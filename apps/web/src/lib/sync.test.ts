import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AppEvent } from "@cdf/shared";
import { db } from "./db.js";
import { hasApplied, projection } from "./store.js";
import { dispatch, settleConflicts } from "./sync.js";

function saleEvent(id: string): AppEvent {
  return {
    id,
    deviceId: "tablette-1",
    clientSeq: 1,
    createdAt: "2026-10-14T19:30:00.000Z",
    type: "sale",
    payload: {
      orderId: id,
      soireeId: "soiree-1",
      registerLabel: "Caisse 1",
      paymentMethod: "cash",
      items: [{ productId: "burger", qty: 1, unitPriceCents: 800 }],
      totalCents: 800,
    },
  };
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await db.outbox.clear();
  await db.log.clear();
  await db.conflicts.clear();
});

describe("dispatch", () => {
  test("enregistre la vente localement puis l'affiche", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    await dispatch(saleEvent(id));

    expect(await db.outbox.get(id)).toBeDefined();
    expect(hasApplied(id)).toBe(true);
  });

  /* Stockage refusé (plein, navigation privée) : la caisse doit le savoir.
     Afficher d'abord donnait un « Encaissé » qui disparaissait au
     rechargement, avec l'argent du client dans la boîte. */
  test("si l'écriture locale échoue, la vente n'est pas affichée et l'appelant le sait", async () => {
    const id = "00000000-0000-4000-8000-000000000002";
    vi.spyOn(db.outbox, "bulkPut").mockRejectedValueOnce(new Error("QuotaExceededError"));

    await expect(dispatch(saleEvent(id))).rejects.toThrow("QuotaExceededError");
    expect(hasApplied(id)).toBe(false);
    expect(await db.log.get(id)).toBeUndefined();
  });
});

describe("conflit d'encaissement de réservation", () => {
  const RESA = "00000000-0000-4000-9000-000000000001";

  function checkin(id: string): AppEvent {
    const ev = saleEvent(id);
    if (ev.type === "sale") ev.payload.reservationId = RESA;
    return ev;
  }

  /* Le serveur a déjà un encaissement payé pour cette réservation : renvoyer
     celui-ci ne changerait rien, mais l'argent a peut-être été reçu. */
  test("le refus sort la vente de l'outbox et de l'écran, et la garde en conflit", async () => {
    const id = "00000000-0000-4000-8000-000000000010";
    await dispatch(checkin(id));
    expect(projection.orders[id]).toBeDefined();

    await settleConflicts({
      acceptedIds: [],
      rejected: [{ id, error: "Déjà encaissée par Caisse 2", code: "conflict" }],
    });

    expect(await db.outbox.get(id)).toBeUndefined();
    expect(await db.log.get(id)).toBeUndefined();
    expect(projection.orders[id]).toBeUndefined();
    expect(await db.conflicts.get(id)).toMatchObject({ error: "Déjà encaissée par Caisse 2" });
  });

  test("un encaissement déjà annulé sur place n'est pas un conflit à trancher", async () => {
    const id = "00000000-0000-4000-8000-000000000011";
    const voidId = "00000000-0000-4000-8000-000000000012";
    await dispatch(checkin(id));
    await dispatch({ ...saleEvent(voidId), type: "order_void", payload: { orderId: id } } as AppEvent);

    await settleConflicts({
      acceptedIds: [],
      rejected: [
        { id, error: "Déjà encaissée", code: "conflict" },
        { id: voidId, error: "PIN administrateur requis" },
      ],
    });

    expect(await db.outbox.count()).toBe(0);
    expect(await db.conflicts.count()).toBe(0);
  });

  test("une autre erreur laisse la vente dans l'outbox", async () => {
    const id = "00000000-0000-4000-8000-000000000013";
    await dispatch(checkin(id));
    await settleConflicts({ acceptedIds: [], rejected: [{ id, error: "base indisponible" }] });
    expect(await db.outbox.get(id)).toBeDefined();
  });
});

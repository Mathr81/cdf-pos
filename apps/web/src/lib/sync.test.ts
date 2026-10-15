import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AppEvent } from "@cdf/shared";
import { db } from "./db.js";
import { hasApplied } from "./store.js";
import { dispatch } from "./sync.js";

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
    vi.spyOn(db.outbox, "put").mockRejectedValueOnce(new Error("QuotaExceededError"));

    await expect(dispatch(saleEvent(id))).rejects.toThrow("QuotaExceededError");
    expect(hasApplied(id)).toBe(false);
    expect(await db.log.get(id)).toBeUndefined();
  });
});

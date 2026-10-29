import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AppEvent } from "@cdf/shared";

const applyEvent = vi.fn();
const findOrderForVoid = vi.fn();
class ConflictError extends Error {
  readonly code = "conflict" as const;
}
vi.mock("./projections.js", () => ({
  applyEvent: (ev: AppEvent) => applyEvent(ev),
  findOrderForVoid: (id: string) => findOrderForVoid(id),
  ConflictError,
}));
vi.mock("./backup/index.js", () => ({ enqueueBackup: async () => {} }));

const { ingestEvents } = await import("./ingest.js");

const io = { emit: vi.fn() } as never;
let n = 0;

function event(type: AppEvent["type"], payload: unknown): AppEvent {
  n++;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    deviceId: "tablette-1",
    clientSeq: n,
    createdAt: "2026-10-14T19:30:00.000Z",
    type,
    payload,
  } as AppEvent;
}

const sale = () =>
  event("sale", {
    orderId: "00000000-0000-4000-8000-00000000abcd",
    soireeId: "s1",
    registerLabel: "Caisse 1",
    paymentMethod: "cash",
    items: [{ productId: "burger", qty: 1, unitPriceCents: 800 }],
    totalCents: 800,
  });
const voidOrder = () =>
  event("order_void", { orderId: "00000000-0000-4000-8000-00000000abcd" });

beforeEach(() => {
  applyEvent.mockReset();
  findOrderForVoid.mockReset();
  findOrderForVoid.mockResolvedValue(null);
  applyEvent.mockImplementation(async (ev: AppEvent) => ({
    applied: true,
    stored: { ...ev, seq: 1, serverReceivedAt: ev.createdAt },
  }));
});

describe("ingestEvents — droits", () => {
  test("un poste sans PIN peut vendre", async () => {
    const ev = sale();
    const ack = await ingestEvents(io, [ev], { isAdmin: false });
    expect(ack.acceptedIds).toEqual([ev.id]);
  });

  /* Le code d'accès est partagé : sans ce contrôle, n'importe quel poste
     peut annuler une vente en espèces déjà encaissée. */
  test("un poste sans PIN ne peut pas annuler une vente", async () => {
    const ev = voidOrder();
    const ack = await ingestEvents(io, [ev], { isAdmin: false });
    expect(ack.acceptedIds).toEqual([]);
    expect(ack.rejected[0]).toMatchObject({ id: ev.id, error: "PIN administrateur requis" });
    expect(applyEvent).not.toHaveBeenCalled();
  });

  test("l'admin peut annuler une vente", async () => {
    const ev = voidOrder();
    const ack = await ingestEvents(io, [ev], { isAdmin: true });
    expect(ack.acceptedIds).toEqual([ev.id]);
  });
});

describe("ingestEvents — ordre", () => {
  /* Deux batchs concurrents ne doivent jamais s'entrelacer : sinon un seq
     plus grand peut être publié avant un plus petit, et un poste rate le
     plus petit pour toujours. */
  test("un second batch attend la fin du premier", async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    applyEvent.mockImplementation(async (ev: AppEvent) => {
      order.push(`start ${ev.clientSeq}`);
      if (order.length === 1) await gate;
      order.push(`end ${ev.clientSeq}`);
      return { applied: false };
    });

    const a = sale();
    const b = sale();
    const first = ingestEvents(io, [a], { isAdmin: false });
    const second = ingestEvents(io, [b], { isAdmin: false });
    await new Promise((r) => setTimeout(r, 10));
    release();
    await Promise.all([first, second]);

    expect(order).toEqual([
      `start ${a.clientSeq}`,
      `end ${a.clientSeq}`,
      `start ${b.clientSeq}`,
      `end ${b.clientSeq}`,
    ]);
  });

  test("un batch qui plante ne bloque pas les suivants", async () => {
    applyEvent.mockRejectedValueOnce(new Error("boum"));
    const a = sale();
    const b = sale();
    const [ackA, ackB] = await Promise.all([
      ingestEvents(io, [a], { isAdmin: false }),
      ingestEvents(io, [b], { isAdmin: false }),
    ]);
    expect(ackA.rejected[0].id).toBe(a.id);
    expect(ackB.acceptedIds).toEqual([b.id]);
  });
});

describe("ingestEvents — réservations", () => {
  /* Deux caisses encaissent la même famille : la seconde doit le savoir,
     et ne pas renvoyer son encaissement en boucle. */
  test("un encaissement en conflit est rejeté avec le code « conflict »", async () => {
    applyEvent.mockRejectedValueOnce(new ConflictError("Déjà encaissée par Caisse 2"));
    const ev = sale();
    const ack = await ingestEvents(io, [ev], { isAdmin: false });
    expect(ack.acceptedIds).toEqual([]);
    expect(ack.rejected).toEqual([{ id: ev.id, error: "Déjà encaissée par Caisse 2", code: "conflict" }]);
  });

  test("une autre erreur n'est pas un conflit", async () => {
    applyEvent.mockRejectedValueOnce(new Error("base indisponible"));
    const ack = await ingestEvents(io, [sale()], { isAdmin: false });
    expect(ack.rejected[0].code).toBeUndefined();
  });

  const resaOrder = {
    reservationId: "00000000-0000-4000-9000-000000000001",
    deviceId: "tablette-1",
    createdAt: "2026-10-14T19:25:00.000Z",
  };

  test("la tablette qui a encaissé une réservation peut annuler dans les 10 min", async () => {
    findOrderForVoid.mockResolvedValue(resaOrder);
    const ev = voidOrder();
    const ack = await ingestEvents(io, [ev], { isAdmin: false });
    expect(ack.acceptedIds).toEqual([ev.id]);
  });

  test("…mais pas une autre tablette, ni au-delà de 10 min", async () => {
    findOrderForVoid.mockResolvedValue({ ...resaOrder, deviceId: "tablette-2" });
    const other = await ingestEvents(io, [voidOrder()], { isAdmin: false });
    expect(other.rejected[0].error).toBe("PIN administrateur requis");

    findOrderForVoid.mockResolvedValue({ ...resaOrder, createdAt: "2026-10-14T19:10:00.000Z" });
    const late = await ingestEvents(io, [voidOrder()], { isAdmin: false });
    expect(late.rejected[0].error).toBe("PIN administrateur requis");
    expect(applyEvent).not.toHaveBeenCalled();
  });
});

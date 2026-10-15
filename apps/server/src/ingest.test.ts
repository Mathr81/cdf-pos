import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AppEvent } from "@cdf/shared";

const applyEvent = vi.fn();
vi.mock("./projections.js", () => ({ applyEvent: (ev: AppEvent) => applyEvent(ev) }));
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

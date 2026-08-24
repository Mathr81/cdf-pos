import { beforeEach, describe, expect, test } from "vitest";
import type { AppEvent } from "@cdf/shared";
import { db } from "./db.js";
import { PendingSalesError, pendingCount, serializeOutbox, wipeLocalData } from "./localData.js";

/** Vente minimale valide, telle qu'une caisse hors ligne en produit. */
function saleEvent(id: string): AppEvent {
  return {
    id,
    deviceId: "tablette-1",
    clientSeq: 1,
    createdAt: "2026-08-24T19:30:00.000Z",
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

async function seedOutbox(...ids: string[]) {
  for (const id of ids) {
    const event = saleEvent(id);
    await db.outbox.put({ id, event, createdAt: Date.now() });
    await db.log.put({ id, seq: null, event });
  }
}

beforeEach(async () => {
  await db.outbox.clear();
  await db.log.clear();
  await db.meta.clear();
});

describe("wipeLocalData", () => {
  test("refuse la purge quand des ventes attendent d'être synchronisées", async () => {
    await seedOutbox("11111111-1111-4111-8111-111111111111");

    await expect(wipeLocalData()).rejects.toThrow(PendingSalesError);
  });

  test("indique combien de ventes sont en attente", async () => {
    await seedOutbox(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    );

    const error = await wipeLocalData().catch((e: unknown) => e);

    expect((error as PendingSalesError).count).toBe(2);
  });

  test("laisse les données intactes après un refus", async () => {
    await seedOutbox("11111111-1111-4111-8111-111111111111");

    await wipeLocalData().catch(() => undefined);

    expect(await db.outbox.count()).toBe(1);
    expect(await db.log.count()).toBe(1);
  });

  test("purge tout quand l'outbox est vide", async () => {
    await db.log.put({
      id: "33333333-3333-4333-8333-333333333333",
      seq: 7,
      event: saleEvent("33333333-3333-4333-8333-333333333333"),
    });
    await db.meta.put({ key: "cursor", value: "7" });

    await wipeLocalData();

    expect(await db.log.count()).toBe(0);
    expect(await db.meta.count()).toBe(0);
  });

  test("purge malgré les ventes en attente quand `force` est demandé", async () => {
    await seedOutbox("11111111-1111-4111-8111-111111111111");

    await wipeLocalData({ force: true });

    expect(await db.outbox.count()).toBe(0);
    expect(await db.log.count()).toBe(0);
  });
});

describe("pendingCount", () => {
  test("compte les événements encore dans l'outbox", async () => {
    await seedOutbox(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    );

    expect(await pendingCount()).toBe(2);
  });
});

describe("serializeOutbox", () => {
  test("produit un JSON contenant les événements rejouables", async () => {
    await seedOutbox("11111111-1111-4111-8111-111111111111");

    const dump = JSON.parse(await serializeOutbox());

    expect(dump.events).toEqual([saleEvent("11111111-1111-4111-8111-111111111111")]);
  });

  test("ordonne les événements par ordre d'émission", async () => {
    const older = saleEvent("11111111-1111-4111-8111-111111111111");
    const newer = saleEvent("22222222-2222-4222-8222-222222222222");
    await db.outbox.put({ id: newer.id, event: newer, createdAt: 2000 });
    await db.outbox.put({ id: older.id, event: older, createdAt: 1000 });

    const dump = JSON.parse(await serializeOutbox());

    expect(dump.events.map((e: AppEvent) => e.id)).toEqual([older.id, newer.id]);
  });
});

import { Prisma } from "@prisma/client";
import type { AppEvent, StoredEvent } from "@cdf/shared";
import { prisma } from "./db.js";

export interface ApplyResult {
  /** true si l'événement vient d'être appliqué (pas un doublon déjà connu). */
  applied: boolean;
  stored?: StoredEvent;
}

type Tx = Prisma.TransactionClient;

/**
 * Applique un événement de façon **idempotente** :
 *  - insère la ligne Event (l'unicité de `id` garantit qu'un doublon est ignoré) ;
 *  - projette les effets de bord dans les tables de vues UNIQUEMENT si l'insert
 *    est nouveau. Le flag `applied` indique s'il faut diffuser / sauvegarder.
 */
export async function applyEvent(ev: AppEvent): Promise<ApplyResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.event.findUnique({ where: { id: ev.id }, select: { id: true } });
    if (existing) return { applied: false };

    const stored = await tx.event.create({
      data: {
        id: ev.id,
        type: ev.type,
        payload: ev.payload as Prisma.InputJsonValue,
        deviceId: ev.deviceId,
        clientSeq: ev.clientSeq,
        createdAt: new Date(ev.createdAt),
      },
      select: { seq: true, serverReceivedAt: true },
    });

    await project(tx, ev);

    return {
      applied: true,
      stored: {
        ...ev,
        seq: stored.seq,
        serverReceivedAt: stored.serverReceivedAt.toISOString(),
      },
    };
  });
}

async function project(tx: Tx, ev: AppEvent): Promise<void> {
  const createdAt = new Date(ev.createdAt);

  switch (ev.type) {
    case "sale": {
      const p = ev.payload;
      // L'Order.id = orderId (UUID client). Si déjà présent, ne rien refaire.
      const already = await tx.order.findUnique({ where: { id: p.orderId }, select: { id: true } });
      if (already) break;
      await tx.order.create({
        data: {
          id: p.orderId,
          createdAt,
          deviceId: ev.deviceId,
          registerLabel: p.registerLabel,
          cashierName: p.cashierName ?? null,
          paymentMethod: p.paymentMethod,
          status: "paid",
          totalCents: p.totalCents,
          cashReceivedCents: p.cashReceivedCents ?? null,
          items: {
            create: p.items.map((it) => ({
              productId: it.productId,
              qty: it.qty,
              unitPriceCents: it.unitPriceCents,
            })),
          },
        },
      });
      break;
    }

    case "order_void": {
      await tx.order.updateMany({
        where: { id: ev.payload.orderId },
        data: { status: "void" },
      });
      break;
    }

    case "stock_adjust": {
      const p = ev.payload;
      await tx.stockMovement.create({
        data: {
          productId: p.productId,
          delta: p.delta,
          reason: p.reason,
          note: p.note ?? null,
          createdAt,
        },
      });
      break;
    }

    case "prepared": {
      const p = ev.payload;
      await tx.prepared.create({
        data: {
          productId: p.productId,
          stationId: p.stationId,
          qty: p.qty,
          createdAt,
        },
      });
      break;
    }

    case "product_upsert": {
      const p = ev.payload;
      // Last-write-wins : n'appliquer que si l'événement est plus récent.
      const current = await tx.product.findUnique({
        where: { id: p.id },
        select: { updatedAt: true },
      });
      if (current && current.updatedAt > createdAt) break;
      const data = {
        name: p.name,
        priceCents: p.priceCents,
        category: p.category ?? "Divers",
        stationId: p.stationId ?? null,
        stockInitial: p.stockInitial ?? 0,
        active: p.active ?? true,
        sortOrder: p.sortOrder ?? 0,
        emoji: p.emoji ?? "🍔",
        color: p.color ?? "#f59e0b",
        updatedAt: createdAt,
      };
      await tx.product.upsert({
        where: { id: p.id },
        update: data,
        create: { id: p.id, ...data },
      });
      break;
    }

    case "product_delete": {
      // Soft-delete : on préserve l'intégrité avec les commandes historiques.
      await tx.product.updateMany({
        where: { id: ev.payload.id },
        data: { active: false, updatedAt: createdAt },
      });
      break;
    }

    case "station_upsert": {
      const p = ev.payload;
      await tx.station.upsert({
        where: { id: p.id },
        update: { name: p.name, sortOrder: p.sortOrder ?? 0 },
        create: { id: p.id, name: p.name, sortOrder: p.sortOrder ?? 0 },
      });
      break;
    }

    case "station_delete": {
      // Détacher les produits de la station avant suppression.
      await tx.product.updateMany({
        where: { stationId: ev.payload.id },
        data: { stationId: null },
      });
      await tx.station.deleteMany({ where: { id: ev.payload.id } });
      break;
    }
  }
}

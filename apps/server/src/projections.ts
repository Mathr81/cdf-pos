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
          soireeId: p.soireeId,
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

    case "order_amend": {
      const p = ev.payload;
      const order = await tx.order.findUnique({ where: { id: p.orderId }, select: { status: true } });
      if (!order || order.status === "void") break;
      await tx.orderItem.deleteMany({ where: { orderId: p.orderId } });
      await tx.order.update({
        where: { id: p.orderId },
        data: {
          totalCents: p.totalCents,
          paymentMethod: p.paymentMethod,
          cashReceivedCents: p.cashReceivedCents ?? null,
          amended: true,
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

    case "stock_adjust": {
      const p = ev.payload;
      await tx.stockMovement.create({
        data: {
          soireeId: p.soireeId,
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
          soireeId: p.soireeId,
          productId: p.productId,
          stationId: p.stationId,
          qty: p.qty,
          createdAt,
        },
      });
      break;
    }

    case "soiree_upsert": {
      const p = ev.payload;
      const current = await tx.soiree.findUnique({ where: { id: p.id }, select: { updatedAt: true } });
      if (current && current.updatedAt > createdAt) break;
      await tx.soiree.upsert({
        where: { id: p.id },
        update: { name: p.name, date: p.date, updatedAt: createdAt },
        create: { id: p.id, name: p.name, date: p.date, updatedAt: createdAt },
      });
      break;
    }

    case "soiree_activate": {
      await tx.soiree.updateMany({ where: { id: ev.payload.soireeId }, data: { status: "open" } });
      await tx.appMeta.upsert({
        where: { key: "activeSoiree" },
        update: { value: ev.payload.soireeId },
        create: { key: "activeSoiree", value: ev.payload.soireeId },
      });
      break;
    }

    case "soiree_close": {
      await tx.soiree.updateMany({ where: { id: ev.payload.soireeId }, data: { status: "closed" } });
      const active = await tx.appMeta.findUnique({ where: { key: "activeSoiree" } });
      if (active?.value === ev.payload.soireeId) {
        await tx.appMeta.update({ where: { key: "activeSoiree" }, data: { value: "" } });
      }
      break;
    }

    case "soiree_delete": {
      await tx.order.deleteMany({ where: { soireeId: ev.payload.soireeId } });
      await tx.stockMovement.deleteMany({ where: { soireeId: ev.payload.soireeId } });
      await tx.prepared.deleteMany({ where: { soireeId: ev.payload.soireeId } });
      await tx.soiree.deleteMany({ where: { id: ev.payload.soireeId } });
      const active = await tx.appMeta.findUnique({ where: { key: "activeSoiree" } });
      if (active?.value === ev.payload.soireeId) {
        await tx.appMeta.update({ where: { key: "activeSoiree" }, data: { value: "" } });
      }
      break;
    }

    // soiree_product_set, preset_upsert, preset_delete : conservés uniquement dans
    // le journal d'événements (projetés côté client), pas de table SQL dédiée.

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
        stockUnlimited: p.stockUnlimited ?? false,
        components: (p.components ?? []) as unknown as Prisma.InputJsonValue,
        active: p.active ?? true,
        sortOrder: p.sortOrder ?? 0,
        emoji: p.emoji ?? "🍔",
        color: p.color ?? "#f59e0b",
        updatedAt: createdAt,
        // `imageKey` absent du payload (poste dont la PWA n'est pas à jour) :
        // on n'écrit rien, l'image existante est conservée. `null` explicite
        // signifie au contraire que l'admin a retiré l'image.
        ...(p.imageKey !== undefined ? { imageKey: p.imageKey } : {}),
        ...(p.imageZoom !== undefined ? { imageZoom: p.imageZoom } : {}),
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

import { randomUUID } from "node:crypto";
import { prisma } from "./db.js";
import { purgeMedia } from "./media.js";

/**
 * ─────────────────────────────────────────────────────────────
 *  Remise à zéro
 * ─────────────────────────────────────────────────────────────
 *  Le journal d'événements est la source de vérité et il est répliqué dans
 *  l'IndexedDB de chaque appareil. Vider la base côté serveur ne suffit donc
 *  pas : les tablettes rejoueraient leur copie locale et « ressusciteraient »
 *  les données effacées.
 *
 *  D'où l'`epoch` : un identifiant de session de données, stocké en base et
 *  annoncé à chaque connexion. Toute remise à zéro en génère un nouveau ; un
 *  client qui voit un epoch différent du sien purge son journal local et
 *  repart de zéro.
 */

const EPOCH_KEY = "epoch";

/** Types d'événements liés à l'exploitation (par opposition à la configuration). */
const OPERATIONAL_EVENT_TYPES = ["sale", "order_void", "order_amend", "stock_adjust", "prepared"];

export type ResetScope =
  /** Efface les ventes / stocks / préparations, garde produits et stations. */
  | "sales"
  /** Efface tout, y compris la carte (produits, stations). */
  | "all";

/** Renvoie l'epoch courant, en le créant au premier appel. */
export async function getEpoch(): Promise<string> {
  const row = await prisma.appMeta.findUnique({ where: { key: EPOCH_KEY } });
  if (row) return row.value;
  const value = randomUUID();
  // upsert plutôt que create : deux démarrages simultanés ne doivent pas planter.
  const created = await prisma.appMeta.upsert({
    where: { key: EPOCH_KEY },
    update: {},
    create: { key: EPOCH_KEY, value },
  });
  return created.value;
}

async function bumpEpoch(): Promise<string> {
  const value = randomUUID();
  await prisma.appMeta.upsert({
    where: { key: EPOCH_KEY },
    update: { value },
    create: { key: EPOCH_KEY, value },
  });
  return value;
}

export interface ResetResult {
  scope: ResetScope;
  /** Nouvel epoch : les appareils qui le reçoivent purgent leur cache local. */
  epoch: string;
  deleted: { events: number; orders: number; stockMovements: number; prepared: number };
  /** Fichiers image supprimés du volume média (scope « all » uniquement). */
  deletedMedia: number;
  keptProducts: number;
}

/**
 * Efface les données puis change l'epoch. L'ordre respecte les clés étrangères
 * (OrderItem est en cascade sur Order ; StockMovement / Prepared / OrderItem
 * référencent Product en RESTRICT).
 */
export async function resetData(scope: ResetScope): Promise<ResetResult> {
  const deleted = await prisma.$transaction(async (tx) => {
    const prepared = await tx.prepared.deleteMany({});
    const stockMovements = await tx.stockMovement.deleteMany({});
    await tx.orderItem.deleteMany({});
    const orders = await tx.order.deleteMany({});
    await tx.backupQueue.deleteMany({});

    // `scope: "sales"` ne retire que les événements d'exploitation : les
    // product_upsert / station_upsert restent pour que la carte survive.
    const events = await tx.event.deleteMany({
      where: scope === "all" ? {} : { type: { in: OPERATIONAL_EVENT_TYPES } },
    });

    if (scope === "all") {
      await tx.product.deleteMany({});
      await tx.station.deleteMany({});
      await tx.soiree.deleteMany({});
      await tx.appMeta.deleteMany({ where: { key: "activeSoiree" } });
    }

    return {
      events: events.count,
      orders: orders.count,
      stockMovements: stockMovements.count,
      prepared: prepared.count,
    };
  });

  // Les images vivent sur disque, hors base : `pg_dump` ne les couvre pas et
  // la transaction ci-dessus ne les supprime pas non plus. Sans ce nettoyage,
  // « l'application repart totalement vide » serait faux et le volume ne ferait
  // que grossir. `scope: "sales"` n'y touche pas, puisque les produits restent.
  const deletedMedia = scope === "all" ? await purgeMedia().catch(() => 0) : 0;

  const epoch = await bumpEpoch();
  const keptProducts = await prisma.product.count();

  return { scope, epoch, deleted, deletedMedia, keptProducts };
}

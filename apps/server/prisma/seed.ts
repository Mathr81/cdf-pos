import { randomUUID } from "node:crypto";
import type { AppEvent } from "@cdf/shared";
import { applyEvent } from "../src/projections.js";
import { prisma } from "../src/db.js";
import { PRODUCTS, STATIONS, type SeedProduct } from "./menu.js";

/**
 * Charge la carte définie dans `menu.ts`. La config est émise sous forme
 * d'ÉVÉNEMENTS pour que le journal reste la source de vérité, y compris pour
 * les clients hors-ligne qui reconstruisent leur état depuis le flux.
 *
 *   pnpm db:seed              → ne fait rien si des produits existent déjà
 *   pnpm db:seed -- --force   → réapplique la carte (écrase les produits de
 *                               même identifiant, garde les autres)
 */

let seq = 0;
const now = () => new Date().toISOString();
const DEVICE = "seed";

function stationEvent(id: string, name: string, sortOrder: number): AppEvent {
  return {
    id: randomUUID(),
    type: "station_upsert",
    deviceId: DEVICE,
    clientSeq: seq++,
    createdAt: now(),
    payload: { id, name, sortOrder },
  };
}

function productEvent(p: SeedProduct, sortOrder: number): AppEvent {
  return {
    id: randomUUID(),
    type: "product_upsert",
    deviceId: DEVICE,
    clientSeq: seq++,
    createdAt: now(),
    payload: {
      id: p.id,
      name: p.name,
      priceCents: p.priceCents,
      category: p.category,
      stationId: p.stationId ?? null,
      stockInitial: p.stockInitial ?? 0,
      stockUnlimited: p.stockUnlimited ?? false,
      components: p.components ?? [],
      active: true,
      sortOrder,
      emoji: p.emoji ?? "🍔",
      color: p.color ?? "#f59e0b",
    },
  };
}

async function main() {
  const force = process.argv.includes("--force");
  const existing = await prisma.product.count();
  if (existing > 0 && !force) {
    // eslint-disable-next-line no-console
    console.log(
      `Seed ignoré : ${existing} produit(s) déjà en base. Relance avec --force pour réappliquer la carte.`,
    );
    return;
  }

  const SOIREE_ID = "demo";
  const wrap = (type: AppEvent["type"], payload: unknown): AppEvent =>
    ({ id: randomUUID(), type, deviceId: DEVICE, clientSeq: seq++, createdAt: now(), payload }) as AppEvent;

  const events: AppEvent[] = [
    ...STATIONS.map((s) => stationEvent(s.id, s.name, s.sortOrder)),
    ...PRODUCTS.map((p, i) => productEvent(p, i)),
    // Soirée de démonstration + carte (tous les produits) + activation.
    wrap("soiree_upsert", { id: SOIREE_ID, name: "Soirée démo", date: new Date().toISOString().slice(0, 10) }),
    ...PRODUCTS.map((p) =>
      wrap("soiree_product_set", {
        soireeId: SOIREE_ID,
        productId: p.id,
        onCarte: true,
        stockInitial: p.stockInitial ?? 0,
        stockUnlimited: p.stockUnlimited ?? false,
        priceOverrideCents: null,
      }),
    ),
    wrap("soiree_activate", { soireeId: SOIREE_ID }),
  ];

  for (const ev of events) {
    await applyEvent(ev);
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seed OK : ${STATIONS.length} stations, ${PRODUCTS.length} produits et 1 soirée démo (active).\n` +
      "⚠️  Vérifie les prix et les stocks dans Admin → Produits avant le service.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

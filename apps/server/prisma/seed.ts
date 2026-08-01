import { randomUUID } from "node:crypto";
import type { AppEvent } from "@cdf/shared";
import { applyEvent } from "../src/projections.js";
import { prisma } from "../src/db.js";

/**
 * Seed de démonstration. La config (stations + produits) est émise sous forme
 * d'ÉVÉNEMENTS pour que le journal reste la source de vérité, y compris pour
 * les clients hors-ligne qui reconstruisent leur état depuis le flux.
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

function productEvent(p: {
  id: string;
  name: string;
  priceCents: number;
  category: string;
  stationId?: string | null;
  stockInitial?: number;
  sortOrder?: number;
  emoji?: string;
  color?: string;
}): AppEvent {
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
      active: true,
      sortOrder: p.sortOrder ?? 0,
      emoji: p.emoji ?? "🍔",
      color: p.color ?? "#f59e0b",
    },
  };
}

async function main() {
  const events: AppEvent[] = [
    stationEvent("grill", "Grill", 0),
    stationEvent("friteuse", "Friteuse", 1),
    stationEvent("boissons", "Boissons", 2),

    productEvent({ id: "burger", name: "Burger", priceCents: 500, category: "Plats", stationId: "grill", stockInitial: 120, sortOrder: 0, emoji: "🍔", color: "#f59e0b" }),
    productEvent({ id: "cheeseburger", name: "Cheeseburger", priceCents: 600, category: "Plats", stationId: "grill", stockInitial: 120, sortOrder: 1, emoji: "🧀", color: "#eab308" }),
    productEvent({ id: "hotdog", name: "Hot-dog", priceCents: 400, category: "Plats", stationId: "grill", stockInitial: 80, sortOrder: 2, emoji: "🌭", color: "#f97316" }),
    productEvent({ id: "frites", name: "Frites", priceCents: 300, category: "Accompagnements", stationId: "friteuse", stockInitial: 200, sortOrder: 3, emoji: "🍟", color: "#facc15" }),
    productEvent({ id: "soda", name: "Soda 33cl", priceCents: 200, category: "Boissons", stationId: "boissons", stockInitial: 200, sortOrder: 4, emoji: "🥤", color: "#3b82f6" }),
    productEvent({ id: "eau", name: "Eau 50cl", priceCents: 100, category: "Boissons", stationId: "boissons", stockInitial: 200, sortOrder: 5, emoji: "💧", color: "#38bdf8" }),
    productEvent({ id: "biere", name: "Bière 25cl", priceCents: 350, category: "Boissons", stationId: "boissons", stockInitial: 150, sortOrder: 6, emoji: "🍺", color: "#d97706" }),
    productEvent({ id: "cafe", name: "Café", priceCents: 150, category: "Boissons", stationId: "boissons", stockInitial: 100, sortOrder: 7, emoji: "☕", color: "#78350f" }),
    productEvent({ id: "crepe", name: "Crêpe sucre", priceCents: 250, category: "Desserts", stationId: null, stockInitial: 100, sortOrder: 8, emoji: "🥞", color: "#ec4899" }),
  ];

  for (const ev of events) {
    await applyEvent(ev);
  }

  // eslint-disable-next-line no-console
  console.log(`Seed OK : ${events.length} événements de configuration appliqués.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

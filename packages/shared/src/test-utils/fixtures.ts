import type { AppEvent, PaymentMethod, SaleItem } from "../events.js";
import { emptyProjection, reduceEvent, type ProjectionState } from "../projection.js";

/**
 * Fabriques d'événements pour les tests.
 *
 * Les identifiants sont dérivés d'un compteur plutôt qu'aléatoires : un test
 * qui échoue doit être lisible et reproductible. Les UUID sont syntaxiquement
 * valides parce que `EventSchema` les valide en production.
 */

/** Événement de la union restreint à un `type` — rend le payload accessible. */
type EventOf<T extends AppEvent["type"]> = Extract<AppEvent, { type: T }>;

let counter = 0;

/** Remet le compteur à zéro — à appeler dans un `beforeEach`. */
export function resetIds(): void {
  counter = 0;
}

export function uuid(): string {
  counter += 1;
  const n = String(counter).padStart(12, "0");
  return `00000000-0000-4000-8000-${n}`;
}

function meta(createdAt: string) {
  return { id: uuid(), deviceId: "device-test", clientSeq: counter, createdAt };
}

export const SOIREE = "soiree-test";

/** Horodatage court : `at("20:30")` → le 24 août 2026 à 20h30 locales. */
export function at(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2026, 7, 24, h, m, 0).toISOString();
}

export function sale(opts: {
  items: SaleItem[];
  totalCents?: number;
  orderId?: string;
  paymentMethod?: PaymentMethod;
  registerLabel?: string;
  cashierName?: string;
  createdAt?: string;
  soireeId?: string;
}): EventOf<"sale"> {
  const total = opts.totalCents ?? opts.items.reduce((a, it) => a + it.qty * it.unitPriceCents, 0);
  return {
    ...meta(opts.createdAt ?? at("20:00")),
    type: "sale",
    payload: {
      orderId: opts.orderId ?? uuid(),
      soireeId: opts.soireeId ?? SOIREE,
      registerLabel: opts.registerLabel ?? "Caisse 1",
      cashierName: opts.cashierName,
      paymentMethod: opts.paymentMethod ?? "cash",
      items: opts.items,
      totalCents: total,
    },
  };
}

export function voidOrder(orderId: string, createdAt = at("21:00")): EventOf<"order_void"> {
  return { ...meta(createdAt), type: "order_void", payload: { orderId } };
}

export function amend(
  orderId: string,
  items: SaleItem[],
  opts: { paymentMethod?: PaymentMethod; createdAt?: string } = {},
): EventOf<"order_amend"> {
  return {
    ...meta(opts.createdAt ?? at("21:00")),
    type: "order_amend",
    payload: {
      orderId,
      items,
      totalCents: items.reduce((a, it) => a + it.qty * it.unitPriceCents, 0),
      paymentMethod: opts.paymentMethod ?? "cash",
    },
  };
}

export function product(
  id: string,
  over: Partial<{
    name: string;
    priceCents: number;
    stockInitial: number;
    stockUnlimited: boolean;
    components: { productId: string; qty: number }[];
    stationId: string | null;
    sortOrder: number;
    createdAt: string;
  }> = {},
): EventOf<"product_upsert"> {
  return {
    ...meta(over.createdAt ?? at("10:00")),
    type: "product_upsert",
    payload: {
      id,
      name: over.name ?? id,
      priceCents: over.priceCents ?? 500,
      stockInitial: over.stockInitial ?? 0,
      stockUnlimited: over.stockUnlimited ?? false,
      components: over.components ?? [],
      stationId: over.stationId ?? null,
      sortOrder: over.sortOrder ?? 0,
      // `z.infer` rend obligatoires les champs à `.default()` : ce sont des
      // valeurs de sortie, pas d'entrée.
      category: "Divers",
      active: true,
      emoji: "🍔",
      color: "#f59e0b",
    },
  };
}

export function soiree(id = SOIREE, name = "Soirée test", date = "2026-08-24"): EventOf<"soiree_upsert"> {
  return { ...meta(at("09:00")), type: "soiree_upsert", payload: { id, name, date } };
}

export function activate(soireeId = SOIREE): EventOf<"soiree_activate"> {
  return { ...meta(at("09:01")), type: "soiree_activate", payload: { soireeId } };
}

/** Met un produit sur la carte d'une soirée, avec stock et prix effectifs. */
export function onCarte(
  productId: string,
  over: Partial<{
    soireeId: string;
    stockInitial: number;
    stockUnlimited: boolean;
    priceOverrideCents: number | null;
    onCarte: boolean;
    createdAt: string;
  }> = {},
): EventOf<"soiree_product_set"> {
  return {
    ...meta(over.createdAt ?? at("10:30")),
    type: "soiree_product_set",
    payload: {
      soireeId: over.soireeId ?? SOIREE,
      productId,
      onCarte: over.onCarte ?? true,
      stockInitial: over.stockInitial ?? 0,
      stockUnlimited: over.stockUnlimited ?? false,
      priceOverrideCents: over.priceOverrideCents ?? null,
    },
  };
}

export function stockAdjust(
  productId: string,
  delta: number,
  reason: "restock" | "spoilage" | "correction" = "restock",
): EventOf<"stock_adjust"> {
  return {
    ...meta(at("20:15")),
    type: "stock_adjust",
    payload: { soireeId: SOIREE, productId, delta, reason },
  };
}

export function cashOpen(
  registerLabel: string,
  floatCents: number,
  over: { soireeId?: string; createdAt?: string } = {},
): EventOf<"cash_open"> {
  return {
    ...meta(over.createdAt ?? at("19:00")),
    type: "cash_open",
    payload: { soireeId: over.soireeId ?? SOIREE, registerLabel, floatCents },
  };
}

export function cashCount(
  registerLabel: string,
  countedCents: number,
  over: { soireeId?: string; createdAt?: string; note?: string } = {},
): EventOf<"cash_count"> {
  return {
    ...meta(over.createdAt ?? at("23:30")),
    type: "cash_count",
    payload: {
      soireeId: over.soireeId ?? SOIREE,
      registerLabel,
      countedCents,
      note: over.note,
    },
  };
}

export function prepared(productId: string, qty: number, stationId = "grill"): EventOf<"prepared"> {
  return {
    ...meta(at("20:20")),
    type: "prepared",
    payload: { soireeId: SOIREE, productId, stationId, qty },
  };
}

/** Rejoue une liste d'événements sur une projection neuve. */
export function replay(...events: AppEvent[]): ProjectionState {
  const state = emptyProjection();
  for (const ev of events) reduceEvent(state, ev);
  return state;
}

import type { AppEvent, PaymentMethod, ProductComponent } from "./events.js";

/**
 * ─────────────────────────────────────────────────────────────
 *  Projection en mémoire (utilisée côté client)
 * ─────────────────────────────────────────────────────────────
 *  Réducteur PUR qui reconstruit l'état courant à partir du flux
 *  d'événements. Le serveur, lui, projette via SQL (perf requêtes),
 *  mais la logique métier est identique — d'où ce module partagé.
 *
 *  Hypothèse : chaque événement est appliqué EXACTEMENT une fois
 *  (la couche de synchro déduplique par `id` avant d'appeler reduce).
 */

export interface ClientProduct {
  id: string;
  name: string;
  priceCents: number;
  category: string;
  stationId: string | null;
  stockInitial: number;
  /** true = pas de stock à suivre (le produit n'est jamais « épuisé »). */
  stockUnlimited: boolean;
  /** Produits contenus dans celui-ci (ex. « Burger Frites » → 1 « Frites »). */
  components: ProductComponent[];
  active: boolean;
  sortOrder: number;
  emoji: string;
  color: string;
}

export interface ClientStation {
  id: string;
  name: string;
  sortOrder: number;
}

export interface ClientOrder {
  id: string;
  createdAt: string;
  registerLabel: string;
  paymentMethod: PaymentMethod;
  status: "paid" | "void";
  totalCents: number;
  items: { productId: string; qty: number; unitPriceCents: number }[];
}

export interface ProjectionState {
  products: Record<string, ClientProduct>;
  stations: Record<string, ClientStation>;
  /** productId → quantité vendue (commandes payées). */
  sold: Record<string, number>;
  /** productId → quantité préparée en cuisine. */
  prepared: Record<string, number>;
  /** productId → somme des ajustements manuels de stock. */
  adjustments: Record<string, number>;
  orders: Record<string, ClientOrder>;
  /** productId → timestamp (ms) du dernier product_upsert appliqué (LWW). */
  productUpdatedAt: Record<string, number>;
}

export function emptyProjection(): ProjectionState {
  return {
    products: {},
    stations: {},
    sold: {},
    prepared: {},
    adjustments: {},
    orders: {},
    productUpdatedAt: {},
  };
}

const add = (map: Record<string, number>, key: string, delta: number) => {
  map[key] = (map[key] ?? 0) + delta;
};

/** Applique un événement à l'état (mutation en place). */
export function reduceEvent(state: ProjectionState, ev: AppEvent): void {
  switch (ev.type) {
    case "sale": {
      const p = ev.payload;
      if (state.orders[p.orderId]) break; // déjà comptabilisé
      state.orders[p.orderId] = {
        id: p.orderId,
        createdAt: ev.createdAt,
        registerLabel: p.registerLabel,
        paymentMethod: p.paymentMethod,
        status: "paid",
        totalCents: p.totalCents,
        items: p.items.map((it) => ({ ...it })),
      };
      for (const it of p.items) add(state.sold, it.productId, it.qty);
      break;
    }
    case "order_void": {
      const order = state.orders[ev.payload.orderId];
      if (!order || order.status === "void") break;
      order.status = "void";
      for (const it of order.items) add(state.sold, it.productId, -it.qty);
      break;
    }
    case "stock_adjust":
      add(state.adjustments, ev.payload.productId, ev.payload.delta);
      break;
    case "prepared":
      add(state.prepared, ev.payload.productId, ev.payload.qty);
      break;
    case "product_upsert": {
      const p = ev.payload;
      const ts = Date.parse(ev.createdAt);
      if ((state.productUpdatedAt[p.id] ?? 0) > ts) break; // last-write-wins
      state.productUpdatedAt[p.id] = ts;
      state.products[p.id] = {
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        category: p.category ?? "Divers",
        stationId: p.stationId ?? null,
        stockInitial: p.stockInitial ?? 0,
        stockUnlimited: p.stockUnlimited ?? false,
        components: p.components ?? [],
        active: p.active ?? true,
        sortOrder: p.sortOrder ?? 0,
        emoji: p.emoji ?? "🍔",
        color: p.color ?? "#f59e0b",
      };
      break;
    }
    case "product_delete": {
      const prod = state.products[ev.payload.id];
      if (prod) prod.active = false;
      break;
    }
    case "station_upsert": {
      const p = ev.payload;
      state.stations[p.id] = { id: p.id, name: p.name, sortOrder: p.sortOrder ?? 0 };
      break;
    }
    case "station_delete": {
      delete state.stations[ev.payload.id];
      for (const prod of Object.values(state.products)) {
        if (prod.stationId === ev.payload.id) prod.stationId = null;
      }
      break;
    }
  }
}

// ─── Sélecteurs dérivés ──────────────────────────────────────

/**
 * Quantité vendue « réelle » d'un produit : ses ventes directes PLUS celles
 * générées par les plats qui le contiennent (3 « Burger Frites » vendus =
 * 3 barquettes de frites à sortir, même si personne n'a acheté de frites seules).
 * Un seul niveau de composition est développé.
 */
export function soldWithComponents(state: ProjectionState, productId: string): number {
  let total = state.sold[productId] ?? 0;
  for (const parent of Object.values(state.products)) {
    if (parent.id === productId) continue;
    const parentSold = state.sold[parent.id] ?? 0;
    if (parentSold === 0) continue;
    for (const c of parent.components) {
      if (c.productId === productId) total += parentSold * c.qty;
    }
  }
  return total;
}

/** Part des ventes d'un produit qui provient des plats qui le contiennent. */
export function soldFromComponents(state: ProjectionState, productId: string): number {
  return soldWithComponents(state, productId) - (state.sold[productId] ?? 0);
}

/**
 * Stock restant, ou `null` quand le produit est en stock illimité
 * (les appelants affichent alors « ∞ » plutôt qu'un nombre trompeur).
 */
export function stockRemaining(state: ProjectionState, productId: string): number | null {
  const p = state.products[productId];
  if (!p) return 0;
  if (p.stockUnlimited) return null;
  return (
    p.stockInitial + (state.adjustments[productId] ?? 0) - soldWithComponents(state, productId)
  );
}

export function toPrepare(state: ProjectionState, productId: string): number {
  return Math.max(0, soldWithComponents(state, productId) - (state.prepared[productId] ?? 0));
}

export function sortedProducts(state: ProjectionState): ClientProduct[] {
  return Object.values(state.products).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
}

export function sortedStations(state: ProjectionState): ClientStation[] {
  return Object.values(state.stations).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
}

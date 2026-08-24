import type { AppEvent, PaymentMethod, PresetItem, ProductComponent } from "./events.js";

/**
 * ─────────────────────────────────────────────────────────────
 *  Projection en mémoire (utilisée côté client)
 * ─────────────────────────────────────────────────────────────
 *  Réducteur PUR qui reconstruit l'état courant à partir du flux
 *  d'événements. Le serveur, lui, projette via SQL, mais la logique
 *  métier est identique — d'où ce module partagé.
 *
 *  Les ventes, stocks et préparations sont **scopés par soirée**.
 *  Le catalogue de produits et les stations sont **globaux** ; chaque
 *  soirée choisit une carte (sous-ensemble de produits) avec son propre
 *  stock initial et éventuellement un prix propre.
 *
 *  Hypothèse : chaque événement est appliqué EXACTEMENT une fois
 *  (la couche de synchro déduplique par `id` avant d'appeler reduce).
 */

export interface ClientProduct {
  id: string;
  name: string;
  /** Prix catalogue par défaut (une soirée peut le surcharger). */
  priceCents: number;
  category: string;
  stationId: string | null;
  /** Stock initial par défaut (repris à l'ajout dans une carte). */
  stockInitial: number;
  stockUnlimited: boolean;
  /** Produits contenus dans celui-ci (ex. « Burger Frites » → 1 « Frites »). */
  components: ProductComponent[];
  active: boolean;
  sortOrder: number;
  emoji: string;
  color: string;
  /**
   * Nom de fichier de l'image personnalisée ("<hash32>.webp"), ou null.
   * L'icône `emoji` reste renseignée : elle sert de repli quand l'image n'est
   * pas encore en cache local (poste hors ligne qui n'a jamais vu ce produit).
   */
  imageKey: string | null;
}

export interface ClientStation {
  id: string;
  name: string;
  sortOrder: number;
}

export interface ClientSoiree {
  id: string;
  name: string;
  date: string;
  status: "open" | "closed";
  createdAt: string;
}

export interface ClientPreset {
  id: string;
  name: string;
  items: PresetItem[];
}

/** Configuration d'un produit dans la carte d'une soirée. */
export interface SoireeProductConfig {
  onCarte: boolean;
  stockInitial: number;
  stockUnlimited: boolean;
  priceOverrideCents: number | null;
}

export interface ClientOrder {
  id: string;
  soireeId: string;
  createdAt: string;
  registerLabel: string;
  cashierName?: string;
  paymentMethod: PaymentMethod;
  status: "paid" | "void";
  totalCents: number;
  cashReceivedCents?: number;
  items: { productId: string; qty: number; unitPriceCents: number }[];
  /** true si la commande a été modifiée après coup. */
  amended?: boolean;
}

/** Compteurs imbriqués : soireeId → productId → nombre. */
type NestedCount = Record<string, Record<string, number>>;

export interface ProjectionState {
  soirees: Record<string, ClientSoiree>;
  activeSoireeId: string | null;
  products: Record<string, ClientProduct>;
  stations: Record<string, ClientStation>;
  presets: Record<string, ClientPreset>;
  /** soireeId → productId → config carte. */
  carte: Record<string, Record<string, SoireeProductConfig>>;
  /** soireeId → productId → quantité vendue (commandes payées). */
  sold: NestedCount;
  /** soireeId → productId → quantité préparée en cuisine. */
  prepared: NestedCount;
  /** soireeId → productId → somme des ajustements manuels de stock. */
  adjustments: NestedCount;
  orders: Record<string, ClientOrder>;
  // Horodatages pour le last-write-wins.
  productUpdatedAt: Record<string, number>;
  soireeUpdatedAt: Record<string, number>;
  presetUpdatedAt: Record<string, number>;
  carteUpdatedAt: Record<string, number>; // clé "soireeId:productId"
}

export function emptyProjection(): ProjectionState {
  return {
    soirees: {},
    activeSoireeId: null,
    products: {},
    stations: {},
    presets: {},
    carte: {},
    sold: {},
    prepared: {},
    adjustments: {},
    orders: {},
    productUpdatedAt: {},
    soireeUpdatedAt: {},
    presetUpdatedAt: {},
    carteUpdatedAt: {},
  };
}

function addNested(map: NestedCount, soireeId: string, productId: string, delta: number) {
  const inner = (map[soireeId] ??= {});
  inner[productId] = (inner[productId] ?? 0) + delta;
}

function getNested(map: NestedCount, soireeId: string, productId: string): number {
  return map[soireeId]?.[productId] ?? 0;
}

/** Applique un événement à l'état (mutation en place). */
export function reduceEvent(state: ProjectionState, ev: AppEvent): void {
  const ts = Date.parse(ev.createdAt);
  switch (ev.type) {
    case "sale": {
      const p = ev.payload;
      if (state.orders[p.orderId]) break; // déjà comptabilisé
      state.orders[p.orderId] = {
        id: p.orderId,
        soireeId: p.soireeId,
        createdAt: ev.createdAt,
        registerLabel: p.registerLabel,
        cashierName: p.cashierName,
        paymentMethod: p.paymentMethod,
        status: "paid",
        totalCents: p.totalCents,
        cashReceivedCents: p.cashReceivedCents,
        items: p.items.map((it) => ({ ...it })),
      };
      for (const it of p.items) addNested(state.sold, p.soireeId, it.productId, it.qty);
      break;
    }
    case "order_void": {
      const order = state.orders[ev.payload.orderId];
      if (!order || order.status === "void") break;
      order.status = "void";
      for (const it of order.items) addNested(state.sold, order.soireeId, it.productId, -it.qty);
      break;
    }
    case "order_amend": {
      const order = state.orders[ev.payload.orderId];
      if (!order || order.status === "void") break;
      // Retire les anciennes lignes, applique les nouvelles (delta sur `sold`).
      for (const it of order.items) addNested(state.sold, order.soireeId, it.productId, -it.qty);
      const p = ev.payload;
      for (const it of p.items) addNested(state.sold, order.soireeId, it.productId, it.qty);
      order.items = p.items.map((it) => ({ ...it }));
      order.totalCents = p.totalCents;
      order.paymentMethod = p.paymentMethod;
      order.cashReceivedCents = p.cashReceivedCents;
      order.amended = true;
      break;
    }
    case "stock_adjust":
      addNested(state.adjustments, ev.payload.soireeId, ev.payload.productId, ev.payload.delta);
      break;
    case "prepared":
      addNested(state.prepared, ev.payload.soireeId, ev.payload.productId, ev.payload.qty);
      break;
    case "product_upsert": {
      const p = ev.payload;
      if ((state.productUpdatedAt[p.id] ?? 0) > ts) break; // last-write-wins
      state.productUpdatedAt[p.id] = ts;
      // `imageKey` absent du payload = poste dont la PWA n'est pas à jour :
      // on conserve l'image déjà connue plutôt que de l'effacer.
      const previousImage = state.products[p.id]?.imageKey ?? null;
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
        imageKey: p.imageKey !== undefined ? p.imageKey : previousImage,
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
    case "soiree_upsert": {
      const p = ev.payload;
      if ((state.soireeUpdatedAt[p.id] ?? 0) > ts) break;
      state.soireeUpdatedAt[p.id] = ts;
      const existing = state.soirees[p.id];
      state.soirees[p.id] = {
        id: p.id,
        name: p.name,
        date: p.date,
        status: existing?.status ?? "open",
        createdAt: existing?.createdAt ?? ev.createdAt,
      };
      break;
    }
    case "soiree_activate": {
      state.activeSoireeId = ev.payload.soireeId;
      const s = state.soirees[ev.payload.soireeId];
      if (s) s.status = "open";
      break;
    }
    case "soiree_close": {
      const s = state.soirees[ev.payload.soireeId];
      if (s) s.status = "closed";
      if (state.activeSoireeId === ev.payload.soireeId) state.activeSoireeId = null;
      break;
    }
    case "soiree_delete": {
      const id = ev.payload.soireeId;
      delete state.soirees[id];
      delete state.carte[id];
      delete state.sold[id];
      delete state.prepared[id];
      delete state.adjustments[id];
      if (state.activeSoireeId === id) state.activeSoireeId = null;
      for (const o of Object.values(state.orders)) {
        if (o.soireeId === id) delete state.orders[o.id];
      }
      break;
    }
    case "soiree_product_set": {
      const p = ev.payload;
      const key = `${p.soireeId}:${p.productId}`;
      if ((state.carteUpdatedAt[key] ?? 0) > ts) break;
      state.carteUpdatedAt[key] = ts;
      const inner = (state.carte[p.soireeId] ??= {});
      inner[p.productId] = {
        onCarte: p.onCarte,
        stockInitial: p.stockInitial ?? 0,
        stockUnlimited: p.stockUnlimited ?? false,
        priceOverrideCents: p.priceOverrideCents ?? null,
      };
      break;
    }
    case "preset_upsert": {
      const p = ev.payload;
      if ((state.presetUpdatedAt[p.id] ?? 0) > ts) break;
      state.presetUpdatedAt[p.id] = ts;
      state.presets[p.id] = { id: p.id, name: p.name, items: p.items ?? [] };
      break;
    }
    case "preset_delete": {
      delete state.presets[ev.payload.id];
      break;
    }
  }
}

// ─── Sélecteurs dérivés ──────────────────────────────────────

export function activeSoiree(state: ProjectionState): ClientSoiree | null {
  return state.activeSoireeId ? (state.soirees[state.activeSoireeId] ?? null) : null;
}

export function sortedSoirees(state: ProjectionState): ClientSoiree[] {
  return Object.values(state.soirees).sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
}

export function sortedPresets(state: ProjectionState): ClientPreset[] {
  return Object.values(state.presets).sort((a, b) => a.name.localeCompare(b.name));
}

/** Config carte d'un produit pour une soirée (ou undefined si non configuré). */
export function carteConfig(
  state: ProjectionState,
  soireeId: string,
  productId: string,
): SoireeProductConfig | undefined {
  return state.carte[soireeId]?.[productId];
}

/** Prix effectif d'un produit dans une soirée (override sinon prix catalogue). */
export function effectivePrice(state: ProjectionState, soireeId: string, productId: string): number {
  const cfg = carteConfig(state, soireeId, productId);
  if (cfg && cfg.priceOverrideCents != null) return cfg.priceOverrideCents;
  return state.products[productId]?.priceCents ?? 0;
}

export interface CarteEntry {
  product: ClientProduct;
  priceCents: number;
  stockInitial: number;
  stockUnlimited: boolean;
}

/** Produits présents sur la carte d'une soirée (triés), avec prix/stock effectifs. */
export function soireeCarte(state: ProjectionState, soireeId: string): CarteEntry[] {
  const configs = state.carte[soireeId] ?? {};
  const entries: CarteEntry[] = [];
  for (const [productId, cfg] of Object.entries(configs)) {
    if (!cfg.onCarte) continue;
    const product = state.products[productId];
    if (!product || !product.active) continue;
    entries.push({
      product,
      priceCents: cfg.priceOverrideCents ?? product.priceCents,
      stockInitial: cfg.stockInitial,
      stockUnlimited: cfg.stockUnlimited,
    });
  }
  return entries.sort(
    (a, b) => a.product.sortOrder - b.product.sortOrder || a.product.name.localeCompare(b.product.name),
  );
}

/**
 * Quantité vendue « réelle » d'un produit dans une soirée : ventes directes
 * PLUS celles générées par les plats qui le contiennent (composition, 1 niveau).
 */
export function soldWithComponents(
  state: ProjectionState,
  soireeId: string,
  productId: string,
): number {
  let total = getNested(state.sold, soireeId, productId);
  for (const parent of Object.values(state.products)) {
    if (parent.id === productId || parent.components.length === 0) continue;
    const parentSold = getNested(state.sold, soireeId, parent.id);
    if (parentSold === 0) continue;
    for (const c of parent.components) {
      if (c.productId === productId) total += parentSold * c.qty;
    }
  }
  return total;
}

/** Part des ventes d'un produit qui provient des plats qui le contiennent. */
export function soldFromComponents(
  state: ProjectionState,
  soireeId: string,
  productId: string,
): number {
  return soldWithComponents(state, soireeId, productId) - getNested(state.sold, soireeId, productId);
}

/**
 * Stock restant dans une soirée, ou `null` si illimité / non suivi
 * (les appelants affichent alors « ∞ »).
 */
export function stockRemaining(
  state: ProjectionState,
  soireeId: string,
  productId: string,
): number | null {
  const cfg = carteConfig(state, soireeId, productId);
  if (!cfg || cfg.stockUnlimited) return null;
  return (
    cfg.stockInitial +
    getNested(state.adjustments, soireeId, productId) -
    soldWithComponents(state, soireeId, productId)
  );
}

export function toPrepare(state: ProjectionState, soireeId: string, productId: string): number {
  return Math.max(
    0,
    soldWithComponents(state, soireeId, productId) - getNested(state.prepared, soireeId, productId),
  );
}

export function soldDirect(state: ProjectionState, soireeId: string, productId: string): number {
  return getNested(state.sold, soireeId, productId);
}

export function preparedCount(state: ProjectionState, soireeId: string, productId: string): number {
  return getNested(state.prepared, soireeId, productId);
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

/** Commandes payées d'une soirée, triées par date. */
export function soireeOrders(state: ProjectionState, soireeId: string): ClientOrder[] {
  return Object.values(state.orders)
    .filter((o) => o.soireeId === soireeId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

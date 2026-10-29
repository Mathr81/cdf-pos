import {
  BOOKING_ADULT_ID,
  BOOKING_CHILD_ID,
  carteConfig,
  effectivePrice,
  soireeCarte,
  type ClientOrder,
  type ProjectionState,
} from "./projection.js";
import type { SaleItem } from "./events.js";

/**
 * ─────────────────────────────────────────────────────────────
 *  Soirées sur réservation
 * ─────────────────────────────────────────────────────────────
 *  Une soirée sur réservation est une soirée ordinaire qui a des tarifs
 *  (`booking_tariffs_set`). Chaque tarif est un produit, hors grille de
 *  caisse. Un encaissement est une vente ordinaire portant un
 *  `reservationId` : stats, récap et comptage de caisse le voient sans rien
 *  savoir des réservations.
 */

/** Fenêtre pendant laquelle la tablette qui a encaissé peut annuler sans PIN. */
export const SELF_VOID_WINDOW_MS = 10 * 60 * 1000;

/** Personnes par tarif : productId → nombre. */
export type Counts = Record<string, number>;

export interface Tariff {
  productId: string;
  name: string;
  priceCents: number;
}

/**
 * Tarifs de la soirée, dans l'ordre réglé par l'admin. Avant
 * `booking_tariffs_set`, une soirée sur réservation se reconnaissait à la
 * config carte de « resa-adulte » : on relit ce format tel quel.
 */
export function bookingTariffs(state: ProjectionState, soireeId: string): Tariff[] {
  const list =
    state.bookingTariffs[soireeId] ??
    (carteConfig(state, soireeId, BOOKING_ADULT_ID)
      ? [BOOKING_ADULT_ID, BOOKING_CHILD_ID].map((productId) => ({
          productId,
          priceCents: effectivePrice(state, soireeId, productId),
        }))
      : []);
  return list.map((t) => ({ ...t, name: state.products[t.productId]?.name ?? t.productId }));
}

export function isBookingSoiree(state: ProjectionState, soireeId: string): boolean {
  return bookingTariffs(state, soireeId).length > 0;
}

/**
 * Soirée sur réservation sans rien d'autre à vendre (carte vide) : la
 * caisse, la cuisine et le stock n'ont alors rien à montrer.
 */
export function isReservationsOnly(state: ProjectionState, soireeId: string): boolean {
  return isBookingSoiree(state, soireeId) && soireeCarte(state, soireeId).length === 0;
}

export function countTotal(counts: Counts): number {
  return Object.values(counts).reduce((s, n) => s + n, 0);
}

/** Lignes de vente pour ces personnes ; les quantités nulles sont omises (le schéma les refuse). */
export function bookingItems(tariffs: Tariff[], counts: Counts): SaleItem[] {
  return tariffs
    .filter((t) => (counts[t.productId] ?? 0) > 0)
    .map((t) => ({ productId: t.productId, qty: counts[t.productId], unitPriceCents: t.priceCents }));
}

export function itemsTotal(items: SaleItem[]): number {
  return items.reduce((s, it) => s + it.qty * it.unitPriceCents, 0);
}

/** Personnes réellement présentes pour une commande : `heads` si donné, sinon ses lignes. */
export function orderHeads(order: ClientOrder): Counts {
  if (order.heads) return order.heads;
  const c: Counts = {};
  for (const it of order.items) c[it.productId] = (c[it.productId] ?? 0) + it.qty;
  return c;
}

/** Personnes arrivées pour une réservation, toutes vagues comprises. */
export function arrivedHeads(row: { order: ClientOrder | null; supplements: ClientOrder[] }): Counts {
  const c: Counts = {};
  for (const o of row.order ? [row.order, ...row.supplements] : [])
    for (const [id, n] of Object.entries(orderHeads(o))) c[id] = (c[id] ?? 0) + n;
  return c;
}

export interface ReservationRow {
  /** = reservationId (réservation importée ou sur-place). */
  id: string;
  name: string;
  phone?: string;
  table?: string;
  note?: string;
  prepaid: boolean;
  /** Prévu à la réservation ; vide pour un sur-place. */
  counts: Counts;
  walkIn: boolean;
  /** Arrivé en partie et déclaré complet : on n'attend plus les absents. */
  complete: boolean;
  /** Arrivée : encaissement (ou pointage d'une réservation payée d'avance) en cours. */
  order: ClientOrder | null;
  /**
   * Ventes rattachées à l'arrivée : supplément d'un payé d'avance (plus de
   * monde que prévu), ou vagues suivantes d'un groupe qui arrive en plusieurs fois.
   */
  supplements: ClientOrder[];
}

/** Réservations de la soirée et sur-place, triées par nom. */
export function reservationRows(state: ProjectionState, soireeId: string): ReservationRow[] {
  const paid = new Map<string, ClientOrder>();
  const supplements = new Map<string, ClientOrder[]>();
  const walkIns: ClientOrder[] = [];
  for (const o of Object.values(state.orders)) {
    if (o.soireeId !== soireeId || !o.reservationId || o.status !== "paid") continue;
    if (o.supplementOf) {
      supplements.set(o.supplementOf, [...(supplements.get(o.supplementOf) ?? []), o]);
      continue;
    }
    paid.set(o.reservationId, o);
    if (!state.reservations[o.reservationId]) walkIns.push(o);
  }
  const rows: ReservationRow[] = Object.values(state.reservations)
    .filter((r) => r.soireeId === soireeId)
    .map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      table: r.table,
      note: r.note,
      prepaid: r.prepaid,
      counts: r.counts,
      walkIn: false,
      complete: state.reservationComplete[r.id] ?? false,
      order: paid.get(r.id) ?? null,
      supplements: supplements.get(r.id) ?? [],
    }));
  for (const o of walkIns) {
    rows.push({
      id: o.reservationId!,
      name: o.guestName || "Sur place",
      prepaid: false,
      counts: {},
      walkIn: true,
      complete: false,
      order: o,
      supplements: [],
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export interface BookingDashboard {
  /** Personnes prévues dans les réservations (hors sur-place). */
  expected: number;
  /** Personnes arrivées, sur-place compris. */
  arrived: number;
  arrivedWalkIn: number;
  /** Personnes réservées pas encore arrivées. */
  remaining: number;
  /** Par tarif : prévues et arrivées (sur-place compris). */
  byTariff: Record<string, { expected: number; arrived: number }>;
  reservations: number;
  reservationsArrived: number;
  /** Argent reçu ce soir (hors « offert » et « payé d'avance »), par moyen de paiement et par caisse. */
  totalCents: number;
  byPaymentMethod: { method: string; orders: number; revenueCents: number }[];
  byRegister: { registerLabel: string; orders: number; revenueCents: number }[];
  /** Réservations arrivées qui avaient payé d'avance, et leur montant. */
  prepaidOrders: number;
  prepaidCents: number;
  giftedOrders: number;
}

export function bookingDashboard(state: ProjectionState, soireeId: string): BookingDashboard {
  const byMethod = new Map<string, { orders: number; revenueCents: number }>();
  const byRegister = new Map<string, { orders: number; revenueCents: number }>();
  const d: BookingDashboard = {
    expected: 0,
    arrived: 0,
    arrivedWalkIn: 0,
    remaining: 0,
    byTariff: {},
    reservations: 0,
    reservationsArrived: 0,
    totalCents: 0,
    byPaymentMethod: [],
    byRegister: [],
    prepaidOrders: 0,
    prepaidCents: 0,
    giftedOrders: 0,
  };
  const tariff = (id: string) => (d.byTariff[id] ??= { expected: 0, arrived: 0 });
  for (const r of reservationRows(state, soireeId)) {
    if (!r.walkIn) {
      d.reservations += 1;
      d.expected += countTotal(r.counts);
      for (const [id, n] of Object.entries(r.counts)) tariff(id).expected += n;
      if (r.order) d.reservationsArrived += 1;
    }
    const heads = arrivedHeads(r);
    // Payé d'avance : pointé en une fois, il n'attend plus personne.
    if (!r.walkIn && !(r.order && (r.prepaid || r.complete))) d.remaining += Math.max(0, countTotal(r.counts) - countTotal(heads));
    if (!r.order) continue;
    d.arrived += countTotal(heads);
    if (r.walkIn) d.arrivedWalkIn += countTotal(heads);
    for (const [id, n] of Object.entries(heads)) tariff(id).arrived += n;
    for (const o of [r.order, ...r.supplements]) {
      // Même règle que `paidOrders` (stats.ts) : un repas offert n'est pas de l'argent.
      if (o.paymentMethod === "offert") {
        d.giftedOrders += 1;
        continue;
      }
      if (o.paymentMethod === "prepaid") {
        d.prepaidOrders += 1;
        d.prepaidCents += o.totalCents;
        continue;
      }
      d.totalCents += o.totalCents;
      for (const [map, key] of [
        [byMethod, o.paymentMethod],
        [byRegister, o.registerLabel],
      ] as const) {
        const agg = map.get(key) ?? { orders: 0, revenueCents: 0 };
        agg.orders += 1;
        agg.revenueCents += o.totalCents;
        map.set(key, agg);
      }
    }
  }
  d.byPaymentMethod = [...byMethod].map(([method, v]) => ({ method, ...v }));
  d.byRegister = [...byRegister]
    .map(([registerLabel, v]) => ({ registerLabel, ...v }))
    .sort((a, b) => a.registerLabel.localeCompare(b.registerLabel, "fr"));
  return d;
}

// ─── Recherche tolérante aux fautes ──────────────────────────

/** Minuscules, sans accents ni ponctuation : « Lefèvre-Dupont » → « lefevre dupont ». */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Score d'un nom pour une requête (plus petit = meilleur), ou null si aucun
 * rapport. Chaque mot tapé doit trouver un mot du nom : en préfixe (0), en
 * sous-chaîne (1), ou à une faute près (deux au-delà de 6 lettres) : 2 + distance. Comparer au
 * préfixe de même longueur permet d'avoir « Dupond » → « Dupontel » en cours
 * de frappe.
 */
function nameScore(name: string, query: string): number | null {
  const words = normalizeName(name).split(" ");
  let total = 0;
  for (const q of query.split(" ")) {
    let best: number | null = null;
    for (const w of words) {
      let s: number | null = null;
      if (w.startsWith(q)) s = 0;
      else if (w.includes(q)) s = 1;
      else if (q.length >= 3) {
        const tolerance = q.length <= 6 ? 1 : 2;
        const dist = Math.min(levenshtein(q, w), levenshtein(q, w.slice(0, q.length)));
        if (dist <= tolerance) s = 2 + dist;
      }
      if (s !== null && (best === null || s < best)) best = s;
    }
    if (best === null) return null;
    total += best;
  }
  return total;
}

/** Filtre et trie des lignes par pertinence (nom, numéro de table, ou chiffres du téléphone). */
export function searchReservations<T extends { name: string; phone?: string; table?: string }>(
  rows: T[],
  query: string,
): T[] {
  const q = normalizeName(query);
  if (!q) return rows;
  const digits = query.replace(/\D/g, "");
  const scored: { row: T; score: number }[] = [];
  for (const row of rows) {
    let score = nameScore(row.name, q);
    // Mot entier : « 12 » trouve « 12 » et « 12-13 », pas « 120 ».
    if (score === null && row.table && normalizeName(row.table).split(" ").includes(q)) score = 0;
    if (score === null && digits.length >= 3 && row.phone?.replace(/\D/g, "").includes(digits)) score = 0;
    if (score !== null) scored.push({ row, score });
  }
  return scored.sort((a, b) => a.score - b.score).map((x) => x.row);
}

export type ArrivalSort = "nom" | "table" | "arrivee";

/**
 * Tri de la liste d'accueil. Par table : ordre naturel (« 2 » avant « 10 »),
 * sans table à la fin. Par arrivée : dernières arrivées en tête, puis ceux
 * qu'on attend encore, par nom.
 */
export function sortReservationRows<T extends { name: string; table?: string; order: { createdAt: string } | null }>(
  rows: T[],
  sort: ArrivalSort,
): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, "fr");
  const sorted = [...rows];
  if (sort === "nom") return sorted.sort(byName);
  if (sort === "table")
    return sorted.sort(
      (a, b) =>
        (a.table ? 0 : 1) - (b.table ? 0 : 1) ||
        (a.table ?? "").localeCompare(b.table ?? "", "fr", { numeric: true }) ||
        byName(a, b),
    );
  return sorted.sort(
    (a, b) =>
      (a.order ? 0 : 1) - (b.order ? 0 : 1) || (b.order?.createdAt ?? "").localeCompare(a.order?.createdAt ?? "") || byName(a, b),
  );
}

/**
 * Une caisse sans PIN peut-elle annuler cet encaissement ? Seulement pour
 * une réservation, depuis la tablette qui l'a encaissée, dans les 10 min.
 * Les deux horodatages viennent de la même horloge (celle de la tablette) :
 * la règle tient aussi pour une annulation faite hors ligne, poussée plus tard.
 */
export function canSelfVoid(
  order: { reservationId?: string | null; deviceId: string; createdAt: string },
  deviceId: string,
  voidCreatedAt: string,
): boolean {
  if (!order.reservationId || order.deviceId !== deviceId) return false;
  const elapsed = Date.parse(voidCreatedAt) - Date.parse(order.createdAt);
  return elapsed >= 0 && elapsed <= SELF_VOID_WINDOW_MS;
}

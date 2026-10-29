import { carteConfig, effectivePrice, type ClientOrder, type ClientReservation, type ProjectionState } from "./projection.js";

/**
 * ─────────────────────────────────────────────────────────────
 *  Soirées sur réservation
 * ─────────────────────────────────────────────────────────────
 *  Une soirée sur réservation est une soirée ordinaire dont la carte
 *  configure les deux produits ci-dessous (hors grille de caisse), avec
 *  leur prix propre à la soirée. Un encaissement est une vente ordinaire
 *  portant un `reservationId` : stats, récap et comptage de caisse le
 *  voient sans rien savoir des réservations.
 */

export const BOOKING_ADULT_ID = "resa-adulte";
export const BOOKING_CHILD_ID = "resa-enfant";

/** Fenêtre pendant laquelle la tablette qui a encaissé peut annuler sans PIN. */
export const SELF_VOID_WINDOW_MS = 10 * 60 * 1000;

export function isBookingSoiree(state: ProjectionState, soireeId: string): boolean {
  return carteConfig(state, soireeId, BOOKING_ADULT_ID) !== undefined;
}

export function bookingPrices(state: ProjectionState, soireeId: string) {
  return {
    adultCents: effectivePrice(state, soireeId, BOOKING_ADULT_ID),
    childCents: effectivePrice(state, soireeId, BOOKING_CHILD_ID),
  };
}

/** Lignes de vente d'un encaissement ; les quantités nulles sont omises (le schéma les refuse). */
export function bookingItems(state: ProjectionState, soireeId: string, adults: number, children: number) {
  const { adultCents, childCents } = bookingPrices(state, soireeId);
  return [
    { productId: BOOKING_ADULT_ID, qty: adults, unitPriceCents: adultCents },
    { productId: BOOKING_CHILD_ID, qty: children, unitPriceCents: childCents },
  ].filter((it) => it.qty > 0);
}

/** Adultes / enfants réellement encaissés dans une commande. */
export function orderHeads(order: ClientOrder): { adults: number; children: number } {
  let adults = 0;
  let children = 0;
  for (const it of order.items) {
    if (it.productId === BOOKING_ADULT_ID) adults += it.qty;
    else if (it.productId === BOOKING_CHILD_ID) children += it.qty;
  }
  return { adults, children };
}

export interface ReservationRow {
  /** = reservationId (réservation importée ou sur-place). */
  id: string;
  name: string;
  phone?: string;
  /** Prévu à la réservation ; 0 pour un sur-place. */
  adults: number;
  children: number;
  walkIn: boolean;
  /** Encaissement payé en cours, s'il y en a un. */
  order: ClientOrder | null;
}

/** Réservations de la soirée et sur-place, triées par nom. */
export function reservationRows(state: ProjectionState, soireeId: string): ReservationRow[] {
  const paid = new Map<string, ClientOrder>();
  const walkIns: ClientOrder[] = [];
  for (const o of Object.values(state.orders)) {
    if (o.soireeId !== soireeId || !o.reservationId || o.status !== "paid") continue;
    paid.set(o.reservationId, o);
    if (!state.reservations[o.reservationId]) walkIns.push(o);
  }
  const rows: ReservationRow[] = Object.values(state.reservations)
    .filter((r) => r.soireeId === soireeId)
    .map((r: ClientReservation) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      adults: r.adults,
      children: r.children,
      walkIn: false,
      order: paid.get(r.id) ?? null,
    }));
  for (const o of walkIns) {
    rows.push({
      id: o.reservationId!,
      name: o.guestName || "Sur place",
      adults: 0,
      children: 0,
      walkIn: true,
      order: o,
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export interface BookingDashboard {
  /** Personnes prévues dans les réservations (hors sur-place). */
  expected: number;
  /** Personnes encaissées, sur-place compris. */
  arrived: number;
  arrivedWalkIn: number;
  /** Personnes réservées pas encore arrivées. */
  remaining: number;
  reservations: number;
  reservationsArrived: number;
  /** Argent encaissé (hors « offert »), par moyen de paiement et par caisse. */
  totalCents: number;
  byPaymentMethod: { method: string; orders: number; revenueCents: number }[];
  byRegister: { registerLabel: string; orders: number; revenueCents: number }[];
  giftedOrders: number;
}

export function bookingDashboard(state: ProjectionState, soireeId: string): BookingDashboard {
  const rows = reservationRows(state, soireeId);
  const byMethod = new Map<string, { orders: number; revenueCents: number }>();
  const byRegister = new Map<string, { orders: number; revenueCents: number }>();
  const d: BookingDashboard = {
    expected: 0,
    arrived: 0,
    arrivedWalkIn: 0,
    remaining: 0,
    reservations: 0,
    reservationsArrived: 0,
    totalCents: 0,
    byPaymentMethod: [],
    byRegister: [],
    giftedOrders: 0,
  };
  for (const r of rows) {
    if (!r.walkIn) {
      d.reservations += 1;
      d.expected += r.adults + r.children;
      if (r.order) d.reservationsArrived += 1;
      else d.remaining += r.adults + r.children;
    }
    if (!r.order) continue;
    const { adults, children } = orderHeads(r.order);
    d.arrived += adults + children;
    if (r.walkIn) d.arrivedWalkIn += adults + children;
    // Même règle que `paidOrders` (stats.ts) : un repas offert n'est pas de l'argent.
    if (r.order.paymentMethod === "offert") {
      d.giftedOrders += 1;
      continue;
    }
    d.totalCents += r.order.totalCents;
    for (const [map, key] of [
      [byMethod, r.order.paymentMethod],
      [byRegister, r.order.registerLabel],
    ] as const) {
      const agg = map.get(key) ?? { orders: 0, revenueCents: 0 };
      agg.orders += 1;
      agg.revenueCents += r.order.totalCents;
      map.set(key, agg);
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

/** Filtre et trie des lignes par pertinence (nom, ou chiffres du téléphone). */
export function searchReservations<T extends { name: string; phone?: string }>(rows: T[], query: string): T[] {
  const q = normalizeName(query);
  if (!q) return rows;
  const digits = query.replace(/\D/g, "");
  const scored: { row: T; score: number }[] = [];
  for (const row of rows) {
    let score = nameScore(row.name, q);
    if (score === null && digits.length >= 3 && row.phone?.replace(/\D/g, "").includes(digits)) score = 0;
    if (score !== null) scored.push({ row, score });
  }
  return scored.sort((a, b) => a.score - b.score).map((x) => x.row);
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

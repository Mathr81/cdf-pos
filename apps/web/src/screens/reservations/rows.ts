import { arrivedHeads, countTotal, type ClientOrder, type Counts, type ReservationRow, type Tariff } from "@cdf/shared";

import { plural } from "../../lib/plural.js";

/** « 2 adultes · 1 enfant » ; les tarifs à zéro sont omis. */
export function countsLabel(tariffs: Tariff[], counts: Counts): string {
  const parts = tariffs
    .filter((t) => (counts[t.productId] ?? 0) > 0)
    .map((t) => plural(counts[t.productId], t.name.toLowerCase()));
  return parts.join(" · ") || "personne";
}

export function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Argent reçu à la porte pour cette arrivée (hors payé d'avance). */
export function onSiteCents(row: ReservationRow): number {
  return [row.order, ...row.supplements]
    .filter((o): o is ClientOrder => o !== null && o.paymentMethod !== "prepaid")
    .reduce((s, o) => s + o.totalCents, 0);
}

/**
 * Personnes encore attendues : toute la réservation tant que personne n'est
 * venu, puis ce qui manque d'un groupe qui arrive en plusieurs fois. Un payé
 * d'avance se pointe en une fois : une fois pointé, il n'attend plus personne,
 * pas plus qu'un groupe déclaré complet.
 */
export function stillExpected(row: ReservationRow): Counts {
  if (row.walkIn || (row.order && (row.prepaid || row.complete))) return {};
  return extras(row.counts, arrivedHeads(row));
}

/** À venir : pas encore arrivé, ou groupe arrivé en partie. */
export function awaited(row: ReservationRow): boolean {
  return !row.order || countTotal(stillExpected(row)) > 0;
}

/** Personnes au-delà de ce qui a été réglé d'avance, par tarif. */
export function extras(counts: Counts, paid: Counts): Counts {
  return Object.fromEntries(Object.entries(counts).map(([id, n]) => [id, Math.max(0, n - (paid[id] ?? 0))]));
}

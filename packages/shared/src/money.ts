/**
 * Toutes les valeurs monétaires sont stockées en **centimes entiers** (Int)
 * pour éviter les erreurs d'arrondi des flottants.
 */

/** Formate des centimes en chaîne « 12,50 € » (locale FR). */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

/** Formate des centimes sans le symbole, ex « 12,50 ». */
export function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Convertit une saisie utilisateur (« 12,50 » ou « 12.5 ») en centimes. */
export function parseAmountToCents(input: string): number {
  const normalized = input.trim().replace(",", ".").replace(/[^\d.]/g, "");
  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}

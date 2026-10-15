/**
 * Saisies libres des écrans d'admin. `parseAmountToCents` est tolérant
 * (« abc » → 0) : sans ce contrôle en amont, un prix mal tapé devenait un
 * produit à 0 € sans le moindre message.
 */
export const isAmount = (s: string) => /^\s*\d{1,4}([.,]\d{1,2})?\s*$/.test(s);

/** Quantité entière positive (stock). */
export const isCount = (s: string) => /^\s*\d{1,5}\s*$/.test(s);

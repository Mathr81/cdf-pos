import { stockRemaining, type ProjectionState } from "./projection.js";

/**
 * Prévision de rupture de stock.
 * ─────────────────────────────────────────────────────────────
 * « Au rythme actuel, épuisé vers 21h40 » : de quoi sortir une deuxième
 * plaque AVANT la rupture, au lieu de la constater.
 *
 * Le débit est mesuré sur une fenêtre glissante récente et non sur toute la
 * soirée : un coup de feu à 20h ne doit pas dicter la prévision de 22h.
 *
 * Purement dérivé de la projection — aucun événement, aucune donnée à
 * stocker.
 */

const DEFAULT_WINDOW_MINUTES = 20;

/**
 * En dessous, on refuse de répondre. Extrapoler trois minutes de service
 * annoncerait « épuisé dans 8 minutes » au premier client servi.
 */
const MIN_ELAPSED_MINUTES = 5;

export interface StockForecast {
  /** Débit observé, en unités par heure (arrondi au dixième). */
  ratePerHour: number;
  /** Instant estimé de rupture (ISO 8601). */
  depletesAt: string;
  /** Minutes avant rupture, arrondies. */
  minutesLeft: number;
}

/** Horodatage de la première vente encaissée de la soirée, en ms. */
function firstPaidOrderMs(state: ProjectionState, soireeId: string): number | null {
  let first: number | null = null;
  for (const o of Object.values(state.orders)) {
    if (o.soireeId !== soireeId || o.status !== "paid") continue;
    const t = Date.parse(o.createdAt);
    if (first === null || t < first) first = t;
  }
  return first;
}

/**
 * Unités d'un produit écoulées entre deux instants, composants inclus —
 * même règle qu'ailleurs : un seul niveau de composition est développé.
 */
function unitsBetween(
  state: ProjectionState,
  soireeId: string,
  productId: string,
  fromMs: number,
  toMs: number,
): number {
  let total = 0;
  for (const o of Object.values(state.orders)) {
    if (o.soireeId !== soireeId || o.status !== "paid") continue;
    const t = Date.parse(o.createdAt);
    if (t < fromMs || t > toMs) continue;
    for (const it of o.items) {
      if (it.productId === productId) total += it.qty;
      const parent = state.products[it.productId];
      if (!parent) continue;
      for (const c of parent.components) {
        if (c.productId === productId) total += it.qty * c.qty;
      }
    }
  }
  return total;
}

/**
 * Estime quand un produit sera épuisé. Renvoie `null` dès qu'aucune
 * prévision honnête n'est possible : stock illimité ou non suivi, stock déjà
 * épuisé, aucune vente récente, ou service trop jeune pour extrapoler.
 */
export function forecastDepletion(
  state: ProjectionState,
  soireeId: string,
  productId: string,
  opts: { now?: Date; windowMinutes?: number } = {},
): StockForecast | null {
  const stock = stockRemaining(state, soireeId, productId);
  if (stock === null || stock <= 0) return null;

  const nowMs = (opts.now ?? new Date()).getTime();
  const windowMs = (opts.windowMinutes ?? DEFAULT_WINDOW_MINUTES) * 60_000;

  const first = firstPaidOrderMs(state, soireeId);
  if (first === null) return null;

  // Ancré sur la première vente : un service ouvert depuis 10 minutes ne doit
  // pas voir son rythme divisé par une fenêtre de 20.
  const start = Math.max(nowMs - windowMs, first);
  const elapsedMinutes = (nowMs - start) / 60_000;
  if (elapsedMinutes < MIN_ELAPSED_MINUTES) return null;

  const units = unitsBetween(state, soireeId, productId, start, nowMs);
  if (units <= 0) return null;

  const ratePerHour = units / (elapsedMinutes / 60);
  const minutesLeft = Math.round((stock / ratePerHour) * 60);

  return {
    ratePerHour: Math.round(ratePerHour * 10) / 10,
    depletesAt: new Date(nowMs + minutesLeft * 60_000).toISOString(),
    minutesLeft,
  };
}

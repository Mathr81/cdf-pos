import type { ProjectionState, ClientOrder } from "./projection.js";

/** Réponse stats (partagée serveur ↔ client). `null` en soireeId = toutes soirées. */
export interface StatsResponse {
  totalRevenueCents: number;
  orderCount: number;
  itemCount: number;
  avgBasketCents: number;
  byPaymentMethod: { method: string; orders: number; revenueCents: number }[];
  byRegister: { registerLabel: string; orders: number; revenueCents: number }[];
  topProducts: { productId: string; name: string; qty: number; revenueCents: number }[];
  salesByHour: { hour: string; orders: number; revenueCents: number }[];
  /** Courbe d'évolution cumulée du CA (un point par commande). */
  revenueTimeline: { t: string; cumulativeCents: number; orders: number }[];
  voidCount: number;
}

function paidOrders(state: ProjectionState, soireeId: string | null): ClientOrder[] {
  return Object.values(state.orders).filter(
    (o) => o.status === "paid" && (soireeId === null || o.soireeId === soireeId),
  );
}

/**
 * Calcule les statistiques depuis la projection locale (live & offline).
 * `soireeId` filtre sur une soirée ; `null` = toutes soirées confondues.
 */
export function computeStats(state: ProjectionState, soireeId: string | null): StatsResponse {
  const paid = paidOrders(state, soireeId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const byMethod = new Map<string, { orders: number; revenueCents: number }>();
  const byRegister = new Map<string, { orders: number; revenueCents: number }>();
  const byHour = new Map<string, { orders: number; revenueCents: number }>();
  const qtyByProduct = new Map<string, number>();
  const revByProduct = new Map<string, number>();
  const revenueTimeline: { t: string; cumulativeCents: number; orders: number }[] = [];

  let totalRevenueCents = 0;
  let itemCount = 0;
  let cumulative = 0;
  let n = 0;

  for (const o of paid) {
    totalRevenueCents += o.totalCents;
    cumulative += o.totalCents;
    n++;
    revenueTimeline.push({ t: o.createdAt, cumulativeCents: cumulative, orders: n });

    const m = byMethod.get(o.paymentMethod) ?? { orders: 0, revenueCents: 0 };
    m.orders++;
    m.revenueCents += o.totalCents;
    byMethod.set(o.paymentMethod, m);

    const r = byRegister.get(o.registerLabel) ?? { orders: 0, revenueCents: 0 };
    r.orders++;
    r.revenueCents += o.totalCents;
    byRegister.set(o.registerLabel, r);

    const hourKey = `${String(new Date(o.createdAt).getHours()).padStart(2, "0")}h`;
    const h = byHour.get(hourKey) ?? { orders: 0, revenueCents: 0 };
    h.orders++;
    h.revenueCents += o.totalCents;
    byHour.set(hourKey, h);

    for (const it of o.items) {
      itemCount += it.qty;
      qtyByProduct.set(it.productId, (qtyByProduct.get(it.productId) ?? 0) + it.qty);
      revByProduct.set(it.productId, (revByProduct.get(it.productId) ?? 0) + it.qty * it.unitPriceCents);
    }
  }

  const topProducts = [...qtyByProduct.entries()]
    .map(([productId, qty]) => ({
      productId,
      name: state.products[productId]?.name ?? productId,
      qty,
      revenueCents: revByProduct.get(productId) ?? 0,
    }))
    .sort((a, b) => b.qty - a.qty);

  const voidCount = Object.values(state.orders).filter(
    (o) => o.status === "void" && (soireeId === null || o.soireeId === soireeId),
  ).length;

  return {
    totalRevenueCents,
    orderCount: paid.length,
    itemCount,
    avgBasketCents: paid.length ? Math.round(totalRevenueCents / paid.length) : 0,
    byPaymentMethod: [...byMethod.entries()].map(([method, v]) => ({ method, ...v })),
    byRegister: [...byRegister.entries()].map(([registerLabel, v]) => ({ registerLabel, ...v })),
    topProducts,
    salesByHour: [...byHour.entries()].map(([hour, v]) => ({ hour, ...v })).sort((a, b) => a.hour.localeCompare(b.hour)),
    revenueTimeline,
    voidCount,
  };
}

/** Résumé compact d'une soirée (pour la comparaison entre soirées). */
export interface SoireeSummary {
  soireeId: string;
  name: string;
  date: string;
  revenueCents: number;
  orders: number;
  items: number;
  avgBasketCents: number;
}

export function soireeSummaries(state: ProjectionState): SoireeSummary[] {
  return Object.values(state.soirees)
    .map((s) => {
      const paid = paidOrders(state, s.id);
      const revenueCents = paid.reduce((a, o) => a + o.totalCents, 0);
      const items = paid.reduce((a, o) => a + o.items.reduce((x, i) => x + i.qty, 0), 0);
      return {
        soireeId: s.id,
        name: s.name,
        date: s.date,
        revenueCents,
        orders: paid.length,
        items,
        avgBasketCents: paid.length ? Math.round(revenueCents / paid.length) : 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface SoireeComparison {
  current: SoireeSummary;
  /** Soirée précédente par la date, ou null si c'est la première. */
  previous: SoireeSummary | null;
  /**
   * Écart de chiffre d'affaires en pourcentage, arrondi à l'entier.
   * `null` s'il n'y a pas de précédente, ou si elle n'a rien vendu —
   * un pourcentage d'évolution depuis zéro n'a pas de sens.
   */
  revenueDeltaPct: number | null;
}

/**
 * Situe une soirée par rapport au service précédent : « +18 % vs 14 juin ».
 * Renvoie `null` si la soirée est inconnue.
 */
export function compareToPrevious(
  state: ProjectionState,
  soireeId: string,
): SoireeComparison | null {
  const summaries = soireeSummaries(state); // triées par date croissante
  const index = summaries.findIndex((s) => s.soireeId === soireeId);
  if (index === -1) return null;

  const current = summaries[index];
  const previous = index > 0 ? summaries[index - 1] : null;

  const revenueDeltaPct =
    previous && previous.revenueCents > 0
      ? Math.round(((current.revenueCents - previous.revenueCents) / previous.revenueCents) * 100)
      : null;

  return { current, previous, revenueDeltaPct };
}

/** Ligne de clôture de caisse (rapport Z) par poste de caisse. */
export interface CashupRow {
  registerLabel: string;
  orders: number;
  cashCents: number;
  cardCents: number;
  totalCents: number;
}

export interface Cashup {
  rows: CashupRow[];
  totalCashCents: number;
  totalCardCents: number;
  totalCents: number;
  orders: number;
}

/** Clôture de caisse d'une soirée : réparti espèces/carte par poste. */
export function computeCashup(state: ProjectionState, soireeId: string): Cashup {
  const byReg = new Map<string, CashupRow>();
  let totalCashCents = 0;
  let totalCardCents = 0;
  let orders = 0;

  for (const o of paidOrders(state, soireeId)) {
    orders++;
    const row = byReg.get(o.registerLabel) ?? {
      registerLabel: o.registerLabel,
      orders: 0,
      cashCents: 0,
      cardCents: 0,
      totalCents: 0,
    };
    row.orders++;
    row.totalCents += o.totalCents;
    if (o.paymentMethod === "cash") {
      row.cashCents += o.totalCents;
      totalCashCents += o.totalCents;
    } else {
      row.cardCents += o.totalCents;
      totalCardCents += o.totalCents;
    }
    byReg.set(o.registerLabel, row);
  }

  return {
    rows: [...byReg.values()].sort((a, b) => a.registerLabel.localeCompare(b.registerLabel)),
    totalCashCents,
    totalCardCents,
    totalCents: totalCashCents + totalCardCents,
    orders,
  };
}

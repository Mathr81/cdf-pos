import type { ProjectionState } from "./projection.js";

/** Réponse de l'endpoint /api/stats (partagée serveur ↔ client). */
export interface StatsResponse {
  totalRevenueCents: number;
  orderCount: number;
  itemCount: number;
  avgBasketCents: number;
  byPaymentMethod: { method: string; orders: number; revenueCents: number }[];
  byRegister: { registerLabel: string; orders: number; revenueCents: number }[];
  topProducts: { productId: string; name: string; qty: number; revenueCents: number }[];
  salesByHour: { hour: string; orders: number; revenueCents: number }[];
  voidCount: number;
}

/**
 * Calcule les statistiques à partir de la projection locale (client).
 * Même logique métier que le serveur SQL, mais sans round-trip → live & offline.
 */
export function computeStats(state: ProjectionState): StatsResponse {
  const orders = Object.values(state.orders);
  const paid = orders.filter((o) => o.status === "paid");

  const byMethod = new Map<string, { orders: number; revenueCents: number }>();
  const byRegister = new Map<string, { orders: number; revenueCents: number }>();
  const byHour = new Map<string, { orders: number; revenueCents: number }>();
  const qtyByProduct = new Map<string, number>();
  const revByProduct = new Map<string, number>();

  let totalRevenueCents = 0;
  let itemCount = 0;

  for (const o of paid) {
    totalRevenueCents += o.totalCents;

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
      revByProduct.set(
        it.productId,
        (revByProduct.get(it.productId) ?? 0) + it.qty * it.unitPriceCents,
      );
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

  return {
    totalRevenueCents,
    orderCount: paid.length,
    itemCount,
    avgBasketCents: paid.length ? Math.round(totalRevenueCents / paid.length) : 0,
    byPaymentMethod: [...byMethod.entries()].map(([method, v]) => ({ method, ...v })),
    byRegister: [...byRegister.entries()].map(([registerLabel, v]) => ({ registerLabel, ...v })),
    topProducts,
    salesByHour: [...byHour.entries()]
      .map(([hour, v]) => ({ hour, ...v }))
      .sort((a, b) => a.hour.localeCompare(b.hour)),
    voidCount: orders.filter((o) => o.status === "void").length,
  };
}

import type { FastifyInstance } from "fastify";
import type { StatsResponse } from "@cdf/shared";
import { prisma } from "../db.js";
import { requireAdmin } from "./guards.js";

export async function statsRoutes(app: FastifyInstance) {
  app.get("/stats", { preHandler: requireAdmin }, async (): Promise<StatsResponse> => {
    const paidWhere = { status: "paid" as const };

    const [orders, items, voidCount, products] = await Promise.all([
      prisma.order.findMany({
        where: paidWhere,
        select: {
          totalCents: true,
          paymentMethod: true,
          registerLabel: true,
          createdAt: true,
        },
      }),
      prisma.orderItem.groupBy({
        by: ["productId"],
        where: { order: paidWhere },
        _sum: { qty: true, unitPriceCents: true },
      }),
      prisma.order.count({ where: { status: "void" } }),
      prisma.product.findMany({ select: { id: true, name: true } }),
    ]);

    const totalRevenueCents = orders.reduce((s, o) => s + o.totalCents, 0);
    const orderCount = orders.length;

    // Regroupements en mémoire (volume faible : un événement de comité).
    const byMethod = new Map<string, { orders: number; revenueCents: number }>();
    const byRegister = new Map<string, { orders: number; revenueCents: number }>();
    const byHour = new Map<string, { orders: number; revenueCents: number }>();

    for (const o of orders) {
      const m = byMethod.get(o.paymentMethod) ?? { orders: 0, revenueCents: 0 };
      m.orders++;
      m.revenueCents += o.totalCents;
      byMethod.set(o.paymentMethod, m);

      const r = byRegister.get(o.registerLabel) ?? { orders: 0, revenueCents: 0 };
      r.orders++;
      r.revenueCents += o.totalCents;
      byRegister.set(o.registerLabel, r);

      const hourKey = `${String(o.createdAt.getHours()).padStart(2, "0")}h`;
      const h = byHour.get(hourKey) ?? { orders: 0, revenueCents: 0 };
      h.orders++;
      h.revenueCents += o.totalCents;
      byHour.set(hourKey, h);
    }

    // Revenu réel par produit : on somme qty * unitPriceCents ligne à ligne.
    const revenueRows = await prisma.orderItem.findMany({
      where: { order: paidWhere },
      select: { productId: true, qty: true, unitPriceCents: true },
    });
    const productRevenue = new Map<string, number>();
    for (const row of revenueRows) {
      productRevenue.set(
        row.productId,
        (productRevenue.get(row.productId) ?? 0) + row.qty * row.unitPriceCents,
      );
    }
    const nameById = new Map(products.map((p) => [p.id, p.name]));
    const itemCount = items.reduce((s, i) => s + (i._sum.qty ?? 0), 0);

    const topProducts = items
      .map((i) => ({
        productId: i.productId,
        name: nameById.get(i.productId) ?? "?",
        qty: i._sum.qty ?? 0,
        revenueCents: productRevenue.get(i.productId) ?? 0,
      }))
      .sort((a, b) => b.qty - a.qty);

    return {
      totalRevenueCents,
      orderCount,
      itemCount,
      avgBasketCents: orderCount ? Math.round(totalRevenueCents / orderCount) : 0,
      byPaymentMethod: [...byMethod.entries()].map(([method, v]) => ({ method, ...v })),
      byRegister: [...byRegister.entries()].map(([registerLabel, v]) => ({ registerLabel, ...v })),
      topProducts,
      salesByHour: [...byHour.entries()]
        .map(([hour, v]) => ({ hour, ...v }))
        .sort((a, b) => a.hour.localeCompare(b.hour)),
      revenueTimeline: [],
      voidCount,
    };
  });
}

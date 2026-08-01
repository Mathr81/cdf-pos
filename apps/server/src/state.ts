import { prisma } from "./db.js";

export interface ProductState {
  id: string;
  name: string;
  priceCents: number;
  category: string;
  stationId: string | null;
  stockInitial: number;
  active: boolean;
  sortOrder: number;
  emoji: string;
  color: string;
  /** Quantité vendue (commandes payées). */
  sold: number;
  /** Somme des ajustements manuels de stock. */
  adjustments: number;
  /** Stock restant = stockInitial + ajustements − vendu. */
  stockRemaining: number;
  /** Quantité marquée préparée en cuisine. */
  prepared: number;
  /** Reste à préparer = vendu − préparé (min 0 pour l'affichage). */
  toPrepare: number;
}

export interface FullState {
  products: ProductState[];
  stations: { id: string; name: string; sortOrder: number }[];
}

/** Construit l'état courant complet à partir des projections. */
export async function getFullState(): Promise<FullState> {
  const [products, stations, soldRows, moveRows, prepRows] = await Promise.all([
    prisma.product.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.station.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { qty: true },
      where: { order: { status: "paid" } },
    }),
    prisma.stockMovement.groupBy({ by: ["productId"], _sum: { delta: true } }),
    prisma.prepared.groupBy({ by: ["productId"], _sum: { qty: true } }),
  ]);

  const soldMap = new Map(soldRows.map((r) => [r.productId, r._sum.qty ?? 0]));
  const moveMap = new Map(moveRows.map((r) => [r.productId, r._sum.delta ?? 0]));
  const prepMap = new Map(prepRows.map((r) => [r.productId, r._sum.qty ?? 0]));

  return {
    stations: stations.map((s) => ({ id: s.id, name: s.name, sortOrder: s.sortOrder })),
    products: products.map((p): ProductState => {
      const sold = soldMap.get(p.id) ?? 0;
      const adjustments = moveMap.get(p.id) ?? 0;
      const prepared = prepMap.get(p.id) ?? 0;
      return {
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        category: p.category,
        stationId: p.stationId,
        stockInitial: p.stockInitial,
        active: p.active,
        sortOrder: p.sortOrder,
        emoji: p.emoji,
        color: p.color,
        sold,
        adjustments,
        stockRemaining: p.stockInitial + adjustments - sold,
        prepared,
        toPrepare: Math.max(0, sold - prepared),
      };
    }),
  };
}

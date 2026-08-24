import type { ProductComponent } from "@cdf/shared";
import { prisma } from "./db.js";

export interface ProductState {
  id: string;
  name: string;
  priceCents: number;
  category: string;
  stationId: string | null;
  stockInitial: number;
  /** true = stock non suivi : le produit n'est jamais « épuisé ». */
  stockUnlimited: boolean;
  /** Produits contenus (ex. « Burger Frites » → 1 « frites »). */
  components: ProductComponent[];
  active: boolean;
  sortOrder: number;
  emoji: string;
  color: string;
  /** Nom de fichier de l'image personnalisée ("<hash32>.webp"), ou null. */
  imageKey: string | null;
  /** Quantité vendue en direct (lignes de commande de ce produit). */
  soldDirect: number;
  /** Quantité générée par les plats qui contiennent ce produit. */
  soldFromComponents: number;
  /** Quantité vendue réelle = direct + composants. */
  sold: number;
  /** Somme des ajustements manuels de stock. */
  adjustments: number;
  /** Stock restant = stockInitial + ajustements − vendu ; `null` si illimité. */
  stockRemaining: number | null;
  /** Quantité marquée préparée en cuisine. */
  prepared: number;
  /** Reste à préparer = vendu − préparé (min 0 pour l'affichage). */
  toPrepare: number;
}

export interface FullState {
  products: ProductState[];
  stations: { id: string; name: string; sortOrder: number }[];
}

/** Lit le champ JSON `components` de façon défensive (lignes historiques). */
function parseComponents(raw: unknown): ProductComponent[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((c) => {
    const item = c as { productId?: unknown; qty?: unknown };
    if (typeof item?.productId !== "string" || typeof item?.qty !== "number") return [];
    return [{ productId: item.productId, qty: item.qty }];
  });
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

  const componentsById = new Map(products.map((p) => [p.id, parseComponents(p.components)]));

  // Ventes induites par les plats composés (un seul niveau, comme côté client).
  const inducedMap = new Map<string, number>();
  for (const parent of products) {
    const parentSold = soldMap.get(parent.id) ?? 0;
    if (parentSold === 0) continue;
    for (const c of componentsById.get(parent.id) ?? []) {
      if (c.productId === parent.id) continue;
      inducedMap.set(c.productId, (inducedMap.get(c.productId) ?? 0) + parentSold * c.qty);
    }
  }

  return {
    stations: stations.map((s) => ({ id: s.id, name: s.name, sortOrder: s.sortOrder })),
    products: products.map((p): ProductState => {
      const soldDirect = soldMap.get(p.id) ?? 0;
      const soldFromComponents = inducedMap.get(p.id) ?? 0;
      const sold = soldDirect + soldFromComponents;
      const adjustments = moveMap.get(p.id) ?? 0;
      const prepared = prepMap.get(p.id) ?? 0;
      return {
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        category: p.category,
        stationId: p.stationId,
        stockInitial: p.stockInitial,
        stockUnlimited: p.stockUnlimited,
        components: componentsById.get(p.id) ?? [],
        active: p.active,
        sortOrder: p.sortOrder,
        emoji: p.emoji,
        color: p.color,
        imageKey: p.imageKey,
        soldDirect,
        soldFromComponents,
        sold,
        adjustments,
        stockRemaining: p.stockUnlimited ? null : p.stockInitial + adjustments - sold,
        prepared,
        toPrepare: Math.max(0, sold - prepared),
      };
    }),
  };
}

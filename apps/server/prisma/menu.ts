import type { ProductComponent } from "@cdf/shared";

/**
 * ─────────────────────────────────────────────────────────────
 *  Carte du soir
 * ─────────────────────────────────────────────────────────────
 *  Point de départ chargé par `pnpm db:seed`. Tout reste modifiable dans
 *  l'écran Admin de l'application (prix, stocks, icônes, stations…) : ce
 *  fichier ne sert qu'à éviter de tout saisir à la main la première fois.
 *
 *  ⚠️ LES PRIX ET LES QUANTITÉS SONT DES VALEURS PAR DÉFAUT — vérifie-les
 *     avant le service, dans Admin → Produits.
 *
 *  `stockUnlimited: true` = produit dont on ne suit pas le stock (les frites
 *  sortent d'un sac et les barquettes sont remplies à la louche) : il n'est
 *  jamais affiché « épuisé » et n'apparaît pas dans les alertes de stock.
 *
 *  `components` = ce que le plat embarque. « Saucisse Frites » contient une
 *  barquette de frites : la friteuse voit donc les barquettes des menus en
 *  plus des frites vendues seules.
 */

export interface SeedStation {
  id: string;
  name: string;
  sortOrder: number;
}

export interface SeedProduct {
  id: string;
  name: string;
  priceCents: number;
  category: string;
  stationId?: string | null;
  stockInitial?: number;
  stockUnlimited?: boolean;
  components?: ProductComponent[];
  emoji?: string;
  color?: string;
}

export const STATIONS: SeedStation[] = [
  { id: "friteuse", name: "Friteuse", sortOrder: 0 },
  { id: "grill", name: "Grill", sortOrder: 1 },
  { id: "froid", name: "Froid & desserts", sortOrder: 2 },
];

export const PRODUCTS: SeedProduct[] = [
  // ─── Entrées ───────────────────────────────────────────────
  {
    id: "oignon-rings",
    name: "Oignon ring's",
    priceCents: 300,
    category: "Entrées",
    stationId: "friteuse",
    stockInitial: 60,
    emoji: "🧅",
    color: "#f59e0b",
  },
  {
    id: "camembert-braise",
    name: "Camembert braisé",
    priceCents: 500,
    category: "Entrées",
    stationId: "grill",
    stockInitial: 30,
    emoji: "🧀",
    color: "#eab308",
  },
  {
    id: "salade-fraicheur",
    name: "Salade fraîcheur",
    priceCents: 300,
    category: "Entrées",
    stationId: "froid",
    stockInitial: 30,
    emoji: "🥗",
    color: "#22c55e",
  },

  // ─── Accompagnement ────────────────────────────────────────
  {
    id: "frites",
    name: "Frites",
    priceCents: 300,
    category: "Accompagnements",
    stationId: "friteuse",
    // Sacs de frites : aucun stock unitaire à suivre.
    stockUnlimited: true,
    emoji: "🍟",
    color: "#facc15",
  },

  // ─── Plats (frites incluses) ───────────────────────────────
  {
    id: "saucisse-frites",
    name: "Saucisse Frites",
    priceCents: 600,
    category: "Plats",
    stationId: "grill",
    stockInitial: 80,
    components: [{ productId: "frites", qty: 1 }],
    emoji: "🌭",
    color: "#f97316",
  },
  {
    id: "poulet-tandoori-frites",
    name: "Poulet Tandoori Frites",
    priceCents: 800,
    category: "Plats",
    stationId: "grill",
    stockInitial: 60,
    components: [{ productId: "frites", qty: 1 }],
    emoji: "🍗",
    color: "#dc2626",
  },
  {
    id: "burger-frites",
    name: "Burger Frites",
    priceCents: 800,
    category: "Plats",
    stationId: "grill",
    stockInitial: 80,
    components: [{ productId: "frites", qty: 1 }],
    emoji: "🍔",
    color: "#f59e0b",
  },

  // ─── Desserts ──────────────────────────────────────────────
  {
    id: "glaces",
    name: "Glaces",
    priceCents: 200,
    category: "Desserts",
    stationId: "froid",
    stockInitial: 80,
    emoji: "🍦",
    color: "#ec4899",
  },
  {
    id: "panna-cotta",
    name: "Panna Cotta",
    priceCents: 300,
    category: "Desserts",
    stationId: "froid",
    stockInitial: 40,
    emoji: "🍮",
    color: "#f472b6",
  },
  {
    id: "mr-freeze",
    name: "Mr Freeze",
    priceCents: 100,
    category: "Desserts",
    stationId: "froid",
    stockInitial: 150,
    emoji: "🧊",
    color: "#38bdf8",
  },
];

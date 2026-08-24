/**
 * Registre d'icônes produit.
 * ─────────────────────────────────────────────────────────────
 * Le champ `product.emoji` est un `z.string()` libre (events.ts) stocké
 * en colonne TEXT sans contrainte (schema.prisma). Le serveur n'en lit
 * jamais le contenu : il le fait transiter tel quel (state.ts,
 * projections.ts). Il n'apparaît ni dans l'export CSV ni dans le miroir
 * Google Sheet.
 *
 * On y stocke donc, au choix :
 *   - un slug Phosphor de ce registre  → une vraie icône est rendue
 *   - n'importe quoi d'autre           → la chaîne est rendue littéralement
 *
 * Conséquence : les produits déjà saisis en emoji continuent de
 * s'afficher exactement comme avant. Aucune migration, aucun changement
 * de schéma zod, aucune migration Prisma.
 *
 * Import en chemin profond (dist/csr/*) : seules les icônes de ce
 * registre entrent dans le bundle.
 */
import type { Icon } from "@phosphor-icons/react";

import { HamburgerIcon } from "@phosphor-icons/react/dist/csr/Hamburger";
import { PizzaIcon } from "@phosphor-icons/react/dist/csr/Pizza";
import { BowlFoodIcon } from "@phosphor-icons/react/dist/csr/BowlFood";
import { BowlSteamIcon } from "@phosphor-icons/react/dist/csr/BowlSteam";
import { CookingPotIcon } from "@phosphor-icons/react/dist/csr/CookingPot";
import { ForkKnifeIcon } from "@phosphor-icons/react/dist/csr/ForkKnife";
import { FishIcon } from "@phosphor-icons/react/dist/csr/Fish";
import { ShrimpIcon } from "@phosphor-icons/react/dist/csr/Shrimp";

import { BreadIcon } from "@phosphor-icons/react/dist/csr/Bread";
import { CheeseIcon } from "@phosphor-icons/react/dist/csr/Cheese";
import { EggIcon } from "@phosphor-icons/react/dist/csr/Egg";
import { CarrotIcon } from "@phosphor-icons/react/dist/csr/Carrot";
import { AvocadoIcon } from "@phosphor-icons/react/dist/csr/Avocado";
import { GrainsIcon } from "@phosphor-icons/react/dist/csr/Grains";
import { BasketIcon } from "@phosphor-icons/react/dist/csr/Basket";
import { JarIcon } from "@phosphor-icons/react/dist/csr/Jar";

import { IceCreamIcon } from "@phosphor-icons/react/dist/csr/IceCream";
import { CakeIcon } from "@phosphor-icons/react/dist/csr/Cake";
import { CookieIcon } from "@phosphor-icons/react/dist/csr/Cookie";
import { CherriesIcon } from "@phosphor-icons/react/dist/csr/Cherries";
import { PopcornIcon } from "@phosphor-icons/react/dist/csr/Popcorn";
import { SnowflakeIcon } from "@phosphor-icons/react/dist/csr/Snowflake";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { DropIcon } from "@phosphor-icons/react/dist/csr/Drop";

import { BeerSteinIcon } from "@phosphor-icons/react/dist/csr/BeerStein";
import { BeerBottleIcon } from "@phosphor-icons/react/dist/csr/BeerBottle";
import { WineIcon } from "@phosphor-icons/react/dist/csr/Wine";
import { ChampagneIcon } from "@phosphor-icons/react/dist/csr/Champagne";
import { BrandyIcon } from "@phosphor-icons/react/dist/csr/Brandy";
import { MartiniIcon } from "@phosphor-icons/react/dist/csr/Martini";
import { CoffeeIcon } from "@phosphor-icons/react/dist/csr/Coffee";

import { TagIcon } from "@phosphor-icons/react/dist/csr/Tag";
import { TicketIcon } from "@phosphor-icons/react/dist/csr/Ticket";
import { PackageIcon } from "@phosphor-icons/react/dist/csr/Package";
import { FlameIcon } from "@phosphor-icons/react/dist/csr/Flame";
import { StorefrontIcon } from "@phosphor-icons/react/dist/csr/Storefront";
import { ConfettiIcon } from "@phosphor-icons/react/dist/csr/Confetti";
import { ToteIcon } from "@phosphor-icons/react/dist/csr/Tote";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { QuestionIcon } from "@phosphor-icons/react/dist/csr/Question";

/** slug → composant. Le slug est la valeur écrite dans `product.emoji`. */
export const PRODUCT_ICONS: Record<string, Icon> = {
  hamburger: HamburgerIcon,
  pizza: PizzaIcon,
  "bowl-food": BowlFoodIcon,
  "bowl-steam": BowlSteamIcon,
  "cooking-pot": CookingPotIcon,
  "fork-knife": ForkKnifeIcon,
  fish: FishIcon,
  shrimp: ShrimpIcon,

  bread: BreadIcon,
  cheese: CheeseIcon,
  egg: EggIcon,
  carrot: CarrotIcon,
  avocado: AvocadoIcon,
  grains: GrainsIcon,
  basket: BasketIcon,
  jar: JarIcon,

  "ice-cream": IceCreamIcon,
  cake: CakeIcon,
  cookie: CookieIcon,
  cherries: CherriesIcon,
  popcorn: PopcornIcon,
  snowflake: SnowflakeIcon,
  sparkle: SparkleIcon,
  drop: DropIcon,

  "beer-stein": BeerSteinIcon,
  "beer-bottle": BeerBottleIcon,
  wine: WineIcon,
  champagne: ChampagneIcon,
  brandy: BrandyIcon,
  martini: MartiniIcon,
  coffee: CoffeeIcon,

  tag: TagIcon,
  ticket: TicketIcon,
  package: PackageIcon,
  flame: FlameIcon,
  storefront: StorefrontIcon,
  confetti: ConfettiIcon,
  tote: ToteIcon,
  star: StarIcon,
  question: QuestionIcon,
};

/** Groupes proposés dans le sélecteur d'icône (Admin → Produits). */
export const ICON_GROUPS: { label: string; slugs: string[] }[] = [
  {
    label: "Plats",
    slugs: [
      "hamburger",
      "pizza",
      "bowl-food",
      "bowl-steam",
      "cooking-pot",
      "fork-knife",
      "fish",
      "shrimp",
    ],
  },
  {
    label: "Entrées & accompagnements",
    slugs: ["bread", "cheese", "egg", "carrot", "avocado", "grains", "basket", "jar"],
  },
  {
    label: "Desserts",
    slugs: [
      "ice-cream",
      "cake",
      "cookie",
      "cherries",
      "popcorn",
      "snowflake",
      "sparkle",
      "drop",
    ],
  },
  {
    label: "Boissons",
    slugs: ["beer-stein", "beer-bottle", "wine", "champagne", "brandy", "martini", "coffee"],
  },
  {
    label: "Divers",
    slugs: [
      "tag",
      "ticket",
      "package",
      "flame",
      "storefront",
      "confetti",
      "tote",
      "star",
      "question",
    ],
  },
];

export function isIconSlug(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(PRODUCT_ICONS, value);
}

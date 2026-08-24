import { PRODUCT_ICONS } from "../lib/productIcons.js";
import { inkOn, ticketColor } from "../lib/ticket.js";
import { cn } from "../lib/cn.js";

/**
 * Résout `product.emoji` :
 *   - slug connu du registre Phosphor → icône vectorielle
 *   - toute autre chaîne              → rendue littéralement
 *
 * C'est ce repli qui rend la bascule sans migration : les produits déjà
 * saisis avec un emoji s'affichent exactement comme avant.
 */
export function ProductIcon({
  value,
  size,
  color,
  className,
}: {
  value: string;
  size: number;
  color?: string;
  className?: string;
}) {
  const Glyph = PRODUCT_ICONS[value];
  if (Glyph) {
    // `fill` : les icônes produit sont posées dans un aplat de couleur,
    // la version pleine reste lisible à bout de bras en soirée.
    return <Glyph size={size} weight="fill" color={color} className={className} />;
  }
  return (
    <span
      className={cn("leading-none", className)}
      style={{ fontSize: size * 0.92, color }}
      aria-hidden="true"
    >
      {value}
    </span>
  );
}

/**
 * Le bloc ticket : aplat plein de la couleur du ticket papier, portant
 * l'icône du produit. C'est le repère visuel principal à bout de bras.
 *
 * Deux garde-fous :
 *   - l'encre de l'icône est calculée depuis la luminance de la couleur,
 *     donc lisible quelle que soit la teinte choisie dans Admin ;
 *   - le bloc ne porte JAMAIS d'information seule. Le nom du produit vit
 *     à côté, à pleine force : la tuile reste identifiable en niveaux de
 *     gris (daltonisme, écran délavé par la lumière).
 */
export function TicketBlock({
  emoji,
  color,
  iconSize,
  className,
  dimmed,
}: {
  emoji: string;
  color: string;
  iconSize: number;
  className?: string;
  dimmed?: boolean;
}) {
  const hex = ticketColor(color);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-control",
        // L'icône suit la taille du bloc quand celui-ci s'étire (tuiles hautes
        // en caisse), sans jamais dépasser une taille utile : un glyphe fixe
        // au milieu d'un grand aplat donnerait un rendu accidentel.
        "[&>svg]:h-auto [&>svg]:max-h-[62%] [&>svg]:w-[52%] [&>svg]:max-w-14",
        dimmed && "opacity-40 saturate-50",
        className,
      )}
      style={{ background: hex }}
    >
      <ProductIcon value={emoji} size={iconSize} color={inkOn(hex)} />
    </div>
  );
}

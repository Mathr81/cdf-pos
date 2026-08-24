import { useEffect, useState } from "react";
import { PRODUCT_ICONS } from "../lib/productIcons.js";
import { mediaUrl } from "../lib/api.js";
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
/**
 * Part du cadre occupée par le dessin quand aucun zoom n'est enregistré.
 * Correspond au rendu d'origine (marge de 6 % de chaque côté).
 */
export const DEFAULT_IMAGE_ZOOM = 88;

/** Bornes du réglage de taille. Doivent rester dans la plage du schéma zod. */
export const ZOOM_MIN = 40;
export const ZOOM_MAX = 100;

export function TicketBlock({
  emoji,
  color,
  imageKey,
  imageZoom,
  iconSize,
  className,
  dimmed,
}: {
  emoji: string;
  color: string;
  /** Image personnalisée, ou null pour retomber sur l'icône. */
  imageKey: string | null;
  /** Part du cadre occupée par le dessin, en % (40-100). null = défaut. */
  imageZoom: number | null;
  iconSize: number;
  className?: string;
  dimmed?: boolean;
}) {
  const hex = ticketColor(color);
  // Une image référencée mais absente du cache local (poste hors ligne qui n'a
  // jamais vu ce produit) déclenche `onError` : on retombe sur l'icône, jamais
  // sur une vignette cassée. C'est aussi pour ça que `emoji` reste renseigné
  // même quand une image est choisie.
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [imageKey]);
  const showImage = Boolean(imageKey) && !broken;

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
      {showImage ? (
        /* `contain` et non `cover` : le bloc peut être très allongé (jusqu'à
           un rapport 0,42 sur une tuile de caisse), et un `cover` y rognerait
           un logo centré jusqu'à le faire disparaître. `contain` garantit en
           plus que la couleur du ticket reste visible autour de l'image, quel
           que soit le mode de traitement retenu à l'upload. */
        /* Le zoom est appliqué ici, à l'affichage, et non cuit dans le fichier :
           le corriger ne demande donc pas de renvoyer l'image. La marge est
           répartie également, le dessin ayant déjà été normalisé au traitement. */
        <img
          src={mediaUrl(imageKey!)}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setBroken(true)}
          className="h-full w-full object-contain"
          style={{ padding: `${(100 - (imageZoom ?? DEFAULT_IMAGE_ZOOM)) / 2}%` }}
        />
      ) : (
        <ProductIcon value={emoji} size={iconSize} color={inkOn(hex)} />
      )}
    </div>
  );
}

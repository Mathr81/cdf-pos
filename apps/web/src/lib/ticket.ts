/**
 * Couleur du ticket papier.
 * ─────────────────────────────────────────────────────────────
 * `product.color` est une donnée métier : c'est la couleur du ticket
 * physique remis en cuisine, distincte pour chaque produit. Elle est
 * saisie librement dans Admin → Produits → « Couleur du ticket ».
 *
 * On ne la corrige jamais, on ne l'harmonise jamais : on l'affiche
 * fidèlement. En revanche, comme la teinte est libre, il faut choisir
 * automatiquement une encre lisible par-dessus, sinon une icône claire
 * sur un ticket jaune vif devient invisible en soirée.
 */

const NIGHT = "#14100f";
const CREAM = "#f7f0e8";

/** #abc | #aabbcc → [r, g, b] ; null si la valeur est inexploitable. */
function parseHex(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Luminance relative WCAG d'un canal sRGB. */
function channel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminance relative WCAG (0 = noir, 1 = blanc). */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Encre à poser sur un aplat de couleur ticket. Le seuil 0.42 est choisi
 * pour que l'écart de contraste reste ≥ 4.5:1 des deux côtés du basculement
 * (un jaune lantern part sur l'encre nuit, un bleu nuit sur l'encre crème).
 */
export function inkOn(hex: string): string {
  return luminance(hex) > 0.42 ? NIGHT : CREAM;
}

/** Couleur ticket exploitable, avec repli sur le défaut du schéma. */
export function ticketColor(hex: string | undefined | null): string {
  return hex && parseHex(hex) ? hex : "#f59e0b";
}

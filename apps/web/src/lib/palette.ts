/**
 * Palette pour Recharts.
 * ─────────────────────────────────────────────────────────────
 * Recharts pose ses couleurs en attributs de présentation SVG, où le
 * support de `var()` reste inégal selon les moteurs. Ce module est donc
 * le SEUL endroit de l'app où les tokens sont redonnés en littéral, et
 * il reflète strictement le bloc `@theme` de index.css.
 *
 * Avant la refonte, cinq hex flottaient dans Stats.tsx sans correspondre
 * à aucune couleur du reste de l'app (#d97706, #199e70, #3987e5...) :
 * le module de statistiques vivait dans sa propre palette parallèle.
 *
 * Si une valeur change dans index.css, elle change ici. Nulle part ailleurs.
 */
export const PALETTE = {
  /** --color-lantern : le chiffre d'affaires, série principale. */
  lantern: "#f5b63c",
  /** --color-mint : espèces. */
  mint: "#4cc08d",
  /** --color-dusk : carte bancaire. */
  dusk: "#6fa8dc",
  /** --color-line : grille et axes. */
  line: "#3a302c",
  /** --color-ash : graduations et étiquettes. */
  ash: "#9c8c82",
  /** --color-surface : fond des infobulles. */
  surface: "#1e1917",
} as const;

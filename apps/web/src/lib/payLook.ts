import { CoinsIcon } from "@phosphor-icons/react/dist/csr/Coins";
import { CreditCardIcon } from "@phosphor-icons/react/dist/csr/CreditCard";
import { CalendarCheckIcon } from "@phosphor-icons/react/dist/csr/CalendarCheck";
import { SignatureIcon } from "@phosphor-icons/react/dist/csr/Signature";

import { PALETTE } from "./palette.js";

/** Rayures : la texture distingue là où la teinte ne suffit pas. */
export function hatch(color: string, deg: number): string {
  return `repeating-linear-gradient(${deg}deg, ${color} 0 6px, ${PALETTE.surface}66 6px 9px)`;
}

/**
 * Teinte, texture et glyphe propres à chaque moyen de paiement. Carte,
 * chèque et payé d'avance partageaient le même bleu rayé : impossible de
 * lire la barre dès qu'il y en avait deux.
 */
const PAY_LOOK: Record<string, { color: string; fill: string; Icon: typeof CoinsIcon }> = {
  cash: { color: PALETTE.mint, fill: PALETTE.mint, Icon: CoinsIcon },
  card: { color: PALETTE.dusk, fill: hatch(PALETTE.dusk, 45), Icon: CreditCardIcon },
  cheque: { color: PALETTE.sand, fill: hatch(PALETTE.sand, -45), Icon: SignatureIcon },
  prepaid: { color: PALETTE.ash, fill: PALETTE.ash, Icon: CalendarCheckIcon },
};
export const payLook = (method: string) => PAY_LOOK[method] ?? PAY_LOOK.card;

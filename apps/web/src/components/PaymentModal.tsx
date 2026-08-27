import { useMemo, useState } from "react";
import { formatCents, parseAmountToCents, type PaymentMethod } from "@cdf/shared";
import { CoinsIcon } from "@phosphor-icons/react/dist/csr/Coins";
import { CreditCardIcon } from "@phosphor-icons/react/dist/csr/CreditCard";
import { GiftIcon } from "@phosphor-icons/react/dist/csr/Gift";
import { Modal } from "./Modal.js";
import { Numpad } from "./Numpad.js";
import { Button } from "./ui.js";

/**
 * Monté uniquement pendant l'encaissement (voir Caisse.tsx) : c'est le
 * démontage qui remet l'écran de choix Espèces / Carte. Garder le composant
 * monté en le pilotant par une prop `open` laissait `mode` à "cash" après
 * une vente en espèces, et le panier suivant s'ouvrait sur la calculatrice.
 */
export function PaymentModal({
  totalCents,
  onClose,
  onConfirm,
}: {
  totalCents: number;
  onClose: () => void;
  onConfirm: (method: PaymentMethod, cashReceivedCents?: number) => void;
}) {
  const [mode, setMode] = useState<"choose" | "cash">("choose");
  const [received, setReceived] = useState("");

  const receivedCents = parseAmountToCents(received);
  const changeCents = receivedCents - totalCents;

  const quick = useMemo(() => {
    // Suggestions : montant exact + billets courants supérieurs au total.
    const bills = [500, 1000, 2000, 5000];
    const opts = [totalCents, ...bills.filter((b) => b >= totalCents)];
    return [...new Set(opts)].slice(0, 4);
  }, [totalCents]);

  /** Retour à l'écran de choix sans fermer (bouton « Retour »). */
  const reset = () => {
    setMode("choose");
    setReceived("");
  };

  return (
    <Modal open onClose={onClose}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lead font-bold text-cream">Encaissement</h2>
        <div className="font-display tnum text-display font-bold text-lantern">
          {formatCents(totalCents)}
        </div>
      </div>

      {mode === "choose" && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            className="h-32 flex-col gap-3 text-lead"
            onClick={() => setMode("cash")}
          >
            <CoinsIcon size={40} weight="fill" className="text-lantern" />
            Espèces
          </Button>
          <Button
            variant="secondary"
            className="h-32 flex-col gap-3 text-lead"
            onClick={() => onConfirm("card")}
          >
            <CreditCardIcon size={40} weight="fill" className="text-dusk" />
            Carte
          </Button>

          {/* Sur toute la largeur et visuellement en retrait : c'est le geste
              rare. Le mettre à égalité avec Espèces et Carte inviterait à le
              toucher par erreur, et un repas encaissé en « Offert » ne se voit
              qu'au dépouillement. */}
          <Button
            variant="ghost"
            className="col-span-2 h-16 gap-3 text-body"
            onClick={() => onConfirm("offert")}
          >
            <GiftIcon size={24} weight="fill" className="text-mint" />
            Offert (bénévole, invité)
          </Button>
        </div>
      )}

      {mode === "cash" && (
        <div className="space-y-4">
          <div className="rounded-control border border-line bg-well p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-body text-sand">Reçu</span>
              <span className="tnum text-title font-bold text-cream">
                {received ? formatCents(receivedCents) : "aucun"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2">
              <span className="text-body text-sand">Rendu monnaie</span>
              <span
                className={
                  changeCents >= 0
                    ? "font-display tnum text-display font-bold text-mint"
                    : "font-display tnum text-display font-bold text-signal"
                }
              >
                {received ? formatCents(Math.max(0, changeCents)) : "0,00 €"}
              </span>
            </div>
            {received !== "" && changeCents < 0 && (
              <p className="mt-1 text-right text-micro font-bold text-signal">Montant insuffisant</p>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {quick.map((c) => (
              <Button
                key={c}
                variant="secondary"
                size="sm"
                className="tnum"
                onClick={() => setReceived(centsToInput(c))}
              >
                {formatCents(c)}
              </Button>
            ))}
          </div>

          <Numpad value={received} onChange={setReceived} />

          <div className="flex gap-2">
            <Button variant="ghost" size="lg" onClick={reset}>
              Retour
            </Button>
            <Button
              variant="success"
              size="lg"
              className="flex-1"
              disabled={received !== "" && changeCents < 0}
              onClick={() => onConfirm("cash", received ? receivedCents : undefined)}
            >
              Encaisser
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

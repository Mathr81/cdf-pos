import { useMemo, useState } from "react";
import { formatCents, parseAmountToCents, type PaymentMethod } from "@cdf/shared";
import { CoinsIcon } from "@phosphor-icons/react/dist/csr/Coins";
import { CreditCardIcon } from "@phosphor-icons/react/dist/csr/CreditCard";
import { GiftIcon } from "@phosphor-icons/react/dist/csr/Gift";
import { cn } from "../lib/cn.js";
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
  /* Carte et Offert passent par un écran de confirmation : ils encaissaient
     en un seul tap, et une vente ne s'annule ensuite qu'avec le PIN admin.
     Pour la carte, c'est aussi le geste réel : on attend que le TPE accepte. */
  const [mode, setMode] = useState<"choose" | "cash" | "card" | "offert">("choose");
  const [received, setReceived] = useState("");

  const receivedCents = parseAmountToCents(received);
  const changeCents = receivedCents - totalCents;

  const quick = useMemo(() => {
    // Suggestions : montant exact + billets courants supérieurs au total.
    const bills = [500, 1000, 2000, 5000, 10000];
    const opts = [totalCents, ...bills.filter((b) => b > totalCents)];
    return [...new Set(opts)].slice(0, 4);
  }, [totalCents]);

  const cashValid = received === "" || changeCents >= 0;
  const confirmCash = () => {
    if (cashValid) onConfirm("cash", received ? receivedCents : undefined);
  };

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
            onClick={() => setMode("card")}
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
            onClick={() => setMode("offert")}
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
              {/* Neutre tant que rien n'est saisi : un « 0,00 € » rouge criait
                  « montant insuffisant » avant même le premier chiffre. */}
              <span
                className={cn(
                  "font-display tnum text-display font-bold",
                  received === "" ? "text-ash" : changeCents >= 0 ? "text-mint" : "text-signal",
                )}
              >
                {received ? formatCents(Math.max(0, changeCents)) : "—"}
              </span>
            </div>
            {received !== "" && changeCents < 0 && (
              <p className="mt-1 text-right text-micro font-bold text-signal">Montant insuffisant</p>
            )}
          </div>

          <div className="flex gap-2">
            {quick.map((c) => (
              <Button
                key={c}
                variant="secondary"
                size="sm"
                className="tnum flex-1 px-1"
                onClick={() => setReceived(centsToInput(c))}
              >
                {formatCents(c)}
              </Button>
            ))}
          </div>

          <Numpad value={received} onChange={setReceived} onEnter={confirmCash} />

          <div className="flex gap-2">
            <Button variant="ghost" size="lg" onClick={reset}>
              Retour
            </Button>
            <Button
              variant="success"
              size="lg"
              className="flex-1"
              disabled={!cashValid}
              onClick={confirmCash}
            >
              Encaisser
            </Button>
          </div>
        </div>
      )}

      {(mode === "card" || mode === "offert") && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 rounded-control border border-line bg-well p-6 text-center">
            {mode === "card" ? (
              <CreditCardIcon size={48} weight="fill" className="text-dusk" />
            ) : (
              <GiftIcon size={48} weight="fill" className="text-mint" />
            )}
            <p className="font-display text-lead font-bold text-cream">
              {mode === "card" ? "Le paiement par carte est accepté ?" : "Offrir cette commande ?"}
            </p>
            <p className="text-body text-sand">
              {mode === "card"
                ? "Attends la validation du terminal de paiement avant de confirmer."
                : "Pour un bénévole ou un invité : le stock et la cuisine en tiennent compte, pas le chiffre d'affaires."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="lg" onClick={reset}>
              Retour
            </Button>
            <Button
              variant={mode === "card" ? "primary" : "success"}
              size="lg"
              className="flex-1"
              autoFocus
              onClick={() => onConfirm(mode)}
            >
              {mode === "card" ? `Carte acceptée · ${formatCents(totalCents)}` : "Confirmer l'offert"}
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

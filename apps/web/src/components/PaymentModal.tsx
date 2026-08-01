import { useMemo, useState } from "react";
import { formatCents, parseAmountToCents, type PaymentMethod } from "@cdf/shared";
import { Modal } from "./Modal.js";
import { Numpad } from "./Numpad.js";
import { Button } from "./ui.js";

export function PaymentModal({
  open,
  totalCents,
  onClose,
  onConfirm,
}: {
  open: boolean;
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

  const reset = () => {
    setMode("choose");
    setReceived("");
  };
  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={close}>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-slate-100">Encaissement</h2>
        <div className="text-3xl font-black text-amber-400">{formatCents(totalCents)}</div>
      </div>

      {mode === "choose" && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            className="h-28 flex-col gap-2 text-xl"
            onClick={() => setMode("cash")}
          >
            <span className="text-4xl">💶</span>
            Espèces
          </Button>
          <Button
            variant="success"
            className="h-28 flex-col gap-2 text-xl"
            onClick={() => onConfirm("card")}
          >
            <span className="text-4xl">💳</span>
            Carte
          </Button>
        </div>
      )}

      {mode === "cash" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-800 p-4">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Reçu</span>
              <span className="text-2xl font-bold text-slate-100">
                {received ? formatCents(receivedCents) : "—"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-700 pt-2">
              <span className="text-sm text-slate-400">Rendu monnaie</span>
              <span
                className={
                  changeCents >= 0
                    ? "text-2xl font-black text-emerald-400"
                    : "text-2xl font-black text-rose-400"
                }
              >
                {received ? formatCents(Math.max(0, changeCents)) : "—"}
              </span>
            </div>
            {received !== "" && changeCents < 0 && (
              <p className="mt-1 text-right text-xs text-rose-400">Montant insuffisant</p>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {quick.map((c) => (
              <Button key={c} variant="ghost" size="sm" onClick={() => setReceived(centsToInput(c))}>
                {formatCents(c)}
              </Button>
            ))}
          </div>

          <Numpad value={received} onChange={setReceived} />

          <div className="flex gap-2">
            <Button variant="ghost" onClick={reset}>
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

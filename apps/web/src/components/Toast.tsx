import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";
import { cn } from "../lib/cn.js";

export interface ToastData {
  text: string;
  tone?: "success" | "error";
  /** Bouton d'action dans le toast (ex. « Annuler »). */
  action?: { label: string; run: () => void };
  /** Durée d'affichage, en ms. */
  ms?: number;
}

/**
 * Un toast à la fois, et UN minuteur : le précédent est annulé à chaque
 * nouveau message. Deux `setTimeout` indépendants laissaient le minuteur
 * d'une vente précédente effacer le toast de la suivante — y compris un
 * message d'erreur de 6 s coupé au bout de 2 s.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((t: ToastData) => {
    clearTimeout(timer.current);
    setToast(t);
    timer.current = setTimeout(() => setToast(null), t.ms ?? (t.tone === "error" ? 6000 : 2200));
  }, []);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  return { toast, show, hide };
}

export function Toast({ toast, onHide }: { toast: ToastData | null; onHide: () => void }) {
  // La région live existe en permanence : un lecteur d'écran n'annonce pas
  // une région insérée en même temps que son contenu.
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[max(6.5rem,calc(env(safe-area-inset-bottom)+5.75rem))] z-[60] flex justify-center px-4 lg:bottom-6"
    >
      {toast && (
        <div
          className={cn(
            "animate-rise-in pointer-events-auto flex max-w-full items-center gap-3 rounded-full py-2 pr-2 pl-5 text-body font-bold text-night shadow-lg",
            toast.tone === "error" ? "bg-signal" : "bg-mint",
            !toast.action && "py-3 pr-5",
          )}
        >
          {toast.tone === "error" ? (
            <WarningIcon size={20} weight="fill" className="shrink-0" />
          ) : (
            <CheckCircleIcon size={20} weight="fill" className="shrink-0" />
          )}
          <span className="min-w-0">{toast.text}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.run();
                onHide();
              }}
              className="min-h-11 shrink-0 rounded-full bg-night/15 px-4 font-black underline-offset-2 hover:bg-night/25"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

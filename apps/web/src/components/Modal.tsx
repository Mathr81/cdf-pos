import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export function Modal({
  open,
  onClose,
  children,
  className,
  padded = true,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /**
   * `false` quand le contenu gère lui-même son cadrage ET son défilement
   * (feuille panier : liste défilante + pied fixe). Le contenu devient
   * alors l'unique enfant flex du cadre et doit porter `min-h-0 flex-1`.
   */
  padded?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-night/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      {/* Colonne flex plafonnée : le contenu défile À L'INTÉRIEUR au lieu de
          pousser le bas de la modale hors de l'écran. Sans ce plafond, une
          modale plus haute que la fenêtre est rognée sans recours, puisque
          l'overlay est aligné en bas.

          `dvh` et non `vh` : sur Chrome Android, `vh` compte la barre d'URL
          rétractée et déborde d'autant. */}
      <div
        className={cn(
          "flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-surface border border-line bg-surface",
          "animate-sheet-in shadow-[0_-8px_40px_rgba(0,0,0,0.5)] sm:rounded-surface",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {padded ? (
          /* Le padding bas ADDITIONNE l'encoche à sa base — voir le
             commentaire des utilitaires d'encoche dans index.css. */
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../lib/cn.js";

/**
 * Pile des modales ouvertes : seule la plus haute répond à Échap. Sans ça,
 * une confirmation posée sur un éditeur fermerait les deux d'un coup.
 */
const stack: symbol[] = [];

export function Modal({
  open,
  onClose,
  children,
  className,
  wide = false,
  padded = true,
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Largeur 2xl au lieu de lg. Prop dédiée : `cn` ne fusionne pas les
      classes, un `max-w-2xl` passé en className perdait contre `max-w-lg`. */
  wide?: boolean;
  /**
   * `false` quand le contenu gère lui-même son cadrage ET son défilement
   * (feuille panier : liste défilante + pied fixe). Le contenu devient
   * alors l'unique enfant flex du cadre et doit porter `min-h-0 flex-1`.
   */
  padded?: boolean;
  /**
   * `false` = ni le tap sur le fond ni Échap ne ferment. Pour un brouillon
   * modifié : un tap à côté d'un champ effaçait sans prévenir tout un
   * éditeur de carte. Les boutons Annuler / Enregistrer restent la sortie.
   */
  dismissable?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Lue au moment de l'appui : l'écouteur n'est pas recréé à chaque frappe.
  const latest = useRef({ onClose, dismissable });
  latest.current = { onClose, dismissable };

  useEffect(() => {
    if (!open) return;
    const me = Symbol("modal");
    stack.push(me);
    const previous = document.activeElement as HTMLElement | null;
    const el = panel.current;

    // Nom accessible = le premier titre de la modale.
    const heading = el?.querySelector("h1, h2, h3");
    if (el && heading) {
      heading.id ||= `modal-title-${Math.random().toString(36).slice(2, 8)}`;
      el.setAttribute("aria-labelledby", heading.id);
    }
    // Le focus entre dans la modale (sauf si un champ `autoFocus` l'a déjà pris).
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || stack[stack.length - 1] !== me) return;
      if (latest.current.dismissable) {
        e.stopPropagation();
        latest.current.onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(me), 1);
      // Retour du focus là où il était : au clavier, on ne repart pas du haut de page.
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-night/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => dismissable && onClose()}
    >
      {/* Colonne flex plafonnée : le contenu défile À L'INTÉRIEUR au lieu de
          pousser le bas de la modale hors de l'écran. Sans ce plafond, une
          modale plus haute que la fenêtre est rognée sans recours, puisque
          l'overlay est aligné en bas.

          `dvh` et non `vh` : sur Chrome Android, `vh` compte la barre d'URL
          rétractée et déborde d'autant. */}
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          "flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-surface border border-line bg-surface outline-none",
          "animate-sheet-in shadow-[0_-8px_40px_rgba(0,0,0,0.5)] sm:rounded-surface",
          wide ? "max-w-2xl" : "max-w-lg",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {padded ? (
          /* L'encoche ne concerne QUE la feuille collée au bord bas, sous `sm`.
             À partir de `sm` la modale est centrée (`sm:items-center`), loin de
             l'indicateur d'accueil : y appliquer l'encoche n'y dégageait rien et
             creusait un bas plus épais que les côtés, visible sur iPad.
             `max()` et non une addition : voir index.css. */
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5">
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { Modal } from "./Modal.js";
import { Button } from "./ui.js";

/**
 * Remplace les `window.confirm()` natifs : en PWA plein écran sur iPad,
 * le dialogue système est minuscule, hors charte, et ses boutons sont
 * bien en dessous de la cible tactile de 44px.
 */
export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  tone = "danger",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="font-display text-title font-bold text-cream">{title}</h2>
      {body && <div className="mt-2 text-body text-sand">{body}</div>}
      <div className="mt-6 flex gap-2">
        <Button variant="ghost" size="lg" className="flex-1" onClick={onClose}>
          Annuler
        </Button>
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          size="lg"
          className="flex-1"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

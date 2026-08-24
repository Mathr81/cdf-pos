import { useState } from "react";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { useStore } from "../lib/store.js";
import { downloadOutboxRescue } from "../lib/rescue.js";
import { forceWipeAndReload, retryPendingSync } from "../lib/sync.js";
import { Button } from "./ui.js";
import { Modal } from "./Modal.js";

/**
 * Dernier rempart avant la destruction de ventes qui n'existent nulle part
 * ailleurs. S'affiche quand une purge a été suspendue (voir `store.blocked`).
 *
 * « Réessayer la synchro » n'apparaît que pour une purge demandée ici : après
 * un reset serveur, repousser ces événements ferait réapparaître des ventes
 * que l'admin vient d'effacer.
 */
export function PendingSalesGuard() {
  const blocked = useStore((s) => s.blocked);
  const setBlocked = useStore((s) => s.setBlocked);
  const [busy, setBusy] = useState<"retry" | "wipe" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!blocked) return null;

  const { reason, count } = blocked;

  const retry = async () => {
    setBusy("retry");
    setNote(null);
    try {
      const left = await retryPendingSync();
      if (left === 0) {
        // Tout est arrivé au serveur : la purge initiale peut aboutir.
        await forceWipeAndReload();
        return;
      }
      setBlocked({ reason, count: left });
      setNote(`${left} vente(s) résistent encore. La tablette est-elle en ligne ?`);
    } catch {
      setNote("La synchro a échoué. Vérifie la connexion réseau.");
    } finally {
      setBusy(null);
    }
  };

  const rescueThenWipe = async () => {
    setBusy("wipe");
    setNote(null);
    try {
      // La purge n'a lieu QUE si la sauvegarde a été produite.
      await downloadOutboxRescue();
      await forceWipeAndReload();
    } catch {
      setNote("La sauvegarde a échoué — rien n'a été effacé.");
      setBusy(null);
    }
  };

  const intro = {
    manual: "Cette tablette contient des ventes que le serveur n'a jamais reçues.",
    reset: "Une remise à zéro a été lancée depuis un autre poste, mais cette tablette contient des ventes que le serveur n'a jamais reçues.",
    epoch: "Le serveur a été remis à zéro pendant que cette tablette était hors ligne. Elle contient des ventes qui n'ont jamais été transmises.",
  }[reason];

  return (
    <Modal open onClose={() => setBlocked(null)}>
      <h2 className="font-display flex items-center gap-2 text-title font-bold text-signal">
        <WarningIcon size={22} weight="fill" />
        {count} vente{count > 1 ? "s" : ""} non synchronisée{count > 1 ? "s" : ""}
      </h2>

      <p className="mt-3 text-body text-sand">{intro}</p>
      <p className="mt-2 text-body text-sand">
        Les effacer maintenant, c'est les <b className="text-cream">perdre définitivement</b>.
        Télécharge la sauvegarde d'abord : le fichier permet de les rejouer.
      </p>

      {note && (
        <p className="mt-3 rounded-control border border-signal bg-signal/10 p-3 text-body font-semibold text-signal">
          {note}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {reason === "manual" && (
          <Button variant="primary" size="lg" disabled={busy !== null} onClick={() => void retry()}>
            <ArrowsClockwiseIcon size={20} weight="bold" />
            {busy === "retry" ? "Synchronisation…" : "Réessayer la synchro"}
          </Button>
        )}

        <Button variant="danger" size="lg" disabled={busy !== null} onClick={() => void rescueThenWipe()}>
          <DownloadSimpleIcon size={20} weight="bold" />
          {busy === "wipe" ? "Sauvegarde…" : "Télécharger puis effacer"}
        </Button>

        {/* Jamais de cul-de-sac : on ne piège pas une caisse en plein service.
            L'indicateur de synchro continue de signaler les ventes en attente. */}
        <Button variant="ghost" size="lg" disabled={busy !== null} onClick={() => setBlocked(null)}>
          Annuler
        </Button>
      </div>
    </Modal>
  );
}

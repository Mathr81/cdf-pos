import { useEffect, useState } from "react";
import { BroomIcon } from "@phosphor-icons/react/dist/csr/Broom";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";

import { useStore } from "../../lib/store.js";
import { api } from "../../lib/api.js";
import { PendingSalesError, pendingCount, wipeLocalData } from "../../lib/localData.js";
import {
  estimateStorage,
  requestPersistentStorage,
  type PersistStatus,
} from "../../lib/persist.js";
import { Button, Card, TextInput } from "../../components/ui.js";
import { Modal } from "../../components/Modal.js";
import { ConfirmModal } from "../../components/ConfirmModal.js";

function StorageCard() {
  const [status, setStatus] = useState<PersistStatus | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [waiting, setWaiting] = useState(0);

  const refresh = () => {
    void requestPersistentStorage().then(setStatus);
    void estimateStorage().then(setUsage);
    void pendingCount().then(setWaiting);
  };

  useEffect(refresh, []);

  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} Mo`;
  const ok = status === "persisted";

  return (
    <Card className="p-4">
      <h2 className="font-display flex items-center gap-2 text-lead font-bold text-cream">
        {ok ? (
          <CheckCircleIcon size={20} weight="fill" className="text-mint" />
        ) : (
          <WarningIcon size={20} weight="fill" className="text-signal" />
        )}
        Stockage de cette tablette
      </h2>

      <p className="mt-2 text-body text-sand">
        {status === null && "Vérification…"}
        {status === "persisted" && (
          <>
            <b className="text-mint">Persistant.</b> Le navigateur ne peut pas effacer les ventes
            hors ligne pour faire de la place.
          </>
        )}
        {status === "denied" && (
          <>
            <b className="text-signal">Non garanti.</b> Le navigateur a refusé le stockage
            persistant : il pourrait effacer les ventes hors ligne s'il manque d'espace. Installe
            l'app sur l'écran d'accueil, puis reviens ici.
          </>
        )}
        {status === "unsupported" && (
          <>
            <b className="text-signal">Non garanti.</b> Ce navigateur ne gère pas le stockage
            persistant (iOS antérieur à 17). Évite de laisser une caisse hors ligne longtemps.
          </>
        )}
      </p>

      <p className="mt-2 text-micro text-ash">
        {usage && `${mb(usage.usage)} utilisés sur ${mb(usage.quota)} disponibles. `}
        {waiting > 0
          ? `${waiting} vente(s) en attente de synchro sur ce poste.`
          : "Aucune vente en attente sur ce poste."}
      </p>

      <Button variant="secondary" size="md" className="mt-3" onClick={refresh}>
        Revérifier
      </Button>
    </Card>
  );
}

/**
 * Remise à zéro. Le journal d'événements étant répliqué sur chaque appareil,
 * le serveur change son `epoch` : tous les postes connectés purgent alors leur
 * copie locale et se rechargent automatiquement.
 */
export function ResetPanel() {
  const [pending, setPending] = useState<"sales" | "all" | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const setBlocked = useStore((s) => s.setBlocked);

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.reset(pending);
      setDone(
        pending === "sales"
          ? `Ventes effacées. ${res.keptProducts} produits conservés.`
          : `Tout a été effacé (ventes, carte et ${res.deletedMedia} image(s)).`,
      );
      setPending(null);
      setTyped("");
      // Le serveur diffuse « server:reset » : cet appareil aussi se purge et
      // se recharge. On force le passage au cas où le socket serait coupé.
      try {
        await wipeLocalData();
        setTimeout(() => window.location.reload(), 1200);
      } catch (e) {
        // Ce poste avait lui-même des ventes non transmises : l'écran
        // bloquant prend la main plutôt que de les détruire.
        if (e instanceof PendingSalesError) setBlocked({ reason: "reset", count: e.count });
        else throw e;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const expected = pending === "all" ? "TOUT EFFACER" : "EFFACER";

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4">
      <StorageCard />

      {/* C'est l'écran le plus dangereux de l'app : il reçoit désormais
          l'emphase correspondante, au lieu d'une bordure imperceptible. */}
      <Card tone="danger" className="p-4">
        <h2 className="font-display flex items-center gap-2 text-lead font-bold text-signal">
          <WarningIcon size={20} weight="fill" />
          Effacer les ventes
        </h2>
        <p className="mt-2 text-body text-sand">
          Supprime les commandes, les mouvements de stock et les préparations sur tous les
          appareils. <b className="text-cream">Les produits et stations sont conservés.</b> C'est le
          bon choix après une soirée de test.
        </p>
        <Button variant="danger" size="lg" className="mt-3" onClick={() => setPending("sales")}>
          Effacer les ventes
        </Button>
      </Card>

      <Card tone="danger" className="p-4">
        <h2 className="font-display flex items-center gap-2 text-lead font-bold text-signal">
          <WarningIcon size={20} weight="fill" />
          Tout effacer
        </h2>
        <p className="mt-2 text-body text-sand">
          Supprime aussi la carte (produits, stations) et les images envoyées. L'application repart
          totalement vide : à utiliser si tu veux tout ressaisir toi-même.
        </p>
        <Button variant="danger" size="lg" className="mt-3" onClick={() => setPending("all")}>
          Tout effacer
        </Button>
      </Card>

      <Card className="p-4">
        <h2 className="font-display flex items-center gap-2 text-lead font-bold text-cream">
          <BroomIcon size={20} weight="fill" className="text-sand" />
          Vider seulement cet appareil
        </h2>
        <p className="mt-2 text-body text-sand">
          Ne touche pas au serveur : efface le cache local de cette tablette puis recharge. Utile si
          un poste affiche des données incohérentes.
        </p>
        <Button variant="secondary" size="lg" className="mt-3" onClick={() => setConfirmWipe(true)}>
          Vider le cache local
        </Button>
      </Card>

      <p className="px-1 text-micro text-ash">
        Une remise à zéro est définitive côté application. Les dumps PostgreSQL et le miroir Google
        Sheet, eux, gardent la trace de ce qui a été effacé.
      </p>

      {done && (
        <p className="flex items-center gap-2 rounded-control border border-mint bg-mint/10 p-3 text-body font-semibold text-mint">
          <CheckCircleIcon size={18} weight="fill" />
          {done} Rechargement…
        </p>
      )}

      <ConfirmModal
        open={confirmWipe}
        title="Vider les données locales ?"
        body="Le cache de cette tablette est effacé, puis la page se recharge. Le serveur n'est pas touché."
        confirmLabel="Vider et recharger"
        tone="primary"
        onConfirm={() => {
          void (async () => {
            try {
              await wipeLocalData();
              window.location.reload();
            } catch (e) {
              if (e instanceof PendingSalesError) setBlocked({ reason: "manual", count: e.count });
              else throw e;
            }
          })();
        }}
        onClose={() => setConfirmWipe(false)}
      />

      <Modal open={pending !== null} onClose={() => setPending(null)}>
        <h2 className="font-display flex items-center gap-2 text-lead font-bold text-signal">
          <WarningIcon size={20} weight="fill" />
          {pending === "all" ? "Tout effacer ?" : "Effacer les ventes ?"}
        </h2>
        <p className="mt-2 mb-4 text-body text-sand">
          Cette action est <b className="text-cream">irréversible</b> et s'applique à tous les
          appareils. Tape <b className="text-cream">{expected}</b> pour confirmer.
        </p>
        <TextInput
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          placeholder={expected}
          aria-label="Confirmation par saisie"
        />
        {error && <p className="mt-2 text-body font-semibold text-signal">{error}</p>}
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" size="lg" onClick={() => setPending(null)}>
            Annuler
          </Button>
          <div className="flex-1" />
          <Button
            variant="danger"
            size="lg"
            disabled={typed.trim() !== expected || busy}
            onClick={run}
          >
            {busy ? "Effacement…" : "Confirmer"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

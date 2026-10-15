import { useState } from "react";
import type { ClientStation } from "@cdf/shared";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";

import { projection } from "../../lib/store.js";
import { deleteStation, upsertStation } from "../../lib/actions.js";
import { Button, Field, TextInput } from "../../components/ui.js";
import { Modal } from "../../components/Modal.js";
import { ConfirmModal } from "../../components/ConfirmModal.js";

export function StationEditor({ station, onClose }: { station: ClientStation; onClose: () => void }) {
  const [name, setName] = useState(station.name);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isNew = !projection.stations[station.id];
  const attached = Object.values(projection.products).filter(
    (p) => p.active && p.stationId === station.id,
  );

  const save = () => {
    void upsertStation({
      id: station.id,
      name: name.trim() || "Station",
      sortOrder: station.sortOrder,
    });
    onClose();
  };

  return (
    <>
      <Modal open onClose={onClose} dismissable={name === station.name}>
        <h2 className="font-display mb-4 text-lead font-bold text-cream">
          {isNew ? "Nouvelle station" : "Station cuisine"}
        </h2>
        <Field label="Nom">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <div className="mt-5 flex flex-wrap gap-2">
          {/* Glyphe explicite : « Supprimer » (signal) et « Enregistrer »
              (lantern) sont deux boutons pleins voisins, et ces deux teintes
              convergent en deutéranopie. */}
          {!isNew && (
            <Button variant="danger" onClick={() => setConfirmRemove(true)}>
              <TrashIcon size={17} weight="bold" />
              Supprimer
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={!name.trim()} onClick={save}>
            Enregistrer
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmRemove}
        title={`Supprimer la station « ${name || "sans nom"} » ?`}
        body={
          attached.length === 0
            ? "Aucun produit n'y est rattaché."
            : `${attached.length} produit${attached.length > 1 ? "s" : ""} (${attached
                .map((p) => p.name)
                .join(", ")}) n'apparaîtr${attached.length > 1 ? "ont" : "a"} plus dans aucun poste cuisine. Rattache-les à une autre station dans Produits.`
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          void deleteStation(station.id);
          onClose();
        }}
        onClose={() => setConfirmRemove(false)}
      />
    </>
  );
}

/**
 * Santé du stockage local de CETTE tablette.
 *
 * Sans stockage persistant, le navigateur peut évincer IndexedDB — et les
 * ventes hors ligne avec. Le statut est affiché plutôt que supposé : un refus
 * silencieux ne vaudrait pas mieux que ne rien demander. La demande est
 * rejouée ici parce que les heuristiques (app installée sur l'écran d'accueil,
 * engagement) peuvent l'accorder aujourd'hui après l'avoir refusée hier.
 */

import { useState } from "react";
import { countTotal, type Counts, type ReservationRow, type Tariff } from "@cdf/shared";

import { newId } from "../../lib/device.js";
import { deleteReservations, upsertReservations } from "../../lib/actions.js";
import { Button, Field, TextInput } from "../../components/ui.js";
import { Modal } from "../../components/Modal.js";
import { ConfirmModal } from "../../components/ConfirmModal.js";
import { Counters } from "./parts.js";

export function EditModal({
  soireeId,
  tariffs,
  row,
  onClose,
}: {
  soireeId: string;
  tariffs: Tariff[];
  row: ReservationRow | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(row?.name ?? "");
  const [counts, setCounts] = useState<Counts>(row?.counts ?? { [tariffs[0]?.productId ?? ""]: 2 });
  const [phone, setPhone] = useState(row?.phone ?? "");
  const [table, setTable] = useState(row?.table ?? "");
  const [note, setNote] = useState(row?.note ?? "");
  const [prepaid, setPrepaid] = useState(row?.prepaid ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const present = Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0));
  const valid = name.trim() !== "" && countTotal(present) > 0;

  const save = async () => {
    if (!valid) return;
    await upsertReservations([
      {
        id: row?.id ?? newId(),
        soireeId,
        name: name.trim(),
        counts: present,
        phone: phone.trim() || undefined,
        table: table.trim() || undefined,
        note: note.trim() || undefined,
        prepaid,
      },
    ]);
    onClose();
  };

  return (
    <Modal open onClose={onClose} dismissable={false}>
      <h2 className="font-display mb-4 text-lead font-bold text-cream">
        {row ? "Modifier la réservation" : "Nouvelle réservation"}
      </h2>
      <div className="space-y-3">
        <Field label="Nom">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={120} />
        </Field>
        <Counters tariffs={tariffs} counts={counts} onChange={setCounts} />
        <Field label="Téléphone (facultatif)">
          <TextInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
        </Field>
        <Field label="Table (facultatif)">
          <TextInput value={table} onChange={(e) => setTable(e.target.value)} maxLength={20} placeholder="12" />
        </Field>
        <Field label="Remarque (allergie, anniversaire…)">
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Sans gluten · chaise haute"
          />
        </Field>
        <label className="flex cursor-pointer items-center gap-3 rounded-control border border-line bg-well p-3">
          <input
            type="checkbox"
            checked={prepaid}
            onChange={(e) => setPrepaid(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-lantern"
          />
          <span className="text-body font-bold text-cream">Payé d'avance</span>
        </label>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {row && (
          <Button
            variant="danger"
            size="lg"
            disabled={row.order !== null}
            title={row.order ? "Annulez d'abord l'arrivée" : undefined}
            onClick={() => setConfirmDelete(true)}
          >
            Supprimer
          </Button>
        )}
        <Button variant="ghost" size="lg" className="ml-auto" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" size="lg" disabled={!valid} onClick={() => void save()}>
          Enregistrer
        </Button>
      </div>
      {row && (
        <ConfirmModal
          open={confirmDelete}
          title={`Supprimer « ${row.name} » ?`}
          confirmLabel="Supprimer"
          onConfirm={() => {
            void deleteReservations([row.id]);
            onClose();
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </Modal>
  );
}

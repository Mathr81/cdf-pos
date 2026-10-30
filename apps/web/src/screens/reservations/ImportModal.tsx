import { useState } from "react";
import { normalizeName, type ReservationRow, type Tariff } from "@cdf/shared";

import { newId } from "../../lib/device.js";
import { plural } from "../../lib/plural.js";
import { type CsvResult } from "../../lib/reservationCsv.js";
import { upsertReservations } from "../../lib/actions.js";
import { Badge, Button } from "../../components/ui.js";
import { Modal } from "../../components/Modal.js";
import { countsLabel } from "./rows.js";
import { TableTag } from "./parts.js";

export function ImportModal({
  soireeId,
  tariffs,
  result,
  existing,
  onClose,
  onDone,
}: {
  soireeId: string;
  tariffs: Tariff[];
  result: CsvResult;
  existing: ReservationRow[];
  onClose: () => void;
  onDone: (count: number) => void;
}) {
  // Doublon = même nom (sans accents ni casse) déjà dans la soirée ou plus
  // haut dans le fichier : décoché par défaut, réimporter ne double rien.
  const [dupes] = useState(() => {
    const seen = new Set(existing.map((r) => normalizeName(r.name)));
    return result.rows.map((r) => {
      const key = normalizeName(r.name);
      const dupe = seen.has(key);
      seen.add(key);
      return dupe;
    });
  });
  const [checked, setChecked] = useState(() => dupes.map((d) => !d));
  const [busy, setBusy] = useState(false);
  const count = checked.filter(Boolean).length;

  const run = async () => {
    setBusy(true);
    try {
      await upsertReservations(result.rows.filter((_, i) => checked[i]).map((r) => ({ id: newId(), soireeId, ...r })));
      onDone(count);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} wide dismissable={false}>
      <h2 className="font-display text-lead font-bold text-cream">Importer des réservations</h2>
      {result.errors.length > 0 && (
        <div className="mt-3 rounded-control border border-signal/60 bg-signal/10 p-3 text-body text-cream">
          <p className="font-bold">
            {plural(result.errors.length, "ligne illisible", "lignes illisibles")} (non importée
            {result.errors.length > 1 ? "s" : ""}) :
          </p>
          <ul className="mt-1 list-disc pl-5 text-sand">
            {result.errors.map((e) => (
              <li key={e.line}>
                Ligne {e.line} — {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.ignored.length > 0 && (
        <p className="mt-3 rounded-control border border-lantern/60 bg-lantern/10 p-3 text-body text-cream">
          Colonne{result.ignored.length > 1 ? "s" : ""} ignorée
          {result.ignored.length > 1 ? "s" : ""} : <b>{result.ignored.join(", ")}</b>. Si c'est un tarif, ajoutez-le
          d'abord dans les tarifs de la soirée.
        </p>
      )}
      <ul className="mt-3 max-h-[50vh] space-y-1 overflow-y-auto">
        {result.rows.map((r, i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-center gap-3 rounded-control border border-line bg-well px-3 py-2">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
                className="h-5 w-5 shrink-0 accent-lantern"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-bold text-cream">{r.name}</span>
                  {r.table && <TableTag table={r.table} />}
                </span>
                <span className="tnum block truncate text-micro text-ash">
                  {countsLabel(tariffs, r.counts)}
                  {r.phone && ` · ${r.phone}`}
                </span>
                {r.note && <span className="block truncate text-micro text-lantern">{r.note}</span>}
              </span>
              {r.prepaid && <Badge tone="dusk">Payé</Badge>}
              {dupes[i] && <Badge tone="lantern">Déjà dans la liste</Badge>}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex gap-2">
        <Button variant="ghost" size="lg" onClick={onClose}>
          Annuler
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={count === 0 || busy}
          onClick={() => void run()}
        >
          Importer {plural(count, "réservation")}
        </Button>
      </div>
    </Modal>
  );
}

import { useRef, useState } from "react";
import { bookingTariffs, isBookingSoiree, reservationRows, type ReservationRow } from "@cdf/shared";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { PrinterIcon } from "@phosphor-icons/react/dist/csr/Printer";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/csr/UploadSimple";

import { projection } from "../../lib/store.js";
import { useRev } from "../../lib/hooks.js";
import { plural } from "../../lib/plural.js";
import { exportReservationsCsv } from "../../lib/export.js";
import { decodeCsv, parseReservationCsv, type CsvResult } from "../../lib/reservationCsv.js";
import { deleteReservations } from "../../lib/actions.js";
import { Badge, Button, Card } from "../../components/ui.js";
import { ConfirmModal } from "../../components/ConfirmModal.js";
import { type ToastData } from "../../components/Toast.js";
import { countsLabel } from "./rows.js";
import { TableTag } from "./parts.js";
import { TariffsEditor } from "./TariffsEditor.js";
import { ImportModal } from "./ImportModal.js";
import { EditModal } from "./EditModal.js";

export function ManageTab({
  soireeId,
  soireeName,
  toast,
}: {
  soireeId: string;
  soireeName: string;
  toast: (t: ToastData) => void;
}) {
  useRev();
  const booking = isBookingSoiree(projection, soireeId);
  const tariffs = bookingTariffs(projection, soireeId);
  const [imported, setImported] = useState<CsvResult | null>(null);
  const [editing, setEditing] = useState<ReservationRow | "new" | null>(null);
  const [clearing, setClearing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const rows = reservationRows(projection, soireeId).filter((r) => !r.walkIn);
  // Les arrivées restent : leur supprimer la réservation ferait passer l'argent en « sur place ».
  const unpaid = rows.filter((r) => !r.order);

  const readFile = async (file: File) => {
    setImported(parseReservationCsv(decodeCsv(await file.arrayBuffer()), tariffs));
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
      {/* Remonté quand les tarifs enregistrés changent (création juste avant,
          autre poste, notre propre enregistrement) : le brouillon repart d'eux. */}
      <TariffsEditor
        key={tariffs.map((t) => `${t.productId}:${t.name}:${t.priceCents}`).join("|")}
        soireeId={soireeId}
        soireeName={soireeName}
        booking={booking}
        toast={toast}
      />

      {booking && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display mr-auto text-lead font-bold text-cream">
              Liste <span className="tnum text-ash">({plural(rows.length, "réservation")})</span>
            </h2>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])}
            />
            <Button onClick={() => fileInput.current?.click()}>
              <UploadSimpleIcon size={18} weight="bold" />
              Importer un CSV
            </Button>
            <Button onClick={() => setEditing("new")}>
              <PlusIcon size={18} weight="bold" />
              Ajouter
            </Button>
            <Button onClick={() => window.print()}>
              <PrinterIcon size={18} weight="bold" />
              Imprimer la liste
            </Button>
            <Button onClick={() => exportReservationsCsv(projection, soireeId)}>
              <DownloadSimpleIcon size={18} weight="bold" />
              Exporter le bilan
            </Button>
            {unpaid.length > 0 && (
              <Button variant="ghost" onClick={() => setClearing(true)}>
                <TrashIcon size={18} weight="bold" />
                Vider la liste
              </Button>
            )}
          </div>
          <p className="mt-1 text-micro text-ash">
            CSV : une colonne Nom (et éventuellement Prénom), une colonne par tarif (
            {tariffs.map((t) => t.name).join(", ")}), et au choix Téléphone, Table, Remarque (ou Allergies…), Payé
            (oui / non). Séparateur « ; » ou « , ».
          </p>
          <ul className="mt-3 space-y-1.5">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-control border border-line bg-well px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-bold text-cream">{r.name}</div>
                    {r.table && <TableTag table={r.table} />}
                  </div>
                  <div className="tnum truncate text-micro text-ash">
                    {countsLabel(tariffs, r.counts)}
                    {r.phone && ` · ${r.phone}`}
                  </div>
                  {r.note && <div className="truncate text-micro text-lantern">{r.note}</div>}
                </div>
                {r.prepaid && <Badge tone="dusk">Payé</Badge>}
                {r.order && <Badge tone="mint">Arrivé</Badge>}
                <Button size="sm" variant="ghost" aria-label={`Modifier ${r.name}`} onClick={() => setEditing(r)}>
                  <PencilSimpleIcon size={18} weight="bold" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {imported && (
        <ImportModal
          soireeId={soireeId}
          tariffs={tariffs}
          result={imported}
          existing={rows}
          onClose={() => setImported(null)}
          onDone={(n) => {
            setImported(null);
            toast({
              text: `${plural(n, "réservation")} importée${n > 1 ? "s" : ""}`,
            });
          }}
        />
      )}
      <ConfirmModal
        open={clearing}
        title={`Supprimer ${plural(unpaid.length, "réservation")} ?`}
        body={
          unpaid.length < rows.length
            ? `Les ${rows.length - unpaid.length} déjà arrivées sont gardées. Pratique avant de réimporter une liste corrigée.`
            : "Pratique avant de réimporter une liste corrigée."
        }
        confirmLabel="Supprimer"
        onConfirm={() => void deleteReservations(unpaid.map((r) => r.id))}
        onClose={() => setClearing(false)}
      />
      {editing && (
        <EditModal
          soireeId={soireeId}
          tariffs={tariffs}
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

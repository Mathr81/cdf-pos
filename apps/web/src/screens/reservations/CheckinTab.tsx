import { useState } from "react";
import {
  arrivedHeads,
  bookingItems,
  bookingTariffs,
  countTotal,
  formatCents,
  itemsTotal,
  reservationRows,
  searchReservations,
  sortReservationRows,
  type ArrivalSort,
} from "@cdf/shared";
import { CalendarCheckIcon } from "@phosphor-icons/react/dist/csr/CalendarCheck";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { HourglassMediumIcon } from "@phosphor-icons/react/dist/csr/HourglassMedium";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { UserPlusIcon } from "@phosphor-icons/react/dist/csr/UserPlus";
import { WifiSlashIcon } from "@phosphor-icons/react/dist/csr/WifiSlash";

import { projection, useStore } from "../../lib/store.js";
import { useRev } from "../../lib/hooks.js";
import { useSession } from "../../lib/session.js";
import { useUrlState } from "../../lib/urlState.js";
import { cn } from "../../lib/cn.js";
import { Badge, Button, EmptyState, TextInput } from "../../components/ui.js";
import { type ToastData } from "../../components/Toast.js";
import { countsLabel, hhmm, stillExpected, awaited } from "./rows.js";
import { TableTag, NoteBox } from "./parts.js";
import { DoorSide } from "./DoorSide.js";
import { CheckinModal } from "./CheckinModal.js";
import { PaidModal } from "./PaidModal.js";

export function CheckinTab({ soireeId, toast }: { soireeId: string; toast: (t: ToastData) => void }) {
  useRev();
  const connected = useStore((s) => s.connected);
  const pendingIds = useStore((s) => s.pendingOrderIds);
  const isAdmin = useSession((s) => s.isAdmin);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useUrlState<"tous" | "attendus" | "arrives">("filtre", "tous");
  const [sort, setSort] = useUrlState<ArrivalSort>("tri", "nom");
  // `more` : arrivants d'un groupe déjà en partie arrivé.
  const [open, setOpen] = useState<{ id: string; more?: boolean } | "walkin" | null>(null);

  const tariffs = bookingTariffs(projection, soireeId);
  const rows = reservationRows(projection, soireeId);
  const arrivedCount = rows.filter((r) => r.order).length;
  const awaitedCount = rows.filter(awaited).length;
  // Un groupe arrivé en partie est dans les deux listes.
  const filtered = filter === "tous" ? rows : rows.filter((r) => (filter === "arrives" ? r.order !== null : awaited(r)));
  // Une recherche porte sur toute la liste, par pertinence : filtrée, elle
  // ne trouverait pas un groupe attendu et pousserait à l'encaisser en sur place.
  const shown = q ? searchReservations(rows, q) : sortReservationRows(filtered, sort);
  // Relu à chaque rendu : la ligne peut passer « encaissée » par une autre caisse modale ouverte.
  const selected = open && open !== "walkin" ? rows.find((r) => r.id === open.id) : undefined;

  const done = (t: ToastData) => {
    setOpen(null);
    setQ("");
    toast(t);
  };

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!connected && (
          <div className="mb-3 flex items-start gap-2.5 rounded-control border border-signal/60 bg-signal/10 p-3 text-body text-cream">
            <WifiSlashIcon size={20} weight="bold" className="mt-0.5 shrink-0 text-signal" />
            <span>
              <b>Hors ligne.</b> Les encaissements restent sur cette tablette. Une autre caisse peut encaisser la même
              réservation : ce sera vérifié dès le retour du réseau.
            </span>
          </div>
        )}

        <div className="mb-2 flex shrink-0 gap-2">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlassIcon
              size={20}
              weight="bold"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ash"
            />
            <TextInput
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              placeholder="Nom, table ou tél."
              aria-label="Rechercher une réservation"
              className="min-h-14 pl-10 text-lead"
            />
          </div>
          <Button size="lg" onClick={() => setOpen("walkin")}>
            <UserPlusIcon size={20} weight="bold" />
            Sur place
          </Button>
        </div>
        {/* Contrôles secondaires : petits, sur une ligne, pour laisser la place à la liste. */}
        <div className="mb-2 flex shrink-0 items-center gap-2">
          <div className="flex rounded-full bg-well p-0.5" role="group" aria-label="Filtrer la liste">
            {(
              [
                ["tous", "Tous", rows.length],
                ["attendus", "À venir", awaitedCount],
                ["arrives", "Arrivés", arrivedCount],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value && !q}
                onClick={() => setFilter(value)}
                className={cn(
                  "h-9 rounded-full px-3 text-micro font-bold whitespace-nowrap transition-colors",
                  filter === value && !q ? "bg-line text-cream" : "text-ash hover:text-sand",
                )}
              >
                {label} <span className="tnum font-semibold opacity-70">{count}</span>
              </button>
            ))}
          </div>
          <select
            aria-label="Trier la liste"
            value={sort}
            onChange={(e) => setSort(e.target.value as ArrivalSort)}
            disabled={q !== ""}
            title={q ? "Pendant une recherche, toute la liste, les noms les plus proches en tête" : undefined}
            className="ml-auto h-9 min-w-0 cursor-pointer rounded-full bg-transparent px-2 text-micro font-bold text-ash outline-none hover:text-sand focus-visible:ring-2 focus-visible:ring-lantern disabled:opacity-40"
          >
            <option value="nom">Tri : nom</option>
            <option value="table">Tri : table</option>
            <option value="arrivee">Tri : arrivées</option>
          </select>
        </div>

        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-4">
          {rows.length === 0 ? (
            <EmptyState
              icon={<ClipboardTextIcon size={44} weight="light" />}
              title="Aucune réservation"
              hint={
                isAdmin
                  ? "Importez la liste (CSV) dans l'onglet Gestion. Les personnes sans réservation passent par « Sur place »."
                  : "La liste n'a pas encore été importée. Les personnes sans réservation passent par « Sur place »."
              }
            />
          ) : shown.length === 0 && !q ? (
            <EmptyState
              title={filter === "attendus" ? "Tout le monde est arrivé" : "Personne n'est encore arrivé"}
            />
          ) : shown.length === 0 ? (
            <EmptyState
              title={`Aucun nom ne ressemble à « ${q} »`}
              action={
                <Button size="lg" onClick={() => setOpen("walkin")}>
                  <UserPlusIcon size={20} weight="bold" />
                  Encaisser en sur place
                </Button>
              }
            />
          ) : (
            shown.map((r) => {
              const waiting = awaited(r);
              return (
                <li key={r.id}>
                  <button
                    onClick={() => setOpen({ id: r.id })}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-control border border-line bg-surface px-4 py-3 text-left",
                      "transition-colors hover:border-lantern/60 active:scale-[0.99]",
                      !waiting && "bg-transparent",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className={cn("truncate text-lead font-bold", waiting ? "text-cream" : "text-sand")}>
                          {r.name}
                        </div>
                        {r.table && <TableTag table={r.table} />}
                      </div>
                      <div className="tnum truncate text-micro text-ash">
                        {r.walkIn ? "Sur place" : countsLabel(tariffs, r.counts)}
                        {r.phone && ` · ${r.phone}`}
                      </div>
                      {r.note && waiting && <NoteBox note={r.note} />}
                    </div>
                    {r.order ? (
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {waiting ? (
                          <>
                            <Badge tone="lantern">
                              <span className="tnum">
                                {countTotal(arrivedHeads(r))}/{countTotal(r.counts)}
                              </span>{" "}
                              arrivés
                            </Badge>
                            <span className="tnum text-micro text-lantern">
                              reste {formatCents(itemsTotal(bookingItems(tariffs, stillExpected(r))))}
                            </span>
                          </>
                        ) : (
                          <Badge tone="mint">Arrivé</Badge>
                        )}
                        <span className="tnum text-micro text-ash">
                          {r.order.registerLabel} · {hhmm(r.order.createdAt)}
                        </span>
                        {pendingIds.has(r.order.id) && (
                          <Badge>
                            <HourglassMediumIcon size={13} weight="bold" />
                            Pas encore synchronisé
                          </Badge>
                        )}
                      </div>
                    ) : r.prepaid ? (
                      <Badge tone="dusk" className="shrink-0">
                        <CalendarCheckIcon size={14} weight="bold" />
                        Payé d'avance
                      </Badge>
                    ) : (
                      <span className="tnum font-display shrink-0 text-lead font-bold text-lantern">
                        {formatCents(itemsTotal(bookingItems(tariffs, r.counts)))}
                      </span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
      <DoorSide soireeId={soireeId} rows={rows} onOpen={(id) => setOpen({ id })} />

      {open === "walkin" && (
        <CheckinModal soireeId={soireeId} row={null} initialName={q} onClose={() => setOpen(null)} onDone={done} />
      )}
      {selected && !selected.order && (
        <CheckinModal soireeId={soireeId} row={selected} onClose={() => setOpen(null)} onDone={done} />
      )}
      {selected?.order && open !== "walkin" && open?.more && (
        <CheckinModal
          soireeId={soireeId}
          row={selected}
          more
          onClose={() => setOpen({ id: selected.id })}
          onDone={done}
        />
      )}
      {selected?.order && open !== "walkin" && !open?.more && (
        <PaidModal
          soireeId={soireeId}
          row={selected}
          pending={pendingIds.has(selected.order.id)}
          onMore={() => setOpen({ id: selected.id, more: true })}
          onClose={() => setOpen(null)}
          onDone={done}
        />
      )}
    </div>
  );
}

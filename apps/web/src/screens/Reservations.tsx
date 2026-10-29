import { useRef, useState, type ReactNode } from "react";
import {
  bookingDashboard,
  bookingItems,
  bookingTariffs,
  canSelfVoid,
  countTotal,
  formatAmount,
  formatCents,
  isBookingSoiree,
  itemsTotal,
  normalizeName,
  orderHeads,
  parseAmountToCents,
  paymentLabel,
  reservationRows,
  searchReservations,
  BOOKING_ADULT_ID,
  BOOKING_CHILD_ID,
  type BookingDashboard,
  type ClientOrder,
  type Counts,
  type PaymentMethod,
  type ReservationRow,
  type Tariff,
} from "@cdf/shared";
import { CalendarCheckIcon } from "@phosphor-icons/react/dist/csr/CalendarCheck";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { HourglassMediumIcon } from "@phosphor-icons/react/dist/csr/HourglassMedium";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { MinusIcon } from "@phosphor-icons/react/dist/csr/Minus";
import { NoteIcon } from "@phosphor-icons/react/dist/csr/Note";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { PrinterIcon } from "@phosphor-icons/react/dist/csr/Printer";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { UserPlusIcon } from "@phosphor-icons/react/dist/csr/UserPlus";
import { WifiSlashIcon } from "@phosphor-icons/react/dist/csr/WifiSlash";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";

import { projection, useStore } from "../lib/store.js";
import { useActiveSoiree, useRev } from "../lib/hooks.js";
import { useSession } from "../lib/session.js";
import { useUrlState } from "../lib/urlState.js";
import { getDeviceId, newId } from "../lib/device.js";
import { isAmount } from "../lib/validate.js";
import { plural } from "../lib/plural.js";
import { cn } from "../lib/cn.js";
import { exportReservationsCsv } from "../lib/export.js";
import { decodeCsv, parseReservationCsv, type CsvResult } from "../lib/reservationCsv.js";
import { deleteReservations, emitSale, setBookingTariffs, upsertReservations, voidOrder } from "../lib/actions.js";
import { Badge, Button, Card, EmptyState, Field, StepButton, TextInput } from "../components/ui.js";
import { Modal } from "../components/Modal.js";
import { ConfirmModal } from "../components/ConfirmModal.js";
import { PaymentModal } from "../components/PaymentModal.js";
import { NoSoiree } from "../components/NoSoiree.js";
import { Toast, useToast, type ToastData } from "../components/Toast.js";
import { TabBtn } from "./admin/TabBtn.js";

type Tab = "accueil" | "bord" | "gestion";

/**
 * Soirées sur réservation : remplace la liste imprimée que chaque caisse
 * surlignait. Un encaissement est une vente ordinaire (voir
 * `packages/shared/src/reservations.ts`) : il apparaît partout ailleurs —
 * stats, récap, comptage de caisse — sans traitement particulier.
 */
export function ReservationsScreen() {
  useRev();
  const soiree = useActiveSoiree();
  const isAdmin = useSession((s) => s.isAdmin);
  const [tab, setTab] = useUrlState<Tab>("vue", "accueil");
  const { toast, show, hide } = useToast();

  if (!soiree) return <NoSoiree />;
  const booking = isBookingSoiree(projection, soiree.id);
  if (!booking && !isAdmin) {
    return (
      <EmptyState
        icon={<ClipboardTextIcon size={48} weight="light" />}
        title="Cette soirée n'est pas sur réservation"
        hint="Un responsable peut fixer les tarifs dans l'onglet Réservations, avec le PIN."
      />
    );
  }
  // Sans tarifs, seule la gestion a un sens ; sans PIN, pas de gestion.
  const current: Tab = !booking ? "gestion" : tab === "gestion" && !isAdmin ? "accueil" : tab;

  return (
    <>
      {/* Accueil : plus large sur iPad en paysage, pour la colonne de droite. */}
      <div
        className={cn(
          "mx-auto flex h-full max-w-4xl flex-col p-4 print:hidden",
          current === "accueil" && "lg:max-w-6xl",
        )}
      >
        {/* Sur téléphone, les onglets prennent toute une ligne à parts égales au
            lieu de passer à la ligne n'importe où sous le titre. */}
        <div className="mb-3 flex shrink-0 flex-col gap-2 md:flex-row md:items-center">
          <h1 className="font-display text-title font-bold text-cream md:mr-auto">Réservations</h1>
          {booking && (
            <div className={cn("grid gap-2 md:flex", isAdmin ? "grid-cols-3" : "grid-cols-2")}>
              <TabBtn active={current === "accueil"} onClick={() => setTab("accueil")}>
                Accueil
              </TabBtn>
              <TabBtn active={current === "bord"} onClick={() => setTab("bord")}>
                Suivi
              </TabBtn>
              {isAdmin && (
                <TabBtn active={current === "gestion"} onClick={() => setTab("gestion")}>
                  Gestion
                </TabBtn>
              )}
            </div>
          )}
        </div>
        {current === "accueil" && <CheckinTab soireeId={soiree.id} toast={show} />}
        {current === "bord" && <DashboardTab soireeId={soiree.id} />}
        {current === "gestion" && <ManageTab soireeId={soiree.id} soireeName={soiree.name} toast={show} />}
        <Toast toast={toast} onHide={hide} />
      </div>
      {booking && <PrintList soireeId={soiree.id} />}
    </>
  );
}

/** « 2 adultes · 1 enfant » ; les tarifs à zéro sont omis. */
function countsLabel(tariffs: Tariff[], counts: Counts): string {
  const parts = tariffs
    .filter((t) => (counts[t.productId] ?? 0) > 0)
    .map((t) => plural(counts[t.productId], t.name.toLowerCase()));
  return parts.join(" · ") || "personne";
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Argent reçu à la porte pour cette arrivée (hors payé d'avance). */
function onSiteCents(row: ReservationRow): number {
  return [row.order, ...row.supplements]
    .filter((o): o is ClientOrder => o !== null && o.paymentMethod !== "prepaid")
    .reduce((s, o) => s + o.totalCents, 0);
}

/** « Table 12 » : là où l'accueil place le groupe. */
function TableTag({ table, large }: { table: string; large?: boolean }) {
  return (
    <span
      className={cn(
        "tnum shrink-0 rounded-control border border-line bg-well font-bold whitespace-nowrap text-cream",
        large ? "px-3 py-1 text-lead" : "px-1.5 py-0.5 text-micro",
      )}
    >
      Table {table}
    </span>
  );
}

function NoteBox({ note, large }: { note: string; large?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-control border border-lantern/60 bg-lantern/10 text-cream",
        large ? "mt-3 p-3 text-lead font-bold" : "mt-1 px-2 py-1 text-micro",
      )}
    >
      <NoteIcon size={large ? 22 : 14} weight="bold" className="mt-0.5 shrink-0 text-lantern" />
      <span className="min-w-0">{note}</span>
    </div>
  );
}

// ─── Accueil (caisse) ────────────────────────────────────────

function CheckinTab({ soireeId, toast }: { soireeId: string; toast: (t: ToastData) => void }) {
  useRev();
  const connected = useStore((s) => s.connected);
  const pendingIds = useStore((s) => s.pendingOrderIds);
  const isAdmin = useSession((s) => s.isAdmin);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<{ id: string } | "walkin" | null>(null);

  const tariffs = bookingTariffs(projection, soireeId);
  const rows = reservationRows(projection, soireeId);
  const shown = searchReservations(rows, q);
  const paidCount = rows.filter((r) => r.order && !r.walkIn).length;
  const expectedCount = rows.filter((r) => !r.walkIn).length;
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
        <p className="tnum mb-2 shrink-0 px-1 text-micro text-ash">
          Arrivées : {paidCount} / {plural(expectedCount, "réservation")}
        </p>

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
            shown.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setOpen({ id: r.id })}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-control border border-line bg-surface px-4 py-3 text-left",
                    "transition-colors hover:border-lantern/60 active:scale-[0.99]",
                    r.order && "bg-transparent",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className={cn("truncate text-lead font-bold", r.order ? "text-sand" : "text-cream")}>
                        {r.name}
                      </div>
                      {r.table && <TableTag table={r.table} />}
                    </div>
                    <div className="tnum truncate text-micro text-ash">
                      {r.walkIn ? "Sur place" : countsLabel(tariffs, r.counts)}
                      {r.phone && ` · ${r.phone}`}
                    </div>
                    {r.note && !r.order && <NoteBox note={r.note} />}
                  </div>
                  {r.order ? (
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone="mint">Arrivé</Badge>
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
            ))
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
      {selected?.order && (
        <PaidModal
          soireeId={soireeId}
          row={selected}
          pending={pendingIds.has(selected.order.id)}
          onClose={() => setOpen(null)}
          onDone={done}
        />
      )}
    </div>
  );
}

/**
 * Colonne de droite de l'accueil, sur iPad en paysage seulement : le bilan de
 * la porte et les remarques des groupes pas encore arrivés.
 */
function DoorSide({
  soireeId,
  rows,
  onOpen,
}: {
  soireeId: string;
  rows: ReservationRow[];
  onOpen: (id: string) => void;
}) {
  const d = bookingDashboard(projection, soireeId);
  const watch = rows.filter((r) => r.note && !r.order && !r.walkIn);
  const line = (label: string, value: ReactNode) => (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-sand">{label}</span>
      <b className="tnum text-cream">{value}</b>
    </div>
  );

  return (
    <aside className="hidden w-80 shrink-0 flex-col gap-3 overflow-y-auto pb-4 lg:flex">
      <Card className="p-4">
        <h2 className="font-display text-lead font-bold text-cream">Bilan</h2>
        <div className="mt-2 space-y-1.5 text-body">
          {line("Réservations arrivées", `${d.reservationsArrived} / ${d.reservations}`)}
          <ArrivalBar d={d} />
          {line("Couverts restants", `${d.remaining} / ${d.expected}`)}
          {line("Encaissé ce soir", formatCents(d.totalCents))}
        </div>
      </Card>
      <Card className="p-4">
        <h2 className="font-display text-lead font-bold text-cream">À surveiller</h2>
        {watch.length === 0 ? (
          <p className="mt-2 text-body text-ash">Aucune remarque en attente.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {watch.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => onOpen(r.id)}
                  className="w-full rounded-control border border-line bg-well px-3 py-2 text-left transition-colors hover:border-lantern/60"
                >
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-bold text-cream">{r.name}</span>
                    {r.table && <TableTag table={r.table} />}
                  </span>
                  <span className="mt-0.5 block text-micro text-lantern">{r.note}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </aside>
  );
}

function Counter({
  label,
  unitCents,
  value,
  onChange,
}: {
  label: string;
  unitCents: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-control border border-line bg-well p-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-lead font-bold text-cream">{label}</div>
        <div className="tnum text-micro text-ash">{formatCents(unitCents)} / personne</div>
      </div>
      <StepButton aria-label={`${label} : un de moins`} disabled={value === 0} onClick={() => onChange(value - 1)}>
        <MinusIcon size={18} weight="bold" />
      </StepButton>
      <span className="tnum font-display w-10 text-center text-title font-bold text-cream" aria-live="polite">
        {value}
      </span>
      <StepButton aria-label={`${label} : un de plus`} onClick={() => onChange(value + 1)}>
        <PlusIcon size={18} weight="bold" />
      </StepButton>
    </div>
  );
}

function Counters({ tariffs, counts, onChange }: { tariffs: Tariff[]; counts: Counts; onChange: (c: Counts) => void }) {
  return (
    <div className="space-y-2">
      {tariffs.map((t) => (
        <Counter
          key={t.productId}
          label={t.name}
          unitCents={t.priceCents}
          value={counts[t.productId] ?? 0}
          onChange={(n) => onChange({ ...counts, [t.productId]: n })}
        />
      ))}
    </div>
  );
}

/** Personnes au-delà de ce qui a été réglé d'avance, par tarif. */
function extras(counts: Counts, paid: Counts): Counts {
  return Object.fromEntries(Object.entries(counts).map(([id, n]) => [id, Math.max(0, n - (paid[id] ?? 0))]));
}

/**
 * Arrivée d'une réservation (`row`) ou d'un sur-place (`row === null`).
 * Payée d'avance : on pointe sans encaisser ; seules les personnes en plus
 * paient à la porte, dans une vente « supplément » à part.
 */
function CheckinModal({
  soireeId,
  row,
  initialName = "",
  onClose,
  onDone,
}: {
  soireeId: string;
  row: ReservationRow | null;
  initialName?: string;
  onClose: () => void;
  onDone: (t: ToastData) => void;
}) {
  const { label, cashierName } = useSession();
  const tariffs = bookingTariffs(projection, soireeId);
  const [counts, setCounts] = useState<Counts>(() => row?.counts ?? { [tariffs[0]?.productId ?? ""]: 1 });
  const [guest, setGuest] = useState(initialName);
  const [paying, setPaying] = useState(false);
  // Double appui pendant l'écriture locale = deux encaissements.
  const busy = useRef(false);

  const present = Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0));
  const prepaid = row?.prepaid ?? false;
  const paidItems = prepaid ? bookingItems(tariffs, row!.counts) : [];
  // Payé d'avance : seul le supplément est à encaisser.
  const dueItems = bookingItems(tariffs, prepaid ? extras(counts, row!.counts) : counts);
  const dueCents = itemsTotal(dueItems);
  const changed = row !== null && JSON.stringify(present) !== JSON.stringify(row.counts);
  const name = row?.name ?? (guest.trim() || "Sur place");
  const base = {
    soireeId,
    registerLabel: label ?? "Caisse",
    cashierName: cashierName ?? undefined,
  };

  const confirm = async (paymentMethod?: PaymentMethod, cashReceivedCents?: number) => {
    if (busy.current) return;
    busy.current = true;
    try {
      // Une autre caisse a pu passer pendant que la modale était ouverte.
      const winner = row && reservationRows(projection, soireeId).find((r) => r.id === row.id)?.order;
      if (winner) {
        onDone({
          tone: "error",
          text: `${row.name} : déjà pointée par ${winner.registerLabel}`,
        });
        return;
      }
      if (prepaid) {
        await emitSale({
          ...base,
          orderId: newId(),
          paymentMethod: "prepaid",
          items: paidItems,
          totalCents: itemsTotal(paidItems),
          reservationId: row!.id,
          heads: present,
        });
        if (dueItems.length > 0 && paymentMethod) {
          await emitSale({
            ...base,
            orderId: newId(),
            paymentMethod,
            items: dueItems,
            totalCents: dueCents,
            cashReceivedCents,
            reservationId: newId(),
            supplementOf: row!.id,
            // Déjà comptées dans l'arrivée ci-dessus.
            heads: {},
          });
        }
      } else {
        await emitSale({
          ...base,
          orderId: newId(),
          paymentMethod: paymentMethod!,
          items: dueItems,
          totalCents: dueCents,
          cashReceivedCents,
          reservationId: row?.id ?? newId(),
          guestName: row ? undefined : guest.trim() || undefined,
        });
      }
      onDone({
        text:
          dueCents > 0
            ? `${name} · ${formatCents(dueCents)} · ${paymentLabel(paymentMethod!).toLowerCase()}`
            : `${name} : arrivée pointée`,
      });
    } catch (e) {
      onDone({
        tone: "error",
        text: `Arrivée non enregistrée : ${(e as Error).message}`,
      });
    } finally {
      busy.current = false;
    }
  };

  if (paying) {
    return <PaymentModal totalCents={dueCents} cheque onClose={() => setPaying(false)} onConfirm={confirm} />;
  }

  return (
    <Modal open onClose={onClose}>
      <div className="flex items-center gap-3">
        <h2 className="font-display min-w-0 text-title font-bold text-cream">{row ? row.name : "Sur place"}</h2>
        {row?.table && <TableTag table={row.table} large />}
      </div>
      {row ? (
        <p className="tnum mt-1 text-body text-sand">
          Réservé : {countsLabel(tariffs, row.counts)}
          {row.phone && ` · ${row.phone}`}
        </p>
      ) : (
        <div className="mt-3">
          <Field label="Nom (facultatif)">
            <TextInput
              value={guest}
              onChange={(e) => setGuest(e.target.value)}
              maxLength={120}
              placeholder="Famille Roux"
            />
          </Field>
        </div>
      )}
      {row?.note && <NoteBox note={row.note} large />}
      {prepaid && (
        <div className="mt-3 flex items-center gap-2 rounded-control border border-dusk/60 bg-dusk/10 p-3 text-body text-cream">
          <CalendarCheckIcon size={20} weight="bold" className="shrink-0 text-dusk" />
          <span>
            <b>Payé d'avance</b> : <span className="tnum">{formatCents(itemsTotal(paidItems))}</span>. Rien à encaisser,
            sauf pour les personnes en plus.
          </span>
        </div>
      )}
      <div className="mt-4">
        <Counters tariffs={tariffs} counts={counts} onChange={setCounts} />
      </div>
      {changed && (
        <p className="mt-2 text-micro text-lantern">Nombre de personnes modifié par rapport à la réservation.</p>
      )}
      <div className="mt-6 flex gap-2">
        <Button variant="ghost" size="lg" onClick={onClose}>
          Retour
        </Button>
        {prepaid && dueCents === 0 ? (
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={countTotal(present) === 0}
            onClick={() => void confirm()}
          >
            Marquer arrivé
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={dueItems.length === 0}
            onClick={() => setPaying(true)}
          >
            {prepaid ? "Supplément" : "Encaisser"} <span className="tnum">{formatCents(dueCents)}</span>
          </Button>
        )}
      </div>
    </Modal>
  );
}

function PaidModal({
  soireeId,
  row,
  pending,
  onClose,
  onDone,
}: {
  soireeId: string;
  row: ReservationRow;
  pending: boolean;
  onClose: () => void;
  onDone: (t: ToastData) => void;
}) {
  const isAdmin = useSession((s) => s.isAdmin);
  const [confirming, setConfirming] = useState(false);
  const tariffs = bookingTariffs(projection, soireeId);
  const order = row.order!;
  const toRefund = onSiteCents(row);
  const allowed = () => isAdmin || canSelfVoid(order, getDeviceId(), new Date().toISOString());

  const cancel = async () => {
    // Revérifié au moment du geste : la fenêtre de 10 min a pu se fermer.
    if (!allowed()) {
      onDone({
        tone: "error",
        text: "Plus de 10 min : l'annulation demande le PIN admin",
      });
      return;
    }
    try {
      for (const o of [order, ...row.supplements]) await voidOrder(o.id, "Arrivée de réservation annulée");
      onDone({ text: `${row.name} : arrivée annulée` });
    } catch (e) {
      onDone({
        tone: "error",
        text: `Annulation non enregistrée : ${(e as Error).message}`,
      });
    }
  };

  return (
    <Modal open onClose={onClose}>
      <div className="flex items-center gap-3">
        <h2 className="font-display min-w-0 text-title font-bold text-cream">{row.name}</h2>
        {row.table && <TableTag table={row.table} large />}
      </div>
      <div className="mt-3 space-y-1 text-body text-sand">
        <p>
          <Badge tone="mint">Arrivé</Badge> pointé par <b className="text-cream">{order.registerLabel}</b> à{" "}
          {hhmm(order.createdAt)}
        </p>
        <p className="tnum">
          {countsLabel(tariffs, orderHeads(order))}
          {!row.walkIn && ` (réservé : ${countsLabel(tariffs, row.counts)})`}
        </p>
        {[order, ...row.supplements].map((o) => (
          <p key={o.id} className="tnum">
            <b className="text-cream">{formatCents(o.totalCents)}</b> · {paymentLabel(o.paymentMethod)}
            {o.supplementOf && " (supplément)"}
          </p>
        ))}
        {pending && (
          <p className="flex items-center gap-1.5 text-lantern">
            <HourglassMediumIcon size={16} weight="bold" />
            Pas encore synchronisé : une autre caisse ne le voit pas encore.
          </p>
        )}
      </div>
      {row.note && <NoteBox note={row.note} />}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
        <Button variant="ghost" size="lg" className="flex-1" onClick={onClose}>
          Retour
        </Button>
        {allowed() && (
          <Button variant="danger" size="lg" className="flex-1" onClick={() => setConfirming(true)}>
            Annuler l'arrivée
          </Button>
        )}
      </div>
      {!allowed() && (
        <p className="mt-3 text-micro text-ash">
          Pour annuler : la caisse qui a pointé dans les 10 minutes, sinon un poste avec le PIN admin.
        </p>
      )}
      <ConfirmModal
        open={confirming}
        title="Annuler cette arrivée ?"
        body={`${toRefund > 0 ? `${formatCents(toRefund)} à rendre à ${row.name}. ` : ""}La réservation redeviendra « à pointer ».`}
        confirmLabel="Annuler l'arrivée"
        onConfirm={() => void cancel()}
        onClose={() => setConfirming(false)}
      />
    </Modal>
  );
}

// ─── Suivi ───────────────────────────────────────────────────

function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="truncate text-micro font-bold tracking-wide text-ash uppercase">{label}</div>
      <div className="font-display tnum mt-1 text-title font-bold text-cream sm:text-display">{value}</div>
      {hint && <div className="tnum mt-1 text-body text-sand">{hint}</div>}
    </Card>
  );
}

function DashboardTab({ soireeId }: { soireeId: string }) {
  useRev();
  const d = bookingDashboard(projection, soireeId);
  const tariffs = bookingTariffs(projection, soireeId);
  const extra = [
    d.prepaidCents > 0 && `+ ${formatCents(d.prepaidCents)} payés d'avance`,
    d.giftedOrders > 0 && `+ ${plural(d.giftedOrders, "offert")}`,
  ].filter(Boolean);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Arrivés" value={d.arrived} hint={`dont ${d.arrivedWalkIn} sur place`} />
        <Kpi label="Couverts restants" value={d.remaining} hint={`sur ${d.expected} réservés`} />
        <Kpi label="Réservations" value={`${d.reservationsArrived} / ${d.reservations}`} hint="arrivées" />
        <Kpi label="Encaissé ce soir" value={formatCents(d.totalCents)} hint={extra.join(" · ") || undefined} />
      </div>

      <ArrivalBar d={d} className="mt-4" />

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="p-4 md:col-span-2">
          <h2 className="font-display text-lead font-bold text-cream">Par tarif</h2>
          <table className="mt-2 w-full text-body">
            <tbody className="tnum">
              {tariffs.map((t) => (
                <tr key={t.productId} className="border-t border-line first:border-0">
                  <td className="py-2 font-semibold text-cream">{t.name}</td>
                  <td className="py-2 text-right text-cream">
                    <b>{d.byTariff[t.productId]?.arrived ?? 0}</b>
                    <span className="text-ash"> arrivés / {d.byTariff[t.productId]?.expected ?? 0} réservés</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <BreakdownCard
          title="Par moyen de paiement"
          rows={d.byPaymentMethod.map((m) => ({
            key: m.method,
            label: paymentLabel(m.method),
            ...m,
          }))}
        />
        <BreakdownCard
          title="Par caisse"
          rows={d.byRegister.map((r) => ({
            key: r.registerLabel,
            label: r.registerLabel,
            ...r,
          }))}
        />
      </div>
    </div>
  );
}

function ArrivalBar({ d, className }: { d: BookingDashboard; className?: string }) {
  const pct = d.expected > 0 ? Math.min(100, Math.round(((d.expected - d.remaining) / d.expected) * 100)) : 0;
  return (
    <div
      className={cn("h-3 w-full overflow-hidden rounded-full bg-well", className)}
      role="progressbar"
      aria-label="Personnes réservées arrivées"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-mint transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; orders: number; revenueCents: number }[];
}) {
  return (
    <Card className="p-4">
      <h2 className="font-display text-lead font-bold text-cream">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-body text-ash">Rien d'encaissé pour l'instant.</p>
      ) : (
        <table className="mt-2 w-full text-body">
          <tbody className="tnum">
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-line first:border-0">
                <td className="py-2 font-semibold text-cream">{r.label}</td>
                <td className="py-2 text-right text-ash">{plural(r.orders, "encaissement")}</td>
                <td className="py-2 text-right font-bold text-cream">{formatCents(r.revenueCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// ─── Gestion (admin) ─────────────────────────────────────────

function ManageTab({
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

interface TariffDraft {
  productId?: string;
  name: string;
  price: string;
}

function TariffsEditor({
  soireeId,
  soireeName,
  booking,
  toast,
}: {
  soireeId: string;
  soireeName: string;
  booking: boolean;
  toast: (t: ToastData) => void;
}) {
  const [draft, setDraft] = useState<TariffDraft[]>(() =>
    booking
      ? bookingTariffs(projection, soireeId).map((t) => ({
          productId: t.productId,
          name: t.name,
          price: formatAmount(t.priceCents),
        }))
      : [
          {
            productId: BOOKING_ADULT_ID,
            name: projection.products[BOOKING_ADULT_ID]?.name ?? "Adulte",
            price: "",
          },
          {
            productId: BOOKING_CHILD_ID,
            name: projection.products[BOOKING_CHILD_ID]?.name ?? "Enfant",
            price: "",
          },
        ],
  );
  const [busy, setBusy] = useState(false);
  // Un tarif déjà réservé ne se retire pas : ces personnes n'auraient plus de prix.
  const used = new Set(reservationRows(projection, soireeId).flatMap((r) => Object.keys(r.counts)));
  const valid = draft.length > 0 && draft.every((t) => t.name.trim() !== "" && isAmount(t.price));
  const set = (i: number, patch: Partial<TariffDraft>) =>
    setDraft((d) => d.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await setBookingTariffs(
        soireeId,
        draft.map((t) => ({
          productId: t.productId,
          name: t.name.trim(),
          priceCents: parseAmountToCents(t.price),
        })),
      );
      toast({ text: "Tarifs enregistrés" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <h2 className="font-display text-lead font-bold text-cream">Tarifs de « {soireeName} »</h2>
      {!booking && (
        <p className="mt-1 text-body text-sand">
          Fixez les tarifs pour faire de cette soirée une soirée sur réservation.
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {draft.map((t, i) => (
          <li key={t.productId ?? i} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label={i === 0 ? "Tarif" : ""}>
                <TextInput
                  value={t.name}
                  onChange={(e) => set(i, { name: e.target.value })}
                  maxLength={40}
                  placeholder="Étudiant"
                  aria-label={`Nom du tarif ${i + 1}`}
                  invalid={t.name.trim() === ""}
                />
              </Field>
            </div>
            <div className="w-24 shrink-0">
              <Field label={i === 0 ? "Prix (€)" : ""}>
                <TextInput
                  inputMode="decimal"
                  value={t.price}
                  onChange={(e) => set(i, { price: e.target.value })}
                  aria-label={`Prix du tarif ${t.name || i + 1}`}
                  invalid={t.price !== "" && !isAmount(t.price)}
                  placeholder="24"
                />
              </Field>
            </div>
            <Button
              variant="ghost"
              aria-label={`Retirer le tarif ${t.name}`}
              title={t.productId && used.has(t.productId) ? "Des réservations utilisent ce tarif" : undefined}
              disabled={draft.length === 1 || (t.productId !== undefined && used.has(t.productId))}
              onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
            >
              <XIcon size={18} weight="bold" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          disabled={draft.length >= 10}
          onClick={() => setDraft((d) => [...d, { name: "", price: "" }])}
        >
          <PlusIcon size={18} weight="bold" />
          Ajouter un tarif
        </Button>
        <Button variant="primary" className="ml-auto" disabled={!valid || busy} onClick={() => void save()}>
          Enregistrer les tarifs
        </Button>
      </div>
    </Card>
  );
}

function ImportModal({
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

function EditModal({
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

// ─── Liste imprimée (secours papier) ─────────────────────────

/**
 * Feuille de secours pour le jour où le wifi ou les tablettes lâchent :
 * même usage que l'ancien Excel, mais à jour à la minute. Invisible à
 * l'écran, c'est elle seule qui sort à l'impression (Gestion → Imprimer).
 */
function PrintList({ soireeId }: { soireeId: string }) {
  useRev();
  const soiree = projection.soirees[soireeId];
  const tariffs = bookingTariffs(projection, soireeId);
  const rows = reservationRows(projection, soireeId).filter((r) => !r.walkIn);
  const totals = Object.fromEntries(
    tariffs.map((t) => [t.productId, rows.reduce((s, r) => s + (r.counts[t.productId] ?? 0), 0)]),
  );
  const cell = "border border-neutral-400 px-1.5 py-1";

  return (
    <article className="hidden bg-white font-sans text-[12px] leading-snug text-neutral-900 print:block">
      <header className="mb-2 flex items-baseline justify-between gap-2 border-b-2 border-neutral-900 pb-1">
        <h1 className="text-lg font-bold">{soiree?.name} — réservations</h1>
        <span className="text-[11px] text-neutral-600">
          {tariffs.map((t) => `${t.name} ${formatCents(t.priceCents)}`).join(" · ")} · imprimé le{" "}
          {new Date().toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
      </header>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-neutral-100 text-left">
            <th className={cn(cell, "w-8")}>✓</th>
            <th className={cell}>Nom</th>
            <th className={cell}>Table</th>
            <th className={cell}>Téléphone</th>
            {tariffs.map((t) => (
              <th key={t.productId} className={cn(cell, "text-right")}>
                {t.name}
              </th>
            ))}
            <th className={cn(cell, "text-right")}>À payer</th>
            <th className={cell}>Remarque</th>
          </tr>
        </thead>
        <tbody className="tnum">
          {rows.map((r) => (
            <tr key={r.id} className="break-inside-avoid">
              <td className={cn(cell, "text-center")}>{r.order ? "✓" : "☐"}</td>
              <td className={cn(cell, "font-semibold")}>{r.name}</td>
              <td className={cn(cell, "font-semibold")}>{r.table}</td>
              <td className={cell}>{r.phone}</td>
              {tariffs.map((t) => (
                <td key={t.productId} className={cn(cell, "text-right")}>
                  {r.counts[t.productId] || ""}
                </td>
              ))}
              <td className={cn(cell, "text-right")}>
                {r.prepaid ? "payé" : formatCents(itemsTotal(bookingItems(tariffs, r.counts)))}
              </td>
              <td className={cell}>{r.note}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className={cell} />
            <td className={cell} colSpan={3}>
              {plural(rows.length, "réservation")}
            </td>
            {tariffs.map((t) => (
              <td key={t.productId} className={cn(cell, "text-right")}>
                {totals[t.productId]}
              </td>
            ))}
            <td className={cell} colSpan={2} />
          </tr>
        </tbody>
      </table>
    </article>
  );
}

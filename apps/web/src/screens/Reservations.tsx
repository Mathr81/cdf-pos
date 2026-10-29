import { useRef, useState, type ReactNode } from "react";
import {
  bookingDashboard,
  bookingItems,
  bookingPrices,
  canSelfVoid,
  formatAmount,
  formatCents,
  isBookingSoiree,
  normalizeName,
  orderHeads,
  parseAmountToCents,
  paymentLabel,
  reservationRows,
  searchReservations,
  type PaymentMethod,
  type ReservationRow,
} from "@cdf/shared";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { HourglassMediumIcon } from "@phosphor-icons/react/dist/csr/HourglassMedium";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { MinusIcon } from "@phosphor-icons/react/dist/csr/Minus";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { UserPlusIcon } from "@phosphor-icons/react/dist/csr/UserPlus";
import { WifiSlashIcon } from "@phosphor-icons/react/dist/csr/WifiSlash";

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
import {
  deleteReservations,
  emitSale,
  setBookingPrices,
  upsertReservations,
  voidOrder,
} from "../lib/actions.js";
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
        hint="Un responsable peut fixer les tarifs adulte / enfant dans l'onglet Réservations, avec le PIN."
      />
    );
  }
  // Sans tarifs, seule la gestion a un sens ; sans PIN, pas de gestion.
  const current: Tab = !booking ? "gestion" : tab === "gestion" && !isAdmin ? "accueil" : tab;

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col p-4">
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
  );
}

function heads(adults: number, children: number): string {
  return `${plural(adults, "adulte")} · ${plural(children, "enfant")}`;
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ─── Accueil (caisse) ────────────────────────────────────────

function CheckinTab({ soireeId, toast }: { soireeId: string; toast: (t: ToastData) => void }) {
  useRev();
  const connected = useStore((s) => s.connected);
  const pendingIds = useStore((s) => s.pendingOrderIds);
  const isAdmin = useSession((s) => s.isAdmin);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<{ id: string } | "walkin" | null>(null);

  const rows = reservationRows(projection, soireeId);
  const shown = searchReservations(rows, q);
  const { adultCents, childCents } = bookingPrices(projection, soireeId);
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
    <div className="flex min-h-0 flex-1 flex-col">
      {!connected && (
        <div className="mb-3 flex items-start gap-2.5 rounded-control border border-signal/60 bg-signal/10 p-3 text-body text-cream">
          <WifiSlashIcon size={20} weight="bold" className="mt-0.5 shrink-0 text-signal" />
          <span>
            <b>Hors ligne.</b> Les encaissements restent sur cette tablette. Une autre caisse peut encaisser la
            même réservation : ce sera vérifié dès le retour du réseau.
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
            placeholder="Nom ou tél."
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
        Encaissées : {paidCount} / {plural(expectedCount, "réservation")}
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
                  <div className={cn("truncate text-lead font-bold", r.order ? "text-sand" : "text-cream")}>
                    {r.name}
                  </div>
                  <div className="tnum truncate text-micro text-ash">
                    {r.walkIn ? "Sur place" : heads(r.adults, r.children)}
                    {r.phone && ` · ${r.phone}`}
                  </div>
                </div>
                {r.order ? (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone="mint">Encaissé</Badge>
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
                ) : (
                  <span className="tnum font-display shrink-0 text-lead font-bold text-lantern">
                    {formatCents(r.adults * adultCents + r.children * childCents)}
                  </span>
                )}
              </button>
            </li>
          ))
        )}
      </ul>

      {open === "walkin" && (
        <CheckinModal soireeId={soireeId} row={null} initialName={q} onClose={() => setOpen(null)} onDone={done} />
      )}
      {selected && !selected.order && (
        <CheckinModal soireeId={soireeId} row={selected} onClose={() => setOpen(null)} onDone={done} />
      )}
      {selected?.order && (
        <PaidModal
          row={selected}
          pending={pendingIds.has(selected.order.id)}
          onClose={() => setOpen(null)}
          onDone={done}
        />
      )}
    </div>
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
        <div className="text-lead font-bold text-cream">{label}</div>
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

/** Encaissement d'une réservation (`row`) ou d'un sur-place (`row === null`). */
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
  const [adults, setAdults] = useState(row?.adults ?? 1);
  const [children, setChildren] = useState(row?.children ?? 0);
  const [guest, setGuest] = useState(initialName);
  const [paying, setPaying] = useState(false);
  // Double appui pendant l'écriture locale = deux encaissements.
  const busy = useRef(false);

  const prices = bookingPrices(projection, soireeId);
  const items = bookingItems(projection, soireeId, adults, children);
  const totalCents = items.reduce((s, it) => s + it.qty * it.unitPriceCents, 0);
  const changed = row !== null && (adults !== row.adults || children !== row.children);
  const name = row?.name ?? (guest.trim() || "Sur place");

  const confirm = async (paymentMethod: PaymentMethod, cashReceivedCents?: number) => {
    if (busy.current) return;
    busy.current = true;
    try {
      // Une autre caisse a pu passer pendant que la modale était ouverte.
      const winner = row && reservationRows(projection, soireeId).find((r) => r.id === row.id)?.order;
      if (winner) {
        onDone({ tone: "error", text: `${row.name} : déjà encaissée par ${winner.registerLabel}` });
        return;
      }
      await emitSale({
        orderId: newId(),
        soireeId,
        registerLabel: label ?? "Caisse",
        cashierName: cashierName ?? undefined,
        paymentMethod,
        items,
        totalCents,
        cashReceivedCents,
        reservationId: row?.id ?? newId(),
        guestName: row ? undefined : guest.trim() || undefined,
      });
      onDone({ text: `${name} · ${formatCents(totalCents)} · ${paymentLabel(paymentMethod).toLowerCase()}` });
    } catch (e) {
      onDone({ tone: "error", text: `Encaissement non enregistré : ${(e as Error).message}` });
    } finally {
      busy.current = false;
    }
  };

  if (paying) {
    return <PaymentModal totalCents={totalCents} onClose={() => setPaying(false)} onConfirm={confirm} />;
  }

  return (
    <Modal open onClose={onClose}>
      <h2 className="font-display text-title font-bold text-cream">{row ? row.name : "Sur place"}</h2>
      {row ? (
        <p className="tnum mt-1 text-body text-sand">
          Réservé : {heads(row.adults, row.children)}
          {row.phone && ` · ${row.phone}`}
        </p>
      ) : (
        <div className="mt-3">
          <Field label="Nom (facultatif)">
            <TextInput value={guest} onChange={(e) => setGuest(e.target.value)} maxLength={120} placeholder="Famille Roux" />
          </Field>
        </div>
      )}
      <div className="mt-4 space-y-2">
        <Counter label="Adultes" unitCents={prices.adultCents} value={adults} onChange={setAdults} />
        <Counter label="Enfants" unitCents={prices.childCents} value={children} onChange={setChildren} />
      </div>
      {changed && (
        <p className="mt-2 text-micro text-lantern">Nombre de personnes modifié par rapport à la réservation.</p>
      )}
      <div className="mt-6 flex gap-2">
        <Button variant="ghost" size="lg" onClick={onClose}>
          Retour
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={items.length === 0}
          onClick={() => setPaying(true)}
        >
          Encaisser <span className="tnum">{formatCents(totalCents)}</span>
        </Button>
      </div>
    </Modal>
  );
}

function PaidModal({
  row,
  pending,
  onClose,
  onDone,
}: {
  row: ReservationRow;
  pending: boolean;
  onClose: () => void;
  onDone: (t: ToastData) => void;
}) {
  const isAdmin = useSession((s) => s.isAdmin);
  const [confirming, setConfirming] = useState(false);
  const order = row.order!;
  const got = orderHeads(order);
  const allowed = () => isAdmin || canSelfVoid(order, getDeviceId(), new Date().toISOString());

  const cancel = async () => {
    // Revérifié au moment du geste : la fenêtre de 10 min a pu se fermer.
    if (!allowed()) {
      onDone({ tone: "error", text: "Plus de 10 min : l'annulation demande le PIN admin" });
      return;
    }
    try {
      await voidOrder(order.id, "Encaissement de réservation annulé");
      onDone({ text: `${row.name} : encaissement annulé` });
    } catch (e) {
      onDone({ tone: "error", text: `Annulation non enregistrée : ${(e as Error).message}` });
    }
  };

  return (
    <Modal open onClose={onClose}>
      <h2 className="font-display text-title font-bold text-cream">{row.name}</h2>
      <div className="mt-3 space-y-1 text-body text-sand">
        <p>
          <Badge tone="mint">Encaissé</Badge> par <b className="text-cream">{order.registerLabel}</b> à{" "}
          {hhmm(order.createdAt)}
        </p>
        <p className="tnum">
          {heads(got.adults, got.children)}
          {!row.walkIn && ` (réservé : ${heads(row.adults, row.children)})`}
        </p>
        <p className="tnum">
          <b className="text-cream">{formatCents(order.totalCents)}</b> · {paymentLabel(order.paymentMethod)}
        </p>
        {pending && (
          <p className="flex items-center gap-1.5 text-lantern">
            <HourglassMediumIcon size={16} weight="bold" />
            Pas encore synchronisé : une autre caisse ne le voit pas encore.
          </p>
        )}
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
        <Button variant="ghost" size="lg" className="flex-1" onClick={onClose}>
          Retour
        </Button>
        {allowed() && (
          <Button variant="danger" size="lg" className="flex-1" onClick={() => setConfirming(true)}>
            Annuler l'encaissement
          </Button>
        )}
      </div>
      {!allowed() && (
        <p className="mt-3 text-micro text-ash">
          Pour annuler : la caisse qui a encaissé dans les 10 minutes, sinon un poste avec le PIN admin.
        </p>
      )}
      <ConfirmModal
        open={confirming}
        title="Annuler cet encaissement ?"
        body={`${formatCents(order.totalCents)} à rendre à ${row.name}. La réservation redeviendra « à encaisser ».`}
        confirmLabel="Annuler l'encaissement"
        onConfirm={() => void cancel()}
        onClose={() => setConfirming(false)}
      />
    </Modal>
  );
}

// ─── Tableau de bord ─────────────────────────────────────────

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
  const pct = d.expected > 0 ? Math.min(100, Math.round(((d.expected - d.remaining) / d.expected) * 100)) : 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Arrivés"
          value={d.arrived}
          hint={`dont ${d.arrivedWalkIn} sur place`}
        />
        <Kpi label="Couverts restants" value={d.remaining} hint={`sur ${d.expected} réservés`} />
        <Kpi
          label="Réservations"
          value={`${d.reservationsArrived} / ${d.reservations}`}
          hint="arrivées"
        />
        <Kpi
          label="Encaissé"
          value={formatCents(d.totalCents)}
          hint={d.giftedOrders > 0 ? `+ ${plural(d.giftedOrders, "offert")}` : undefined}
        />
      </div>

      <div
        className="mt-4 h-3 w-full overflow-hidden rounded-full bg-well"
        role="progressbar"
        aria-label="Personnes réservées arrivées"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-mint transition-[width]" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <BreakdownCard
          title="Par moyen de paiement"
          rows={d.byPaymentMethod.map((m) => ({ key: m.method, label: paymentLabel(m.method), ...m }))}
        />
        <BreakdownCard
          title="Par caisse"
          rows={d.byRegister.map((r) => ({ key: r.registerLabel, label: r.registerLabel, ...r }))}
        />
      </div>
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
  const prices = bookingPrices(projection, soireeId);
  const [adult, setAdult] = useState(booking ? formatAmount(prices.adultCents) : "");
  const [child, setChild] = useState(booking ? formatAmount(prices.childCents) : "");
  const [imported, setImported] = useState<CsvResult | null>(null);
  const [editing, setEditing] = useState<ReservationRow | "new" | null>(null);
  const [clearing, setClearing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const rows = reservationRows(projection, soireeId).filter((r) => !r.walkIn);
  const pricesValid = isAmount(adult) && isAmount(child);
  // Les encaissées restent : leur supprimer la réservation ferait passer l'argent en « sur place ».
  const unpaid = rows.filter((r) => !r.order);

  const savePrices = async () => {
    if (!pricesValid) return;
    await setBookingPrices(soireeId, parseAmountToCents(adult), parseAmountToCents(child));
    toast({ text: "Tarifs enregistrés" });
  };

  const readFile = async (file: File) => {
    setImported(parseReservationCsv(decodeCsv(await file.arrayBuffer())));
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
      <Card className="p-4">
        <h2 className="font-display text-lead font-bold text-cream">Tarifs de « {soireeName} »</h2>
        {!booking && (
          <p className="mt-1 text-body text-sand">
            Fixez les tarifs pour faire de cette soirée une soirée sur réservation.
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Adulte (€)">
            <TextInput inputMode="decimal" value={adult} onChange={(e) => setAdult(e.target.value)} invalid={adult !== "" && !isAmount(adult)} placeholder="24" />
          </Field>
          <Field label="Enfant (€)">
            <TextInput inputMode="decimal" value={child} onChange={(e) => setChild(e.target.value)} invalid={child !== "" && !isAmount(child)} placeholder="9" />
          </Field>
        </div>
        <Button variant="primary" className="mt-3" disabled={!pricesValid} onClick={() => void savePrices()}>
          Enregistrer les tarifs
        </Button>
      </Card>

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
            CSV avec une colonne Nom (et éventuellement Prénom), Adultes, Enfants, Téléphone. Séparateur « ; » ou « , ».
          </p>
          <ul className="mt-3 space-y-1.5">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-control border border-line bg-well px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-cream">{r.name}</div>
                  <div className="tnum truncate text-micro text-ash">
                    {heads(r.adults, r.children)}
                    {r.phone && ` · ${r.phone}`}
                  </div>
                </div>
                {r.order && <Badge tone="mint">Encaissé</Badge>}
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
          result={imported}
          existing={rows}
          onClose={() => setImported(null)}
          onDone={(n) => {
            setImported(null);
            toast({ text: `${plural(n, "réservation")} importée${n > 1 ? "s" : ""}` });
          }}
        />
      )}
      <ConfirmModal
        open={clearing}
        title={`Supprimer ${plural(unpaid.length, "réservation")} ?`}
        body={
          unpaid.length < rows.length
            ? `Les ${rows.length - unpaid.length} déjà encaissées sont gardées. Pratique avant de réimporter une liste corrigée.`
            : "Pratique avant de réimporter une liste corrigée."
        }
        confirmLabel="Supprimer"
        onConfirm={() => void deleteReservations(unpaid.map((r) => r.id))}
        onClose={() => setClearing(false)}
      />
      {editing && (
        <EditModal
          soireeId={soireeId}
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ImportModal({
  soireeId,
  result,
  existing,
  onClose,
  onDone,
}: {
  soireeId: string;
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
      await upsertReservations(
        result.rows.filter((_, i) => checked[i]).map((r) => ({ id: newId(), soireeId, ...r })),
      );
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
          <p className="font-bold">{plural(result.errors.length, "ligne illisible", "lignes illisibles")} (non importées) :</p>
          <ul className="mt-1 list-disc pl-5 text-sand">
            {result.errors.map((e) => (
              <li key={e.line}>
                Ligne {e.line} — {e.message}
              </li>
            ))}
          </ul>
        </div>
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
                <span className="block truncate font-bold text-cream">{r.name}</span>
                <span className="tnum block truncate text-micro text-ash">
                  {heads(r.adults, r.children)}
                  {r.phone && ` · ${r.phone}`}
                </span>
              </span>
              {dupes[i] && <Badge tone="lantern">Déjà dans la liste</Badge>}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex gap-2">
        <Button variant="ghost" size="lg" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" size="lg" className="flex-1" disabled={count === 0 || busy} onClick={() => void run()}>
          Importer {plural(count, "réservation")}
        </Button>
      </div>
    </Modal>
  );
}

function EditModal({
  soireeId,
  row,
  onClose,
}: {
  soireeId: string;
  row: ReservationRow | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(row?.name ?? "");
  const [adults, setAdults] = useState(row?.adults ?? 2);
  const [children, setChildren] = useState(row?.children ?? 0);
  const [phone, setPhone] = useState(row?.phone ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const prices = bookingPrices(projection, soireeId);
  const valid = name.trim() !== "" && adults + children > 0;

  const save = async () => {
    if (!valid) return;
    await upsertReservations([
      { id: row?.id ?? newId(), soireeId, name: name.trim(), adults, children, phone: phone.trim() || undefined },
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
        <Counter label="Adultes" unitCents={prices.adultCents} value={adults} onChange={setAdults} />
        <Counter label="Enfants" unitCents={prices.childCents} value={children} onChange={setChildren} />
        <Field label="Téléphone (facultatif)">
          <TextInput type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
        </Field>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {row && (
          <Button
            variant="danger"
            size="lg"
            disabled={row.order !== null}
            title={row.order ? "Annulez d'abord l'encaissement" : undefined}
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

import { useRef, useState } from "react";
import {
  arrivedHeads,
  bookingItems,
  bookingTariffs,
  countTotal,
  formatCents,
  itemsTotal,
  paymentLabel,
  reservationRows,
  type Counts,
  type PaymentMethod,
  type ReservationRow,
} from "@cdf/shared";
import { CalendarCheckIcon } from "@phosphor-icons/react/dist/csr/CalendarCheck";

import { projection } from "../../lib/store.js";
import { useSession } from "../../lib/session.js";
import { newId } from "../../lib/device.js";
import { emitSale } from "../../lib/actions.js";
import { Button, Field, TextInput } from "../../components/ui.js";
import { Modal } from "../../components/Modal.js";
import { PaymentModal } from "../../components/PaymentModal.js";
import { type ToastData } from "../../components/Toast.js";
import { countsLabel, stillExpected, extras } from "./rows.js";
import { TableTag, NoteBox, Counters } from "./parts.js";

/**
 * Arrivée d'une réservation (`row`) ou d'un sur-place (`row === null`).
 * Payée d'avance : on pointe sans encaisser ; seules les personnes en plus
 * paient à la porte, dans une vente « supplément » à part.
 * `more` : vague suivante d'un groupe déjà en partie arrivé ; chacun paie sa
 * part dans une vente rattachée au groupe, comme un supplément.
 */
export function CheckinModal({
  soireeId,
  row,
  more = false,
  initialName = "",
  onClose,
  onDone,
}: {
  soireeId: string;
  row: ReservationRow | null;
  more?: boolean;
  initialName?: string;
  onClose: () => void;
  onDone: (t: ToastData) => void;
}) {
  const { label, cashierName } = useSession();
  const tariffs = bookingTariffs(projection, soireeId);
  const [counts, setCounts] = useState<Counts>(() => {
    const one = { [tariffs[0]?.productId ?? ""]: 1 };
    if (more) return countTotal(stillExpected(row!)) > 0 ? stillExpected(row!) : one;
    return row?.counts ?? one;
  });
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
  const changed = !more && row !== null && JSON.stringify(present) !== JSON.stringify(row.counts);
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
      const winner = !more && row && reservationRows(projection, soireeId).find((r) => r.id === row.id)?.order;
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
          // Vague suivante : id neuf, sinon le serveur y verrait un second encaissement.
          reservationId: row && !more ? row.id : newId(),
          supplementOf: more ? row!.id : undefined,
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
        <h2 className="font-display min-w-0 text-title font-bold text-cream">
          {row ? row.name : "Sur place"}
          {more && <span className="text-sand"> · arrivants en plus</span>}
        </h2>
        {row?.table && <TableTag table={row.table} large />}
      </div>
      {row ? (
        <p className="tnum mt-1 text-body text-sand">
          {more && `Déjà arrivés : ${countsLabel(tariffs, arrivedHeads(row))} · `}
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

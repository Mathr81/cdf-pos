import { useState } from "react";
import {
  arrivedHeads,
  bookingItems,
  bookingTariffs,
  canSelfVoid,
  countTotal,
  formatCents,
  itemsTotal,
  orderHeads,
  paymentLabel,
  type ClientOrder,
  type ReservationRow,
} from "@cdf/shared";
import { HourglassMediumIcon } from "@phosphor-icons/react/dist/csr/HourglassMedium";
import { UserPlusIcon } from "@phosphor-icons/react/dist/csr/UserPlus";

import { projection } from "../../lib/store.js";
import { useSession } from "../../lib/session.js";
import { getDeviceId } from "../../lib/device.js";
import { plural } from "../../lib/plural.js";
import { setReservationComplete, voidOrder } from "../../lib/actions.js";
import { Badge, Button } from "../../components/ui.js";
import { Modal } from "../../components/Modal.js";
import { ConfirmModal } from "../../components/ConfirmModal.js";
import { type ToastData } from "../../components/Toast.js";
import { countsLabel, hhmm, onSiteCents, stillExpected } from "./rows.js";
import { TableTag, NoteBox } from "./parts.js";

export function PaidModal({
  soireeId,
  row,
  pending,
  onMore,
  onClose,
  onDone,
}: {
  soireeId: string;
  row: ReservationRow;
  pending: boolean;
  onMore: () => void;
  onClose: () => void;
  onDone: (t: ToastData) => void;
}) {
  const isAdmin = useSession((s) => s.isAdmin);
  const [confirming, setConfirming] = useState(false);
  const [voiding, setVoiding] = useState<ClientOrder | null>(null);
  const tariffs = bookingTariffs(projection, soireeId);
  const order = row.order!;
  const toRefund = onSiteCents(row);
  // Le serveur vérifie chaque annulation : une vague encaissée par une autre caisse demande le PIN.
  const canVoid = (o: ClientOrder) => isAdmin || canSelfVoid(o, getDeviceId(), new Date().toISOString());
  const allowed = () => [order, ...row.supplements].every(canVoid);
  const missing = countTotal(row.counts) - countTotal(arrivedHeads(row));
  const expected = stillExpected(row);
  // Groupe en partie arrivé : la suite, c'est presque toujours la vague suivante.
  const waiting = countTotal(expected) > 0;

  const setComplete = async (complete: boolean) => {
    try {
      await setReservationComplete(row.id, complete);
      onDone({ text: complete ? `${row.name} : groupe complet` : `${row.name} : de nouveau attendu` });
    } catch (e) {
      onDone({ tone: "error", text: `Non enregistré : ${(e as Error).message}` });
    }
  };

  const cancelWave = async (o: ClientOrder) => {
    if (!canVoid(o)) {
      onDone({ tone: "error", text: "Plus de 10 min : l'annulation demande le PIN admin" });
      return;
    }
    try {
      await voidOrder(o.id, "Arrivants annulés");
      onDone({ text: `${row.name} : ${formatCents(o.totalCents)} annulé` });
    } catch (e) {
      onDone({ tone: "error", text: `Annulation non enregistrée : ${(e as Error).message}` });
    }
  };

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
          {waiting ? (
            <Badge tone="lantern">
              <span className="tnum">
                {countTotal(arrivedHeads(row))}/{countTotal(row.counts)}
              </span>{" "}
              arrivés
            </Badge>
          ) : (
            <Badge tone="mint">Arrivé</Badge>
          )}{" "}
          pointé par <b className="text-cream">{order.registerLabel}</b> à{" "}
          {hhmm(order.createdAt)}
        </p>
        <p className="tnum">
          {countsLabel(tariffs, arrivedHeads(row))}
          {!row.walkIn && ` (réservé : ${countsLabel(tariffs, row.counts)})`}
        </p>
        {[order, ...row.supplements].map((o) => (
          <div key={o.id} className="tnum flex items-center gap-2">
            <p className="min-w-0 flex-1">
              <b className="text-cream">{formatCents(o.totalCents)}</b> · {paymentLabel(o.paymentMethod)}
              {o.supplementOf &&
                (row.prepaid
                  ? " (supplément)"
                  : ` · ${countsLabel(tariffs, orderHeads(o))} · ${o.registerLabel} ${hhmm(o.createdAt)}`)}
            </p>
            {/* Supplément d'un payé d'avance : ses personnes sont dans l'arrivée, on annule le tout. */}
            {o.supplementOf && !row.prepaid && canVoid(o) && (
              <Button variant="ghost" size="sm" onClick={() => setVoiding(o)}>
                Annuler
              </Button>
            )}
          </div>
        ))}
        {pending && (
          <p className="flex items-center gap-1.5 text-lantern">
            <HourglassMediumIcon size={16} weight="bold" />
            Pas encore synchronisé : une autre caisse ne le voit pas encore.
          </p>
        )}
      </div>
      {row.note && <NoteBox note={row.note} />}
      {waiting ? (
        <>
          <Button variant="primary" size="xl" className="mt-5 w-full" onClick={onMore}>
            <UserPlusIcon size={28} weight="bold" className="shrink-0" />
            <span className="flex min-w-0 flex-col items-start text-left">
              <span>Ajouter des arrivants</span>
              <span className="tnum text-body font-semibold opacity-75">
                {countsLabel(tariffs, expected)} {countTotal(expected) > 1 ? "attendus" : "attendu"} · {formatCents(itemsTotal(bookingItems(tariffs, expected)))}
              </span>
            </span>
          </Button>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" size="lg" className="flex-1" onClick={onClose}>
              Retour
            </Button>
            {/* Les absents ne viendront pas : le groupe quitte « À venir » et le reste à encaisser. */}
            <Button size="lg" className="flex-1" onClick={() => void setComplete(true)}>
              Groupe complet · {plural(countTotal(expected), "absent")}
            </Button>
          </div>
          {allowed() && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-2 min-h-11 w-full text-body font-bold text-signal hover:underline"
            >
              Annuler l'arrivée
            </button>
          )}
        </>
      ) : (
        <>
          {/* Groupe au complet : plus de monde que prévu, ça arrive, mais rarement. */}
          {!row.prepaid && !row.walkIn && (
            <Button size="lg" className="mt-4 w-full" onClick={onMore}>
              <UserPlusIcon size={20} weight="bold" />
              Ajouter des arrivants
            </Button>
          )}
          {row.complete && missing > 0 && (
            <p className="mt-2 flex items-center gap-2 text-micro text-ash">
              <span>Déclaré complet : {plural(missing, "absent")}.</span>
              <button
                type="button"
                className="font-bold text-sand underline hover:text-cream"
                onClick={() => void setComplete(false)}
              >
                Rouvrir
              </button>
            </p>
          )}
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
        </>
      )}
      {!allowed() && (
        <p className="mt-3 text-micro text-ash">
          Pour annuler : la caisse qui a encaissé, dans les 10 minutes, sinon un poste avec le PIN admin.
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
      <ConfirmModal
        open={voiding !== null}
        title="Annuler ces arrivants ?"
        body={
          voiding
            ? `${formatCents(voiding.totalCents)} à rendre. ${countsLabel(tariffs, orderHeads(voiding))} : de nouveau attendus.`
            : ""
        }
        confirmLabel="Annuler ces arrivants"
        onConfirm={() => voiding && void cancelWave(voiding)}
        onClose={() => setVoiding(null)}
      />
    </Modal>
  );
}

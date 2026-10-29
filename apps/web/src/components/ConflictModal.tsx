import { useState } from "react";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";
import { formatCents, paymentLabel, reservationRows } from "@cdf/shared";
import { projection, useStore } from "../lib/store.js";
import { useRev } from "../lib/hooks.js";
import { resolveConflict } from "../lib/actions.js";
import { Button } from "./ui.js";
import { Modal } from "./Modal.js";

/**
 * Une réservation encaissée ici l'avait déjà été par une autre caisse (les
 * deux hors ligne, ou presque en même temps). Le serveur a gardé l'autre.
 * Bloquant, et sur tous les écrans : la caisse a peut-être de l'argent dans
 * la boîte qui ne correspond plus à aucune vente.
 */
export function ConflictModal() {
  useRev();
  const conflicts = useStore((s) => s.conflicts);
  const [busy, setBusy] = useState(false);
  const row = conflicts[0];
  if (!row) return null;

  const p = row.event.payload;
  const name = projection.reservations[p.reservationId ?? ""]?.name ?? p.guestName ?? "Réservation";
  const winner = reservationRows(projection, p.soireeId).find((r) => r.id === p.reservationId)?.order;
  // Un groupe qui arrive en plusieurs fois, encaissé à deux portes en même temps.
  // Payé d'avance : le pointage n'est pas de l'argent, il n'y a rien à rattacher.
  const group = projection.reservations[p.reservationId ?? ""];
  const canJoin = group !== undefined && !group.prepaid && p.paymentMethod !== "prepaid";
  const decide = async (outcome: "groupe" | "sur-place" | "rien") => {
    setBusy(true);
    try {
      await resolveConflict(row, outcome);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={() => {}} dismissable={false}>
      <div className="flex items-start gap-3">
        <WarningIcon size={28} weight="fill" className="mt-0.5 shrink-0 text-signal" />
        <div>
          <h2 className="font-display text-title font-bold text-cream">« {name} » déjà encaissée</h2>
          <p className="mt-2 text-body text-sand">
            {winner
              ? `${winner.registerLabel} l'a encaissée à ${new Date(winner.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} (${formatCents(winner.totalCents)}).`
              : `${row.error}.`}{" "}
            Votre encaissement de <b className="text-cream">{formatCents(p.totalCents)}</b> (
            {paymentLabel(p.paymentMethod).toLowerCase()}, {new Date(row.event.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}) n'a pas été retenu.
          </p>
          <p className="mt-3 text-body font-bold text-cream">Avez-vous reçu cet argent ?</p>
          <p className="text-micro text-ash">
            {canJoin
              ? "Si oui, c'étaient d'autres membres du groupe, arrivés à une autre porte, ou un homonyme."
              : "Si oui, c'étaient d'autres personnes (un homonyme par exemple)."}
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-2">
        {canJoin && (
          <Button variant="primary" size="lg" disabled={busy} onClick={() => void decide("groupe")}>
            Oui : ajouter aux arrivants du groupe
          </Button>
        )}
        <Button
          variant={canJoin ? "secondary" : "primary"}
          size="lg"
          disabled={busy}
          onClick={() => void decide("sur-place")}
        >
          Oui : {canJoin ? "un autre groupe, " : ""}garder en sur-place
        </Button>
        <Button variant="ghost" size="lg" disabled={busy} onClick={() => void decide("rien")}>
          Non, rien reçu (ou remboursé)
        </Button>
      </div>
      {conflicts.length > 1 && (
        <p className="tnum mt-3 text-center text-micro text-ash">{conflicts.length - 1} autre(s) ensuite</p>
      )}
    </Modal>
  );
}

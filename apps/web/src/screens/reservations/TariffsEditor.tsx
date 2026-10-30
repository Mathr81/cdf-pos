import { useState } from "react";
import {
  bookingTariffs,
  formatAmount,
  parseAmountToCents,
  reservationRows,
  BOOKING_ADULT_ID,
  BOOKING_CHILD_ID,
} from "@cdf/shared";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";

import { projection } from "../../lib/store.js";
import { isAmount } from "../../lib/validate.js";
import { setBookingTariffs } from "../../lib/actions.js";
import { Button, Card, Field, TextInput } from "../../components/ui.js";
import { type ToastData } from "../../components/Toast.js";

interface TariffDraft {
  productId?: string;
  name: string;
  price: string;
}

export function TariffsEditor({
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

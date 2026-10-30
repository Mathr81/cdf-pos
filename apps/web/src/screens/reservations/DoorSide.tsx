import {
  bookingDashboard,
  bookingItems,
  bookingTariffs,
  formatCents,
  itemsTotal,
  paymentLabel,
  type ReservationRow,
} from "@cdf/shared";
import { CalendarCheckIcon } from "@phosphor-icons/react/dist/csr/CalendarCheck";

import { projection } from "../../lib/store.js";
import { plural } from "../../lib/plural.js";
import { payLook } from "../../lib/payLook.js";
import { Card } from "../../components/ui.js";
import { stillExpected, awaited } from "./rows.js";
import { TableTag } from "./parts.js";

/**
 * Colonne de droite de l'accueil, sur iPad en paysage seulement : le bilan de
 * la porte, les remarques des groupes pas encore arrivés, les arrivées par
 * tarif et l'argent reçu par moyen de paiement.
 */
export function DoorSide({
  soireeId,
  rows,
  onOpen,
}: {
  soireeId: string;
  rows: ReservationRow[];
  onOpen: (id: string) => void;
}) {
  const d = bookingDashboard(projection, soireeId);
  const tariffs = bookingTariffs(projection, soireeId);
  const watch = rows.filter((r) => r.note && !r.walkIn && awaited(r));
  // Ce que la porte doit encore encaisser : personnes attendues, hors payé d'avance.
  const toCollect = rows
    .filter((r) => !r.prepaid)
    .reduce((s, r) => s + itemsTotal(bookingItems(tariffs, stillExpected(r))), 0);
  const moneyScale = d.totalCents + toCollect;

  // Chiffres en haut, toujours visibles ; les remarques prennent la place
  // qui reste et défilent dans leur carte.
  return (
    <aside className="hidden w-80 shrink-0 flex-col gap-3 overflow-y-auto pb-4 lg:flex">
      <Card className="shrink-0 p-4">
        <h2 className="font-display text-lead font-bold text-cream">Arrivées</h2>
        <div className="mt-3 flex items-center gap-4">
          <Ring value={d.expected - d.remaining} total={d.expected} />
          <div className="min-w-0 text-body">
            <p className="text-sand">couverts arrivés</p>
            <p className="tnum mt-1 text-cream">
              <b>{d.reservationsArrived}</b> / {d.reservations} réservations
            </p>
            {d.arrivedWalkIn > 0 && <p className="tnum text-micro text-ash">+ {d.arrivedWalkIn} sur place</p>}
          </div>
        </div>
        <div className="mt-4 space-y-2.5">
          {tariffs.map((t) => {
            const { arrived = 0, expected = 0 } = d.byTariff[t.productId] ?? {};
            return (
              <div key={t.productId}>
                <div className="flex items-baseline justify-between gap-2 text-micro">
                  <span className="truncate text-sand">{t.name}</span>
                  <span className="tnum text-cream">
                    <b>{arrived}</b> / {expected}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-well">
                  <div
                    className="h-full rounded-full bg-mint transition-[width]"
                    style={{ width: `${expected > 0 ? Math.min(100, (arrived / expected) * 100) : 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card className="shrink-0 p-4">
        <h2 className="font-display text-lead font-bold text-cream">Encaissé</h2>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <b className="tnum font-display text-title text-cream">{formatCents(d.totalCents)}</b>
          {toCollect > 0 && <span className="tnum text-micro text-ash">+ {formatCents(toCollect)} à venir</span>}
        </p>
        {/* Barre pleine = tout ce que la porte doit encaisser ; la partie vide
            est ce qui reste à venir. Texture + glyphe par moyen, comme Stats. */}
        {moneyScale > 0 && (
          <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full bg-well">
            {d.byPaymentMethod.map((m) => (
              <div
                key={m.method}
                className="border-r-2 border-surface"
                style={{ width: `${(m.revenueCents / moneyScale) * 100}%`, background: payLook(m.method).fill }}
              />
            ))}
          </div>
        )}
        <div className="mt-3 space-y-1.5 text-body">
          {d.byPaymentMethod.map((m) => {
            const { Icon, color } = payLook(m.method);
            return (
              <div key={m.method} className="flex items-center gap-2">
                <Icon size={16} weight="fill" style={{ color }} className="shrink-0" />
                <span className="text-sand">{paymentLabel(m.method)}</span>
                <b className="tnum ml-auto text-cream">{formatCents(m.revenueCents)}</b>
              </div>
            );
          })}
          {toCollect > 0 && (
            <div className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 shrink-0 rounded-sm border border-line bg-well" />
              <span className="text-sand">Reste à encaisser</span>
              <b className="tnum ml-auto text-cream">{formatCents(toCollect)}</b>
            </div>
          )}
          {d.prepaidCents > 0 && (
            <div className="flex items-center gap-2 text-micro">
              <CalendarCheckIcon size={14} weight="fill" className="shrink-0 text-ash" />
              <span className="text-ash">Payé d'avance (hors barre)</span>
              <span className="tnum ml-auto text-sand">{formatCents(d.prepaidCents)}</span>
            </div>
          )}
          {d.giftedOrders > 0 && <p className="text-micro text-ash">{plural(d.giftedOrders, "repas offert")}</p>}
        </div>
      </Card>
      {watch.length > 0 && (
        <Card className="flex min-h-40 flex-1 flex-col p-4">
          <h2 className="font-display shrink-0 text-lead font-bold text-cream">À surveiller</h2>
          <ul className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
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
        </Card>
      )}
    </aside>
  );
}

/** Anneau de progression : couverts réservés déjà arrivés. */
function Ring({ value, total }: { value: number; total: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <div className="relative h-24 w-24 shrink-0" role="img" aria-label={`${value} couverts arrivés sur ${total}`}>
      <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90">
        <circle cx="42" cy="42" r={r} fill="none" strokeWidth="10" className="stroke-well" />
        {pct > 0 && (
          <circle
            cx="42"
            cy="42"
            r={r}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${pct * c} ${c}`}
            className="stroke-mint transition-[stroke-dasharray]"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
        <b className="tnum font-display text-lead text-cream">{value}</b>
        <span className="tnum text-micro text-ash">/ {total}</span>
      </div>
    </div>
  );
}

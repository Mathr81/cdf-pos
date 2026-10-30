import { type ReactNode } from "react";
import { bookingDashboard, bookingTariffs, formatCents, paymentLabel, type BookingDashboard } from "@cdf/shared";

import { projection } from "../../lib/store.js";
import { useRev } from "../../lib/hooks.js";
import { plural } from "../../lib/plural.js";
import { cn } from "../../lib/cn.js";
import { Card } from "../../components/ui.js";

function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="truncate text-micro font-bold tracking-wide text-ash uppercase">{label}</div>
      <div className="font-display tnum mt-1 text-title font-bold text-cream sm:text-display">{value}</div>
      {hint && <div className="tnum mt-1 text-body text-sand">{hint}</div>}
    </Card>
  );
}

export function DashboardTab({ soireeId }: { soireeId: string }) {
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

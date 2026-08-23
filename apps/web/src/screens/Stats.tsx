import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  computeCashup,
  computeStats,
  formatCents,
  soireeSummaries,
  sortedSoirees,
} from "@cdf/shared";
import { CoinsIcon } from "@phosphor-icons/react/dist/csr/Coins";
import { CreditCardIcon } from "@phosphor-icons/react/dist/csr/CreditCard";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";

import { projection } from "../lib/store.js";
import { useActiveSoiree, useRev } from "../lib/hooks.js";
import { exportOrdersCsv } from "../lib/export.js";
import { PALETTE } from "../lib/palette.js";
import { Button, Card, SelectInput } from "../components/ui.js";

export function StatsScreen() {
  const rev = useRev();
  const active = useActiveSoiree();
  const soirees = sortedSoirees(projection);
  const [scope, setScope] = useState<string>(active?.id ?? "all");
  const soireeId = scope === "all" ? null : scope;

  const stats = useMemo(() => computeStats(projection, soireeId), [soireeId, rev]);
  const cashup = useMemo(
    () => (soireeId ? computeCashup(projection, soireeId) : null),
    [soireeId, rev],
  );
  const summaries = useMemo(() => soireeSummaries(projection), [rev]);

  const topProducts = stats.topProducts.slice(0, 8);
  const paidTotal = stats.byPaymentMethod.reduce((s, m) => s + m.revenueCents, 0);
  const timeline = stats.revenueTimeline.map((p) => ({
    t: new Date(p.t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    euros: p.cumulativeCents / 100,
  }));

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto p-4">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-title font-bold text-cream">Statistiques</h1>
        <SelectInput
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          aria-label="Portée des statistiques"
        >
          <option value="all">Toutes soirées</option>
          {soirees.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.date})
            </option>
          ))}
        </SelectInput>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          onClick={() => exportOrdersCsv(projection, soireeId)}
        >
          <DownloadSimpleIcon size={17} weight="bold" />
          Export CSV
        </Button>
      </div>

      {/* Une seule tuile porte le lantern : le CA. Les trois autres sont en
          texte plein. C'est ce qui recrée la hiérarchie que le « tout ambre »
          avait effacée. */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Chiffre d'affaires" value={formatCents(stats.totalRevenueCents)} accent />
        <StatTile label="Commandes" value={String(stats.orderCount)} />
        <StatTile label="Panier moyen" value={formatCents(stats.avgBasketCents)} />
        <StatTile label="Articles vendus" value={String(stats.itemCount)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Évolution du chiffre d'affaires" hint="Cumul dans le temps" wide>
          {timeline.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timeline} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PALETTE.lantern} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={PALETTE.lantern} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={PALETTE.line} />
                <XAxis
                  dataKey="t"
                  tick={{ fill: PALETTE.ash, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: PALETTE.line }}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fill: PALETTE.ash, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(v) => `${v}€`}
                />
                <Tooltip content={<ChartTooltip money />} />
                <Area
                  type="monotone"
                  dataKey="euros"
                  stroke={PALETTE.lantern}
                  strokeWidth={2}
                  fill="url(#rev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Affluence par heure" hint="Nombre de commandes">
          {stats.salesByHour.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.salesByHour} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={PALETTE.line} />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: PALETTE.ash, fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: PALETTE.line }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: PALETTE.ash, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  cursor={{ fill: "rgba(247,240,232,0.05)" }}
                  content={<ChartTooltip fmt={(v) => `${v} commande${v > 1 ? "s" : ""}`} />}
                />
                <Bar dataKey="orders" fill={PALETTE.lantern} radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top produits" hint="Quantités vendues">
          {topProducts.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, topProducts.length * 34)}>
              <BarChart
                data={topProducts}
                layout="vertical"
                margin={{ top: 0, right: 28, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: PALETTE.ash, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={96}
                />
                <Tooltip
                  cursor={{ fill: "rgba(247,240,232,0.05)" }}
                  content={<ChartTooltip fmt={(v) => `${v} vendus`} />}
                />
                <Bar dataKey="qty" fill={PALETTE.lantern} radius={[0, 4, 4, 0]} maxBarSize={22}>
                  <LabelList dataKey="qty" position="right" fill={PALETTE.ash} fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Moyens de paiement" hint="Part du chiffre d'affaires">
          {paidTotal === 0 ? (
            <Empty />
          ) : (
            /* Espèces et Carte se distinguent par la TEXTURE et le GLYPHE,
               pas seulement par la teinte : en tritanopie, --mint et --dusk
               convergent (ΔE00 ≈ 9), le plus faible écart de la palette. */
            <div className="flex h-[220px] flex-col justify-center gap-4">
              <div className="flex h-6 w-full overflow-hidden rounded-full">
                {stats.byPaymentMethod.map((m) => (
                  <div
                    key={m.method}
                    style={{
                      width: `${(m.revenueCents / paidTotal) * 100}%`,
                      background:
                        m.method === "cash"
                          ? PALETTE.mint
                          : `repeating-linear-gradient(45deg, ${PALETTE.dusk} 0 6px, ${PALETTE.surface}66 6px 9px)`,
                    }}
                    className="border-r-2 border-surface last:border-0"
                  />
                ))}
              </div>
              <div className="space-y-2">
                {stats.byPaymentMethod.map((m) => (
                  <div key={m.method} className="flex items-center gap-2 text-body">
                    {m.method === "cash" ? (
                      <CoinsIcon size={17} weight="fill" style={{ color: PALETTE.mint }} />
                    ) : (
                      <CreditCardIcon size={17} weight="fill" style={{ color: PALETTE.dusk }} />
                    )}
                    <span className="font-semibold text-cream">
                      {m.method === "cash" ? "Espèces" : "Carte"}
                    </span>
                    <span className="tnum ml-auto text-sand">{formatCents(m.revenueCents)}</span>
                    <span className="tnum w-14 text-right text-ash">
                      {Math.round((m.revenueCents / paidTotal) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Rapport Z (clôture de caisse) : seulement pour une soirée. */}
      {cashup && cashup.orders > 0 && (
        <Card className="mt-4 p-4">
          <h2 className="font-display text-lead font-bold text-cream">
            Clôture de caisse (rapport Z)
          </h2>
          <p className="mt-1 mb-3 text-micro text-ash">
            Montants attendus par poste, à comparer avec la caisse comptée.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="text-left text-micro font-bold tracking-wide text-ash uppercase">
                  <th className="py-1.5">Caisse</th>
                  <th className="py-1.5 text-right">Cmd</th>
                  <th className="py-1.5 text-right">Espèces</th>
                  <th className="py-1.5 text-right">Carte</th>
                  <th className="py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {cashup.rows.map((r) => (
                  <tr key={r.registerLabel} className="border-t border-line">
                    <td className="py-2 font-semibold text-cream">{r.registerLabel}</td>
                    <td className="py-2 text-right text-ash">{r.orders}</td>
                    <td className="py-2 text-right text-mint">{formatCents(r.cashCents)}</td>
                    <td className="py-2 text-right text-dusk">{formatCents(r.cardCents)}</td>
                    <td className="py-2 text-right font-bold text-cream">
                      {formatCents(r.totalCents)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-sand/40 font-bold">
                  <td className="py-2 text-cream">Total</td>
                  <td className="py-2 text-right text-sand">{cashup.orders}</td>
                  <td className="py-2 text-right text-mint">
                    {formatCents(cashup.totalCashCents)}
                  </td>
                  <td className="py-2 text-right text-dusk">
                    {formatCents(cashup.totalCardCents)}
                  </td>
                  <td className="py-2 text-right text-lantern">{formatCents(cashup.totalCents)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {summaries.length > 1 && (
        <ChartCard
          title="Comparaison entre soirées"
          hint="Chiffre d'affaires par soirée"
          className="mt-4"
        >
          <ResponsiveContainer width="100%" height={Math.max(180, summaries.length * 40)}>
            <BarChart
              data={summaries.map((s) => ({ name: s.name, euros: s.revenueCents / 100 }))}
              layout="vertical"
              margin={{ top: 0, right: 56, left: 0, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: PALETTE.ash, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip cursor={{ fill: "rgba(247,240,232,0.05)" }} content={<ChartTooltip money />} />
              <Bar dataKey="euros" fill={PALETTE.lantern} radius={[0, 4, 4, 0]} maxBarSize={26}>
                <LabelList
                  dataKey="euros"
                  position="right"
                  fill={PALETTE.ash}
                  fontSize={11}
                  formatter={(v: number) => `${v.toFixed(0)}€`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {stats.voidCount > 0 && (
        <p className="tnum mt-4 pb-2 text-center text-micro text-ash">
          {stats.voidCount} commande(s) annulée(s)
        </p>
      )}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-micro font-bold tracking-wide text-ash uppercase">{label}</div>
      <div
        className={
          accent
            ? "font-display tnum mt-1.5 text-display font-bold text-lantern"
            : "font-display tnum mt-1.5 text-display font-bold text-cream"
        }
      >
        {value}
      </div>
    </Card>
  );
}

function ChartCard({
  title,
  hint,
  children,
  wide,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <Card className={`${wide ? "lg:col-span-2" : ""} p-4 ${className ?? ""}`}>
      <div className="mb-3">
        <h2 className="font-display text-lead font-bold text-cream">{title}</h2>
        {hint && <p className="text-micro text-ash">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

function Empty() {
  return (
    <div className="flex h-[220px] items-center justify-center text-body text-ash">
      Pas encore de données
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; payload: Record<string, unknown> }[];
  label?: string;
  fmt?: (v: number) => string;
  money?: boolean;
}

function ChartTooltip({ active, payload, label, fmt, money }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const name = (p.payload.name as string) ?? (p.payload.t as string) ?? label ?? "";
  const text = money ? `${p.value.toFixed(2).replace(".", ",")} €` : fmt ? fmt(p.value) : String(p.value);
  return (
    <div className="rounded-control border border-line bg-surface px-3 py-2 text-body shadow-lg">
      {name && <div className="font-bold text-cream">{name}</div>}
      <div className="tnum text-sand">{text}</div>
    </div>
  );
}

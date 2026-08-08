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
import { projection } from "../lib/store.js";
import { useActiveSoiree, useRev } from "../lib/hooks.js";
import { exportOrdersCsv } from "../lib/export.js";
import { Button, Card } from "../components/ui.js";

const MAG = "#d97706";
const CASH = "#199e70";
const CARD = "#3987e5";
const AXIS = "#94a3b8";
const GRID = "#1e293b";

export function StatsScreen() {
  const rev = useRev();
  const active = useActiveSoiree();
  const soirees = sortedSoirees(projection);
  const [scope, setScope] = useState<string>(active?.id ?? "all");
  const soireeId = scope === "all" ? null : scope;

  const stats = useMemo(() => computeStats(projection, soireeId), [soireeId, rev]);
  const cashup = useMemo(() => (soireeId ? computeCashup(projection, soireeId) : null), [soireeId, rev]);
  const summaries = useMemo(() => soireeSummaries(projection), [rev]);

  const topProducts = stats.topProducts.slice(0, 8);
  const paidTotal = stats.byPaymentMethod.reduce((s, m) => s + m.revenueCents, 0);
  const timeline = stats.revenueTimeline.map((p) => ({
    t: new Date(p.t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    euros: p.cumulativeCents / 100,
  }));

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-slate-100">Statistiques</h1>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100"
        >
          <option value="all">Toutes soirées</option>
          {soirees.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.date})
            </option>
          ))}
        </select>
        <div className="ml-auto">
          <Button variant="secondary" size="sm" onClick={() => exportOrdersCsv(projection, soireeId)}>
            ⬇ Export CSV
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Chiffre d'affaires" value={formatCents(stats.totalRevenueCents)} accent />
        <StatTile label="Commandes" value={String(stats.orderCount)} />
        <StatTile label="Panier moyen" value={formatCents(stats.avgBasketCents)} />
        <StatTile label="Articles vendus" value={String(stats.itemCount)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Évolution du CA (cumulé) */}
        <ChartCard title="Évolution du chiffre d'affaires" hint="Cumul dans le temps" wide>
          {timeline.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timeline} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={MAG} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={MAG} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="t" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={40} />
                <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v}€`} />
                <Tooltip content={<ChartTooltip money />} />
                <Area type="monotone" dataKey="euros" stroke={MAG} strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Affluence par heure */}
        <ChartCard title="Affluence par heure" hint="Nombre de commandes">
          {stats.salesByHour.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.salesByHour} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="hour" tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} />
                <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} width={40} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip fmt={(v) => `${v} commande${v > 1 ? "s" : ""}`} />} />
                <Bar dataKey="orders" fill={MAG} radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Top produits */}
        <ChartCard title="Top produits" hint="Quantités vendues">
          {topProducts.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, topProducts.length * 34)}>
              <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} width={96} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip fmt={(v) => `${v} vendus`} />} />
                <Bar dataKey="qty" fill={MAG} radius={[0, 4, 4, 0]} maxBarSize={22}>
                  <LabelList dataKey="qty" position="right" fill={AXIS} fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Paiements */}
        <ChartCard title="Moyens de paiement" hint="Part du chiffre d'affaires">
          {paidTotal === 0 ? (
            <Empty />
          ) : (
            <div className="flex h-[220px] flex-col justify-center gap-4">
              <div className="flex h-6 w-full overflow-hidden rounded-full">
                {stats.byPaymentMethod.map((m) => (
                  <div key={m.method} style={{ width: `${(m.revenueCents / paidTotal) * 100}%`, background: m.method === "cash" ? CASH : CARD }} className="border-r-2 border-slate-900 last:border-0" />
                ))}
              </div>
              <div className="space-y-2">
                {stats.byPaymentMethod.map((m) => (
                  <div key={m.method} className="flex items-center gap-2 text-sm">
                    <span className="inline-block h-3 w-3 rounded-sm" style={{ background: m.method === "cash" ? CASH : CARD }} />
                    <span className="font-semibold text-slate-200">{m.method === "cash" ? "Espèces" : "Carte"}</span>
                    <span className="ml-auto tabular-nums text-slate-300">{formatCents(m.revenueCents)}</span>
                    <span className="w-14 text-right tabular-nums text-slate-500">{Math.round((m.revenueCents / paidTotal) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Rapport Z (clôture de caisse) — seulement pour une soirée */}
      {cashup && cashup.orders > 0 && (
        <Card className="mt-4 p-4">
          <h2 className="mb-1 font-bold text-slate-100">Clôture de caisse (rapport Z)</h2>
          <p className="mb-3 text-xs text-slate-500">Montants attendus par poste — à comparer avec la caisse comptée.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-1">Caisse</th>
                  <th className="py-1 text-right">Cmd</th>
                  <th className="py-1 text-right">Espèces</th>
                  <th className="py-1 text-right">Carte</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {cashup.rows.map((r) => (
                  <tr key={r.registerLabel} className="border-t border-slate-800">
                    <td className="py-1.5 font-semibold text-slate-200">{r.registerLabel}</td>
                    <td className="py-1.5 text-right text-slate-400">{r.orders}</td>
                    <td className="py-1.5 text-right text-emerald-300">{formatCents(r.cashCents)}</td>
                    <td className="py-1.5 text-right text-sky-300">{formatCents(r.cardCents)}</td>
                    <td className="py-1.5 text-right font-bold text-slate-100">{formatCents(r.totalCents)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-700 font-bold">
                  <td className="py-1.5 text-slate-100">Total</td>
                  <td className="py-1.5 text-right text-slate-400">{cashup.orders}</td>
                  <td className="py-1.5 text-right text-emerald-400">{formatCents(cashup.totalCashCents)}</td>
                  <td className="py-1.5 text-right text-sky-400">{formatCents(cashup.totalCardCents)}</td>
                  <td className="py-1.5 text-right text-amber-400">{formatCents(cashup.totalCents)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Comparaison entre soirées */}
      {summaries.length > 1 && (
        <ChartCard title="Comparaison entre soirées" hint="Chiffre d'affaires par soirée" className="mt-4">
          <ResponsiveContainer width="100%" height={Math.max(180, summaries.length * 40)}>
            <BarChart data={summaries.map((s) => ({ name: s.name, euros: s.revenueCents / 100 }))} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} width={120} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip money />} />
              <Bar dataKey="euros" fill={MAG} radius={[0, 4, 4, 0]} maxBarSize={26}>
                <LabelList dataKey="euros" position="right" fill={AXIS} fontSize={11} formatter={(v: number) => `${v.toFixed(0)}€`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {stats.voidCount > 0 && <p className="mt-4 text-center text-xs text-slate-500">{stats.voidCount} commande(s) annulée(s)</p>}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={accent ? "mt-1 text-2xl font-black text-amber-400" : "mt-1 text-2xl font-black text-slate-100"}>{value}</div>
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
        <h2 className="font-bold text-slate-100">{title}</h2>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

function Empty() {
  return <div className="flex h-[220px] items-center justify-center text-sm text-slate-500">Pas encore de données</div>;
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
    <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm shadow-lg">
      {name && <div className="font-semibold text-slate-100">{name}</div>}
      <div className="tabular-nums text-slate-300">{text}</div>
    </div>
  );
}

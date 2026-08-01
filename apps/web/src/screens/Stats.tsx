import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { computeStats, formatCents } from "@cdf/shared";
import { projection } from "../lib/store.js";
import { useRev } from "../lib/hooks.js";
import { Card } from "../components/ui.js";

// Palette validée (dataviz) sur la surface carte #0f172a :
const MAG = "#d97706"; // magnitude (hue unique)
const CASH = "#199e70"; // aqua
const CARD = "#3987e5"; // bleu
const AXIS = "#94a3b8";
const GRID = "#1e293b";

export function StatsScreen() {
  const rev = useRev();
  const stats = useMemo(() => computeStats(projection), [rev]);

  const topProducts = stats.topProducts.slice(0, 8);
  const paidTotal = stats.byPaymentMethod.reduce((s, m) => s + m.revenueCents, 0);

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto p-4">
      <h1 className="mb-4 text-xl font-bold text-slate-100">Statistiques</h1>

      {/* Tuiles clés */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Chiffre d'affaires" value={formatCents(stats.totalRevenueCents)} accent />
        <StatTile label="Commandes" value={String(stats.orderCount)} />
        <StatTile label="Panier moyen" value={formatCents(stats.avgBasketCents)} />
        <StatTile label="Articles vendus" value={String(stats.itemCount)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  content={<ChartTooltip fmt={(v) => `${v} commande${v > 1 ? "s" : ""}`} />}
                />
                <Bar dataKey="orders" fill={MAG} radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Répartition paiement */}
        <ChartCard title="Moyens de paiement" hint="Part du chiffre d'affaires">
          {paidTotal === 0 ? (
            <Empty />
          ) : (
            <div className="flex h-[220px] flex-col justify-center gap-4">
              <div className="flex h-6 w-full overflow-hidden rounded-full">
                {stats.byPaymentMethod.map((m) => (
                  <div
                    key={m.method}
                    style={{
                      width: `${(m.revenueCents / paidTotal) * 100}%`,
                      background: m.method === "cash" ? CASH : CARD,
                    }}
                    className="border-r-2 border-slate-900 last:border-0"
                  />
                ))}
              </div>
              <div className="space-y-2">
                {stats.byPaymentMethod.map((m) => (
                  <div key={m.method} className="flex items-center gap-2 text-sm">
                    <span
                      className="inline-block h-3 w-3 rounded-sm"
                      style={{ background: m.method === "cash" ? CASH : CARD }}
                    />
                    <span className="font-semibold text-slate-200">
                      {m.method === "cash" ? "Espèces" : "Carte"}
                    </span>
                    <span className="ml-auto tabular-nums text-slate-300">{formatCents(m.revenueCents)}</span>
                    <span className="w-14 text-right tabular-nums text-slate-500">
                      {Math.round((m.revenueCents / paidTotal) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
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
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: AXIS, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={96}
                />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip fmt={(v) => `${v} vendus`} />} />
                <Bar dataKey="qty" fill={MAG} radius={[0, 4, 4, 0]} maxBarSize={22}>
                  <LabelList dataKey="qty" position="right" fill={AXIS} fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* CA par caisse */}
        <ChartCard title="Chiffre d'affaires par caisse" hint="Répartition entre postes">
          {stats.byRegister.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, stats.byRegister.length * 44)}>
              <BarChart data={stats.byRegister} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="registerLabel"
                  tick={{ fill: AXIS, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip money fmt={(v) => formatCents(v)} />} />
                <Bar dataKey="revenueCents" fill={MAG} radius={[0, 4, 4, 0]} maxBarSize={28}>
                  <LabelList dataKey="revenueCents" position="right" fill={AXIS} fontSize={11} formatter={(v: number) => formatCents(v)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {stats.voidCount > 0 && (
        <p className="mt-4 text-center text-xs text-slate-500">{stats.voidCount} commande(s) annulée(s)</p>
      )}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={accent ? "mt-1 text-2xl font-black text-amber-400" : "mt-1 text-2xl font-black text-slate-100"}>
        {value}
      </div>
    </Card>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
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
  fmt: (v: number) => string;
  money?: boolean;
}

function ChartTooltip({ active, payload, label, fmt }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const name = (p.payload.name as string) ?? (p.payload.registerLabel as string) ?? label ?? "";
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm shadow-lg">
      {name && <div className="font-semibold text-slate-100">{name}</div>}
      <div className="tabular-nums text-slate-300">{fmt(p.value)}</div>
    </div>
  );
}

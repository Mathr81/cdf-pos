import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  compareToPrevious,
  computeCashup,
  computeStats,
  formatAmount,
  formatCents,
  parseAmountToCents,
  soireeSummaries,
  sortedSoirees,
  type SoireeComparison,
  paymentLabel,
} from "@cdf/shared";
import { CoinsIcon } from "@phosphor-icons/react/dist/csr/Coins";
import { CreditCardIcon } from "@phosphor-icons/react/dist/csr/CreditCard";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { TrendUpIcon } from "@phosphor-icons/react/dist/csr/TrendUp";
import { TrendDownIcon } from "@phosphor-icons/react/dist/csr/TrendDown";

import { projection } from "../lib/store.js";
import { useActiveSoiree, useRev } from "../lib/hooks.js";
import { countCash, openCash } from "../lib/actions.js";
import { exportOrdersCsv } from "../lib/export.js";
import { PALETTE } from "../lib/palette.js";
import { Button, Card, Field, SelectInput, TextInput } from "../components/ui.js";
import { Modal } from "../components/Modal.js";
import { cn } from "../lib/cn.js";

export function StatsScreen() {
  const rev = useRev();
  const active = useActiveSoiree();
  const soirees = sortedSoirees(projection);
  const [scope, setScope] = useState<string>(active?.id ?? "all");
  const [cashEdit, setCashEdit] = useState<{ registerLabel: string } | null>(null);
  const soireeId = scope === "all" ? null : scope;

  const stats = useMemo(() => computeStats(projection, soireeId), [soireeId, rev]);
  const cashup = useMemo(
    () => (soireeId ? computeCashup(projection, soireeId) : null),
    [soireeId, rev],
  );
  const summaries = useMemo(() => soireeSummaries(projection), [rev]);
  // Uniquement sur une soirée précise : « toutes soirées » n'a pas de
  // service précédent auquel se comparer.
  const comparison = useMemo(
    () => (soireeId ? compareToPrevious(projection, soireeId) : null),
    [soireeId, rev],
  );

  const topProducts = stats.topProducts.slice(0, 8);
  const peak = stats.salesByHour.reduce<(typeof stats.salesByHour)[number] | null>(
    (best, h) => (best === null || h.orders > best.orders ? h : best),
    null,
  );
  const bestRegister = stats.byRegister.reduce<(typeof stats.byRegister)[number] | null>(
    (best, r) => (best === null || r.revenueCents > best.revenueCents ? r : best),
    null,
  );
  const paidTotal = stats.byPaymentMethod.reduce((s, m) => s + m.revenueCents, 0);
  const timeline = stats.revenueTimeline.map((p) => ({
    t: new Date(p.t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    euros: p.cumulativeCents / 100,
  }));

  /* Tuiles construites en LISTE, puis la grille en déduit ses colonnes.
     Avant, quatre colonnes en dur recevaient parfois cinq tuiles : la
     cinquième restait seule avec trois cellules vides à sa droite. */
  const tiles: TileProps[] = [
    {
      label: "Chiffre d'affaires",
      value: formatCents(stats.totalRevenueCents),
      accent: true,
      comparison,
    },
    { label: "Commandes", value: String(stats.orderCount) },
    { label: "Panier moyen", value: formatCents(stats.avgBasketCents) },
    { label: "Articles vendus", value: String(stats.itemCount) },
  ];
  if (stats.giftedValueCents > 0) {
    tiles.push({
      label: "Offert",
      value: formatCents(stats.giftedValueCents),
      hint: `${stats.giftedItems} article(s), hors CA`,
    });
  }

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
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

      {/* Une seule tuile porte le lantern : le CA. Les autres sont en texte
          plein — c'est ce qui recrée la hiérarchie que le « tout ambre »
          avait effacée. */}
      <div
        className={cn(
          "mb-4 grid grid-cols-2 gap-3",
          tiles.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4",
        )}
      >
        {tiles.map((t, i) => (
          <StatTile
            key={t.label}
            {...t}
            /* Nombre impair : la dernière tuile occupe les deux colonnes du
               mobile plutôt que de laisser un demi-vide à côté d'elle. */
            className={cn(
              i === tiles.length - 1 && tiles.length % 2 === 1 && "col-span-2 lg:col-span-1",
            )}
          />
        ))}
      </div>

      {/* Deux repères que le tableau de bord ne donnait pas et qu'on cherchait
          dans les graphiques : quand ça a tapé le plus fort, et quel poste a
          le plus encaissé. */}
      {(peak || bestRegister) && (
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 px-1 text-body text-sand">
          {peak && (
            <span>
              Pic d'affluence <b className="text-cream">{peak.hour}</b> ·{" "}
              <span className="tnum">{peak.orders}</span> commandes
            </span>
          )}
          {bestRegister && (
            <span>
              Poste le plus actif <b className="text-cream">{bestRegister.registerLabel}</b> ·{" "}
              <span className="tnum">{formatCents(bestRegister.revenueCents)}</span>
            </span>
          )}
        </div>
      )}

      {/* Six colonnes plutôt que deux : chaque rangée est remplie
          exactement, et `items-stretch` aligne les bas de cartes qui
          partaient auparavant en escalier (308 px contre 360). */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-6">
        <ChartCard title="Évolution du chiffre d'affaires" hint="Cumul dans le temps" span={6}>
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
                {/* 44 px ne suffisaient pas à « 1600€ » : Recharts rognait le
                    premier chiffre et l'axe affichait « 800€ » pour 1 600 €.
                    Le graphique mentait. Format compact + largeur adéquate. */}
                <YAxis
                  tick={{ fill: PALETTE.ash, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={58}
                  tickFormatter={compactEuro}
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

        <ChartCard title="Affluence par heure" hint="Nombre de commandes" span={4}>
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
                {/* Le pic est plein, les autres barres en retrait : l'heure
                    de coup de feu se repère sans lire l'axe. */}
                <Bar dataKey="orders" radius={[4, 4, 0, 0]} maxBarSize={44}>
                  {stats.salesByHour.map((h) => (
                    <Cell
                      key={h.hour}
                      fill={PALETTE.lantern}
                      fillOpacity={peak && h.hour === peak.hour ? 1 : 0.45}
                    />
                  ))}
                  <LabelList
                    dataKey="orders"
                    position="top"
                    fill={PALETTE.ash}
                    fontSize={11}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Moyens de paiement" hint="Part du chiffre d'affaires" span={2}>
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
                      {paymentLabel(m.method)}
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
        <ChartCard title="Top produits" hint="Quantités vendues" span={6}>
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

      </div>

      {/* Rapport Z (clôture de caisse) : seulement pour une soirée. */}
      {cashup && (cashup.orders > 0 || cashup.totalRegisters > 0) && soireeId && (
        <Card className="mt-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lead font-bold text-cream">
                Clôture de caisse (rapport Z)
              </h2>
              <p className="mt-1 text-micro text-ash">
                Attendu = fond de caisse + espèces encaissées. La carte ne passe pas par la boîte.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setCashEdit({ registerLabel: "" })}>
              <CoinsIcon size={16} weight="bold" />
              Fond de caisse
            </Button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="text-left text-micro font-bold tracking-wide text-ash uppercase">
                  <th className="py-1.5">Caisse</th>
                  <th className="py-1.5 text-right">Espèces</th>
                  <th className="py-1.5 text-right">Carte</th>
                  <th className="py-1.5 text-right">Fond</th>
                  <th className="py-1.5 text-right">Attendu</th>
                  <th className="py-1.5 text-right">Compté</th>
                  <th className="py-1.5 text-right">Écart</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody className="tnum">
                {cashup.rows.map((r) => (
                  <tr key={r.registerLabel} className="border-t border-line">
                    <td className="py-2 font-semibold text-cream">{r.registerLabel}</td>
                    <td className="py-2 text-right text-mint">{formatCents(r.cashCents)}</td>
                    <td className="py-2 text-right text-dusk">{formatCents(r.cardCents)}</td>
                    <td className="py-2 text-right text-sand">{formatCents(r.floatCents)}</td>
                    <td className="py-2 text-right font-bold text-cream">
                      {formatCents(r.expectedCashCents)}
                    </td>
                    <td className="py-2 text-right text-sand">
                      {r.countedCents === null ? "—" : formatCents(r.countedCents)}
                    </td>
                    <td className="py-2 text-right">
                      <Variance cents={r.varianceCents} />
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCashEdit({ registerLabel: r.registerLabel })}
                      >
                        {r.countedCents === null ? "Compter" : "Modifier"}
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-sand/40 font-bold">
                  <td className="py-2 text-cream">Total</td>
                  <td className="py-2 text-right text-mint">
                    {formatCents(cashup.totalCashCents)}
                  </td>
                  <td className="py-2 text-right text-dusk">
                    {formatCents(cashup.totalCardCents)}
                  </td>
                  <td className="py-2 text-right text-sand">
                    {formatCents(cashup.totalFloatCents)}
                  </td>
                  <td className="py-2 text-right text-lantern">
                    {formatCents(cashup.totalFloatCents + cashup.totalCashCents)}
                  </td>
                  <td className="py-2 text-right text-ash">
                    {cashup.countedRegisters}/{cashup.totalRegisters}
                  </td>
                  <td className="py-2 text-right">
                    {/* Muet tant qu'aucun poste n'est compté : un « 0,00 € »
                        se lirait « tout tombe juste », ce qui serait faux. */}
                    {cashup.countedRegisters > 0 ? (
                      <Variance cents={cashup.totalVarianceCents} />
                    ) : (
                      <span className="text-ash">—</span>
                    )}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {cashup.countedRegisters < cashup.totalRegisters && cashup.totalRegisters > 0 && (
            <p className="mt-3 text-micro text-ash">
              {cashup.totalRegisters - cashup.countedRegisters} poste(s) pas encore compté(s) :
              l'écart total ne porte que sur les {cashup.countedRegisters} déjà comptés.
            </p>
          )}
        </Card>
      )}

      {cashEdit && soireeId && (
        <CashModal
          soireeId={soireeId}
          initialLabel={cashEdit.registerLabel}
          registers={cashup?.rows.map((r) => r.registerLabel) ?? []}
          onClose={() => setCashEdit(null)}
        />
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

/**
 * Écart de caisse. Le signe est porté par le texte ET la couleur : en
 * deutéranopie, mint et signal se rapprochent, un « −4,00 € » vert serait
 * lu comme un excédent.
 *
 * Zéro est vert, pas neutre : « ça tombe juste » est une bonne nouvelle et
 * mérite d'être lisible d'un coup d'œil sur une table de dix postes.
 */
function Variance({ cents }: { cents: number | null }) {
  if (cents === null) return <span className="text-ash">—</span>;
  if (cents === 0) return <span className="font-bold text-mint">juste</span>;
  const manque = cents < 0;
  return (
    <span className={cn("font-bold", manque ? "text-signal" : "text-lantern")}>
      {manque ? "−" : "+"}
      {formatCents(Math.abs(cents))}
    </span>
  );
}

/**
 * Saisie du fond de caisse et du comptage pour un poste.
 * Les deux vivent dans la même modale parce que c'est le même geste mental
 * — « faire la caisse » — à deux moments du service.
 */
function CashModal({
  soireeId,
  initialLabel,
  registers,
  onClose,
}: {
  soireeId: string;
  initialLabel: string;
  registers: string[];
  onClose: () => void;
}) {
  const [label, setLabel] = useState(initialLabel);
  const [fond, setFond] = useState("");
  const [compte, setCompte] = useState("");
  const [note, setNote] = useState("");

  const session = label ? computeCashup(projection, soireeId).rows.find((r) => r.registerLabel === label) : undefined;

  const valider = () => {
    const poste = label.trim();
    if (!poste) return;
    if (fond.trim()) void openCash(poste, parseAmountToCents(fond), soireeId);
    if (compte.trim()) void countCash(poste, parseAmountToCents(compte), note.trim() || undefined, soireeId);
    onClose();
  };

  return (
    <Modal open onClose={onClose}>
      <h2 className="font-display text-title font-bold text-cream">Faire la caisse</h2>

      <div className="mt-4 space-y-4">
        <Field label="Poste">
          {/* Saisie libre plutôt qu'une liste fermée : un fond peut être posé
              dans une caisse qui n'a encore rien vendu, donc inconnue ici. */}
          <TextInput
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Caisse 1"
            list="cdf-registers"
          />
          <datalist id="cdf-registers">
            {registers.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>

        {session && (
          <p className="tnum rounded-control border border-line bg-well p-3 text-body text-sand">
            Espèces encaissées <b className="text-cream">{formatCents(session.cashCents)}</b> · fond
            actuel <b className="text-cream">{formatCents(session.floatCents)}</b> · attendu{" "}
            <b className="text-lantern">{formatCents(session.expectedCashCents)}</b>
          </p>
        )}

        <Field label="Fond de caisse (€) — au début du service">
          <TextInput
            value={fond}
            onChange={(e) => setFond(e.target.value)}
            inputMode="decimal"
            placeholder={session ? formatAmount(session.floatCents) : "150,00"}
          />
        </Field>

        <Field label="Compté dans la boîte (€) — en fin de service">
          <TextInput
            value={compte}
            onChange={(e) => setCompte(e.target.value)}
            inputMode="decimal"
            placeholder={session?.countedCents != null ? formatAmount(session.countedCents) : "0,00"}
          />
        </Field>

        <Field label="Note (facultatif)">
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="un billet de 20 manquant"
          />
        </Field>
      </div>

      <p className="mt-3 text-micro text-ash">
        Laisse un champ vide pour ne pas y toucher. Un recomptage remplace le précédent.
      </p>

      <div className="mt-5 flex gap-2">
        <Button variant="ghost" size="lg" className="flex-1" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" size="lg" className="flex-1" onClick={valider} disabled={!label.trim()}>
          Enregistrer
        </Button>
      </div>
    </Modal>
  );
}

/** Montant court pour un axe : « 1 434 € » devient « 1,4 k€ ». */
function compactEuro(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1).replace(".", ",")} k€`;
  return `${v} €`;
}

interface TileProps {
  label: string;
  value: string;
  accent?: boolean;
  comparison?: SoireeComparison | null;
  hint?: string;
  className?: string;
}

function StatTile({ label, value, accent, comparison, hint, className }: TileProps) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="text-micro font-bold tracking-wide text-ash uppercase">{label}</div>
      <div
        /* `text-display` déborde d'une demi-largeur de téléphone : « 1 434,00 € »
           y perdait son symbole. On monte d'un cran seulement à partir de sm. */
        className={cn(
          "font-display tnum mt-1.5 text-title font-bold sm:text-display",
          accent ? "text-lantern" : "text-cream",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1.5 text-micro text-ash">{hint}</div>}
      {comparison && <DeltaLine comparison={comparison} />}
    </Card>
  );
}

/**
 * « +18 % vs 14 juin ». Un chiffre d'affaires seul ne dit pas si la soirée
 * marche : c'est la comparaison au service précédent qui le dit.
 *
 * Muet quand la comparaison n'a pas de sens (première soirée, ou précédente
 * sans aucune vente) plutôt que d'afficher un « +∞ % » ou un « 0 % » faux.
 */
function DeltaLine({ comparison }: { comparison: SoireeComparison }) {
  const { previous, revenueDeltaPct } = comparison;
  if (!previous || revenueDeltaPct === null) return null;

  const hausse = revenueDeltaPct >= 0;
  const date = new Date(previous.date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mt-2 flex items-center gap-1.5 text-micro font-bold">
      {hausse ? (
        <TrendUpIcon size={14} weight="bold" className="shrink-0 text-mint" />
      ) : (
        <TrendDownIcon size={14} weight="bold" className="shrink-0 text-signal" />
      )}
      <span className={cn("tnum", hausse ? "text-mint" : "text-signal")}>
        {hausse ? "+" : ""}
        {revenueDeltaPct} %
      </span>
      <span className="truncate text-ash">vs {date}</span>
    </div>
  );
}

/**
 * Carte de graphique.
 *
 * `span` est en dur dans une table plutôt que composé (`lg:col-span-${n}`) :
 * Tailwind compile les classes trouvées dans le source, une classe construite
 * à l'exécution n'existerait tout simplement pas.
 */
const SPANS: Record<number, string> = {
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  6: "lg:col-span-6",
};

function ChartCard({
  title,
  hint,
  children,
  span = 3,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  span?: 2 | 3 | 4 | 6;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col p-4", SPANS[span], className)}>
      <div className="mb-3 shrink-0">
        <h2 className="font-display text-lead font-bold text-cream">{title}</h2>
        {hint && <p className="text-micro text-ash">{hint}</p>}
      </div>
      {/* Le contenu occupe la hauteur restante : deux cartes voisines de
          titres inégaux gardent malgré tout le même bas. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center">{children}</div>
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

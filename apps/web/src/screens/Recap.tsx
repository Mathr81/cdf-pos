import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { computeRecap, formatCents, paymentLabel, sortedSoirees } from "@cdf/shared";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { PrinterIcon } from "@phosphor-icons/react/dist/csr/Printer";
import { NotebookIcon } from "@phosphor-icons/react/dist/csr/Notebook";

import { projection } from "../lib/store.js";
import { useActiveSoiree, useRev } from "../lib/hooks.js";
import { useUrlState } from "../lib/urlState.js";
import { plural } from "../lib/plural.js";
import { cn } from "../lib/cn.js";
import { Button, EmptyState, SelectInput } from "../components/ui.js";

/**
 * Récapitulatif de fin de soirée, pour le trésorier.
 *
 * La feuille est blanche À L'ÉCRAN aussi : ce qu'on voit est ce qui sort de
 * l'imprimante ou du PDF (« Imprimer » → « Enregistrer au format PDF »), sans
 * feuille de style d'impression à maintenir en parallèle du thème sombre.
 */
export function RecapScreen() {
  const rev = useRev();
  const navigate = useNavigate();
  const active = useActiveSoiree();
  const soirees = sortedSoirees(projection);
  const [param, setParam] = useUrlState<string>("soiree", "");
  const soireeId = param || active?.id || soirees[0]?.id || "";
  const soiree = projection.soirees[soireeId];

  const recap = useMemo(() => (soiree ? computeRecap(projection, soiree.id) : null), [soiree, rev]);

  if (!soiree || !recap) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={<NotebookIcon size={44} weight="light" />}
          title="Aucune soirée"
          hint="Le récapitulatif apparaîtra dès qu'une soirée aura été créée."
        />
      </div>
    );
  }

  const { stats, cashup, products } = recap;
  const paidTotal = stats.byPaymentMethod.reduce((s, m) => s + m.revenueCents, 0);
  const uncounted = cashup.totalRegisters - cashup.countedRegisters;

  return (
    <div className="h-full overflow-y-auto p-4 print:h-auto print:overflow-visible print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center gap-2 print:hidden">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeftIcon size={18} weight="bold" />
          Retour
        </Button>
        <SelectInput
          aria-label="Soirée"
          value={soireeId}
          onChange={(e) => setParam(e.target.value)}
          className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1"
        >
          {soirees.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.date})
            </option>
          ))}
        </SelectInput>
        <Button variant="primary" className="ml-auto sm:ml-0" onClick={() => window.print()}>
          <PrinterIcon size={18} weight="bold" />
          Imprimer / PDF
        </Button>
      </div>

      <article className="mx-auto max-w-3xl rounded-surface bg-white p-6 font-sans text-[13px] leading-snug text-neutral-900 shadow-xl sm:p-8 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-neutral-900 pb-3">
          <div>
            <p className="text-[11px] font-bold tracking-wide text-neutral-500 uppercase">
              Récapitulatif de soirée
            </p>
            <h1 className="font-display text-2xl font-bold">{soiree.name}</h1>
          </div>
          <div className="text-right text-neutral-600">
            <div className="tnum">{formatDate(soiree.date)}</div>
            {soiree.training && (
              <div className="font-bold text-neutral-900">Soirée d'entraînement — hors comptes</div>
            )}
            {soiree.status !== "closed" && <div>Soirée non clôturée</div>}
          </div>
        </header>

        <Section title="Chiffres clés">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4 print:grid-cols-4">
            <Kpi label="Chiffre d'affaires" value={formatCents(stats.totalRevenueCents)} strong />
            <Kpi label="Commandes" value={String(stats.orderCount)} />
            <Kpi label="Panier moyen" value={formatCents(stats.avgBasketCents)} />
            <Kpi label="Articles vendus" value={String(stats.itemCount)} />
          </div>
          <ul className="mt-3 space-y-0.5 text-neutral-700">
            <li>
              Offerts : <b className="tnum">{plural(stats.giftedItems, "article")}</b>, d'une valeur de{" "}
              <b className="tnum">{formatCents(stats.giftedValueCents)}</b> (hors chiffre d'affaires)
            </li>
            <li>
              Annulations :{" "}
              <b className="tnum">{plural(recap.voidedOrders, "commande annulée", "commandes annulées")}</b>
              {recap.voidedOrders > 0 && (
                <>
                  {" "}
                  pour <b className="tnum">{formatCents(recap.voidedCents)}</b>
                </>
              )}
              {recap.amendedOrders > 0 && (
                <>
                  {" "}
                  · <b className="tnum">{plural(recap.amendedOrders, "commande modifiée", "commandes modifiées")}</b>
                </>
              )}
            </li>
            <li>
              Pertes déclarées : <b className="tnum">{plural(recap.lostItems, "article")}</b>
            </li>
          </ul>
        </Section>

        <Section title="Moyens de paiement">
          <Table head={["Moyen", "Commandes", "Montant", "Part"]}>
            {stats.byPaymentMethod.map((m) => (
              <tr key={m.method}>
                <Td>{paymentLabel(m.method)}</Td>
                <Td num>{m.orders}</Td>
                <Td num>{formatCents(m.revenueCents)}</Td>
                <Td num>{paidTotal ? Math.round((m.revenueCents / paidTotal) * 100) : 0} %</Td>
              </tr>
            ))}
            <TotalRow cells={["Total", String(stats.orderCount), formatCents(paidTotal), ""]} />
          </Table>
        </Section>

        <Section title="Caisses">
          {cashup.rows.length === 0 ? (
            <p className="text-neutral-600">Aucune caisse n'a encaissé ni reçu de fond.</p>
          ) : (
            <>
              <Table head={["Caisse", "Espèces", "Carte", "Fond", "Attendu", "Compté", "Écart"]}>
                {cashup.rows.map((r) => (
                  <tr key={r.registerLabel}>
                    <Td>{r.registerLabel}</Td>
                    <Td num>{formatCents(r.cashCents)}</Td>
                    <Td num>{formatCents(r.cardCents)}</Td>
                    <Td num>{formatCents(r.floatCents)}</Td>
                    <Td num>{formatCents(r.expectedCashCents)}</Td>
                    <Td num>{r.countedCents === null ? "—" : formatCents(r.countedCents)}</Td>
                    <Td num bold={r.varianceCents !== null && r.varianceCents !== 0}>
                      {variance(r.varianceCents)}
                    </Td>
                  </tr>
                ))}
                <TotalRow
                  cells={[
                    "Total",
                    formatCents(cashup.totalCashCents),
                    formatCents(cashup.totalCardCents),
                    formatCents(cashup.totalFloatCents),
                    formatCents(cashup.totalFloatCents + cashup.totalCashCents),
                    "",
                    cashup.countedRegisters > 0 ? variance(cashup.totalVarianceCents) : "—",
                  ]}
                />
              </Table>
              {uncounted > 0 && (
                <p className="mt-2 font-bold">
                  ⚠ {plural(uncounted, "caisse pas encore comptée", "caisses pas encore comptées")} :
                  l'écart total est partiel.
                </p>
              )}
            </>
          )}
        </Section>

        <Section title="Produits">
          <Table head={["Produit", "Vendus", "Chiffre", "Offerts", "Pertes", "Réappro", "Correct.", "Restant"]}>
            {products.map((p) => (
              <tr key={p.productId}>
                <Td>{p.name}</Td>
                <Td num>{p.soldQty}</Td>
                <Td num>{formatCents(p.revenueCents)}</Td>
                <Td num>{p.offeredQty || "—"}</Td>
                <Td num bold={p.lostQty > 0}>{p.lostQty || "—"}</Td>
                <Td num>{p.restockQty || "—"}</Td>
                <Td num>{p.correctionQty ? signed(p.correctionQty) : "—"}</Td>
                <Td num>{p.remaining === null ? "∞" : p.remaining}</Td>
              </tr>
            ))}
          </Table>
        </Section>

        <footer className="mt-6 border-t border-neutral-300 pt-2 text-[11px] text-neutral-500">
          Édité le{" "}
          {new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })} depuis CDF
          Caisse. Les chiffres reflètent les ventes synchronisées sur ce poste à cet instant.
        </footer>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h2 className="mb-2 text-[11px] font-bold tracking-wide text-neutral-500 uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Kpi({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className={cn("tnum font-display text-xl font-bold", strong && "text-2xl")}>{value}</div>
    </div>
  );
}

/** Tableau compact ; défile horizontalement à l'écran sur téléphone. */
function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-neutral-900 text-[11px] text-neutral-500">
            {head.map((h, i) => (
              <th key={h} className={cn("py-1 pr-2 font-bold whitespace-nowrap", i === 0 ? "text-left" : "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tnum">{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, num, bold }: { children: ReactNode; num?: boolean; bold?: boolean }) {
  return (
    <td
      className={cn(
        "border-b border-neutral-200 py-1 pr-2",
        num ? "text-right whitespace-nowrap" : "text-left",
        bold && "font-bold",
      )}
    >
      {children}
    </td>
  );
}

function TotalRow({ cells }: { cells: string[] }) {
  return (
    <tr className="border-t-2 border-neutral-900 font-bold">
      {cells.map((c, i) => (
        <td key={i} className={cn("py-1 pr-2", i === 0 ? "text-left" : "text-right whitespace-nowrap")}>
          {c}
        </td>
      ))}
    </tr>
  );
}

/** « −4,00 € manque » / « +2,00 € » : le signe en clair, l'encre est noire. */
function variance(cents: number | null): string {
  if (cents === null) return "—";
  if (cents === 0) return "juste";
  return `${cents < 0 ? "−" : "+"}${formatCents(Math.abs(cents))}`;
}

function signed(n: number): string {
  return `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

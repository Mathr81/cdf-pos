import { bookingItems, bookingTariffs, formatCents, itemsTotal, reservationRows } from "@cdf/shared";

import { projection } from "../../lib/store.js";
import { useRev } from "../../lib/hooks.js";
import { plural } from "../../lib/plural.js";
import { cn } from "../../lib/cn.js";

/**
 * Feuille de secours pour le jour où le wifi ou les tablettes lâchent :
 * même usage que l'ancien Excel, mais à jour à la minute. Invisible à
 * l'écran, c'est elle seule qui sort à l'impression (Gestion → Imprimer).
 */
export function PrintList({ soireeId }: { soireeId: string }) {
  useRev();
  const soiree = projection.soirees[soireeId];
  const tariffs = bookingTariffs(projection, soireeId);
  const rows = reservationRows(projection, soireeId).filter((r) => !r.walkIn);
  const totals = Object.fromEntries(
    tariffs.map((t) => [t.productId, rows.reduce((s, r) => s + (r.counts[t.productId] ?? 0), 0)]),
  );
  const cell = "border border-neutral-400 px-1.5 py-1";

  return (
    <article className="hidden bg-white font-sans text-[12px] leading-snug text-neutral-900 print:block">
      <header className="mb-2 flex items-baseline justify-between gap-2 border-b-2 border-neutral-900 pb-1">
        <h1 className="text-lg font-bold">{soiree?.name} — réservations</h1>
        <span className="text-[11px] text-neutral-600">
          {tariffs.map((t) => `${t.name} ${formatCents(t.priceCents)}`).join(" · ")} · imprimé le{" "}
          {new Date().toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
      </header>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-neutral-100 text-left">
            <th className={cn(cell, "w-8")}>✓</th>
            <th className={cell}>Nom</th>
            <th className={cell}>Table</th>
            <th className={cell}>Téléphone</th>
            {tariffs.map((t) => (
              <th key={t.productId} className={cn(cell, "text-right")}>
                {t.name}
              </th>
            ))}
            <th className={cn(cell, "text-right")}>À payer</th>
            <th className={cell}>Remarque</th>
          </tr>
        </thead>
        <tbody className="tnum">
          {rows.map((r) => (
            <tr key={r.id} className="break-inside-avoid">
              <td className={cn(cell, "text-center")}>{r.order ? "✓" : "☐"}</td>
              <td className={cn(cell, "font-semibold")}>{r.name}</td>
              <td className={cn(cell, "font-semibold")}>{r.table}</td>
              <td className={cell}>{r.phone}</td>
              {tariffs.map((t) => (
                <td key={t.productId} className={cn(cell, "text-right")}>
                  {r.counts[t.productId] || ""}
                </td>
              ))}
              <td className={cn(cell, "text-right")}>
                {r.prepaid ? "payé" : formatCents(itemsTotal(bookingItems(tariffs, r.counts)))}
              </td>
              <td className={cell}>{r.note}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className={cell} />
            <td className={cell} colSpan={3}>
              {plural(rows.length, "réservation")}
            </td>
            {tariffs.map((t) => (
              <td key={t.productId} className={cn(cell, "text-right")}>
                {totals[t.productId]}
              </td>
            ))}
            <td className={cell} colSpan={2} />
          </tr>
        </tbody>
      </table>
    </article>
  );
}

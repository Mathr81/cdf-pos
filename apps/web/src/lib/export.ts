import {
  arrivedHeads,
  bookingTariffs,
  countTotal,
  formatAmount,
  paymentLabel,
  reservationRows,
  type ProjectionState,
} from "@cdf/shared";
import { download } from "./download.js";

/** Échappe un champ CSV (séparateur « ; », compatible Excel FR). */
function cell(v: string | number): string {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, content: string) {
  // BOM UTF-8 pour qu'Excel affiche correctement les accents.
  download(filename, "﻿" + content, "text/csv;charset=utf-8;");
}

function fileTag(state: ProjectionState, soireeId: string | null): string {
  const tag = soireeId ? (state.soirees[soireeId]?.name ?? soireeId) : "toutes-soirees";
  return tag.replace(/[^\w-]+/g, "_").toLowerCase();
}

/**
 * Bilan de fin de soirée sur réservation : une ligne par réservation (venue
 * ou non) et par sur-place, avec ce qui a réellement été encaissé.
 */
export function exportReservationsCsv(state: ProjectionState, soireeId: string): void {
  const tariffs = bookingTariffs(state, soireeId);
  const header = [
    "Nom",
    "Téléphone",
    "Table",
    "Remarque",
    "Payé d'avance",
    ...tariffs.flatMap((t) => [`${t.name} prévus`, `${t.name} venus`]),
    "Statut",
    "Montant payé d'avance",
    "Montant encaissé",
    "Paiement",
    "Caisse",
    "Heure",
  ];
  const lines = [header.map(cell).join(";")];
  for (const r of reservationRows(state, soireeId)) {
    const o = r.order;
    const heads = arrivedHeads(r);
    const onSite = [o, ...r.supplements].filter((x) => x && x.paymentMethod !== "prepaid");
    lines.push(
      [
        r.name,
        r.phone ?? "",
        r.table ?? "",
        r.note ?? "",
        r.prepaid ? "oui" : "",
        ...tariffs.flatMap((t) => [r.walkIn ? "" : (r.counts[t.productId] ?? 0), heads[t.productId] ?? 0]),
        r.walkIn
          ? "sur place"
          : !o
            ? "absent"
            : !r.prepaid && !r.complete && countTotal(heads) < countTotal(r.counts)
              ? "partiel"
              : "arrivé",
        o?.paymentMethod === "prepaid" ? formatAmount(o.totalCents) : "",
        onSite.length ? formatAmount(onSite.reduce((sum, x) => sum + x!.totalCents, 0)) : "",
        [...new Set(onSite.map((x) => paymentLabel(x!.paymentMethod)))].join(" + "),
        o?.registerLabel ?? "",
        o ? new Date(o.createdAt).toLocaleTimeString("fr-FR") : "",
      ]
        .map(cell)
        .join(";"),
    );
  }
  downloadCsv(`reservations-${fileTag(state, soireeId)}.csv`, lines.join("\n"));
}

/**
 * Exporte le détail des ventes (une ligne par article de commande) en CSV.
 * `soireeId = null` exporte toutes les soirées.
 */
export function exportOrdersCsv(state: ProjectionState, soireeId: string | null): void {
  const header = [
    "Soirée",
    "Date",
    "Heure",
    "Commande",
    "Statut",
    "Caisse",
    "Vendeur",
    "Paiement",
    "Produit",
    "Quantité",
    "Prix unitaire",
    "Total ligne",
  ];
  const lines: string[] = [header.map(cell).join(";")];

  const orders = Object.values(state.orders)
    .filter((o) => soireeId === null || o.soireeId === soireeId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const o of orders) {
    const soireeName = state.soirees[o.soireeId]?.name ?? o.soireeId;
    const d = new Date(o.createdAt);
    for (const it of o.items) {
      lines.push(
        [
          soireeName,
          d.toLocaleDateString("fr-FR"),
          d.toLocaleTimeString("fr-FR"),
          o.id.slice(0, 8),
          o.status === "void" ? "annulée" : o.amended ? "modifiée" : "payée",
          o.registerLabel,
          o.cashierName ?? "",
          paymentLabel(o.paymentMethod),
          state.products[it.productId]?.name ?? it.productId,
          it.qty,
          formatAmount(it.unitPriceCents),
          formatAmount(it.qty * it.unitPriceCents),
        ]
          .map(cell)
          .join(";"),
      );
    }
  }

  downloadCsv(`ventes-${fileTag(state, soireeId)}.csv`, lines.join("\n"));
}

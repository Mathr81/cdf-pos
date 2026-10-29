import {
  formatAmount,
  orderHeads,
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
  const header = [
    "Nom",
    "Téléphone",
    "Adultes prévus",
    "Enfants prévus",
    "Adultes venus",
    "Enfants venus",
    "Statut",
    "Montant",
    "Paiement",
    "Caisse",
    "Heure",
  ];
  const lines = [header.map(cell).join(";")];
  for (const r of reservationRows(state, soireeId)) {
    const o = r.order;
    const heads = o ? orderHeads(o) : { adults: 0, children: 0 };
    lines.push(
      [
        r.name,
        r.phone ?? "",
        r.walkIn ? "" : r.adults,
        r.walkIn ? "" : r.children,
        heads.adults,
        heads.children,
        r.walkIn ? "sur place" : o ? "encaissé" : "absent",
        o ? formatAmount(o.totalCents) : "",
        o ? paymentLabel(o.paymentMethod) : "",
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

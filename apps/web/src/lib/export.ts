import { formatAmount, paymentLabel, type ProjectionState } from "@cdf/shared";
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

  const tag = soireeId ? (state.soirees[soireeId]?.name ?? soireeId) : "toutes-soirees";
  const safe = tag.replace(/[^\w-]+/g, "_").toLowerCase();
  downloadCsv(`ventes-${safe}.csv`, lines.join("\n"));
}

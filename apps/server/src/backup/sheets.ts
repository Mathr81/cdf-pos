import { google, type sheets_v4 } from "googleapis";
import { formatAmount, paymentLabel } from "@cdf/shared";
import type { IoServer } from "../ingest.js";
import { prisma } from "../db.js";
import { env } from "../env.js";

/**
 * Worker de sauvegarde vers Google Sheet.
 * Dépile `BackupQueue` par lots et ajoute une ligne lisible par événement dans
 * un Google Sheet (secours humain immédiat si la prod tombe). File de retry :
 * un lot en échec reste `pending` (attempts++) et sera repris au tick suivant.
 */

const POLL_MS = 5000;
const BATCH = 200;
const MAX_ATTEMPTS = 6;
const HEADER = [
  "Reçu le",
  "Type",
  "Caisse",
  "Paiement",
  "Total €",
  "Articles",
  "Détails",
  "ID événement",
];

let sheets: sheets_v4.Sheets | null = null;

async function getSheets(): Promise<sheets_v4.Sheets> {
  if (sheets) return sheets;
  const auth = new google.auth.GoogleAuth({
    keyFile: env.backup.googleCredentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  sheets = google.sheets({ version: "v4", auth: await auth.getClient() as never });
  return sheets;
}

async function ensureHeader(): Promise<void> {
  const api = await getSheets();
  const res = await api.spreadsheets.values.get({
    spreadsheetId: env.backup.sheetsId,
    range: "A1:A1",
  });
  if (!res.data.values || res.data.values.length === 0) {
    await api.spreadsheets.values.update({
      spreadsheetId: env.backup.sheetsId,
      range: "A1",
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
  }
}

/** Transforme un événement stocké en ligne lisible pour le tableur. */
async function eventToRow(ev: {
  id: string;
  type: string;
  payload: unknown;
  serverReceivedAt: Date;
}): Promise<string[]> {
  const when = ev.serverReceivedAt.toISOString().replace("T", " ").slice(0, 19);
  const p = ev.payload as Record<string, unknown>;

  if (ev.type === "sale") {
    const items = (p.items as { productId: string; qty: number }[]) ?? [];
    const ids = [...new Set(items.map((i) => i.productId))];
    const names = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    const nameById = new Map(names.map((n) => [n.id, n.name]));
    const itemsStr = items.map((i) => `${i.qty}× ${nameById.get(i.productId) ?? i.productId}`).join(", ");
    return [
      when,
      "VENTE",
      String(p.registerLabel ?? ""),
      paymentLabel(String(p.paymentMethod ?? "")),
      formatAmount(Number(p.totalCents ?? 0)),
      itemsStr,
      String(p.cashierName ?? ""),
      ev.id,
    ];
  }

  // Mouvements de caisse : lisibles au même titre qu'une vente. Si la prod
  // tombe, le fond et le comptage doivent se relire dans le tableur.
  if (ev.type === "cash_open") {
    return [
      when,
      "FOND DE CAISSE",
      String(p.registerLabel ?? ""),
      "Espèces",
      formatAmount(Number(p.floatCents ?? 0)),
      "",
      "",
      ev.id,
    ];
  }

  if (ev.type === "cash_count") {
    return [
      when,
      "COMPTAGE CAISSE",
      String(p.registerLabel ?? ""),
      "Espèces",
      formatAmount(Number(p.countedCents ?? 0)),
      String(p.note ?? ""),
      "",
      ev.id,
    ];
  }

  // Autres types : ligne générique compacte.
  return [when, ev.type, "", "", "", "", JSON.stringify(p), ev.id];
}

async function processBatch(): Promise<void> {
  const queued = await prisma.backupQueue.findMany({
    where: { status: "pending" },
    orderBy: { id: "asc" },
    take: BATCH,
  });
  if (queued.length === 0) return;

  const events = await prisma.event.findMany({
    where: { id: { in: queued.map((q) => q.eventId) } },
  });
  const eventById = new Map(events.map((e) => [e.id, e]));

  const rows: string[][] = [];
  for (const q of queued) {
    const ev = eventById.get(q.eventId);
    if (ev) rows.push(await eventToRow(ev));
  }

  try {
    const api = await getSheets();
    if (rows.length > 0) {
      await api.spreadsheets.values.append({
        spreadsheetId: env.backup.sheetsId,
        range: "A1",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rows },
      });
    }
    await prisma.backupQueue.updateMany({
      where: { id: { in: queued.map((q) => q.id) } },
      data: { status: "done", attempts: { increment: 1 } },
    });
  } catch (e) {
    const message = (e as Error).message.slice(0, 500);
    // Retry : on incrémente attempts ; au-delà du seuil on marque en erreur.
    for (const q of queued) {
      const attempts = q.attempts + 1;
      await prisma.backupQueue.update({
        where: { id: q.id },
        data: {
          attempts,
          lastError: message,
          status: attempts >= MAX_ATTEMPTS ? "error" : "pending",
        },
      });
    }
    // eslint-disable-next-line no-console
    console.error("[backup] échec Sheets, retry programmé :", message);
  }
}

export function startBackupWorker(_io: IoServer): void {
  if (!env.backup.sheetsEnabled) return;
  if (!env.backup.sheetsId || !env.backup.googleCredentials) {
    // eslint-disable-next-line no-console
    console.warn("[backup] BACKUP_SHEETS_ENABLED=true mais BACKUP_SHEETS_ID / credentials manquants — désactivé.");
    return;
  }

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await ensureHeader();
      await processBatch();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[backup] erreur worker :", (e as Error).message);
    } finally {
      running = false;
    }
  };

  // eslint-disable-next-line no-console
  console.log("[backup] Miroir Google Sheet activé.");
  setInterval(tick, POLL_MS);
  void tick();
}

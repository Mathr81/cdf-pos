import type { StoredEvent } from "@cdf/shared";
import { prisma } from "../db.js";
import { env } from "../env.js";

/**
 * Met un événement en file pour le miroir Google Sheet.
 * Le worker (voir ./sheets.ts) dépile cette file avec retry.
 * Si la sauvegarde Sheets est désactivée, on ne fait rien (aucun surcoût).
 */
export async function enqueueBackup(ev: StoredEvent): Promise<void> {
  if (!env.backup.sheetsEnabled) return;
  await prisma.backupQueue.create({
    data: { eventId: ev.id, eventType: ev.type },
  });
}

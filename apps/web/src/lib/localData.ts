import type { AppEvent } from "@cdf/shared";
import { db } from "./db.js";

/**
 * Cycle de vie des données locales de l'appareil.
 * ─────────────────────────────────────────────────────────────
 * Séparé de `sync.ts` (qui, lui, ne parle que du socket) parce que la
 * destruction du journal local est l'opération la plus dangereuse de
 * l'app : elle mérite son module, sa garde et ses tests.
 */

/**
 * Levée quand une purge détruirait des ventes que le serveur n'a jamais
 * reçues. La garde vit ici, dans `wipeLocalData`, et non chez les appelants :
 * les trois chemins de purge (admin, reset distant, changement d'epoch) sont
 * ainsi sûrs par défaut, et tout appelant futur l'est aussi.
 */
export class PendingSalesError extends Error {
  constructor(readonly count: number) {
    super(`${count} vente(s) non synchronisée(s)`);
    this.name = "PendingSalesError";
  }
}

/** Nombre d'événements créés ici et pas encore acquittés par le serveur. */
export async function pendingCount(): Promise<number> {
  return db.outbox.count();
}

/**
 * Efface toutes les données locales (journal, outbox, curseur).
 *
 * Refuse tant que l'outbox n'est pas vide : ces événements n'existent
 * nulle part ailleurs. `force` n'est légitime qu'après avoir proposé le
 * dump de secours à l'utilisateur (voir `rescue.ts`).
 */
export async function wipeLocalData({ force = false }: { force?: boolean } = {}): Promise<void> {
  if (!force) {
    const count = await pendingCount();
    if (count > 0) throw new PendingSalesError(count);
  }
  await db.transaction("rw", db.log, db.outbox, db.meta, async () => {
    await db.log.clear();
    await db.outbox.clear();
    await db.meta.clear();
  });
}

/**
 * Sérialise l'outbox en JSON. Format volontairement brut — ce sont les
 * événements du journal, tels que le serveur les accepterait : illisible
 * pour un bénévole, mais rejouable, ce qu'un CSV cosmétique ne serait pas.
 */
export async function serializeOutbox(): Promise<string> {
  const rows = await db.outbox.orderBy("createdAt").toArray();
  const events: AppEvent[] = rows.map((r) => r.event);
  return JSON.stringify({ exportedAt: new Date().toISOString(), events }, null, 2);
}

import Dexie, { type EntityTable } from "dexie";
import type { AppEvent } from "@cdf/shared";

/**
 * Base locale IndexedDB (Dexie).
 *  - `outbox` : événements créés localement, pas encore acquittés par le serveur.
 *  - `log`    : tous les événements connus (locaux + reçus), pour reconstruire
 *               la projection au démarrage sans re-télécharger tout le flux.
 *  - `meta`   : paires clé/valeur (curseur de synchro, etc.).
 *  - `conflicts` : encaissements de réservation refusés par le serveur (déjà
 *               encaissée ailleurs). Retirés de l'outbox, mais gardés ici tant
 *               que la caisse n'a pas dit ce qu'elle a fait de l'argent.
 */

export interface OutboxRow {
  id: string; // = event.id
  event: AppEvent;
  createdAt: number;
}

export interface LogRow {
  id: string; // = event.id
  seq: number | null; // seq serveur (null tant que non confirmé)
  event: AppEvent;
}

export interface ConflictRow {
  id: string; // = event.id
  event: Extract<AppEvent, { type: "sale" }>;
  error: string;
  at: number;
}

export interface MetaRow {
  key: string;
  value: string;
}

export const db = new Dexie("cdf-pos") as Dexie & {
  outbox: EntityTable<OutboxRow, "id">;
  log: EntityTable<LogRow, "id">;
  meta: EntityTable<MetaRow, "key">;
  conflicts: EntityTable<ConflictRow, "id">;
};

db.version(1).stores({
  outbox: "id, createdAt",
  log: "id, seq",
  meta: "key",
});

db.version(2).stores({
  outbox: "id, createdAt",
  log: "id, seq",
  meta: "key",
  conflicts: "id, at",
});

export async function getMeta(key: string): Promise<string | null> {
  const row = await db.meta.get(key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value });
}

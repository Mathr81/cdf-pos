/**
 * Stockage persistant.
 * ─────────────────────────────────────────────────────────────
 * Sans cette demande, IndexedDB est en mode « best-effort » : le navigateur
 * peut évincer la base sous pression disque — et l'outbox part avec elle.
 *
 * Safari ≥ 17 (iOS/iPadOS 17+) implémente l'API et accorde la permission
 * selon des heuristiques dont « le site est ouvert en web app depuis l'écran
 * d'accueil », ce qui est exactement le mode d'usage des tablettes. Chrome
 * l'accorde à l'installation ou sur engagement. Un refus reste possible :
 * c'est pourquoi le statut est affiché dans Admin plutôt qu'ignoré.
 */

export type PersistStatus = "persisted" | "denied" | "unsupported";

export async function requestPersistentStorage(
  storage: StorageManager | undefined = globalThis.navigator?.storage,
): Promise<PersistStatus> {
  if (!storage?.persist || !storage.persisted) return "unsupported";
  try {
    if (await storage.persisted()) return "persisted";
    return (await storage.persist()) ? "persisted" : "denied";
  } catch {
    // L'API existe mais a échoué (contexte non sécurisé, mode privé…).
    // La conséquence pour l'utilisateur est celle d'un refus.
    return "denied";
  }
}

/** Occupation du quota, pour repérer une tablette proche de la saturation. */
export async function estimateStorage(
  storage: StorageManager | undefined = globalThis.navigator?.storage,
): Promise<{ usage: number; quota: number } | null> {
  if (!storage?.estimate) return null;
  try {
    const { usage, quota } = await storage.estimate();
    if (usage === undefined || quota === undefined) return null;
    return { usage, quota };
  } catch {
    return null;
  }
}

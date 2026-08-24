import { download } from "./download.js";
import { serializeOutbox } from "./localData.js";

/**
 * Télécharge les ventes non synchronisées avant une purge.
 * Le fichier est le dernier exemplaire existant de ces événements : ils ne
 * sont, par définition, arrivés sur aucun serveur.
 */
export async function downloadOutboxRescue(): Promise<void> {
  const content = await serializeOutbox();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  download(`ventes-non-synchronisees-${stamp}.json`, content, "application/json");
}

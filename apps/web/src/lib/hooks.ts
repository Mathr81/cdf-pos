import { activeSoiree, type ClientSoiree } from "@cdf/shared";
import { projection } from "./store.js";
import { useStore } from "./store.js";

/**
 * S'abonne aux changements de la projection. Les composants appellent ce hook
 * puis lisent `projection` + les sélecteurs de @cdf/shared.
 */
export function useRev(): number {
  return useStore((s) => s.rev);
}

/** Soirée active courante (réactive). */
export function useActiveSoiree(): ClientSoiree | null {
  useRev();
  return activeSoiree(projection);
}

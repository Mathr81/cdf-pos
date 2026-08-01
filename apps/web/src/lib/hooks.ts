import { useStore } from "./store.js";

/**
 * S'abonne aux changements de la projection. Les composants appellent ce hook
 * puis lisent `projection` + les sélecteurs de @cdf/shared.
 */
export function useRev(): number {
  return useStore((s) => s.rev);
}

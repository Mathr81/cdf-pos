import { useEffect } from "react";

/**
 * Écran maintenu allumé pendant le service.
 * ─────────────────────────────────────────────────────────────
 * Le navigateur relâche le sentinel dès que le document passe en
 * arrière-plan et ne le rend jamais de lui-même : la reprise sur
 * `visibilitychange` n'est pas un raffinement, c'est ce qui fait que le
 * verrou survit au premier verrouillage de la tablette.
 *
 * La logique est isolée des API du navigateur (`WakeLockDeps`) pour être
 * testable sans navigateur ; `useWakeLock` n'est que le câblage React.
 */

interface SentinelLike {
  release: () => Promise<void>;
}

export interface WakeLockDeps {
  request: () => Promise<SentinelLike>;
  isVisible: () => boolean;
  /** Abonne `cb` aux changements de visibilité ; renvoie le désabonnement. */
  onVisibilityChange: (cb: () => void) => () => void;
}

/** Démarre le maintien d'écran. Renvoie la fonction d'arrêt. */
export function startWakeLock(deps: WakeLockDeps): () => void {
  let sentinel: SentinelLike | null = null;
  let stopped = false;

  const acquire = async () => {
    if (stopped || sentinel || !deps.isVisible()) return;
    try {
      const next = await deps.request();
      // L'arrêt a pu survenir pendant l'attente : ne pas laisser fuir un
      // verrou que plus personne ne relâchera.
      if (stopped) void next.release().catch(() => undefined);
      else sentinel = next;
    } catch {
      // Verrou indisponible (API absente, onglet masqué, refus système).
      // Une caisse ne doit pas tomber pour un écran qui s'éteint.
    }
  };

  const unsubscribe = deps.onVisibilityChange(() => {
    if (deps.isVisible()) void acquire();
    else sentinel = null; // déjà relâché par le navigateur
  });

  void acquire();

  return () => {
    stopped = true;
    unsubscribe();
    const held = sentinel;
    sentinel = null;
    if (held) void held.release().catch(() => undefined);
  };
}

/** Câblage React : actif tant que le composant est monté. */
export function useWakeLock(): void {
  useEffect(() => {
    const wakeLock = navigator.wakeLock;
    if (!wakeLock) return;
    return startWakeLock({
      request: () => wakeLock.request("screen"),
      isVisible: () => document.visibilityState === "visible",
      onVisibilityChange: (cb) => {
        document.addEventListener("visibilitychange", cb);
        return () => document.removeEventListener("visibilitychange", cb);
      },
    });
  }, []);
}

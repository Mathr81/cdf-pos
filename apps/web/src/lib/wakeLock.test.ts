import { describe, expect, test, vi } from "vitest";
import { startWakeLock, type WakeLockDeps } from "./wakeLock.js";

/**
 * Environnement de test : verrou factice + visibilité pilotable.
 * `flush` laisse les promesses internes se résoudre avant l'assertion.
 */
function harness(over: Partial<WakeLockDeps> = {}) {
  const released: number[] = [];
  let visible = true;
  const listeners = new Set<() => void>();
  let n = 0;

  const request = vi.fn(async () => {
    const id = ++n;
    return {
      release: async () => {
        released.push(id);
      },
    };
  });

  const deps: WakeLockDeps = {
    request,
    isVisible: () => visible,
    onVisibilityChange: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    ...over,
  };

  return {
    deps,
    request,
    released,
    setVisible(v: boolean) {
      visible = v;
      for (const cb of listeners) cb();
    },
    listenerCount: () => listeners.size,
    flush: () => new Promise((r) => setTimeout(r, 0)),
  };
}

describe("startWakeLock", () => {
  test("acquiert un verrou au démarrage", async () => {
    const h = harness();

    startWakeLock(h.deps);
    await h.flush();

    expect(h.request).toHaveBeenCalledTimes(1);
  });

  test("n'acquiert rien tant que le document est masqué", async () => {
    const h = harness({ isVisible: () => false });

    startWakeLock(h.deps);
    await h.flush();

    expect(h.request).not.toHaveBeenCalled();
  });

  /* Le cas qui compte : le navigateur relâche le sentinel dès que la page
     passe en arrière-plan. Sans reprise, l'écran ne serait protégé que
     jusqu'au premier verrouillage de la tablette. */
  test("reprend le verrou quand le document redevient visible", async () => {
    const h = harness();
    startWakeLock(h.deps);
    await h.flush();

    h.setVisible(false);
    await h.flush();
    h.setVisible(true);
    await h.flush();

    expect(h.request).toHaveBeenCalledTimes(2);
  });

  test("relâche le verrou à l'arrêt", async () => {
    const h = harness();
    const stop = startWakeLock(h.deps);
    await h.flush();

    stop();
    await h.flush();

    expect(h.released).toEqual([1]);
  });

  test("se désabonne de la visibilité à l'arrêt", async () => {
    const h = harness();
    const stop = startWakeLock(h.deps);
    await h.flush();

    stop();

    expect(h.listenerCount()).toBe(0);
  });

  test("n'acquiert plus de verrou après l'arrêt", async () => {
    const h = harness();
    const stop = startWakeLock(h.deps);
    await h.flush();
    stop();

    h.setVisible(true);
    await h.flush();

    expect(h.request).toHaveBeenCalledTimes(1);
  });

  test("reste silencieux quand l'API refuse le verrou", async () => {
    const h = harness({
      request: vi.fn(async () => {
        throw new Error("NotAllowedError");
      }),
    });

    const stop = startWakeLock(h.deps);
    await h.flush();

    expect(() => stop()).not.toThrow();
  });
});

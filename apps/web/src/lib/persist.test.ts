import { describe, expect, test, vi } from "vitest";
import { requestPersistentStorage } from "./persist.js";

/** StorageManager minimal — seule la partie que le code appelle est fournie. */
function fakeStorage(over: Partial<StorageManager>): StorageManager {
  return {
    persisted: async () => false,
    persist: async () => false,
    estimate: async () => ({}),
    ...over,
  } as StorageManager;
}

describe("requestPersistentStorage", () => {
  test("renvoie « unsupported » quand le navigateur n'expose pas l'API", async () => {
    expect(await requestPersistentStorage(undefined)).toBe("unsupported");
  });

  test("renvoie « persisted » quand le stockage est déjà persistant", async () => {
    const storage = fakeStorage({ persisted: async () => true });

    expect(await requestPersistentStorage(storage)).toBe("persisted");
  });

  test("ne redemande pas la permission si elle est déjà accordée", async () => {
    const persist = vi.fn(async () => true);
    const storage = fakeStorage({ persisted: async () => true, persist });

    await requestPersistentStorage(storage);

    expect(persist).not.toHaveBeenCalled();
  });

  test("renvoie « persisted » quand la demande est accordée", async () => {
    const storage = fakeStorage({ persist: async () => true });

    expect(await requestPersistentStorage(storage)).toBe("persisted");
  });

  test("renvoie « denied » quand la demande est refusée", async () => {
    const storage = fakeStorage({ persist: async () => false });

    expect(await requestPersistentStorage(storage)).toBe("denied");
  });

  test("renvoie « denied » quand l'API lève une erreur", async () => {
    const storage = fakeStorage({
      persist: async () => {
        throw new Error("SecurityError");
      },
    });

    expect(await requestPersistentStorage(storage)).toBe("denied");
  });
});

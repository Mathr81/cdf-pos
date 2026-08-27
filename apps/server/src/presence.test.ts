import { beforeEach, describe, expect, test } from "vitest";
import { PresenceRegistry } from "./presence.js";

/**
 * Registre des postes connectés.
 * ─────────────────────────────────────────────────────────────
 * Il existe pour une raison précise : avant une remise à zéro, l'admin doit
 * savoir qu'une tablette est hors ligne avec des ventes non transmises. Les
 * tests portent donc surtout sur ce que le registre dit d'un poste absent.
 */

let registry: PresenceRegistry;

beforeEach(() => {
  registry = new PresenceRegistry();
});

const CAISSE1 = { deviceId: "tablette-1", role: "caisse" as const, label: "Caisse 1" };
const CAISSE2 = { deviceId: "tablette-2", role: "caisse" as const, label: "Caisse 2" };

describe("connexions", () => {
  test("un poste connecté apparaît dans la liste", () => {
    registry.join("socket-a", CAISSE1);

    expect(registry.list()).toMatchObject([{ deviceId: "tablette-1", label: "Caisse 1" }]);
  });

  test("un poste déconnecté disparaît", () => {
    registry.join("socket-a", CAISSE1);

    registry.leave("socket-a");

    expect(registry.list()).toHaveLength(0);
  });

  test("déconnecter un socket inconnu ne casse rien", () => {
    expect(() => registry.leave("socket-fantome")).not.toThrow();
  });

  test("les postes sont triés par libellé, pour une liste stable", () => {
    registry.join("socket-b", CAISSE2);
    registry.join("socket-a", CAISSE1);

    expect(registry.list().map((e) => e.label)).toEqual(["Caisse 1", "Caisse 2"]);
  });

  /* Une tablette qui se reconnecte ouvre un nouveau socket avant que l'ancien
     ne soit fermé. Sans dédoublonnage par appareil, l'admin verrait « Caisse 1 »
     deux fois et douterait de ce qu'il lit. */
  test("un même appareil sur deux sockets n'apparaît qu'une fois", () => {
    registry.join("socket-ancien", CAISSE1);
    registry.join("socket-nouveau", CAISSE1);

    expect(registry.list()).toHaveLength(1);
  });

  test("l'appareil reste visible tant qu'il lui reste un socket", () => {
    registry.join("socket-ancien", CAISSE1);
    registry.join("socket-nouveau", CAISSE1);

    registry.leave("socket-ancien");

    expect(registry.list()).toHaveLength(1);
  });
});

describe("ventes en attente", () => {
  test("un poste démarre à zéro en attente", () => {
    registry.join("socket-a", CAISSE1);

    expect(registry.list()[0].pending).toBe(0);
  });

  test("un poste peut déclarer ses ventes en attente", () => {
    registry.join("socket-a", CAISSE1);

    registry.setPending("socket-a", 4);

    expect(registry.list()[0].pending).toBe(4);
  });

  test("déclarer sur un socket inconnu est ignoré", () => {
    expect(() => registry.setPending("socket-fantome", 3)).not.toThrow();
    expect(registry.list()).toHaveLength(0);
  });

  /* Deux sockets pour un même appareil : on retient le plus élevé plutôt que
     le dernier reçu. Un socket mourant qui annonce 0 ne doit pas effacer les
     4 ventes que l'autre vient de signaler. */
  test("retient le plus grand nombre déclaré par un appareil", () => {
    registry.join("socket-ancien", CAISSE1);
    registry.join("socket-nouveau", CAISSE1);
    registry.setPending("socket-nouveau", 4);

    registry.setPending("socket-ancien", 0);

    expect(registry.list()[0].pending).toBe(4);
  });

  test("compte les ventes en attente sur l'ensemble des postes", () => {
    registry.join("socket-a", CAISSE1);
    registry.join("socket-b", CAISSE2);
    registry.setPending("socket-a", 3);
    registry.setPending("socket-b", 2);

    expect(registry.totalPending()).toBe(5);
  });

  test("les ventes d'un poste déconnecté ne sont plus comptées", () => {
    // Elles ne sont pas perdues pour autant : elles restent sur la tablette.
    // Le registre ne décrit que ce qui est joignable maintenant.
    registry.join("socket-a", CAISSE1);
    registry.setPending("socket-a", 3);

    registry.leave("socket-a");

    expect(registry.totalPending()).toBe(0);
  });
});

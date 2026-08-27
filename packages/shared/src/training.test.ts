import { beforeEach, describe, expect, test } from "vitest";
import { compareToPrevious, computeStats, soireeSummaries } from "./stats.js";
import { activeSoiree } from "./projection.js";
import {
  activate,
  at,
  onCarte,
  product,
  replay,
  resetIds,
  sale,
  soiree,
} from "./test-utils/fixtures.js";

/**
 * Soirées d'entraînement.
 * ─────────────────────────────────────────────────────────────
 * Former les bénévoles la semaine d'avant sans que les ventes fictives
 * n'atterrissent dans les chiffres du comité. Une soirée d'entraînement
 * garde ses stats à elle — c'est utile de voir ce qu'on a fait — mais
 * disparaît de tout ce qui agrège plusieurs soirées.
 */

beforeEach(resetIds);

const BURGER = "burger";

function vente(soireeId: string, qty: number) {
  return sale({ soireeId, items: [{ productId: BURGER, qty, unitPriceCents: 100 }] });
}

function monde() {
  return [
    soiree("juin", "Juin", "2026-06-14"),
    soiree("essai", "Essai bénévoles", "2026-06-10", { training: true }),
    product(BURGER, { priceCents: 100 }),
    onCarte(BURGER, { soireeId: "juin", stockInitial: 500 }),
    onCarte(BURGER, { soireeId: "essai", stockInitial: 500 }),
    vente("juin", 20),
    vente("essai", 99),
  ];
}

describe("périmètre des statistiques", () => {
  test("« toutes soirées » ignore l'entraînement", () => {
    const state = replay(...monde());

    expect(computeStats(state, null).totalRevenueCents).toBe(2000);
  });

  test("une soirée d'entraînement garde ses propres statistiques", () => {
    // C'est le but : le bénévole doit voir le résultat de son exercice.
    const state = replay(...monde());

    expect(computeStats(state, "essai").totalRevenueCents).toBe(9900);
  });

  test("le résumé des soirées exclut l'entraînement", () => {
    const state = replay(...monde());

    expect(soireeSummaries(state).map((s) => s.soireeId)).toEqual(["juin"]);
  });

  /* Sans exclusion, la vraie soirée se comparerait à une session
     d'entraînement — « −80 % vs 10 juin » n'aurait aucun sens. */
  test("la comparaison saute par-dessus une soirée d'entraînement", () => {
    const state = replay(
      ...monde(),
      soiree("mai", "Mai", "2026-05-01"),
      onCarte(BURGER, { soireeId: "mai", stockInitial: 500 }),
      vente("mai", 10),
    );

    expect(compareToPrevious(state, "juin")?.previous?.soireeId).toBe("mai");
  });

  test("comparer une soirée d'entraînement ne renvoie rien", () => {
    const state = replay(...monde());

    expect(compareToPrevious(state, "essai")).toBeNull();
  });
});

describe("marquage", () => {
  test("une soirée est une vraie soirée par défaut", () => {
    const state = replay(soiree("juin", "Juin", "2026-06-14"));

    expect(state.soirees.juin.training).toBe(false);
  });

  test("le drapeau d'entraînement est conservé", () => {
    const state = replay(soiree("essai", "Essai", "2026-06-10", { training: true }));

    expect(state.soirees.essai.training).toBe(true);
  });

  test("une soirée d'entraînement peut être activée normalement", () => {
    const state = replay(
      soiree("essai", "Essai", "2026-06-10", { training: true }),
      activate("essai"),
    );

    expect(activeSoiree(state)?.training).toBe(true);
  });

  test("le drapeau se corrige par un événement plus récent", () => {
    const state = replay(
      soiree("essai", "Essai", "2026-06-10", { training: true }),
      soiree("essai", "Essai", "2026-06-10", { training: false, createdAt: at("10:00") }),
    );

    expect(state.soirees.essai.training).toBe(false);
  });

  test("une correction plus ancienne ne réactive pas l'entraînement", () => {
    const state = replay(
      soiree("essai", "Essai", "2026-06-10", { training: false, createdAt: at("10:00") }),
      soiree("essai", "Essai", "2026-06-10", { training: true, createdAt: at("08:00") }),
    );

    expect(state.soirees.essai.training).toBe(false);
  });
});

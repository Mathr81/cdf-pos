import { beforeEach, describe, expect, test } from "vitest";
import { compareToPrevious, computeCashup, computeStats, soireeSummaries } from "./stats.js";
import {
  SOIREE,
  activate,
  at,
  onCarte,
  product,
  replay,
  resetIds,
  sale,
  soiree,
  voidOrder,
} from "./test-utils/fixtures.js";

/**
 * Filet de caractérisation des agrégations monétaires.
 * ─────────────────────────────────────────────────────────────
 * `paidOrders()` alimente computeStats, computeCashup ET soireeSummaries.
 * C'est le point que le lot « repas offerts » devra filtrer : ces tests
 * existent pour qu'un oubli casse quelque chose de visible.
 */

beforeEach(resetIds);

const BURGER = "burger";
const FRITES = "frites";

function decor() {
  return [
    soiree(),
    activate(),
    product(BURGER, { name: "Burger", priceCents: 800 }),
    product(FRITES, { name: "Frites", priceCents: 300 }),
    onCarte(BURGER, { stockInitial: 100 }),
    onCarte(FRITES, { stockInitial: 100 }),
  ];
}

describe("computeStats — chiffre d'affaires", () => {
  test("additionne le total des commandes payées", () => {
    const state = replay(
      ...decor(),
      sale({ items: [{ productId: BURGER, qty: 2, unitPriceCents: 800 }] }),
      sale({ items: [{ productId: FRITES, qty: 1, unitPriceCents: 300 }] }),
    );

    expect(computeStats(state, SOIREE).totalRevenueCents).toBe(1900);
  });

  test("exclut les commandes annulées du chiffre d'affaires", () => {
    const annulee = sale({ items: [{ productId: BURGER, qty: 5, unitPriceCents: 800 }] });

    const state = replay(
      ...decor(),
      sale({ items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }] }),
      annulee,
      voidOrder(annulee.payload.orderId),
    );

    const stats = computeStats(state, SOIREE);
    expect(stats.totalRevenueCents).toBe(800);
    expect(stats.orderCount).toBe(1);
    expect(stats.voidCount).toBe(1);
  });

  test("compte les articles, pas seulement les commandes", () => {
    const state = replay(
      ...decor(),
      sale({
        items: [
          { productId: BURGER, qty: 2, unitPriceCents: 800 },
          { productId: FRITES, qty: 3, unitPriceCents: 300 },
        ],
      }),
    );

    const stats = computeStats(state, SOIREE);
    expect(stats.orderCount).toBe(1);
    expect(stats.itemCount).toBe(5);
  });

  test("le panier moyen est arrondi au centime", () => {
    const state = replay(
      ...decor(),
      sale({ items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }] }),
      sale({ items: [{ productId: FRITES, qty: 1, unitPriceCents: 300 }] }),
      sale({ items: [{ productId: FRITES, qty: 1, unitPriceCents: 300 }] }),
    );

    // 1400 / 3 = 466,66… → 467
    expect(computeStats(state, SOIREE).avgBasketCents).toBe(467);
  });

  test("un état sans vente ne divise pas par zéro", () => {
    const stats = computeStats(replay(...decor()), SOIREE);

    expect(stats.avgBasketCents).toBe(0);
    expect(stats.totalRevenueCents).toBe(0);
  });
});

describe("computeStats — répartitions", () => {
  test("sépare espèces et carte", () => {
    const state = replay(
      ...decor(),
      sale({ items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }], paymentMethod: "cash" }),
      sale({ items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }], paymentMethod: "card" }),
      sale({ items: [{ productId: FRITES, qty: 1, unitPriceCents: 300 }], paymentMethod: "card" }),
    );

    const byMethod = computeStats(state, SOIREE).byPaymentMethod;
    expect(byMethod.find((m) => m.method === "cash")).toMatchObject({
      orders: 1,
      revenueCents: 800,
    });
    expect(byMethod.find((m) => m.method === "card")).toMatchObject({
      orders: 2,
      revenueCents: 1100,
    });
  });

  test("sépare les postes de caisse", () => {
    const state = replay(
      ...decor(),
      sale({ items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }], registerLabel: "Caisse 1" }),
      sale({ items: [{ productId: BURGER, qty: 2, unitPriceCents: 800 }], registerLabel: "Caisse 2" }),
    );

    const byRegister = computeStats(state, SOIREE).byRegister;
    expect(byRegister.find((r) => r.registerLabel === "Caisse 2")?.revenueCents).toBe(1600);
  });

  test("classe les produits par quantité vendue décroissante", () => {
    const state = replay(
      ...decor(),
      sale({ items: [{ productId: BURGER, qty: 2, unitPriceCents: 800 }] }),
      sale({ items: [{ productId: FRITES, qty: 9, unitPriceCents: 300 }] }),
    );

    const top = computeStats(state, SOIREE).topProducts;
    expect(top[0]).toMatchObject({ productId: FRITES, name: "Frites", qty: 9 });
    expect(top[1]).toMatchObject({ productId: BURGER, qty: 2 });
  });

  test("regroupe les ventes par heure", () => {
    const state = replay(
      ...decor(),
      sale({ items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }], createdAt: at("19:10") }),
      sale({ items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }], createdAt: at("19:50") }),
      sale({ items: [{ productId: FRITES, qty: 1, unitPriceCents: 300 }], createdAt: at("21:05") }),
    );

    expect(computeStats(state, SOIREE).salesByHour).toEqual([
      { hour: "19h", orders: 2, revenueCents: 1600 },
      { hour: "21h", orders: 1, revenueCents: 300 },
    ]);
  });

  test("la courbe de CA est cumulée dans l'ordre chronologique", () => {
    const state = replay(
      ...decor(),
      sale({ items: [{ productId: FRITES, qty: 1, unitPriceCents: 300 }], createdAt: at("21:00") }),
      sale({ items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }], createdAt: at("19:00") }),
    );

    expect(computeStats(state, SOIREE).revenueTimeline.map((p) => p.cumulativeCents)).toEqual([
      800, 1100,
    ]);
  });
});

describe("computeStats — périmètre", () => {
  test("un soireeId null agrège toutes les soirées", () => {
    const state = replay(
      ...decor(),
      soiree("autre", "Autre", "2026-09-01"),
      onCarte(BURGER, { soireeId: "autre", stockInitial: 10 }),
      sale({ items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }] }),
      sale({ soireeId: "autre", items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }] }),
    );

    expect(computeStats(state, null).totalRevenueCents).toBe(1600);
    expect(computeStats(state, SOIREE).totalRevenueCents).toBe(800);
  });
});

describe("computeCashup", () => {
  test("répartit espèces et carte par poste", () => {
    const state = replay(
      ...decor(),
      sale({
        items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }],
        registerLabel: "Caisse 1",
        paymentMethod: "cash",
      }),
      sale({
        items: [{ productId: FRITES, qty: 1, unitPriceCents: 300 }],
        registerLabel: "Caisse 1",
        paymentMethod: "card",
      }),
      sale({
        items: [{ productId: BURGER, qty: 2, unitPriceCents: 800 }],
        registerLabel: "Caisse 2",
        paymentMethod: "cash",
      }),
    );

    // Égalité exacte volontaire : la forme de la ligne fait partie du contrat.
    // Sans fond ni comptage, l'attendu se réduit aux espèces encaissées.
    const cashup = computeCashup(state, SOIREE);
    expect(cashup.rows).toEqual([
      {
        registerLabel: "Caisse 1",
        orders: 2,
        cashCents: 800,
        cardCents: 300,
        totalCents: 1100,
        floatCents: 0,
        expectedCashCents: 800,
        countedCents: null,
        varianceCents: null,
        countedAt: null,
      },
      {
        registerLabel: "Caisse 2",
        orders: 1,
        cashCents: 1600,
        cardCents: 0,
        totalCents: 1600,
        floatCents: 0,
        expectedCashCents: 1600,
        countedCents: null,
        varianceCents: null,
        countedAt: null,
      },
    ]);
  });

  test("les totaux recoupent la somme des postes", () => {
    const state = replay(
      ...decor(),
      sale({ items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }], paymentMethod: "cash" }),
      sale({ items: [{ productId: FRITES, qty: 1, unitPriceCents: 300 }], paymentMethod: "card" }),
    );

    const cashup = computeCashup(state, SOIREE);
    expect(cashup.totalCashCents).toBe(800);
    expect(cashup.totalCardCents).toBe(300);
    expect(cashup.totalCents).toBe(1100);
    expect(cashup.orders).toBe(2);
  });

  test("exclut les commandes annulées", () => {
    const annulee = sale({
      items: [{ productId: BURGER, qty: 5, unitPriceCents: 800 }],
      paymentMethod: "cash",
    });

    const state = replay(...decor(), annulee, voidOrder(annulee.payload.orderId));

    expect(computeCashup(state, SOIREE).totalCashCents).toBe(0);
  });
});

describe("soireeSummaries", () => {
  test("résume chaque soirée et trie par date croissante", () => {
    const state = replay(
      soiree("sept", "Septembre", "2026-09-01"),
      soiree("juin", "Juin", "2026-06-14"),
      product(BURGER, { priceCents: 800 }),
      onCarte(BURGER, { soireeId: "sept", stockInitial: 10 }),
      onCarte(BURGER, { soireeId: "juin", stockInitial: 10 }),
      sale({ soireeId: "sept", items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }] }),
      sale({ soireeId: "juin", items: [{ productId: BURGER, qty: 3, unitPriceCents: 800 }] }),
    );

    const summaries = soireeSummaries(state);
    expect(summaries.map((s) => s.soireeId)).toEqual(["juin", "sept"]);
    expect(summaries[0]).toMatchObject({ revenueCents: 2400, orders: 1, items: 3 });
  });

  test("une soirée sans vente est résumée à zéro", () => {
    const state = replay(soiree());

    expect(soireeSummaries(state)[0]).toMatchObject({
      revenueCents: 0,
      orders: 0,
      items: 0,
      avgBasketCents: 0,
    });
  });
});

describe("compareToPrevious", () => {
  /** Deux soirées : « juin » à 2400, « sept » à 3000 (+25 %). */
  function deuxSoirees() {
    return [
      soiree("juin", "Juin", "2026-06-14"),
      soiree("sept", "Septembre", "2026-09-01"),
      product(BURGER, { priceCents: 100 }),
      onCarte(BURGER, { soireeId: "juin", stockInitial: 100 }),
      onCarte(BURGER, { soireeId: "sept", stockInitial: 100 }),
      sale({ soireeId: "juin", items: [{ productId: BURGER, qty: 24, unitPriceCents: 100 }] }),
      sale({ soireeId: "sept", items: [{ productId: BURGER, qty: 30, unitPriceCents: 100 }] }),
    ];
  }

  test("compare à la soirée qui précède par la date", () => {
    const comparison = compareToPrevious(replay(...deuxSoirees()), "sept");

    expect(comparison?.current.revenueCents).toBe(3000);
    expect(comparison?.previous?.soireeId).toBe("juin");
  });

  test("calcule l'écart de chiffre d'affaires en pourcentage", () => {
    const comparison = compareToPrevious(replay(...deuxSoirees()), "sept");

    expect(comparison?.revenueDeltaPct).toBe(25);
  });

  test("une baisse donne un pourcentage négatif", () => {
    const state = replay(
      ...deuxSoirees(),
      soiree("dec", "Décembre", "2026-12-31"),
      onCarte(BURGER, { soireeId: "dec", stockInitial: 100 }),
      sale({ soireeId: "dec", items: [{ productId: BURGER, qty: 15, unitPriceCents: 100 }] }),
    );

    // 1500 après 3000 → −50 %.
    expect(compareToPrevious(state, "dec")?.revenueDeltaPct).toBe(-50);
  });

  test("la première soirée n'a rien à quoi se comparer", () => {
    const comparison = compareToPrevious(replay(...deuxSoirees()), "juin");

    expect(comparison?.current.soireeId).toBe("juin");
    expect(comparison?.revenueDeltaPct).toBeNull();
  });

  test("ignore les soirées postérieures", () => {
    const state = replay(
      ...deuxSoirees(),
      soiree("dec", "Décembre", "2026-12-31"),
    );

    expect(compareToPrevious(state, "sept")?.previous?.soireeId).toBe("juin");
  });

  test("ne divise pas par zéro quand la soirée précédente n'a rien vendu", () => {
    const state = replay(
      soiree("vide", "Vide", "2026-06-14"),
      soiree("sept", "Septembre", "2026-09-01"),
      product(BURGER, { priceCents: 100 }),
      onCarte(BURGER, { soireeId: "sept", stockInitial: 100 }),
      sale({ soireeId: "sept", items: [{ productId: BURGER, qty: 30, unitPriceCents: 100 }] }),
    );

    const comparison = compareToPrevious(state, "sept");

    expect(comparison?.previous?.soireeId).toBe("vide");
    expect(comparison?.revenueDeltaPct).toBeNull();
  });

  test("renvoie null pour une soirée inconnue", () => {
    expect(compareToPrevious(replay(...deuxSoirees()), "fantome")).toBeNull();
  });
});

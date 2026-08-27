import { beforeEach, describe, expect, test } from "vitest";
import { computeCashup, computeStats, soireeSummaries } from "./stats.js";
import { soldWithComponents, stockRemaining, toPrepare } from "./projection.js";
import {
  SOIREE,
  activate,
  onCarte,
  product,
  replay,
  resetIds,
  sale,
  soiree,
} from "./test-utils/fixtures.js";

/**
 * Repas offerts.
 * ─────────────────────────────────────────────────────────────
 * Un burger donné à un bénévole doit compter pour le STOCK et la CUISINE,
 * jamais pour le chiffre d'affaires. La commande garde les vrais prix, ce
 * qui permet de rapporter ce que les gratuités ont coûté.
 *
 * `paidOrders()` alimente computeStats, computeCashup ET soireeSummaries :
 * ces tests vérifient les trois, parce qu'oublier un seul point de filtrage
 * fausserait le CA sans que rien ne le signale.
 */

beforeEach(resetIds);

const BURGER = "burger";
const FRITES = "frites";

function decor() {
  return [
    soiree(),
    activate(),
    product(BURGER, { name: "Burger", priceCents: 800 }),
    onCarte(BURGER, { stockInitial: 100 }),
  ];
}

const vendu = (qty: number) =>
  sale({ items: [{ productId: BURGER, qty, unitPriceCents: 800 }], paymentMethod: "cash" });

const offert = (qty: number) =>
  sale({ items: [{ productId: BURGER, qty, unitPriceCents: 800 }], paymentMethod: "offert" });

describe("chiffre d'affaires", () => {
  test("un repas offert n'entre pas dans le chiffre d'affaires", () => {
    const state = replay(...decor(), vendu(2), offert(3));

    expect(computeStats(state, SOIREE).totalRevenueCents).toBe(1600);
  });

  test("un repas offert n'est pas compté comme une commande encaissée", () => {
    const state = replay(...decor(), vendu(2), offert(3));

    expect(computeStats(state, SOIREE).orderCount).toBe(1);
  });

  test("le panier moyen n'est pas dilué par les gratuités", () => {
    // Sans exclusion, 1600 / 2 commandes donnerait 800 au lieu de 1600.
    const state = replay(...decor(), vendu(2), offert(3));

    expect(computeStats(state, SOIREE).avgBasketCents).toBe(1600);
  });

  test("les articles offerts ne gonflent pas les articles vendus", () => {
    const state = replay(...decor(), vendu(2), offert(3));

    expect(computeStats(state, SOIREE).itemCount).toBe(2);
  });

  test("« offert » n'apparaît pas dans la répartition des paiements", () => {
    const state = replay(...decor(), vendu(2), offert(3));

    expect(computeStats(state, SOIREE).byPaymentMethod.map((m) => m.method)).toEqual(["cash"]);
  });
});

describe("valeur de ce qui a été offert", () => {
  test("rapporte le montant offert", () => {
    const state = replay(...decor(), vendu(2), offert(3));

    expect(computeStats(state, SOIREE).giftedValueCents).toBe(2400);
  });

  test("rapporte le nombre de commandes et d'articles offerts", () => {
    const state = replay(...decor(), vendu(2), offert(3));

    const stats = computeStats(state, SOIREE);
    expect(stats.giftedOrders).toBe(1);
    expect(stats.giftedItems).toBe(3);
  });

  test("sans gratuité, tout est à zéro", () => {
    const state = replay(...decor(), vendu(2));

    const stats = computeStats(state, SOIREE);
    expect(stats.giftedValueCents).toBe(0);
    expect(stats.giftedOrders).toBe(0);
  });
});

describe("stock et cuisine", () => {
  /* Tout l'intérêt du mode « offert » : sans lui, le repas était soit saisi
     comme une vente — CA faux — soit pas saisi du tout, et la cuisine ne
     voyait pas la barquette à sortir. */
  test("un repas offert décrémente le stock", () => {
    const state = replay(...decor(), offert(4));

    expect(stockRemaining(state, SOIREE, BURGER)).toBe(96);
  });

  test("un repas offert compte dans le vendu, donc dans le reste à préparer", () => {
    const state = replay(...decor(), offert(4));

    expect(soldWithComponents(state, SOIREE, BURGER)).toBe(4);
    expect(toPrepare(state, SOIREE, BURGER)).toBe(4);
  });

  test("les composants d'un plat offert sont sortis eux aussi", () => {
    const state = replay(
      soiree(),
      activate(),
      product(FRITES, { name: "Frites" }),
      product(BURGER, { name: "Burger Frites", components: [{ productId: FRITES, qty: 1 }] }),
      onCarte(FRITES, { stockInitial: 100 }),
      onCarte(BURGER, { stockInitial: 100 }),
      offert(5),
    );

    expect(soldWithComponents(state, SOIREE, FRITES)).toBe(5);
  });
});

describe("clôture de caisse", () => {
  test("un repas offert n'entre ni dans les espèces ni dans la carte", () => {
    const state = replay(...decor(), vendu(2), offert(3));

    const cashup = computeCashup(state, SOIREE);
    expect(cashup.totalCashCents).toBe(1600);
    expect(cashup.totalCardCents).toBe(0);
    expect(cashup.orders).toBe(1);
  });

  /* Le cas qui coûterait de l'argent : sans exclusion, l'attendu inclurait
     les 24 € offerts et le poste afficherait un manque de 24 € à chaque
     clôture — on chercherait une erreur qui n'existe pas. */
  test("les gratuités ne créent pas un faux manque en caisse", () => {
    const state = replay(...decor(), vendu(2), offert(3));

    expect(computeCashup(state, SOIREE).rows[0].expectedCashCents).toBe(1600);
  });
});

describe("résumé de soirée", () => {
  test("le chiffre d'affaires de la soirée exclut les gratuités", () => {
    const state = replay(...decor(), vendu(2), offert(3));

    expect(soireeSummaries(state)[0]).toMatchObject({ revenueCents: 1600, orders: 1, items: 2 });
  });
});

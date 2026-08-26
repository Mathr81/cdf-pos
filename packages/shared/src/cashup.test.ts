import { beforeEach, describe, expect, test } from "vitest";
import { computeCashup } from "./stats.js";
import {
  SOIREE,
  activate,
  at,
  cashCount,
  cashOpen,
  onCarte,
  product,
  replay,
  resetIds,
  sale,
  soiree,
  voidOrder,
} from "./test-utils/fixtures.js";

/**
 * Clôture de caisse : fond de monnaie, comptage réel, écart.
 * ─────────────────────────────────────────────────────────────
 * L'écart est le seul chiffre qui révèle une erreur de rendu monnaie le soir
 * même. Sa formule — compté − (fond + espèces encaissées) — est testée dans
 * les deux sens, parce qu'un signe inversé passerait inaperçu à l'œil.
 */

beforeEach(resetIds);

const BURGER = "burger";

function decor() {
  return [
    soiree(),
    activate(),
    product(BURGER, { name: "Burger", priceCents: 100 }),
    onCarte(BURGER, { stockInitial: 500 }),
  ];
}

/** Vente en espèces de `euros` euros au poste donné. */
function especes(euros: number, registerLabel = "Caisse 1") {
  return sale({
    items: [{ productId: BURGER, qty: euros, unitPriceCents: 100 }],
    paymentMethod: "cash",
    registerLabel,
  });
}

function carte(euros: number, registerLabel = "Caisse 1") {
  return sale({
    items: [{ productId: BURGER, qty: euros, unitPriceCents: 100 }],
    paymentMethod: "card",
    registerLabel,
  });
}

function ligne(state: Parameters<typeof computeCashup>[0], label = "Caisse 1") {
  return computeCashup(state, SOIREE).rows.find((r) => r.registerLabel === label);
}

describe("fond de caisse", () => {
  test("le fond déclaré apparaît sur la ligne du poste", () => {
    const state = replay(...decor(), cashOpen("Caisse 1", 15000), especes(50));

    expect(ligne(state)?.floatCents).toBe(15000);
  });

  test("un poste sans fond déclaré est à zéro, pas indéfini", () => {
    const state = replay(...decor(), especes(50));

    expect(ligne(state)?.floatCents).toBe(0);
  });

  test("le fond est propre à chaque poste", () => {
    const state = replay(
      ...decor(),
      cashOpen("Caisse 1", 15000),
      cashOpen("Caisse 2", 5000),
      especes(50, "Caisse 1"),
      especes(30, "Caisse 2"),
    );

    expect(ligne(state, "Caisse 1")?.floatCents).toBe(15000);
    expect(ligne(state, "Caisse 2")?.floatCents).toBe(5000);
  });

  test("le fond est propre à chaque soirée", () => {
    const state = replay(
      ...decor(),
      soiree("autre", "Autre", "2026-09-01"),
      cashOpen("Caisse 1", 15000),
      cashOpen("Caisse 1", 9900, { soireeId: "autre" }),
      especes(50),
    );

    expect(ligne(state)?.floatCents).toBe(15000);
  });

  test("un poste qui a un fond mais aucune vente apparaît quand même", () => {
    // Sinon un fond déposé dans une caisse qui n'a rien vendu serait
    // invisible à la clôture — et l'argent avec.
    const state = replay(...decor(), cashOpen("Caisse 3", 10000));

    expect(ligne(state, "Caisse 3")).toMatchObject({ floatCents: 10000, orders: 0 });
  });
});

describe("comptage et écart", () => {
  test("sans comptage, l'écart n'est pas calculé", () => {
    const state = replay(...decor(), cashOpen("Caisse 1", 15000), especes(50));

    expect(ligne(state)?.countedCents).toBeNull();
    expect(ligne(state)?.varianceCents).toBeNull();
  });

  test("un comptage exact donne un écart nul", () => {
    // 150 € de fond + 50 € encaissés = 200 € attendus.
    const state = replay(
      ...decor(),
      cashOpen("Caisse 1", 15000),
      especes(50),
      cashCount("Caisse 1", 20000),
    );

    expect(ligne(state)?.varianceCents).toBe(0);
  });

  test("un manque donne un écart négatif", () => {
    const state = replay(
      ...decor(),
      cashOpen("Caisse 1", 15000),
      especes(50),
      cashCount("Caisse 1", 19600),
    );

    expect(ligne(state)?.varianceCents).toBe(-400);
  });

  test("un excédent donne un écart positif", () => {
    const state = replay(
      ...decor(),
      cashOpen("Caisse 1", 15000),
      especes(50),
      cashCount("Caisse 1", 20250),
    );

    expect(ligne(state)?.varianceCents).toBe(250);
  });

  /* La carte ne passe pas par la boîte : l'inclure dans l'attendu créerait un
     écart négatif du montant des paiements carte, à chaque clôture. */
  test("les paiements carte n'entrent pas dans l'écart", () => {
    const state = replay(
      ...decor(),
      cashOpen("Caisse 1", 15000),
      especes(50),
      carte(80),
      cashCount("Caisse 1", 20000),
    );

    expect(ligne(state)?.varianceCents).toBe(0);
  });

  test("une vente annulée ne compte pas dans l'attendu", () => {
    const annulee = especes(40);

    const state = replay(
      ...decor(),
      cashOpen("Caisse 1", 15000),
      especes(50),
      annulee,
      voidOrder(annulee.payload.orderId),
      cashCount("Caisse 1", 20000),
    );

    expect(ligne(state)?.varianceCents).toBe(0);
  });

  test("un recomptage remplace le précédent au lieu de s'y ajouter", () => {
    const state = replay(
      ...decor(),
      cashOpen("Caisse 1", 15000),
      especes(50),
      cashCount("Caisse 1", 19000, { createdAt: at("23:00") }),
      cashCount("Caisse 1", 20000, { createdAt: at("23:30") }),
    );

    expect(ligne(state)?.countedCents).toBe(20000);
    expect(ligne(state)?.varianceCents).toBe(0);
  });

  test("un comptage plus ancien n'écrase pas un plus récent", () => {
    const state = replay(
      ...decor(),
      cashOpen("Caisse 1", 15000),
      especes(50),
      cashCount("Caisse 1", 20000, { createdAt: at("23:30") }),
      cashCount("Caisse 1", 19000, { createdAt: at("23:00") }),
    );

    expect(ligne(state)?.countedCents).toBe(20000);
  });

  test("conserve la note du comptage", () => {
    const state = replay(
      ...decor(),
      especes(50),
      cashCount("Caisse 1", 5000, { note: "un billet de 20 manquant" }),
    );

    expect(ligne(state)?.countedNote).toBe("un billet de 20 manquant");
  });
});

describe("totaux de clôture", () => {
  test("additionne les fonds et les écarts de tous les postes", () => {
    const state = replay(
      ...decor(),
      cashOpen("Caisse 1", 15000),
      cashOpen("Caisse 2", 5000),
      especes(50, "Caisse 1"),
      especes(30, "Caisse 2"),
      cashCount("Caisse 1", 19600), // −4 €
      cashCount("Caisse 2", 8250), // +2,50 €
    );

    const cashup = computeCashup(state, SOIREE);
    expect(cashup.totalFloatCents).toBe(20000);
    expect(cashup.totalVarianceCents).toBe(-150);
  });

  test("l'écart total ignore les postes non comptés", () => {
    const state = replay(
      ...decor(),
      cashOpen("Caisse 1", 15000),
      cashOpen("Caisse 2", 5000),
      especes(50, "Caisse 1"),
      especes(30, "Caisse 2"),
      cashCount("Caisse 1", 19600), // −4 €, Caisse 2 pas encore comptée
    );

    const cashup = computeCashup(state, SOIREE);
    expect(cashup.totalVarianceCents).toBe(-400);
    expect(cashup.countedRegisters).toBe(1);
    expect(cashup.totalRegisters).toBe(2);
  });

  test("les chiffres de vente existants ne bougent pas", () => {
    const state = replay(...decor(), cashOpen("Caisse 1", 15000), especes(50), carte(80));

    const cashup = computeCashup(state, SOIREE);
    expect(cashup.totalCashCents).toBe(5000);
    expect(cashup.totalCardCents).toBe(8000);
    expect(cashup.totalCents).toBe(13000);
    expect(cashup.orders).toBe(2);
  });
});

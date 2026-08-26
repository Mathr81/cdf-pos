import { beforeEach, describe, expect, test } from "vitest";
import { forecastDepletion } from "./forecast.js";
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
 * Prévision de rupture : « au rythme actuel, épuisé vers 21h40 ».
 * Le débit est mesuré sur une fenêtre glissante récente, pas sur toute la
 * soirée — un coup de feu à 20h ne doit pas dicter la prévision de 22h.
 */

beforeEach(resetIds);

const BURGER = "burger";
const FRITES = "frites";

function decor(stockInitial = 100) {
  return [
    soiree(),
    activate(),
    product(BURGER, { name: "Burger", priceCents: 800 }),
    onCarte(BURGER, { stockInitial }),
  ];
}

/** Vend `qty` burgers à l'heure dite. */
function vente(qty: number, hhmm: string, productId = BURGER) {
  return sale({ items: [{ productId, qty, unitPriceCents: 800 }], createdAt: at(hhmm) });
}

describe("forecastDepletion", () => {
  test("estime l'heure de rupture au rythme observé", () => {
    // 10 vendus en 20 min → 30/h. Stock restant 90 → 3 h → 24h00.
    const state = replay(...decor(100), vente(10, "20:40"));

    const f = forecastDepletion(state, SOIREE, BURGER, { now: new Date(at("21:00")) });

    expect(f?.ratePerHour).toBe(30);
    expect(f?.minutesLeft).toBe(180);
  });

  test("renvoie l'instant de rupture en ISO", () => {
    const state = replay(...decor(40), vente(10, "20:40"));

    const f = forecastDepletion(state, SOIREE, BURGER, { now: new Date(at("21:00")) });

    // 30 restants à 30/h → 1 h → 22h00.
    expect(f?.depletesAt).toBe(at("22:00"));
  });

  test("ignore les ventes hors de la fenêtre glissante", () => {
    const state = replay(
      ...decor(100),
      vente(50, "19:00"), // coup de feu ancien : ne doit pas compter
      vente(10, "20:45"),
    );

    const f = forecastDepletion(state, SOIREE, BURGER, { now: new Date(at("21:00")) });

    expect(f?.ratePerHour).toBe(30);
  });

  test("compte les composants inclus dans les plats", () => {
    const state = replay(
      soiree(),
      activate(),
      product(FRITES, { name: "Frites" }),
      product(BURGER, { name: "Burger Frites", components: [{ productId: FRITES, qty: 1 }] }),
      onCarte(FRITES, { stockInitial: 100 }),
      onCarte(BURGER, { stockInitial: 100 }),
      vente(10, "20:40"),
    );

    const f = forecastDepletion(state, SOIREE, FRITES, { now: new Date(at("21:00")) });

    expect(f?.ratePerHour).toBe(30);
  });

  test("ne compte pas les commandes annulées", () => {
    const annulee = sale({
      items: [{ productId: BURGER, qty: 40, unitPriceCents: 800 }],
      createdAt: at("20:50"),
    });

    const state = replay(...decor(100), vente(10, "20:40"), annulee, voidOrder(annulee.payload.orderId));

    const f = forecastDepletion(state, SOIREE, BURGER, { now: new Date(at("21:00")) });

    expect(f?.ratePerHour).toBe(30);
  });

  test("ne prévoit rien pour un stock illimité", () => {
    const state = replay(
      soiree(),
      activate(),
      product(BURGER),
      onCarte(BURGER, { stockUnlimited: true }),
      vente(10, "20:45"),
    );

    expect(forecastDepletion(state, SOIREE, BURGER, { now: new Date(at("21:00")) })).toBeNull();
  });

  test("ne prévoit rien sans vente dans la fenêtre", () => {
    const state = replay(...decor(100), vente(10, "19:00"));

    expect(forecastDepletion(state, SOIREE, BURGER, { now: new Date(at("21:00")) })).toBeNull();
  });

  test("ne prévoit rien quand le stock est déjà épuisé", () => {
    const state = replay(...decor(10), vente(10, "20:45"));

    expect(forecastDepletion(state, SOIREE, BURGER, { now: new Date(at("21:00")) })).toBeNull();
  });

  /* Extrapoler sur trois minutes de service donnerait « épuisé dans 8 min »
     au premier client. On refuse de répondre tant que la fenêtre observée
     est trop courte. */
  test("ne prévoit rien dans les toutes premières minutes de service", () => {
    const state = replay(...decor(100), vente(3, "20:01"));

    expect(forecastDepletion(state, SOIREE, BURGER, { now: new Date(at("20:03")) })).toBeNull();
  });

  /* Le débit est ancré sur la première vente de la soirée, pas bêtement sur
     `now − fenêtre` : sinon un service ouvert depuis 10 min serait divisé par
     20 min et son rythme sous-estimé de moitié. */
  test("mesure le débit sur le temps réellement écoulé depuis la première vente", () => {
    // Première vente à 20h00, il est 20h10 : 10 min écoulées, pas 20.
    const state = replay(...decor(100), vente(10, "20:00"));

    const f = forecastDepletion(state, SOIREE, BURGER, { now: new Date(at("20:10")) });

    expect(f?.ratePerHour).toBe(60);
  });
});

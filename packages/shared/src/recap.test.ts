import { beforeEach, expect, test } from "vitest";
import { computeRecap } from "./stats.js";
import { sortCategories } from "./projection.js";
import {
  SOIREE,
  activate,
  onCarte,
  product,
  replay,
  resetIds,
  sale,
  soiree,
  stockAdjust,
  uuid,
  voidOrder,
} from "./test-utils/fixtures.js";

beforeEach(resetIds);

const BURGER = "burger";
const GLACE = "glace";

function decor() {
  return [
    soiree(),
    activate(),
    product(BURGER, { name: "Burger", priceCents: 800 }),
    product(GLACE, { name: "Glace", priceCents: 200 }),
    onCarte(BURGER, { stockInitial: 50 }),
    onCarte(GLACE, { stockInitial: 30 }),
  ];
}

test("récap : ventes, offerts, pertes, réappros, corrections, annulations", () => {
  const voided = uuid();
  const state = replay(
    ...decor(),
    sale({ items: [{ productId: BURGER, qty: 2, unitPriceCents: 800 }] }),
    sale({ items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }], paymentMethod: "offert" }),
    sale({ orderId: voided, items: [{ productId: GLACE, qty: 3, unitPriceCents: 200 }] }),
    voidOrder(voided),
    stockAdjust(BURGER, -4, "spoilage"),
    stockAdjust(BURGER, 10, "restock"),
    stockAdjust(GLACE, -2, "correction"),
  );

  const recap = computeRecap(state, SOIREE);
  const burger = recap.products.find((r) => r.productId === BURGER)!;
  const glace = recap.products.find((r) => r.productId === GLACE)!;

  expect(burger).toMatchObject({ soldQty: 2, revenueCents: 1600, offeredQty: 1, lostQty: 4, restockQty: 10 });
  // 50 + 10 réappro − 4 pertes − 3 vendus (offert compris)
  expect(burger.remaining).toBe(53);
  // Produit sur la carte mais non vendu : présent quand même, avec sa correction.
  expect(glace).toMatchObject({ soldQty: 0, correctionQty: -2 });
  expect(recap.voidedOrders).toBe(1);
  expect(recap.voidedCents).toBe(600);
  expect(recap.lostItems).toBe(4);
  expect(recap.stats.totalRevenueCents).toBe(1600);
});

test("sortCategories : ordre réglé d'abord, nouvelles catégories ensuite", () => {
  const state = replay(...decor());
  state.categoryOrder = ["Plats", "Desserts"];
  expect(sortCategories(state, ["Entrées", "Desserts", "Boissons", "Plats"])).toEqual([
    "Plats",
    "Desserts",
    "Entrées",
    "Boissons",
  ]);
});

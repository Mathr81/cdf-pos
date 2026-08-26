import { beforeEach, describe, expect, test } from "vitest";
import {
  activeSoiree,
  effectivePrice,
  preparedCount,
  soireeCarte,
  soireeOrders,
  soldDirect,
  soldFromComponents,
  soldWithComponents,
  stockRemaining,
  toPrepare,
} from "./projection.js";
import {
  SOIREE,
  activate,
  amend,
  at,
  onCarte,
  prepared,
  product,
  replay,
  resetIds,
  soiree,
  stockAdjust,
  sale,
  voidOrder,
} from "./test-utils/fixtures.js";

/**
 * Filet de caractérisation du réducteur.
 * ─────────────────────────────────────────────────────────────
 * Ces tests décrivent le comportement ACTUEL, pas un comportement souhaité :
 * ils sont écrits avant de modifier le calcul de l'argent (repas offerts,
 * marge, fond de caisse) pour que toute dérive devienne visible.
 */

beforeEach(resetIds);

const BURGER = "burger";
const FRITES = "frites";

/** Décor minimal : une soirée active, un produit sur la carte avec du stock. */
function withCarte(stockInitial = 10, over: Parameters<typeof onCarte>[1] = {}) {
  return [
    soiree(),
    activate(),
    product(BURGER, { name: "Burger", priceCents: 800 }),
    onCarte(BURGER, { stockInitial, ...over }),
  ];
}

describe("ventes", () => {
  test("une vente alimente les quantités vendues", () => {
    const state = replay(
      ...withCarte(),
      sale({ items: [{ productId: BURGER, qty: 3, unitPriceCents: 800 }] }),
    );

    expect(soldDirect(state, SOIREE, BURGER)).toBe(3);
  });

  test("un même orderId rejoué deux fois ne compte qu'une fois", () => {
    const first = sale({
      orderId: "11111111-1111-4111-8111-111111111111",
      items: [{ productId: BURGER, qty: 2, unitPriceCents: 800 }],
    });
    const duplicate = sale({
      orderId: "11111111-1111-4111-8111-111111111111",
      items: [{ productId: BURGER, qty: 2, unitPriceCents: 800 }],
    });

    const state = replay(...withCarte(), first, duplicate);

    expect(soldDirect(state, SOIREE, BURGER)).toBe(2);
  });

  test("les commandes d'une soirée sont rendues triées par date", () => {
    const late = sale({
      items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }],
      createdAt: at("21:30"),
    });
    const early = sale({
      items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }],
      createdAt: at("19:30"),
    });

    const state = replay(...withCarte(), late, early);

    expect(soireeOrders(state, SOIREE).map((o) => o.createdAt)).toEqual([
      at("19:30"),
      at("21:30"),
    ]);
  });
});

describe("annulation", () => {
  test("une annulation retire les quantités vendues", () => {
    const order = sale({ items: [{ productId: BURGER, qty: 3, unitPriceCents: 800 }] });

    const state = replay(...withCarte(), order, voidOrder(order.payload.orderId));

    expect(soldDirect(state, SOIREE, BURGER)).toBe(0);
  });

  test("annuler deux fois la même commande ne double pas le retrait", () => {
    const order = sale({ items: [{ productId: BURGER, qty: 3, unitPriceCents: 800 }] });
    const id = order.payload.orderId;

    const state = replay(...withCarte(), order, voidOrder(id), voidOrder(id));

    expect(soldDirect(state, SOIREE, BURGER)).toBe(0);
  });

  test("la commande annulée reste dans le journal avec le statut void", () => {
    const order = sale({ items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }] });

    const state = replay(...withCarte(), order, voidOrder(order.payload.orderId));

    expect(state.orders[order.payload.orderId].status).toBe("void");
  });
});

describe("modification de commande", () => {
  test("la quantité vendue suit le delta entre ancien et nouveau panier", () => {
    const order = sale({ items: [{ productId: BURGER, qty: 3, unitPriceCents: 800 }] });

    const state = replay(
      ...withCarte(),
      order,
      amend(order.payload.orderId, [{ productId: BURGER, qty: 1, unitPriceCents: 800 }]),
    );

    expect(soldDirect(state, SOIREE, BURGER)).toBe(1);
  });

  test("la commande est marquée comme modifiée", () => {
    const order = sale({ items: [{ productId: BURGER, qty: 1, unitPriceCents: 800 }] });

    const state = replay(
      ...withCarte(),
      order,
      amend(order.payload.orderId, [{ productId: BURGER, qty: 2, unitPriceCents: 800 }]),
    );

    expect(state.orders[order.payload.orderId].amended).toBe(true);
  });

  test("modifier une commande annulée n'a aucun effet", () => {
    const order = sale({ items: [{ productId: BURGER, qty: 3, unitPriceCents: 800 }] });
    const id = order.payload.orderId;

    const state = replay(
      ...withCarte(),
      order,
      voidOrder(id),
      amend(id, [{ productId: BURGER, qty: 9, unitPriceCents: 800 }]),
    );

    expect(soldDirect(state, SOIREE, BURGER)).toBe(0);
  });
});

describe("plats composés", () => {
  /** « Burger Frites » contient 1 « Frites » : vendre le plat sort une barquette. */
  function withCompose() {
    return [
      soiree(),
      activate(),
      product(FRITES, { name: "Frites", priceCents: 300 }),
      product(BURGER, {
        name: "Burger Frites",
        priceCents: 800,
        components: [{ productId: FRITES, qty: 1 }],
      }),
      onCarte(FRITES, { stockInitial: 50 }),
      onCarte(BURGER, { stockInitial: 20 }),
    ];
  }

  test("vendre un plat compte aussi ses composants", () => {
    const state = replay(
      ...withCompose(),
      sale({ items: [{ productId: BURGER, qty: 3, unitPriceCents: 800 }] }),
    );

    expect(soldWithComponents(state, SOIREE, FRITES)).toBe(3);
  });

  test("la vente directe du composant reste distincte de la vente induite", () => {
    const state = replay(
      ...withCompose(),
      sale({
        items: [
          { productId: BURGER, qty: 3, unitPriceCents: 800 },
          { productId: FRITES, qty: 2, unitPriceCents: 300 },
        ],
      }),
    );

    expect(soldDirect(state, SOIREE, FRITES)).toBe(2);
    expect(soldFromComponents(state, SOIREE, FRITES)).toBe(3);
  });

  test("le stock du composant est décrémenté par les plats vendus", () => {
    const state = replay(
      ...withCompose(),
      sale({ items: [{ productId: BURGER, qty: 4, unitPriceCents: 800 }] }),
    );

    expect(stockRemaining(state, SOIREE, FRITES)).toBe(46);
  });

  test("un composant n'est pas lui-même décomposé (un seul niveau)", () => {
    const state = replay(
      soiree(),
      activate(),
      product("pain", { name: "Pain" }),
      product(FRITES, { name: "Frites", components: [{ productId: "pain", qty: 1 }] }),
      product(BURGER, { name: "Burger", components: [{ productId: FRITES, qty: 1 }] }),
      onCarte("pain", { stockInitial: 100 }),
      onCarte(FRITES, { stockInitial: 100 }),
      onCarte(BURGER, { stockInitial: 100 }),
      sale({ items: [{ productId: BURGER, qty: 5, unitPriceCents: 800 }] }),
    );

    // 5 burgers → 5 frites, mais PAS 5 pains : la composition ne se propage pas.
    expect(soldWithComponents(state, SOIREE, FRITES)).toBe(5);
    expect(soldWithComponents(state, SOIREE, "pain")).toBe(0);
  });
});

describe("stock", () => {
  test("le stock restant part du stock initial de la carte", () => {
    const state = replay(...withCarte(25));

    expect(stockRemaining(state, SOIREE, BURGER)).toBe(25);
  });

  test("les ventes et les ajustements se cumulent sur le stock", () => {
    const state = replay(
      ...withCarte(10),
      sale({ items: [{ productId: BURGER, qty: 4, unitPriceCents: 800 }] }),
      stockAdjust(BURGER, 12),
      stockAdjust(BURGER, -2, "spoilage"),
    );

    expect(stockRemaining(state, SOIREE, BURGER)).toBe(16);
  });

  test("un stock illimité ne se calcule pas", () => {
    const state = replay(
      ...withCarte(0, { stockUnlimited: true }),
      sale({ items: [{ productId: BURGER, qty: 30, unitPriceCents: 800 }] }),
    );

    expect(stockRemaining(state, SOIREE, BURGER)).toBeNull();
  });

  test("un produit absent de la carte n'a pas de stock suivi", () => {
    const state = replay(soiree(), activate(), product(BURGER));

    expect(stockRemaining(state, SOIREE, BURGER)).toBeNull();
  });

  test("le stock peut passer sous zéro (vente forcée)", () => {
    const state = replay(
      ...withCarte(2),
      sale({ items: [{ productId: BURGER, qty: 5, unitPriceCents: 800 }] }),
    );

    expect(stockRemaining(state, SOIREE, BURGER)).toBe(-3);
  });
});

describe("cuisine", () => {
  test("le reste à préparer est la différence entre vendu et préparé", () => {
    const state = replay(
      ...withCarte(50),
      sale({ items: [{ productId: BURGER, qty: 7, unitPriceCents: 800 }] }),
      prepared(BURGER, 4),
    );

    expect(preparedCount(state, SOIREE, BURGER)).toBe(4);
    expect(toPrepare(state, SOIREE, BURGER)).toBe(3);
  });

  test("préparer plus que vendu ne rend pas un reste négatif", () => {
    const state = replay(
      ...withCarte(50),
      sale({ items: [{ productId: BURGER, qty: 2, unitPriceCents: 800 }] }),
      prepared(BURGER, 10),
    );

    expect(toPrepare(state, SOIREE, BURGER)).toBe(0);
  });
});

describe("carte et prix", () => {
  test("le prix de la soirée l'emporte sur le prix catalogue", () => {
    const state = replay(
      soiree(),
      activate(),
      product(BURGER, { priceCents: 800 }),
      onCarte(BURGER, { priceOverrideCents: 650 }),
    );

    expect(effectivePrice(state, SOIREE, BURGER)).toBe(650);
  });

  test("sans surcharge, le prix catalogue s'applique", () => {
    const state = replay(...withCarte());

    expect(effectivePrice(state, SOIREE, BURGER)).toBe(800);
  });

  test("un produit retiré de la carte disparaît de la carte de la soirée", () => {
    const state = replay(...withCarte(), onCarte(BURGER, { onCarte: false, createdAt: at("11:00") }));

    expect(soireeCarte(state, SOIREE)).toHaveLength(0);
  });

  test("un produit supprimé disparaît de la carte sans effacer son historique", () => {
    const order = sale({ items: [{ productId: BURGER, qty: 2, unitPriceCents: 800 }] });
    const state = replay(...withCarte(), order, {
      id: "22222222-2222-4222-8222-222222222222",
      deviceId: "device-test",
      clientSeq: 99,
      createdAt: at("22:00"),
      type: "product_delete",
      payload: { id: BURGER },
    });

    expect(soireeCarte(state, SOIREE)).toHaveLength(0);
    expect(soldDirect(state, SOIREE, BURGER)).toBe(2);
  });
});

describe("last-write-wins", () => {
  test("un product_upsert plus ancien n'écrase pas un plus récent", () => {
    const state = replay(
      product(BURGER, { name: "Nouveau nom", createdAt: at("12:00") }),
      product(BURGER, { name: "Ancien nom", createdAt: at("10:00") }),
    );

    expect(state.products[BURGER].name).toBe("Nouveau nom");
  });

  test("une config de carte plus ancienne n'écrase pas une plus récente", () => {
    const state = replay(
      soiree(),
      product(BURGER),
      onCarte(BURGER, { stockInitial: 40, createdAt: at("12:00") }),
      onCarte(BURGER, { stockInitial: 5, createdAt: at("10:00") }),
    );

    expect(stockRemaining(state, SOIREE, BURGER)).toBe(40);
  });
});

describe("soirées", () => {
  test("activer une soirée la rend courante", () => {
    const state = replay(soiree(), activate());

    expect(activeSoiree(state)?.id).toBe(SOIREE);
  });

  test("clôturer la soirée active la retire du poste courant", () => {
    const state = replay(soiree(), activate(), {
      id: "33333333-3333-4333-8333-333333333333",
      deviceId: "device-test",
      clientSeq: 50,
      createdAt: at("23:59"),
      type: "soiree_close",
      payload: { soireeId: SOIREE },
    });

    expect(activeSoiree(state)).toBeNull();
    expect(state.soirees[SOIREE].status).toBe("closed");
  });

  test("les ventes sont cloisonnées par soirée", () => {
    const state = replay(
      soiree(),
      soiree("autre", "Autre soirée", "2026-09-01"),
      activate(),
      product(BURGER),
      onCarte(BURGER, { stockInitial: 10 }),
      onCarte(BURGER, { soireeId: "autre", stockInitial: 10 }),
      sale({ items: [{ productId: BURGER, qty: 3, unitPriceCents: 800 }] }),
      sale({ soireeId: "autre", items: [{ productId: BURGER, qty: 8, unitPriceCents: 800 }] }),
    );

    expect(soldDirect(state, SOIREE, BURGER)).toBe(3);
    expect(soldDirect(state, "autre", BURGER)).toBe(8);
  });

  test("supprimer une soirée efface ses ventes et son stock", () => {
    const state = replay(
      ...withCarte(),
      sale({ items: [{ productId: BURGER, qty: 3, unitPriceCents: 800 }] }),
      {
        id: "44444444-4444-4444-8444-444444444444",
        deviceId: "device-test",
        clientSeq: 60,
        createdAt: at("23:00"),
        type: "soiree_delete",
        payload: { soireeId: SOIREE },
      },
    );

    expect(state.soirees[SOIREE]).toBeUndefined();
    expect(soireeOrders(state, SOIREE)).toHaveLength(0);
    expect(soldDirect(state, SOIREE, BURGER)).toBe(0);
  });
});

import { beforeEach, describe, expect, test } from "vitest";
import { BOOKING_ADULT_ID, BOOKING_CHILD_ID } from "./projection.js";
import {
  arrivedHeads,
  bookingDashboard,
  bookingItems,
  bookingTariffs,
  canSelfVoid,
  isBookingSoiree,
  isReservationsOnly,
  reservationRows,
  searchReservations,
  sortReservationRows,
} from "./reservations.js";
import { computeCashup, computeStats } from "./stats.js";
import {
  activate,
  at,
  onCarte,
  product,
  replay,
  reservation,
  reservationComplete,
  reservationDelete,
  resetIds,
  sale,
  soiree,
  SOIREE,
  tariffs,
  voidOrder,
} from "./test-utils/fixtures.js";

beforeEach(resetIds);

const A = BOOKING_ADULT_ID;
const E = BOOKING_CHILD_ID;
const ETU = "resa-etudiant";
const DUPONT = "00000000-0000-4000-9000-000000000001";
const MARTIN = "00000000-0000-4000-9000-000000000002";
const WALKIN = "00000000-0000-4000-9000-000000000003";
const ROUX = "00000000-0000-4000-9000-000000000004";
const EXTRA = "00000000-0000-4000-9000-000000000005";
const ORDER = "00000000-0000-4000-9000-0000000000a1";
const PRICES: Record<string, number> = { [A]: 2400, [E]: 900, [ETU]: 1500 };

function setup() {
  return [
    soiree(),
    activate(),
    product(A, { name: "Adulte", priceCents: 0, stockUnlimited: true }),
    product(E, { name: "Enfant", priceCents: 0, stockUnlimited: true }),
    product(ETU, { name: "Étudiant", priceCents: 0, stockUnlimited: true }),
    tariffs([A, E, ETU].map((productId) => ({ productId, priceCents: PRICES[productId] }))),
    reservation(DUPONT, "Dupont", 2, 1, { phone: "06 12 34 56 78" }),
    reservation(MARTIN, "Martin", 0, 0, { counts: { [A]: 4, [E]: 2, [ETU]: 1 }, note: "Table 4, sans gluten" }),
  ];
}

function arrive(reservationId: string, counts: Record<string, number>, over: Partial<Parameters<typeof sale>[0]> = {}) {
  const items = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([productId, qty]) => ({ productId, qty, unitPriceCents: PRICES[productId] }));
  return sale({ items, reservationId, ...over });
}

describe("soirée sur réservation", () => {
  test("tarifs de la soirée, dans l'ordre, et lignes de vente", () => {
    const state = replay(...setup());
    expect(isBookingSoiree(state, SOIREE)).toBe(true);
    const t = bookingTariffs(state, SOIREE);
    expect(t.map((x) => x.name)).toEqual(["Adulte", "Enfant", "Étudiant"]);
    expect(bookingItems(t, { [A]: 2, [ETU]: 0 })).toEqual([{ productId: A, qty: 2, unitPriceCents: 2400 }]);
  });

  test("réservations seules tant que la carte est vide", () => {
    expect(isReservationsOnly(replay(...setup()), SOIREE)).toBe(true);
    expect(isReservationsOnly(replay(...setup(), product("biere"), onCarte("biere")), SOIREE)).toBe(false);
  });

  /* Les soirées créées avant les tarifs multiples (prod du 29/10) doivent
     continuer de fonctionner sans être reconfigurées. */
  test("ancien format : tarifs adulte / enfant via la carte, réservations adults / children", () => {
    const state = replay(
      soiree(),
      product(A, { name: "Repas adulte" }),
      product(E, { name: "Repas enfant" }),
      onCarte(A, { onCarte: false, priceOverrideCents: 2400 }),
      onCarte(E, { onCarte: false, priceOverrideCents: 900 }),
      reservation(DUPONT, "Dupont", 2, 0),
    );
    expect(bookingTariffs(state, SOIREE).map((t) => [t.productId, t.priceCents])).toEqual([
      [A, 2400],
      [E, 900],
    ]);
    expect(state.reservations[DUPONT].counts).toEqual({ [A]: 2 });
  });

  test("tableau de bord : attendus, arrivés, restants, par tarif, par mode et par caisse", () => {
    const state = replay(
      ...setup(),
      // Dupont vient à 3 adultes au lieu de 2 + 1 : ajusté à l'encaissement.
      arrive(DUPONT, { [A]: 3 }, { paymentMethod: "card", registerLabel: "Caisse 2" }),
      arrive(WALKIN, { [A]: 1, [E]: 1 }, { guestName: "Famille Roux" }),
    );
    const d = bookingDashboard(state, SOIREE);
    expect(d.expected).toBe(10);
    expect(d.arrived).toBe(5);
    expect(d.arrivedWalkIn).toBe(2);
    expect(d.remaining).toBe(7);
    expect(d.byTariff[A]).toEqual({ expected: 6, arrived: 4 });
    expect(d.byTariff[ETU]).toEqual({ expected: 1, arrived: 0 });
    expect(d.totalCents).toBe(3 * 2400 + 2400 + 900);
    expect(d.byPaymentMethod).toEqual(
      expect.arrayContaining([
        { method: "card", orders: 1, revenueCents: 7200 },
        { method: "cash", orders: 1, revenueCents: 3300 },
      ]),
    );
    expect(d.byRegister.map((r) => r.registerLabel)).toEqual(["Caisse 1", "Caisse 2"]);
    expect(reservationRows(state, SOIREE).find((r) => r.walkIn)?.name).toBe("Famille Roux");
    expect(reservationRows(state, SOIREE).find((r) => r.id === MARTIN)?.note).toBe("Table 4, sans gluten");
  });

  test("un encaissement annulé remet la réservation en attente", () => {
    const state = replay(...setup(), arrive(DUPONT, { [A]: 2, [E]: 1 }, { orderId: ORDER }), voidOrder(ORDER));
    const d = bookingDashboard(state, SOIREE);
    expect(d.arrived).toBe(0);
    expect(d.remaining).toBe(10);
    expect(reservationRows(state, SOIREE).find((r) => r.id === DUPONT)?.order).toBeNull();
  });

  test("l'argent des réservations entre dans le comptage de caisse", () => {
    const state = replay(...setup(), arrive(DUPONT, { [A]: 2, [E]: 1 }));
    const row = computeCashup(state, SOIREE).rows.find((r) => r.registerLabel === "Caisse 1");
    expect(row?.cashCents).toBe(5700);
  });

  test("chèque : compté à part, hors de l'attendu en espèces", () => {
    const state = replay(...setup(), arrive(DUPONT, { [A]: 2, [E]: 1 }, { paymentMethod: "cheque" }));
    const cashup = computeCashup(state, SOIREE);
    const row = cashup.rows.find((r) => r.registerLabel === "Caisse 1")!;
    expect([row.cashCents, row.cardCents, row.chequeCents, row.expectedCashCents]).toEqual([0, 0, 5700, 0]);
    expect(cashup.totalCents).toBe(5700);
  });

  test("last-write-wins sur les modifications, la suppression ne ressuscite pas", () => {
    const state = replay(
      ...setup(),
      reservation(MARTIN, "Martin", 1, 0, { createdAt: at("13:00") }),
      reservation(MARTIN, "Martin", 9, 9, { createdAt: at("11:30") }),
      reservation(DUPONT, "Dupont", 2, 1, { createdAt: at("12:00") }),
      reservationDelete(DUPONT, at("12:30")),
      reservation(DUPONT, "Dupont", 5, 5, { createdAt: at("12:10") }),
    );
    expect(state.reservations[MARTIN].counts).toEqual({ [A]: 1 });
    expect(state.reservations[DUPONT]).toBeUndefined();
  });
});

describe("payé d'avance", () => {
  /* Roux a réglé 2 adultes par virement ; 3 viennent. On pointe l'arrivée
     sans encaisser, et le 3ᵉ paie à la porte. */
  function rouxArrives() {
    return replay(
      ...setup(),
      reservation(ROUX, "Roux", 2, 0, { prepaid: true }),
      arrive(ROUX, { [A]: 2 }, { paymentMethod: "prepaid", heads: { [A]: 3 } }),
      arrive(EXTRA, { [A]: 1 }, { supplementOf: ROUX, heads: {}, registerLabel: "Caisse 2" }),
    );
  }

  test("arrivée comptée une fois, supplément rattaché à la réservation", () => {
    const state = rouxArrives();
    const row = reservationRows(state, SOIREE).find((r) => r.id === ROUX)!;
    expect(row.order?.paymentMethod).toBe("prepaid");
    expect(row.supplements).toHaveLength(1);
    expect(reservationRows(state, SOIREE).some((r) => r.walkIn)).toBe(false);
    const d = bookingDashboard(state, SOIREE);
    expect(d.arrived).toBe(3);
    expect(d.prepaidCents).toBe(4800);
    expect(d.totalCents).toBe(2400);
    expect(d.byRegister).toEqual([{ registerLabel: "Caisse 2", orders: 1, revenueCents: 2400 }]);
  });

  test("chiffre d'affaires oui, caisse non : le payé d'avance n'est dans aucune boîte", () => {
    const state = rouxArrives();
    expect(computeStats(state, SOIREE).totalRevenueCents).toBe(7200);
    const cashup = computeCashup(state, SOIREE);
    expect(cashup.totalCents).toBe(2400);
    expect(cashup.rows.map((r) => r.registerLabel)).toEqual(["Caisse 2"]);
  });
});

describe("arrivées en plusieurs fois", () => {
  /* Martin (4 adultes, 2 enfants, 1 étudiant) : 2 adultes d'abord, puis un
     adulte et un enfant qui paient leur part sur une autre caisse. */
  test("chaque vague compte ses présents, le reste est encore attendu", () => {
    const state = replay(
      ...setup(),
      arrive(MARTIN, { [A]: 2 }),
      arrive(EXTRA, { [A]: 1, [E]: 1 }, { supplementOf: MARTIN, paymentMethod: "card", registerLabel: "Caisse 2" }),
    );
    const row = reservationRows(state, SOIREE).find((r) => r.id === MARTIN)!;
    expect(arrivedHeads(row)).toEqual({ [A]: 3, [E]: 1 });
    expect(reservationRows(state, SOIREE).some((r) => r.walkIn)).toBe(false);
    const d = bookingDashboard(state, SOIREE);
    expect(d.arrived).toBe(4);
    expect(d.byTariff[A]).toEqual({ expected: 6, arrived: 3 });
    // Dupont (3) pas arrivé + Martin : 7 prévus − 4 arrivés.
    expect(d.remaining).toBe(6);
    expect(d.totalCents).toBe(3 * 2400 + 900);
  });

  test("groupe complet : les absents ne sont plus attendus, rouvrir les rattend", () => {
    const events = [...setup(), arrive(MARTIN, { [A]: 2 })];
    const closed = replay(...events, reservationComplete(MARTIN, true));
    expect(reservationRows(closed, SOIREE).find((r) => r.id === MARTIN)?.complete).toBe(true);
    // Reste Dupont seul (3) ; Martin compte 2 arrivés sur 7 prévus.
    expect(bookingDashboard(closed, SOIREE).remaining).toBe(3);
    expect(bookingDashboard(closed, SOIREE).arrived).toBe(2);
    // Last-write-wins : un « complet » plus ancien arrivé après coup ne referme pas.
    const reopened = replay(
      ...events,
      reservationComplete(MARTIN, false, at("22:00")),
      reservationComplete(MARTIN, true, at("21:45")),
    );
    expect(bookingDashboard(reopened, SOIREE).remaining).toBe(8);
  });
});

describe("recherche", () => {
  const rows = [
    { name: "Dupont Jean", phone: "06 12 34 56 78" },
    { name: "Lefèvre Marie", table: "12-13" },
    { name: "Martin", table: "120" },
    { name: "Martineau" },
  ];
  const names = (q: string) => searchReservations(rows, q).map((r) => r.name);

  test("tolère accents, casse et fautes", () => {
    expect(names("dupond")).toEqual(["Dupont Jean"]);
    expect(names("LEFEVRE")).toEqual(["Lefèvre Marie"]);
    expect(names("lefebvre")).toEqual(["Lefèvre Marie"]);
    expect(names("marie lef")).toEqual(["Lefèvre Marie"]);
  });

  test("le préfixe exact passe devant, rien de farfelu", () => {
    expect(names("martin")).toEqual(["Martin", "Martineau"]);
    expect(names("zz")).toEqual([]);
    expect(names("")).toHaveLength(4);
  });

  test("par numéro de téléphone", () => {
    expect(names("5678")).toEqual(["Dupont Jean"]);
  });

  test("par numéro de table, mot entier", () => {
    expect(names("12")).toEqual(["Lefèvre Marie"]);
    expect(names("120")).toEqual(["Martin"]);
  });
});

describe("tri de l'accueil", () => {
  const at = (createdAt: string) => ({ createdAt });
  const rows = [
    { name: "Roux", table: "10", order: null },
    { name: "Abel", order: at("2026-10-14T19:05:00.000Z") },
    { name: "Martin", table: "2", order: at("2026-10-14T19:30:00.000Z") },
    { name: "Dupont", table: "Terrasse", order: null },
  ];
  const names = (sort: Parameters<typeof sortReservationRows>[1]) => sortReservationRows(rows, sort).map((r) => r.name);

  test("par nom", () => {
    expect(names("nom")).toEqual(["Abel", "Dupont", "Martin", "Roux"]);
  });
  test("par table : ordre naturel, sans table à la fin", () => {
    expect(names("table")).toEqual(["Martin", "Roux", "Dupont", "Abel"]);
  });
  test("par arrivée : les plus récentes d'abord, puis les attendus par nom", () => {
    expect(names("arrivee")).toEqual(["Martin", "Abel", "Dupont", "Roux"]);
  });
});

describe("annulation sans PIN", () => {
  const order = { reservationId: DUPONT, deviceId: "t1", createdAt: "2026-10-14T19:30:00.000Z" };
  test("même tablette, moins de 10 min", () => {
    expect(canSelfVoid(order, "t1", "2026-10-14T19:39:59.000Z")).toBe(true);
  });
  test("refusée : autre tablette, trop tard, ou vente ordinaire", () => {
    expect(canSelfVoid(order, "t2", "2026-10-14T19:31:00.000Z")).toBe(false);
    expect(canSelfVoid(order, "t1", "2026-10-14T19:40:01.000Z")).toBe(false);
    expect(canSelfVoid({ ...order, reservationId: null }, "t1", "2026-10-14T19:31:00.000Z")).toBe(false);
  });
});

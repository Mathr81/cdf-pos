import { beforeEach, describe, expect, test } from "vitest";
import {
  BOOKING_ADULT_ID,
  BOOKING_CHILD_ID,
  bookingDashboard,
  bookingItems,
  canSelfVoid,
  isBookingSoiree,
  reservationRows,
  searchReservations,
} from "./reservations.js";
import { computeCashup } from "./stats.js";
import {
  activate,
  onCarte,
  product,
  replay,
  reservation,
  reservationDelete,
  resetIds,
  sale,
  soiree,
  at,
  SOIREE,
  voidOrder,
} from "./test-utils/fixtures.js";

beforeEach(resetIds);

const DUPONT = "00000000-0000-4000-9000-000000000001";
const MARTIN = "00000000-0000-4000-9000-000000000002";
const WALKIN = "00000000-0000-4000-9000-000000000003";
const ORDER = "00000000-0000-4000-9000-0000000000a1";

function setup() {
  return [
    soiree(),
    activate(),
    product(BOOKING_ADULT_ID, { priceCents: 0, stockUnlimited: true }),
    product(BOOKING_CHILD_ID, { priceCents: 0, stockUnlimited: true }),
    onCarte(BOOKING_ADULT_ID, { onCarte: false, stockUnlimited: true, priceOverrideCents: 2400 }),
    onCarte(BOOKING_CHILD_ID, { onCarte: false, stockUnlimited: true, priceOverrideCents: 900 }),
    reservation(DUPONT, "Dupont", 2, 1, { phone: "06 12 34 56 78" }),
    reservation(MARTIN, "Martin", 4, 2),
  ];
}

function checkin(reservationId: string, adults: number, children: number, over: Parameters<typeof sale>[0] extends infer O ? Partial<O> : never = {}) {
  const items = [
    { productId: BOOKING_ADULT_ID, qty: adults, unitPriceCents: 2400 },
    { productId: BOOKING_CHILD_ID, qty: children, unitPriceCents: 900 },
  ].filter((it) => it.qty > 0);
  return sale({ items, reservationId, ...over });
}

describe("soirée sur réservation", () => {
  test("détectée par la config carte, tarifs propres à la soirée", () => {
    const state = replay(...setup());
    expect(isBookingSoiree(state, SOIREE)).toBe(true);
    expect(bookingItems(state, SOIREE, 2, 0)).toEqual([
      { productId: BOOKING_ADULT_ID, qty: 2, unitPriceCents: 2400 },
    ]);
  });

  test("tableau de bord : attendus, arrivés, restants, par mode et par caisse", () => {
    const state = replay(
      ...setup(),
      // Dupont vient à 3 au lieu de 2+1 : ajusté à l'encaissement.
      checkin(DUPONT, 3, 0, { paymentMethod: "card", registerLabel: "Caisse 2" }),
      checkin(WALKIN, 1, 1, { guestName: "Famille Roux" }),
    );
    const d = bookingDashboard(state, SOIREE);
    expect(d.expected).toBe(9);
    expect(d.arrived).toBe(5);
    expect(d.arrivedWalkIn).toBe(2);
    expect(d.remaining).toBe(6);
    expect(d.reservationsArrived).toBe(1);
    expect(d.totalCents).toBe(3 * 2400 + 2400 + 900);
    expect(d.byPaymentMethod).toEqual(
      expect.arrayContaining([
        { method: "card", orders: 1, revenueCents: 7200 },
        { method: "cash", orders: 1, revenueCents: 3300 },
      ]),
    );
    expect(d.byRegister.map((r) => r.registerLabel)).toEqual(["Caisse 1", "Caisse 2"]);
    expect(reservationRows(state, SOIREE).find((r) => r.walkIn)?.name).toBe("Famille Roux");
  });

  test("un encaissement annulé remet la réservation en attente", () => {
    const state = replay(...setup(), checkin(DUPONT, 2, 1, { orderId: ORDER }), voidOrder(ORDER));
    const d = bookingDashboard(state, SOIREE);
    expect(d.arrived).toBe(0);
    expect(d.remaining).toBe(9);
    expect(reservationRows(state, SOIREE).find((r) => r.id === DUPONT)?.order).toBeNull();
  });

  test("l'argent des réservations entre dans le comptage de caisse", () => {
    const state = replay(...setup(), checkin(DUPONT, 2, 1));
    const row = computeCashup(state, SOIREE).rows.find((r) => r.registerLabel === "Caisse 1");
    expect(row?.cashCents).toBe(5700);
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
    expect(state.reservations[MARTIN].adults).toBe(1);
    expect(state.reservations[DUPONT]).toBeUndefined();
  });
});

describe("recherche", () => {
  const rows = [
    { name: "Dupont Jean", phone: "06 12 34 56 78" },
    { name: "Lefèvre Marie" },
    { name: "Martin" },
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

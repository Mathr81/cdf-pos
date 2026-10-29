import {
  BOOKING_ADULT_ID,
  BOOKING_CHILD_ID,
  type ReservationUpsertPayload,
} from "@cdf/shared";
import type {
  PaymentMethod,
  PresetItem,
  ProductUpsertPayload,
  SaleItem,
  StationUpsertPayload,
  StockReason,
} from "@cdf/shared";
import { getDeviceId, newId, nextClientSeq } from "./device.js";
import { dismissConflict, dispatch, dispatchMany } from "./sync.js";
import type { ConflictRow } from "./db.js";
import { projection } from "./store.js";

/** Champs communs à toute enveloppe d'événement local. */
function meta() {
  return {
    id: newId(),
    deviceId: getDeviceId(),
    clientSeq: nextClientSeq(),
    createdAt: new Date().toISOString(),
  };
}

/** Soirée active courante, ou lève une erreur si aucune (les écrans gardent-fous). */
function activeSoireeIdOrThrow(): string {
  const id = projection.activeSoireeId;
  if (!id) throw new Error("Aucune soirée active");
  return id;
}

// ─── Ventes ──────────────────────────────────────────────────

export function emitSale(input: {
  orderId?: string;
  soireeId?: string;
  registerLabel: string;
  cashierName?: string;
  paymentMethod: PaymentMethod;
  items: SaleItem[];
  totalCents: number;
  cashReceivedCents?: number;
  reservationId?: string;
  guestName?: string;
}) {
  return dispatch({
    ...meta(),
    type: "sale",
    payload: {
      orderId: input.orderId ?? newId(),
      soireeId: input.soireeId ?? activeSoireeIdOrThrow(),
      registerLabel: input.registerLabel,
      cashierName: input.cashierName,
      paymentMethod: input.paymentMethod,
      items: input.items,
      totalCents: input.totalCents,
      cashReceivedCents: input.cashReceivedCents,
      reservationId: input.reservationId,
      guestName: input.guestName,
    },
  });
}

export function voidOrder(orderId: string, reason?: string) {
  return dispatch({ ...meta(), type: "order_void", payload: { orderId, reason } });
}

export function amendOrder(input: {
  orderId: string;
  items: SaleItem[];
  totalCents: number;
  paymentMethod: PaymentMethod;
  cashReceivedCents?: number;
  reason?: string;
}) {
  return dispatch({ ...meta(), type: "order_amend", payload: input });
}

// ─── Stock & cuisine ─────────────────────────────────────────

export function adjustStock(
  productId: string,
  delta: number,
  reason: StockReason,
  note?: string,
  soireeId?: string,
) {
  return dispatch({
    ...meta(),
    type: "stock_adjust",
    payload: { soireeId: soireeId ?? activeSoireeIdOrThrow(), productId, delta, reason, note },
  });
}

// ─── Caisse (fond et comptage) ───────────────────────────────

/** Déclare le fond de monnaie déposé dans un poste avant le service. */
export function openCash(registerLabel: string, floatCents: number, soireeId?: string) {
  return dispatch({
    ...meta(),
    type: "cash_open",
    payload: { soireeId: soireeId ?? activeSoireeIdOrThrow(), registerLabel, floatCents },
  });
}

/** Enregistre le comptage réel de la boîte. Un recomptage remplace le précédent. */
export function countCash(
  registerLabel: string,
  countedCents: number,
  note?: string,
  soireeId?: string,
) {
  return dispatch({
    ...meta(),
    type: "cash_count",
    payload: { soireeId: soireeId ?? activeSoireeIdOrThrow(), registerLabel, countedCents, note },
  });
}

export function markPrepared(productId: string, stationId: string, qty: number, soireeId?: string) {
  return dispatch({
    ...meta(),
    type: "prepared",
    payload: { soireeId: soireeId ?? activeSoireeIdOrThrow(), productId, stationId, qty },
  });
}

// ─── Catalogue ───────────────────────────────────────────────

export function upsertProduct(payload: ProductUpsertPayload) {
  return dispatch({ ...meta(), type: "product_upsert", payload });
}

export function deleteProduct(id: string) {
  return dispatch({ ...meta(), type: "product_delete", payload: { id } });
}

export function upsertStation(payload: StationUpsertPayload) {
  return dispatch({ ...meta(), type: "station_upsert", payload });
}

export function deleteStation(id: string) {
  return dispatch({ ...meta(), type: "station_delete", payload: { id } });
}

// ─── Soirées ─────────────────────────────────────────────────

export function upsertSoiree(payload: {
  id: string;
  name: string;
  date: string;
  training?: boolean;
}) {
  // `training` est requis en sortie du schéma (zod `.default()`) : on le
  // matérialise ici plutôt que de laisser l'appelant s'en soucier.
  return dispatch({
    ...meta(),
    type: "soiree_upsert",
    payload: { ...payload, training: payload.training ?? false },
  });
}

export function activateSoiree(soireeId: string) {
  return dispatch({ ...meta(), type: "soiree_activate", payload: { soireeId } });
}

export function closeSoiree(soireeId: string) {
  return dispatch({ ...meta(), type: "soiree_close", payload: { soireeId } });
}

export function deleteSoiree(soireeId: string) {
  return dispatch({ ...meta(), type: "soiree_delete", payload: { soireeId } });
}

export function setSoireeProduct(payload: {
  soireeId: string;
  productId: string;
  onCarte: boolean;
  stockInitial: number;
  stockUnlimited: boolean;
  priceOverrideCents: number | null;
}) {
  return dispatch({ ...meta(), type: "soiree_product_set", payload });
}

// ─── Presets (modèles de carte) ──────────────────────────────

export function upsertPreset(payload: { id: string; name: string; items: PresetItem[] }) {
  return dispatch({ ...meta(), type: "preset_upsert", payload });
}

export function deletePreset(id: string) {
  return dispatch({ ...meta(), type: "preset_delete", payload: { id } });
}

/** Ordre des onglets de catégories en caisse. */
export function setCategoryOrder(categories: string[]) {
  return dispatch({ ...meta(), type: "category_order", payload: { categories } });
}

// ─── Réservations ────────────────────────────────────────────

/** Crée ou modifie des réservations, en un seul envoi (import CSV). */
export function upsertReservations(payloads: ReservationUpsertPayload[]) {
  return dispatchMany(payloads.map((payload) => ({ ...meta(), type: "reservation_upsert" as const, payload })));
}

export function deleteReservation(id: string) {
  return dispatch({ ...meta(), type: "reservation_delete", payload: { id } });
}

/**
 * Rend une soirée « sur réservation » et fixe ses tarifs : les deux produits
 * de réservation sont créés au besoin, puis configurés hors grille de caisse
 * avec le prix propre à la soirée.
 */
export async function setBookingPrices(soireeId: string, adultCents: number, childCents: number) {
  const defs = [
    { id: BOOKING_ADULT_ID, name: "Repas adulte", cents: adultCents },
    { id: BOOKING_CHILD_ID, name: "Repas enfant", cents: childCents },
  ];
  for (const d of defs) {
    if (!projection.products[d.id]?.active) {
      await upsertProduct({
        id: d.id,
        name: d.name,
        priceCents: d.cents,
        category: "Réservation",
        stationId: null,
        stockInitial: 0,
        stockUnlimited: true,
        components: [],
        active: true,
        sortOrder: 999,
        emoji: "fork-knife",
        color: "#f59e0b",
      });
    }
    await setSoireeProduct({
      soireeId,
      productId: d.id,
      onCarte: false,
      stockInitial: 0,
      stockUnlimited: true,
      priceOverrideCents: d.cents,
    });
  }
}

/**
 * Tranche un conflit d'encaissement. `keepMoney` : la caisse a bien reçu
 * l'argent (c'étaient d'autres personnes, homonymes par exemple) → la vente
 * est ré-émise en sur-place pour que l'argent reste tracé. Sinon (rien reçu
 * ou remboursé), elle est abandonnée.
 */
export async function resolveConflict(row: ConflictRow, keepMoney: boolean) {
  if (keepMoney) {
    const p = row.event.payload;
    await emitSale({
      soireeId: p.soireeId,
      registerLabel: p.registerLabel,
      cashierName: p.cashierName,
      paymentMethod: p.paymentMethod,
      items: p.items,
      totalCents: p.totalCents,
      cashReceivedCents: p.cashReceivedCents,
      reservationId: newId(),
      guestName: p.guestName ?? projection.reservations[p.reservationId ?? ""]?.name,
    });
  }
  await dismissConflict(row.id);
}

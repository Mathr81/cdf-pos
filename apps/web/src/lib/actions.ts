import type { ReservationUpsertPayload } from "@cdf/shared";
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
  supplementOf?: string;
  heads?: Record<string, number>;
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
      supplementOf: input.supplementOf,
      heads: input.heads,
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
export function upsertReservations(payloads: Omit<ReservationUpsertPayload, "adults" | "children">[]) {
  return dispatchMany(
    payloads.map((p) => ({
      ...meta(),
      type: "reservation_upsert" as const,
      // adults / children : champs de l'ancien format, remplacés par `counts`.
      payload: { ...p, adults: 0, children: 0 },
    })),
  );
}

/** Groupe arrivé en partie : on n'attend plus les absents (ou on les rattend). */
export function setReservationComplete(id: string, complete: boolean) {
  return dispatch({ ...meta(), type: "reservation_complete", payload: { id, complete } });
}

export function deleteReservations(ids: string[]) {
  return dispatchMany(ids.map((id) => ({ ...meta(), type: "reservation_delete" as const, payload: { id } })));
}

/**
 * Fixe les tarifs d'une soirée sur réservation. Chaque tarif est un produit
 * (catégorie « Réservation », hors grille de caisse) : il est créé, ou
 * renommé, au besoin. `productId` absent = nouveau tarif.
 */
export async function setBookingTariffs(
  soireeId: string,
  tariffs: { productId?: string; name: string; priceCents: number }[],
) {
  const saved: { productId: string; priceCents: number }[] = [];
  for (const [i, t] of tariffs.entries()) {
    const productId = t.productId ?? `resa-${newId()}`;
    const existing = projection.products[productId];
    if (!existing?.active || existing.name !== t.name) {
      await upsertProduct({
        id: productId,
        name: t.name,
        priceCents: t.priceCents,
        category: "Réservation",
        stationId: null,
        stockInitial: 0,
        stockUnlimited: true,
        components: [],
        active: true,
        sortOrder: 900 + i,
        emoji: existing?.emoji ?? "fork-knife",
        color: existing?.color ?? "#f59e0b",
      });
    }
    saved.push({ productId, priceCents: t.priceCents });
  }
  await dispatch({ ...meta(), type: "booking_tariffs_set", payload: { soireeId, tariffs: saved } });
}

/**
 * Tranche un conflit d'encaissement.
 * - `groupe` : d'autres membres du même groupe, encaissés en même temps
 *   ailleurs → la vente devient une vague de plus du groupe.
 * - `sur-place` : l'argent est reçu mais c'étaient d'autres personnes
 *   (homonymes) → ré-émise en sur-place pour que l'argent reste tracé.
 * - `rien` : rien reçu ou remboursé → abandonnée.
 */
export async function resolveConflict(row: ConflictRow, outcome: "groupe" | "sur-place" | "rien") {
  if (outcome !== "rien") {
    const p = row.event.payload;
    const group = outcome === "groupe" ? p.reservationId : undefined;
    await emitSale({
      soireeId: p.soireeId,
      registerLabel: p.registerLabel,
      cashierName: p.cashierName,
      paymentMethod: p.paymentMethod,
      items: p.items,
      totalCents: p.totalCents,
      cashReceivedCents: p.cashReceivedCents,
      reservationId: newId(),
      supplementOf: group,
      heads: group ? p.heads : undefined,
      guestName: group ? undefined : (p.guestName ?? projection.reservations[p.reservationId ?? ""]?.name),
    });
  }
  await dismissConflict(row.id);
}

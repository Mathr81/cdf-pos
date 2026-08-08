import type {
  PaymentMethod,
  PresetItem,
  ProductUpsertPayload,
  SaleItem,
  StationUpsertPayload,
  StockReason,
} from "@cdf/shared";
import { getDeviceId, newId, nextClientSeq } from "./device.js";
import { dispatch } from "./sync.js";
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

export function upsertSoiree(payload: { id: string; name: string; date: string }) {
  return dispatch({ ...meta(), type: "soiree_upsert", payload });
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

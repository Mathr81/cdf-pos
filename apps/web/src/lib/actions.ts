import type {
  PaymentMethod,
  ProductUpsertPayload,
  SaleItem,
  StationUpsertPayload,
  StockReason,
} from "@cdf/shared";
import { getDeviceId, newId, nextClientSeq } from "./device.js";
import { dispatch } from "./sync.js";

/** Champs communs à toute enveloppe d'événement local. */
function meta() {
  return {
    id: newId(),
    deviceId: getDeviceId(),
    clientSeq: nextClientSeq(),
    createdAt: new Date().toISOString(),
  };
}

export function emitSale(input: {
  orderId?: string;
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

export function adjustStock(productId: string, delta: number, reason: StockReason, note?: string) {
  return dispatch({ ...meta(), type: "stock_adjust", payload: { productId, delta, reason, note } });
}

export function markPrepared(productId: string, stationId: string, qty: number) {
  return dispatch({ ...meta(), type: "prepared", payload: { productId, stationId, qty } });
}

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

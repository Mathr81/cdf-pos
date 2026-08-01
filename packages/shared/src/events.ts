import { z } from "zod";

/**
 * ─────────────────────────────────────────────────────────────
 *  Journal d'événements (event-sourcing léger)
 * ─────────────────────────────────────────────────────────────
 *  Chaque action de l'app (vente, ajustement de stock, préparation
 *  cuisine, config produit…) est un événement immuable avec un `id`
 *  UUID généré côté client. Le journal est :
 *    1. la source de vérité pour la synchro multi-appareils (idempotence par id)
 *    2. la piste d'audit complète (base des stats)
 *    3. ce qui est mirroré dans Google Sheets et sauvegardé
 *
 *  Le serveur PROJETTE ces événements dans des tables « vues »
 *  (Order, OrderItem, StockMovement, Prepared) pour lecture rapide.
 */

export const PAYMENT_METHODS = ["cash", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const STOCK_REASONS = ["restock", "spoilage", "correction"] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

// ─── Payloads ────────────────────────────────────────────────

/** Ligne de commande (prix figé au moment de la vente). */
export const SaleItemSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
});
export type SaleItem = z.infer<typeof SaleItemSchema>;

/** Vente finalisée (encaissement). */
export const SalePayloadSchema = z.object({
  orderId: z.string().uuid(),
  registerLabel: z.string().min(1),
  cashierName: z.string().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  items: z.array(SaleItemSchema).min(1),
  totalCents: z.number().int().nonnegative(),
  /** Montant remis par le client (cash) pour tracer le rendu monnaie. */
  cashReceivedCents: z.number().int().nonnegative().optional(),
});
export type SalePayload = z.infer<typeof SalePayloadSchema>;

/** Annulation d'une commande déjà encaissée. */
export const OrderVoidPayloadSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().optional(),
});
export type OrderVoidPayload = z.infer<typeof OrderVoidPayloadSchema>;

/** Ajustement manuel de stock (réappro, perte, correction). */
export const StockAdjustPayloadSchema = z.object({
  productId: z.string().min(1),
  /** Variation appliquée au stock (positif = ajout, négatif = retrait). */
  delta: z.number().int(),
  reason: z.enum(STOCK_REASONS),
  note: z.string().optional(),
});
export type StockAdjustPayload = z.infer<typeof StockAdjustPayloadSchema>;

/** Quantité marquée « préparée » en cuisine (delta, peut être négatif pour corriger). */
export const PreparedPayloadSchema = z.object({
  productId: z.string().min(1),
  stationId: z.string().min(1),
  qty: z.number().int(),
});
export type PreparedPayload = z.infer<typeof PreparedPayloadSchema>;

/**
 * Composant d'un produit : un plat « Saucisse Frites » contient 1 « Frites ».
 * Sert à la cuisine (combien de barquettes préparer au total) et au stock.
 * Un seul niveau est développé (un composant n'est pas lui-même décomposé).
 */
export const ProductComponentSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().positive(),
});
export type ProductComponent = z.infer<typeof ProductComponentSchema>;

/** Création / mise à jour d'un produit (admin, last-write-wins). */
export const ProductUpsertPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  category: z.string().default("Divers"),
  stationId: z.string().nullable().optional(),
  stockInitial: z.number().int().nonnegative().default(0),
  /** true = produit sans stock à suivre (frites au sac, sirop, glaçons…). */
  stockUnlimited: z.boolean().default(false),
  components: z.array(ProductComponentSchema).default([]),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  emoji: z.string().default("🍔"),
  color: z.string().default("#f59e0b"),
});
export type ProductUpsertPayload = z.infer<typeof ProductUpsertPayloadSchema>;

export const ProductDeletePayloadSchema = z.object({
  id: z.string().min(1),
});
export type ProductDeletePayload = z.infer<typeof ProductDeletePayloadSchema>;

/** Création / mise à jour d'une station cuisine. */
export const StationUpsertPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().int().default(0),
});
export type StationUpsertPayload = z.infer<typeof StationUpsertPayloadSchema>;

export const StationDeletePayloadSchema = z.object({
  id: z.string().min(1),
});
export type StationDeletePayload = z.infer<typeof StationDeletePayloadSchema>;

// ─── Enveloppe d'événement (discriminated union sur `type`) ──

const baseEnvelope = {
  /** UUID généré côté client — garantit l'idempotence à la synchro. */
  id: z.string().uuid(),
  /** Appareil émetteur (identifiant persistant local). */
  deviceId: z.string().min(1),
  /** Séquence locale croissante par appareil (ordre d'émission). */
  clientSeq: z.number().int().nonnegative(),
  /** Horodatage d'émission côté client (ISO 8601). */
  createdAt: z.string().datetime(),
};

export const EventSchema = z.discriminatedUnion("type", [
  z.object({ ...baseEnvelope, type: z.literal("sale"), payload: SalePayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("order_void"), payload: OrderVoidPayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("stock_adjust"), payload: StockAdjustPayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("prepared"), payload: PreparedPayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("product_upsert"), payload: ProductUpsertPayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("product_delete"), payload: ProductDeletePayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("station_upsert"), payload: StationUpsertPayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("station_delete"), payload: StationDeletePayloadSchema }),
]);

export type AppEvent = z.infer<typeof EventSchema>;
export type EventType = AppEvent["type"];

/** Événement enrichi par le serveur (curseur monotone + horodatage de réception). */
export type StoredEvent = AppEvent & {
  /** Séquence serveur monotone — sert de curseur de synchro fiable. */
  seq: number;
  serverReceivedAt: string;
};

/** Tableau d'événements (batch de synchro montante). */
export const EventBatchSchema = z.array(EventSchema).max(500);

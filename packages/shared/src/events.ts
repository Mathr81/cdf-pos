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

/**
 * Moyens de paiement.
 *
 * `offert` couvre les repas donnés (bénévoles, invités). La commande garde
 * les VRAIS prix : c'est ce qui permet de rapporter « 47 € offerts ». En
 * contrepartie, ce mode doit être exclu de toute agrégation d'argent — voir
 * `paidOrders()` dans stats.ts, qui est le point de passage unique.
 *
 * ⚠️ Ajouter une valeur est rétro-compatible (les événements déjà en base
 * restent valides), en retirer une ne l'est pas : le rejeu du journal
 * échouerait sur les ventes qui l'utilisaient.
 */
export const PAYMENT_METHODS = ["cash", "card", "offert"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Libellé affichable d'un moyen de paiement.
 *
 * Source unique : le ternaire `=== "cash" ? "Espèces" : "Carte"` était
 * dupliqué dans le miroir Sheets, l'export CSV, la caisse, le journal et les
 * stats. Chacun aurait silencieusement étiqueté « offert » en « Carte ».
 *
 * Tolère une chaîne inconnue et la renvoie telle quelle : le journal étant
 * immuable, une version future pourrait introduire un mode que ce code ne
 * connaît pas encore.
 */
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Espèces",
  card: "Carte",
  offert: "Offert",
};

export function paymentLabel(method: PaymentMethod | string): string {
  return PAYMENT_LABELS[method as PaymentMethod] ?? method;
}

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

/** Vente finalisée (encaissement). Rattachée à une soirée. */
export const SalePayloadSchema = z.object({
  orderId: z.string().uuid(),
  soireeId: z.string().min(1),
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

/** Modification d'une commande déjà encaissée (correction tracée). */
export const OrderAmendPayloadSchema = z.object({
  orderId: z.string().uuid(),
  items: z.array(SaleItemSchema).min(1),
  totalCents: z.number().int().nonnegative(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  cashReceivedCents: z.number().int().nonnegative().optional(),
  reason: z.string().optional(),
});
export type OrderAmendPayload = z.infer<typeof OrderAmendPayloadSchema>;

/**
 * Ouverture d'une caisse : fond de monnaie déposé dans la boîte avant le
 * service. Sans lui, l'espèce comptée en fin de soirée n'est comparable à
 * rien.
 */
export const CashOpenPayloadSchema = z.object({
  soireeId: z.string().min(1),
  /** Poste concerné, tel qu'il apparaît dans les ventes (« Caisse 1 »). */
  registerLabel: z.string().min(1),
  floatCents: z.number().int().nonnegative(),
});
export type CashOpenPayload = z.infer<typeof CashOpenPayloadSchema>;

/**
 * Comptage réel de la boîte en fin de service. L'écart avec le théorique
 * (fond + espèces encaissées) est ce qui révèle une erreur de rendu monnaie
 * le soir même, plutôt qu'au dépôt en banque.
 *
 * Rejouable : un recomptage plus récent remplace le précédent
 * (last-write-wins), on ne cumule pas.
 */
export const CashCountPayloadSchema = z.object({
  soireeId: z.string().min(1),
  registerLabel: z.string().min(1),
  countedCents: z.number().int().nonnegative(),
  note: z.string().optional(),
});
export type CashCountPayload = z.infer<typeof CashCountPayloadSchema>;

/** Ajustement manuel de stock (réappro, perte, correction), pour une soirée. */
export const StockAdjustPayloadSchema = z.object({
  soireeId: z.string().min(1),
  productId: z.string().min(1),
  /** Variation appliquée au stock (positif = ajout, négatif = retrait). */
  delta: z.number().int(),
  reason: z.enum(STOCK_REASONS),
  note: z.string().optional(),
});
export type StockAdjustPayload = z.infer<typeof StockAdjustPayloadSchema>;

/** Quantité marquée « préparée » en cuisine (delta), pour une soirée. */
export const PreparedPayloadSchema = z.object({
  soireeId: z.string().min(1),
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
  /**
   * Image personnalisée : nom de fichier seul ("<hash32>.webp"), jamais une URL,
   * jamais un binaire. Le fichier est uploadé à part (POST /api/admin/media) et
   * servi en HTTP ; seule cette référence circule dans le journal.
   *
   * ⚠️ Volontairement `.optional()` SANS `.default()`. `product_upsert` est en
   * last-write-wins avec charge utile complète : un poste dont la PWA n'est pas
   * encore à jour n'enverra pas ce champ, et un `.default(null)` effacerait
   * alors l'image sans que personne comprenne pourquoi. La distinction est donc
   * porteuse de sens et doit être préservée jusqu'à la projection :
   *   - `undefined` → champ absent, ne pas toucher à l'image existante
   *   - `null`      → l'admin a explicitement retiré l'image
   */
  imageKey: z.string().max(64).nullable().optional(),
  /**
   * Part du cadre occupée par le dessin, en pourcentage (40 à 100). Réglage
   * d'AFFICHAGE : il n'est pas cuit dans le fichier, ce qui permet de le
   * corriger après coup sans redemander le fichier source.
   *
   * ⚠️ Même précaution que `imageKey`, et pour la même raison : `.optional()`
   * SANS `.default()`. `undefined` = champ absent (poste dont la PWA n'est pas
   * à jour) → conserver la valeur existante. `null` = retour au défaut.
   */
  imageZoom: z.number().int().min(40).max(100).nullable().optional(),
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

// ─── Soirées (événements/sessions de vente) ──────────────────

/** Création / renommage d'une soirée. */
export const SoireeUpsertPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Date de la soirée (ISO, ex "2026-08-15"). */
  date: z.string().min(1),
  /**
   * Soirée d'entraînement : sert à former les bénévoles sans polluer les
   * chiffres. Exclue des totaux « toutes soirées » et des comparaisons.
   *
   * `.default(false)` et non `.optional()` : les soirées déjà enregistrées
   * sont de vraies soirées, et le défaut doit le dire au rejeu du journal.
   */
  training: z.boolean().default(false),
});
export type SoireeUpsertPayload = z.infer<typeof SoireeUpsertPayloadSchema>;

/** Définit la soirée active (celle où encaissent les caisses). */
export const SoireeActivatePayloadSchema = z.object({
  soireeId: z.string().min(1),
});
export type SoireeActivatePayload = z.infer<typeof SoireeActivatePayloadSchema>;

/** Clôture d'une soirée (archivée, plus modifiable au quotidien). */
export const SoireeClosePayloadSchema = z.object({
  soireeId: z.string().min(1),
});
export type SoireeClosePayload = z.infer<typeof SoireeClosePayloadSchema>;

export const SoireeDeletePayloadSchema = z.object({
  soireeId: z.string().min(1),
});
export type SoireeDeletePayload = z.infer<typeof SoireeDeletePayloadSchema>;

/**
 * Configure un produit dans la carte d'une soirée : présence sur la carte,
 * stock initial et prix propres à la soirée (sinon prix catalogue).
 */
export const SoireeProductSetPayloadSchema = z.object({
  soireeId: z.string().min(1),
  productId: z.string().min(1),
  onCarte: z.boolean(),
  stockInitial: z.number().int().nonnegative().default(0),
  stockUnlimited: z.boolean().default(false),
  /** Prix propre à la soirée en centimes ; null = prix catalogue. */
  priceOverrideCents: z.number().int().nonnegative().nullable().default(null),
});
export type SoireeProductSetPayload = z.infer<typeof SoireeProductSetPayloadSchema>;

// ─── Presets (modèles de carte réutilisables) ────────────────

export const PresetItemSchema = z.object({
  productId: z.string().min(1),
  stockInitial: z.number().int().nonnegative().default(0),
  stockUnlimited: z.boolean().default(false),
  priceOverrideCents: z.number().int().nonnegative().nullable().default(null),
});
export type PresetItem = z.infer<typeof PresetItemSchema>;

export const PresetUpsertPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  items: z.array(PresetItemSchema).default([]),
});
export type PresetUpsertPayload = z.infer<typeof PresetUpsertPayloadSchema>;

export const PresetDeletePayloadSchema = z.object({
  id: z.string().min(1),
});
export type PresetDeletePayload = z.infer<typeof PresetDeletePayloadSchema>;

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
  z.object({ ...baseEnvelope, type: z.literal("order_amend"), payload: OrderAmendPayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("stock_adjust"), payload: StockAdjustPayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("cash_open"), payload: CashOpenPayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("cash_count"), payload: CashCountPayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("prepared"), payload: PreparedPayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("product_upsert"), payload: ProductUpsertPayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("product_delete"), payload: ProductDeletePayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("station_upsert"), payload: StationUpsertPayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("station_delete"), payload: StationDeletePayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("soiree_upsert"), payload: SoireeUpsertPayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("soiree_activate"), payload: SoireeActivatePayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("soiree_close"), payload: SoireeClosePayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("soiree_delete"), payload: SoireeDeletePayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("soiree_product_set"), payload: SoireeProductSetPayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("preset_upsert"), payload: PresetUpsertPayloadSchema }),
  z.object({ ...baseEnvelope, type: z.literal("preset_delete"), payload: PresetDeletePayloadSchema }),
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

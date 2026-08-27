import type { ProjectionState, ClientOrder } from "./projection.js";

/** Réponse stats (partagée serveur ↔ client). `null` en soireeId = toutes soirées. */
export interface StatsResponse {
  totalRevenueCents: number;
  orderCount: number;
  itemCount: number;
  avgBasketCents: number;
  byPaymentMethod: { method: string; orders: number; revenueCents: number }[];
  byRegister: { registerLabel: string; orders: number; revenueCents: number }[];
  topProducts: { productId: string; name: string; qty: number; revenueCents: number }[];
  salesByHour: { hour: string; orders: number; revenueCents: number }[];
  /** Courbe d'évolution cumulée du CA (un point par commande). */
  revenueTimeline: { t: string; cumulativeCents: number; orders: number }[];
  voidCount: number;
  /**
   * Repas offerts (bénévoles, invités). Exclus de tout ce qui précède : ce
   * n'est pas du chiffre d'affaires. Chiffré quand même, parce que « ce que
   * les gratuités ont coûté » est une question que l'asso se pose.
   */
  giftedOrders: number;
  giftedItems: number;
  giftedValueCents: number;
}

/**
 * Commandes réellement ENCAISSÉES : ni annulées, ni offertes.
 *
 * Point de passage unique de tout ce qui parle d'argent — computeStats,
 * computeCashup et soireeSummaries en dépendent. Un repas offert a de vrais
 * prix dans la commande (pour pouvoir chiffrer les gratuités), donc il faut
 * l'exclure ICI et nulle part ailleurs, sinon il gonflerait le chiffre
 * d'affaires et créerait un faux manque à la clôture de caisse.
 */
/**
 * Une soirée d'entraînement est-elle à exclure de ce périmètre ?
 *
 * Seulement quand on agrège PLUSIEURS soirées : demander explicitement les
 * stats d'une session d'entraînement doit les donner, c'est tout l'intérêt
 * de l'exercice pour le bénévole.
 */
function excludedTraining(state: ProjectionState, soireeId: string | null, orderSoireeId: string) {
  return soireeId === null && (state.soirees[orderSoireeId]?.training ?? false);
}

function paidOrders(state: ProjectionState, soireeId: string | null): ClientOrder[] {
  return Object.values(state.orders).filter(
    (o) =>
      o.status === "paid" &&
      o.paymentMethod !== "offert" &&
      (soireeId === null || o.soireeId === soireeId) &&
      !excludedTraining(state, soireeId, o.soireeId),
  );
}

/** Commandes offertes, non annulées. */
function giftedOrders(state: ProjectionState, soireeId: string | null): ClientOrder[] {
  return Object.values(state.orders).filter(
    (o) =>
      o.status === "paid" &&
      o.paymentMethod === "offert" &&
      (soireeId === null || o.soireeId === soireeId),
  );
}

/**
 * Calcule les statistiques depuis la projection locale (live & offline).
 * `soireeId` filtre sur une soirée ; `null` = toutes soirées confondues.
 */
export function computeStats(state: ProjectionState, soireeId: string | null): StatsResponse {
  const paid = paidOrders(state, soireeId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const byMethod = new Map<string, { orders: number; revenueCents: number }>();
  const byRegister = new Map<string, { orders: number; revenueCents: number }>();
  const byHour = new Map<string, { orders: number; revenueCents: number }>();
  const qtyByProduct = new Map<string, number>();
  const revByProduct = new Map<string, number>();
  const revenueTimeline: { t: string; cumulativeCents: number; orders: number }[] = [];

  let totalRevenueCents = 0;
  let itemCount = 0;
  let cumulative = 0;
  let n = 0;

  for (const o of paid) {
    totalRevenueCents += o.totalCents;
    cumulative += o.totalCents;
    n++;
    revenueTimeline.push({ t: o.createdAt, cumulativeCents: cumulative, orders: n });

    const m = byMethod.get(o.paymentMethod) ?? { orders: 0, revenueCents: 0 };
    m.orders++;
    m.revenueCents += o.totalCents;
    byMethod.set(o.paymentMethod, m);

    const r = byRegister.get(o.registerLabel) ?? { orders: 0, revenueCents: 0 };
    r.orders++;
    r.revenueCents += o.totalCents;
    byRegister.set(o.registerLabel, r);

    const hourKey = `${String(new Date(o.createdAt).getHours()).padStart(2, "0")}h`;
    const h = byHour.get(hourKey) ?? { orders: 0, revenueCents: 0 };
    h.orders++;
    h.revenueCents += o.totalCents;
    byHour.set(hourKey, h);

    for (const it of o.items) {
      itemCount += it.qty;
      qtyByProduct.set(it.productId, (qtyByProduct.get(it.productId) ?? 0) + it.qty);
      revByProduct.set(it.productId, (revByProduct.get(it.productId) ?? 0) + it.qty * it.unitPriceCents);
    }
  }

  const topProducts = [...qtyByProduct.entries()]
    .map(([productId, qty]) => ({
      productId,
      name: state.products[productId]?.name ?? productId,
      qty,
      revenueCents: revByProduct.get(productId) ?? 0,
    }))
    .sort((a, b) => b.qty - a.qty);

  const voidCount = Object.values(state.orders).filter(
    (o) => o.status === "void" && (soireeId === null || o.soireeId === soireeId),
  ).length;

  const gifted = giftedOrders(state, soireeId);
  const giftedValueCents = gifted.reduce((a, o) => a + o.totalCents, 0);
  const giftedItems = gifted.reduce((a, o) => a + o.items.reduce((x, i) => x + i.qty, 0), 0);

  return {
    totalRevenueCents,
    orderCount: paid.length,
    itemCount,
    avgBasketCents: paid.length ? Math.round(totalRevenueCents / paid.length) : 0,
    byPaymentMethod: [...byMethod.entries()].map(([method, v]) => ({ method, ...v })),
    byRegister: [...byRegister.entries()].map(([registerLabel, v]) => ({ registerLabel, ...v })),
    topProducts,
    salesByHour: [...byHour.entries()].map(([hour, v]) => ({ hour, ...v })).sort((a, b) => a.hour.localeCompare(b.hour)),
    revenueTimeline,
    voidCount,
    giftedOrders: gifted.length,
    giftedItems,
    giftedValueCents,
  };
}

/** Résumé compact d'une soirée (pour la comparaison entre soirées). */
export interface SoireeSummary {
  soireeId: string;
  name: string;
  date: string;
  revenueCents: number;
  orders: number;
  items: number;
  avgBasketCents: number;
}

/**
 * Résumés des VRAIES soirées, triés par date.
 *
 * Les sessions d'entraînement en sont exclues : elles alimentent la
 * comparaison au service précédent, et « −80 % vs l'exercice de mardi »
 * n'aurait aucun sens.
 */
export function soireeSummaries(state: ProjectionState): SoireeSummary[] {
  return Object.values(state.soirees)
    .filter((s) => !s.training)
    .map((s) => {
      const paid = paidOrders(state, s.id);
      const revenueCents = paid.reduce((a, o) => a + o.totalCents, 0);
      const items = paid.reduce((a, o) => a + o.items.reduce((x, i) => x + i.qty, 0), 0);
      return {
        soireeId: s.id,
        name: s.name,
        date: s.date,
        revenueCents,
        orders: paid.length,
        items,
        avgBasketCents: paid.length ? Math.round(revenueCents / paid.length) : 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface SoireeComparison {
  current: SoireeSummary;
  /** Soirée précédente par la date, ou null si c'est la première. */
  previous: SoireeSummary | null;
  /**
   * Écart de chiffre d'affaires en pourcentage, arrondi à l'entier.
   * `null` s'il n'y a pas de précédente, ou si elle n'a rien vendu —
   * un pourcentage d'évolution depuis zéro n'a pas de sens.
   */
  revenueDeltaPct: number | null;
}

/**
 * Situe une soirée par rapport au service précédent : « +18 % vs 14 juin ».
 * Renvoie `null` si la soirée est inconnue.
 */
export function compareToPrevious(
  state: ProjectionState,
  soireeId: string,
): SoireeComparison | null {
  const summaries = soireeSummaries(state); // triées par date croissante
  const index = summaries.findIndex((s) => s.soireeId === soireeId);
  if (index === -1) return null;

  const current = summaries[index];
  const previous = index > 0 ? summaries[index - 1] : null;

  const revenueDeltaPct =
    previous && previous.revenueCents > 0
      ? Math.round(((current.revenueCents - previous.revenueCents) / previous.revenueCents) * 100)
      : null;

  return { current, previous, revenueDeltaPct };
}

/** Ligne de clôture de caisse (rapport Z) par poste de caisse. */
export interface CashupRow {
  registerLabel: string;
  orders: number;
  cashCents: number;
  cardCents: number;
  totalCents: number;
  /** Fond de monnaie déposé avant le service (0 si non déclaré). */
  floatCents: number;
  /** Espèces qui devraient se trouver dans la boîte : fond + encaissé. */
  expectedCashCents: number;
  /** Comptage réel, ou null tant que la boîte n'a pas été comptée. */
  countedCents: number | null;
  /**
   * Compté − attendu. Négatif = il manque, positif = excédent.
   * `null` sans comptage : zéro signifierait « ça tombe juste », ce qui
   * serait un mensonge.
   */
  varianceCents: number | null;
  countedNote?: string;
  countedAt: string | null;
}

export interface Cashup {
  rows: CashupRow[];
  totalCashCents: number;
  totalCardCents: number;
  totalCents: number;
  orders: number;
  totalFloatCents: number;
  /** Somme des écarts des postes DÉJÀ comptés. */
  totalVarianceCents: number;
  countedRegisters: number;
  totalRegisters: number;
}

/**
 * Clôture de caisse d'une soirée : espèces/carte par poste, plus le fond,
 * le comptage réel et l'écart.
 *
 * Un poste apparaît dès qu'il a vendu OU qu'un fond y a été déposé : un fond
 * placé dans une caisse restée inactive serait sinon invisible à la clôture,
 * et l'argent avec.
 */
export function computeCashup(state: ProjectionState, soireeId: string): Cashup {
  const byReg = new Map<string, CashupRow>();
  const sessions = state.cashSessions[soireeId] ?? {};

  const row = (registerLabel: string): CashupRow => {
    let r = byReg.get(registerLabel);
    if (!r) {
      const session = sessions[registerLabel];
      r = {
        registerLabel,
        orders: 0,
        cashCents: 0,
        cardCents: 0,
        totalCents: 0,
        floatCents: session?.floatCents ?? 0,
        expectedCashCents: 0,
        countedCents: session?.countedCents ?? null,
        varianceCents: null,
        countedNote: session?.countedNote,
        countedAt: session?.countedAt ?? null,
      };
      byReg.set(registerLabel, r);
    }
    return r;
  };

  // Les postes ayant une caisse ouverte existent même sans vente.
  for (const label of Object.keys(sessions)) row(label);

  let totalCashCents = 0;
  let totalCardCents = 0;
  let orders = 0;

  for (const o of paidOrders(state, soireeId)) {
    orders++;
    const r = row(o.registerLabel);
    r.orders++;
    r.totalCents += o.totalCents;
    if (o.paymentMethod === "cash") {
      r.cashCents += o.totalCents;
      totalCashCents += o.totalCents;
    } else {
      // La carte ne passe pas par la boîte : elle n'entre jamais dans
      // l'attendu, sous peine d'un écart négatif à chaque clôture.
      r.cardCents += o.totalCents;
      totalCardCents += o.totalCents;
    }
  }

  let totalFloatCents = 0;
  let totalVarianceCents = 0;
  let countedRegisters = 0;

  for (const r of byReg.values()) {
    r.expectedCashCents = r.floatCents + r.cashCents;
    totalFloatCents += r.floatCents;
    if (r.countedCents !== null) {
      r.varianceCents = r.countedCents - r.expectedCashCents;
      totalVarianceCents += r.varianceCents;
      countedRegisters++;
    }
  }

  return {
    rows: [...byReg.values()].sort((a, b) => a.registerLabel.localeCompare(b.registerLabel)),
    totalCashCents,
    totalCardCents,
    totalCents: totalCashCents + totalCardCents,
    orders,
    totalFloatCents,
    totalVarianceCents,
    countedRegisters,
    totalRegisters: byReg.size,
  };
}

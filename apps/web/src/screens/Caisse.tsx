import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  formatCents,
  soireeCarte,
  stockRemaining,
  type CarteEntry,
  type PaymentMethod,
  paymentLabel,
} from "@cdf/shared";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { ConfettiIcon } from "@phosphor-icons/react/dist/csr/Confetti";
import { ForkKnifeIcon } from "@phosphor-icons/react/dist/csr/ForkKnife";
import { MinusIcon } from "@phosphor-icons/react/dist/csr/Minus";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { ShoppingCartIcon } from "@phosphor-icons/react/dist/csr/ShoppingCart";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";

import { projection } from "../lib/store.js";
import { useActiveSoiree, useRev } from "../lib/hooks.js";
import { useCart } from "../lib/cart.js";
import { useSession } from "../lib/session.js";
import { emitSale } from "../lib/actions.js";
import { Button, EmptyState, StepButton, StockChip } from "../components/ui.js";
import { TicketBlock } from "../components/ProductIcon.js";
import { Modal } from "../components/Modal.js";
import { ConfirmModal } from "../components/ConfirmModal.js";
import { PaymentModal } from "../components/PaymentModal.js";
import { NoSoiree } from "../components/NoSoiree.js";
import { cn } from "../lib/cn.js";

/* ─── Dimensionnement de la grille produit ────────────────────────
   Remplir la hauteur ne suffit pas : mesuré sur banc de test, une grille
   à colonnes figées remplissait bien l'écran mais produisait des tuiles
   de 257x506 pour 5 produits sur iPad portrait, soit des barres de
   couleur étirées dans des cadres vides.

   On choisit donc le nombre de colonnes qui rapproche le plus la tuile
   d'une proportion lisible (un peu plus large que haute), sous contrainte
   de largeur et de hauteur minimales. Le calcul dépend des dimensions
   réelles du conteneur, d'où la mesure plutôt qu'une media query. */
const GAP = 12;
const MIN_TILE_W = 140;
const MIN_TILE_H = 104;
/** Au-delà, une tuile est plus haute que son contenu ne le justifie. */
const MAX_TILE_H = 240;
/** hauteur / largeur visée : une tuile un peu plus large que haute. */
const TARGET_RATIO = 0.66;

/**
 * La hauteur maximale est une CONTRAINTE sur le choix des colonnes, pas un
 * plafond appliqué après coup. Plafonner après coup ramènerait la bande vide
 * d'origine : sur iPad portrait, 5 produits en 2 colonnes donnent 3 lignes de
 * 333px, et les rogner à 240px laisserait 370px de vide en bas. La bonne
 * réponse est de réduire le nombre de colonnes, donc d'augmenter le nombre de
 * lignes, jusqu'à ce que des lignes de hauteur raisonnable remplissent l'écran.
 *
 * `capped` n'est vrai que si aucune combinaison ne tient sous la contrainte
 * (carte à 1 ou 2 produits) : la ligne est alors figée et la grille cadrée
 * en haut, ce qui est plus honnête qu'une tuile de 1000px de haut.
 */
function solveGrid(count: number, boxW: number, boxH: number) {
  const maxCols = Math.max(1, Math.floor((boxW + GAP) / (MIN_TILE_W + GAP)));
  let fitting: { cols: number; score: number } | null = null;
  let fallback = { cols: 1, score: Infinity };

  for (let cols = 1; cols <= maxCols; cols++) {
    const rows = Math.ceil(count / cols);
    const tileW = (boxW - (cols - 1) * GAP) / cols;
    // En cas de débordement, la ligne retombe sur sa hauteur minimale et la
    // grille défile : c'est le comportement attendu au-delà d'une trentaine
    // de produits.
    const rowH = Math.max((boxH - (rows - 1) * GAP) / rows, MIN_TILE_H);
    const score = Math.abs(rowH / tileW - TARGET_RATIO);

    if (rowH <= MAX_TILE_H) {
      if (!fitting || score < fitting.score) fitting = { cols, score };
    }
    if (score < fallback.score) fallback = { cols, score };
  }

  return fitting
    ? { cols: fitting.cols, capped: false }
    : { cols: fallback.cols, capped: true };
}

/**
 * Mesure le conteneur et publie `--tile-cols` / `--tile-row-max`.
 * Le state n'est mis à jour que si le résultat change, pour ne pas
 * boucler avec le ResizeObserver quand la barre de défilement apparaît.
 */
function useTileGrid(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [vars, setVars] = useState<CSSProperties>({});
  const previous = useRef("");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const compute = () => {
      const styles = getComputedStyle(el);
      const boxW = el.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
      const boxH = el.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom);
      if (count === 0 || boxW <= 0 || boxH <= 0) return;

      const { cols, capped } = solveGrid(count, boxW, boxH);
      const next: CSSProperties = {
        "--tile-cols": String(cols),
        "--tile-row-max": capped ? `${MAX_TILE_H}px` : "1fr",
      } as CSSProperties;

      const key = JSON.stringify(next);
      if (key === previous.current) return;
      previous.current = key;
      setVars(next);
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(el);
    return () => observer.disconnect();
  }, [count]);

  return { ref, vars };
}

export function CaisseScreen() {
  useRev();
  const soiree = useActiveSoiree();
  const { label, cashierName } = useSession();
  const cart = useCart();
  const [category, setCategory] = useState<string>("Tous");
  const [payOpen, setPayOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [askOversell, setAskOversell] = useState<CarteEntry | null>(null);
  /** Produits pour lesquels le dépassement de stock a déjà été confirmé
      dans le panier en cours : on ne redemande pas à chaque unité. */
  const oversellOk = useRef<Set<string>>(new Set());

  const soireeId = soiree?.id ?? "";
  const carte = useMemo(() => (soiree ? soireeCarte(projection, soiree.id) : []), [soiree, useRev()]); // eslint-disable-line react-hooks/exhaustive-deps

  const categories = useMemo(() => {
    const set = new Set(carte.map((e) => e.product.category));
    return ["Tous", ...[...set].sort()];
  }, [carte]);
  const visible = category === "Tous" ? carte : carte.filter((e) => e.product.category === category);
  const gridBox = useTileGrid(visible.length);

  const lines = Object.entries(cart.items)
    .map(([id, qty]) => ({ entry: carte.find((e) => e.product.id === id), qty }))
    .filter((l): l is { entry: CarteEntry; qty: number } => Boolean(l.entry));
  const totalCents = lines.reduce((s, l) => s + l.entry.priceCents * l.qty, 0);
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);

  if (!soiree) return <NoSoiree />;

  /**
   * Ajoute une unité, en demandant confirmation si la vente dépasse le stock
   * restant. Friction plutôt que blocage : en soirée, un stock initial mal
   * saisi ne doit pas empêcher d'encaisser, et le négatif qui en résulte est
   * une information utile à l'inventaire.
   *
   * La garde reste indicative : avec plusieurs caisses hors ligne, rien ne
   * réserve une unité, deux caisses peuvent vendre la dernière simultanément.
   */
  const addUnit = (entry: CarteEntry) => {
    const stock = stockRemaining(projection, soireeId, entry.product.id);
    const inCart = cart.items[entry.product.id] ?? 0;
    if (stock !== null && inCart + 1 > stock && !oversellOk.current.has(entry.product.id)) {
      setAskOversell(entry);
      return;
    }
    cart.add(entry.product.id);
  };

  const addUnitById = (id: string) => {
    const entry = carte.find((e) => e.product.id === id);
    if (entry) addUnit(entry);
  };

  const clearCart = () => {
    oversellOk.current.clear();
    cart.clear();
  };

  const confirmPayment = (method: PaymentMethod, cashReceivedCents?: number) => {
    void emitSale({
      soireeId,
      registerLabel: label ?? "Caisse",
      cashierName: cashierName ?? undefined,
      paymentMethod: method,
      items: lines.map((l) => ({
        productId: l.entry.product.id,
        qty: l.qty,
        unitPriceCents: l.entry.priceCents,
      })),
      totalCents,
      cashReceivedCents,
    });
    clearCart();
    setPayOpen(false);
    setSheetOpen(false);
    setToast(`Encaissé ${formatCents(totalCents)} · ${paymentLabel(method).toLowerCase()}`);
    setTimeout(() => setToast(null), 2200);
  };

  const cartPanel = (
    <CartPanel
      lines={lines}
      totalCents={totalCents}
      onInc={addUnitById}
      onDec={(id) => cart.add(id, -1)}
      onRemove={(id) => cart.remove(id)}
      onClear={clearCart}
      onPay={() => setPayOpen(true)}
    />
  );

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-line px-3 py-2.5">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-well px-3 py-1.5 text-micro font-bold text-sand">
            <ConfettiIcon size={14} weight="fill" className="text-lantern" />
            {soiree.name}
          </span>
          <div className="flex gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "min-h-11 rounded-full px-4 text-body font-bold whitespace-nowrap transition-colors active:scale-[0.97]",
                  category === c
                    ? "bg-lantern text-night"
                    : "border border-line bg-well text-sand hover:text-cream",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Conteneur en colonne flex : la grille reçoit `flex-1` et occupe
            donc toute la hauteur restante. Elle déborde et défile
            normalement quand les produits sont nombreux. */}
        <div
          ref={gridBox.ref}
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto p-3",
            // Réserve la hauteur de la barre panier fixe : le même
            // `max(0.75rem, encoche)` que son propre padding bas, sinon la
            // réserve et la barre divergent et laissent un vide ou masquent
            // la dernière ligne de tuiles.
            itemCount > 0 &&
              "pb-[calc(6.25rem+max(0.75rem,env(safe-area-inset-bottom)))] lg:pb-3",
          )}
          style={gridBox.vars}
        >
          {visible.length === 0 ? (
            <EmptyState
              icon={<ForkKnifeIcon size={44} weight="light" />}
              title="Carte vide pour cette soirée"
              hint="Ajoute des produits depuis Soirées, en ouvrant la carte de la soirée active."
            />
          ) : (
            <div className="tile-grid flex-1">
              {visible.map((e) => (
                <ProductTile
                  key={e.product.id}
                  entry={e}
                  soireeId={soireeId}
                  qty={cart.items[e.product.id] ?? 0}
                  onAdd={() => addUnit(e)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <aside className="hidden w-96 flex-col border-l border-line bg-surface lg:flex">
        {cartPanel}
      </aside>

      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <Button
            variant="primary"
            size="lg"
            className="flex w-full items-center justify-between"
            onClick={() => setSheetOpen(true)}
          >
            <span className="tnum flex items-center gap-2">
              <ShoppingCartIcon size={20} weight="fill" />
              {itemCount} article{itemCount > 1 ? "s" : ""}
            </span>
            <span className="tnum">{formatCents(totalCents)}</span>
          </Button>
        </div>
      )}

      {/* `padded={false}` : le panier gère lui-même son défilement, pour que
          la liste seule défile et que le pied « Total + Encaisser » reste
          visible quel que soit le nombre de lignes. */}
      <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} padded={false}>
        {cartPanel}
      </Modal>

      {payOpen && (
        <PaymentModal
          totalCents={totalCents}
          onClose={() => setPayOpen(false)}
          onConfirm={confirmPayment}
        />
      )}

      {askOversell && (
        <ConfirmModal
          open
          title="Stock épuisé"
          body={
            <>
              Stock restant de <b className="text-cream">{askOversell.product.name}</b> :{" "}
              <b className="tnum text-cream">
                {stockRemaining(projection, soireeId, askOversell.product.id)}
              </b>
              {(cart.items[askOversell.product.id] ?? 0) > 0 && (
                <>
                  , et le panier en contient déjà{" "}
                  <b className="tnum text-cream">{cart.items[askOversell.product.id]}</b>
                </>
              )}
              . Vendre quand même fera passer le stock à{" "}
              <b className="tnum text-signal">
                {(stockRemaining(projection, soireeId, askOversell.product.id) ?? 0) -
                  (cart.items[askOversell.product.id] ?? 0) -
                  1}
              </b>
              .
            </>
          }
          confirmLabel="Vendre quand même"
          onConfirm={() => {
            oversellOk.current.add(askOversell.product.id);
            cart.add(askOversell.product.id);
          }}
          onClose={() => setAskOversell(null)}
        />
      )}

      {toast && (
        <div className="animate-rise-in fixed left-1/2 top-4 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-mint px-5 py-3 text-body font-bold text-night shadow-lg">
          <CheckCircleIcon size={20} weight="fill" />
          {toast}
        </div>
      )}
    </div>
  );
}

/**
 * Tuile produit.
 * Trois signaux, trois places distinctes :
 *   - couleur du ticket papier → aplat plein à gauche, repère à bout de bras
 *   - icône                    → dans l'aplat, encre contrastée automatiquement
 *   - nom                      → à droite, pleine force, suffit SEUL à
 *                                identifier le produit (aucune dépendance
 *                                à la couleur)
 * La sélection (qty > 0) est signalée en lantern, qui ne sert qu'à ça.
 */
function ProductTile({
  entry,
  soireeId,
  qty,
  onAdd,
}: {
  entry: CarteEntry;
  soireeId: string;
  qty: number;
  onAdd: () => void;
}) {
  const { product, priceCents } = entry;
  const stock = stockRemaining(projection, soireeId, product.id);
  const soldOut = stock !== null && stock <= 0;

  return (
    <button
      onClick={onAdd}
      className={cn(
        "relative flex gap-2.5 overflow-hidden rounded-control border bg-surface p-2 text-left",
        "transition-transform duration-150 active:scale-[0.97]",
        qty > 0 ? "border-lantern ring-2 ring-lantern" : "border-line",
      )}
    >
      <TicketBlock
        emoji={product.emoji}
        color={product.color}
        imageKey={product.imageKey}
        imageZoom={product.imageZoom}
        iconSize={30}
        dimmed={soldOut}
        className="w-[28%] min-w-13 max-w-36 self-stretch"
      />

      {/* Contenu groupé au centre plutôt qu'épinglé haut et bas : sur une
          tuile haute, `mt-auto` creusait un vide entre le nom et le prix. */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-1 pr-0.5">
        <span className="line-clamp-2 text-body font-bold text-cream">{product.name}</span>
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="tnum text-lead font-bold text-cream">{formatCents(priceCents)}</span>
          <StockChip stock={stock} />
        </div>
      </div>

      {qty > 0 && (
        <span className="tnum absolute right-1.5 top-1.5 flex h-7 min-w-7 items-center justify-center rounded-full bg-lantern px-1.5 text-body font-black text-night">
          {qty}
        </span>
      )}
    </button>
  );
}

interface Line {
  entry: CarteEntry;
  qty: number;
}

function CartPanel({
  lines,
  totalCents,
  onInc,
  onDec,
  onRemove,
  onClear,
  onPay,
}: {
  lines: Line[];
  totalCents: number;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onPay: () => void;
}) {
  /* `min-h-0 flex-1` et non `h-full` : les deux parents (l'aside du bureau et
     le cadre de la feuille mobile) sont des colonnes flex, mais aucun n'a de
     hauteur *définie* — la feuille n'a qu'un `max-height`. Un `height: 100%`
     s'y résout en `auto`, la liste ne se contraint donc jamais, et c'est le
     pied « Total + Encaisser » qui était poussé hors du cadre puis rogné.
     En item flex rétractable, c'est la liste qui absorbe le débordement. */
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-display text-lead font-bold text-cream">Panier</h2>
        {lines.length > 0 && (
          <button
            onClick={onClear}
            className="min-h-11 px-2 text-body font-semibold text-ash transition-colors hover:text-signal"
          >
            Vider
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {lines.length === 0 ? (
          <EmptyState
            icon={<ShoppingCartIcon size={40} weight="light" />}
            title="Panier vide"
            hint="Touche un produit pour l'ajouter."
          />
        ) : (
          /* Deux niveaux plutôt qu'une seule ligne : sur un panneau de 384px,
             aligner nom + stepper + total + suppression laissait moins de
             50px au nom, réduit à « Bu… ». Un caissier doit pouvoir relire
             sa commande avant d'encaisser. */
          <div className="divide-y divide-line">
            {lines.map((l) => (
              <div key={l.entry.product.id} className="flex items-start gap-2.5 py-2.5">
                <TicketBlock
                  emoji={l.entry.product.emoji}
                  color={l.entry.product.color}
                  imageKey={l.entry.product.imageKey}
                  imageZoom={l.entry.product.imageZoom}
                  iconSize={18}
                  className="mt-0.5 h-10 w-10"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-body font-bold text-cream">
                      {l.entry.product.name}
                    </span>
                    <span className="tnum shrink-0 text-body font-bold text-cream">
                      {formatCents(l.entry.priceCents * l.qty)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="tnum text-micro text-ash">
                      {formatCents(l.entry.priceCents)}
                    </span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <StepButton
                        aria-label={`Retirer un ${l.entry.product.name}`}
                        onClick={() => onDec(l.entry.product.id)}
                      >
                        <MinusIcon size={18} weight="bold" />
                      </StepButton>
                      <span className="tnum w-7 text-center text-lead font-bold text-cream">
                        {l.qty}
                      </span>
                      <StepButton
                        aria-label={`Ajouter un ${l.entry.product.name}`}
                        onClick={() => onInc(l.entry.product.id)}
                      >
                        <PlusIcon size={18} weight="bold" />
                      </StepButton>
                      <button
                        onClick={() => onRemove(l.entry.product.id)}
                        aria-label={`Supprimer ${l.entry.product.name}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center text-ash transition-colors hover:text-signal"
                      >
                        <XIcon size={16} weight="bold" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-line px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-body text-sand">Total</span>
          <span className="font-display tnum text-display font-bold text-lantern">
            {formatCents(totalCents)}
          </span>
        </div>
        <Button
          variant="primary"
          size="xl"
          className="w-full"
          disabled={lines.length === 0}
          onClick={onPay}
        >
          Encaisser
        </Button>
      </div>
    </div>
  );
}

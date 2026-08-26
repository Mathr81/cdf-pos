import { useState } from "react";
import {
  preparedCount,
  soireeCarte,
  soldFromComponents,
  soldWithComponents,
  sortedStations,
  toPrepare,
  type ClientProduct,
} from "@cdf/shared";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { ChefHatIcon } from "@phosphor-icons/react/dist/csr/ChefHat";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";

import { projection } from "../lib/store.js";
import { useActiveSoiree, useRev } from "../lib/hooks.js";
import { markPrepared } from "../lib/actions.js";
import { Button, EmptyState, StepButton } from "../components/ui.js";
import { TicketBlock } from "../components/ProductIcon.js";
import { NoSoiree } from "../components/NoSoiree.js";
import { DepletionHint } from "../components/DepletionHint.js";
import { cn } from "../lib/cn.js";

interface KitchenItem {
  product: ClientProduct;
  sold: number;
  viaMenus: number;
  prepared: number;
  remaining: number;
}

export function CuisineScreen() {
  useRev();
  const soiree = useActiveSoiree();
  const stations = sortedStations(projection);
  const [stationId, setStationId] = useState<string>(
    () => localStorage.getItem("cdf.stationId") ?? stations[0]?.id ?? "",
  );
  const [showIdle, setShowIdle] = useState(false);

  const changeStation = (id: string) => {
    setStationId(id);
    localStorage.setItem("cdf.stationId", id);
  };

  if (!soiree) return <NoSoiree />;
  const soireeId = soiree.id;

  // Produits à préparer pour ce poste : ceux de la carte PLUS leurs composants
  // (une frite incluse dans un menu doit apparaître même si elle n'est pas
  // vendue seule sur la carte).
  const relevant = new Set<string>();
  for (const e of soireeCarte(projection, soireeId)) {
    relevant.add(e.product.id);
    for (const c of e.product.components) relevant.add(c.productId);
  }
  const items: KitchenItem[] = [...relevant]
    .map((id) => projection.products[id])
    .filter((p): p is NonNullable<typeof p> => Boolean(p) && p.active && p.stationId === stationId)
    .map((p) => ({
      product: p,
      sold: soldWithComponents(projection, soireeId, p.id),
      viaMenus: soldFromComponents(projection, soireeId, p.id),
      prepared: preparedCount(projection, soireeId, p.id),
      remaining: toPrepare(projection, soireeId, p.id),
    }));

  const todo = items
    .filter((i) => i.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining || a.product.sortOrder - b.product.sortOrder);
  /* « À jour » ne montre que ce qui a effectivement été traité. Un produit ni
     vendu ni préparé a lui aussi `remaining === 0` : les lister ici remplissait
     la section de cartes « 0/0 » qui n'apprennent rien. Ils restent atteignables
     sous un dépliant, replié par défaut, pour pouvoir préparer en avance. */
  const done = items
    .filter((i) => i.remaining === 0 && (i.sold > 0 || i.prepared > 0))
    .sort((a, b) => a.product.sortOrder - b.product.sortOrder);
  const idle = items
    .filter((i) => i.remaining === 0 && i.sold === 0 && i.prepared === 0)
    .sort((a, b) => a.product.sortOrder - b.product.sortOrder);
  const totalToPrepare = todo.reduce((s, i) => s + i.remaining, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2.5">
        {/* Segments tactiles plutôt qu'un <select> natif : la station change
            rarement mais toujours dans l'urgence, gants ou mains grasses. */}
        <div className="flex min-w-0 gap-2 overflow-x-auto">
          {stations.length === 0 && <span className="text-body text-ash">Aucune station</span>}
          {stations.map((s) => (
            <button
              key={s.id}
              onClick={() => changeStation(s.id)}
              className={cn(
                "min-h-12 rounded-control px-4 text-body font-bold whitespace-nowrap transition-colors active:scale-[0.97]",
                s.id === stationId
                  ? "bg-lantern text-night"
                  : "border border-line bg-well text-sand hover:text-cream",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="ml-auto shrink-0 text-right">
          <div className="text-micro font-bold tracking-wide text-ash uppercase">À préparer</div>
          <div
            key={totalToPrepare}
            className={cn(
              "font-display tnum animate-value-in text-title leading-none font-bold",
              totalToPrepare > 0 ? "text-cream" : "text-mint",
            )}
          >
            {totalToPrepare}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <EmptyState
            icon={<ChefHatIcon size={44} weight="light" />}
            title="Rien pour ce poste"
            hint="Aucun produit de cette soirée n'est rattaché à cette station."
          />
        ) : (
          <>
            {/* File à faire : priorité visuelle maximale. Quand elle est vide,
                le message ne prend toute la hauteur que s'il est seul : sinon
                il repousserait hors écran le dépliant de préparation en avance,
                justement utile à ce moment-là. */}
            {todo.length === 0 ? (
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-3 text-center",
                  done.length > 0 || idle.length > 0 ? "py-10" : "h-full",
                )}
              >
                <CheckCircleIcon size={64} weight="fill" className="text-mint" />
                <div className="font-display text-title font-bold text-cream">Tout est à jour</div>
                <div className="text-body text-sand">Rien à préparer pour le moment.</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {todo.map((it) => (
                  <TodoCard
                    key={it.product.id}
                    item={it}
                    soireeId={soireeId}
                    stationId={stationId}
                  />
                ))}
              </div>
            )}

            {/* À jour : compact et discret. */}
            {done.length > 0 && (
              <>
                <div className="mt-6 mb-2 text-micro font-bold tracking-wide text-ash uppercase">
                  À jour
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {done.map((it) => (
                    <DoneCard
                      key={it.product.id}
                      item={it}
                      soireeId={soireeId}
                      stationId={stationId}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Le reste du poste : rien de vendu, rien de préparé. Replié, mais
                accessible pour lancer une préparation en avance. */}
            {idle.length > 0 && (
              <>
                <button
                  onClick={() => setShowIdle((v) => !v)}
                  aria-expanded={showIdle}
                  className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-control border border-line bg-well px-4 text-body font-bold text-sand transition-colors hover:text-cream"
                >
                  <CaretDownIcon
                    size={16}
                    weight="bold"
                    className={cn("transition-transform", showIdle && "rotate-180")}
                  />
                  {showIdle ? "Masquer" : "Voir"} tous les produits du poste ({idle.length})
                </button>
                {showIdle && (
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {idle.map((it) => (
                      <DoneCard
                        key={it.product.id}
                        item={it}
                        soireeId={soireeId}
                        stationId={stationId}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Progression préparé / vendu. Animée en `transform`, jamais en `width`. */
function ProgressBar({ prepared, sold }: { prepared: number; sold: number }) {
  const pct = sold > 0 ? Math.min(100, Math.round((prepared / sold) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-well">
      <div
        className="h-full origin-left rounded-full bg-mint transition-transform duration-300"
        style={{ transform: `scaleX(${pct / 100})`, width: "100%" }}
      />
    </div>
  );
}

/**
 * Carte « à faire ».
 * Le nombre restant n'a pas besoin d'une couleur d'alerte : sa magnitude
 * est portée par la taille typographique et par le fait que la carte est
 * dans la file active. Le teinter en lantern le mettrait en collision
 * avec la sélection, qui est le seul métier de cette couleur.
 */
function TodoCard({
  item,
  soireeId,
  stationId,
}: {
  item: KitchenItem;
  soireeId: string;
  stationId: string;
}) {
  const { product, sold, prepared, remaining, viaMenus } = item;
  return (
    <div className="overflow-hidden rounded-surface border border-line bg-surface">
      <div className="flex gap-3 p-3">
        <TicketBlock
          emoji={product.emoji}
          color={product.color}
          imageKey={product.imageKey}
          imageZoom={product.imageZoom}
          iconSize={38}
          className="h-20 w-20 shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <span className="font-display min-w-0 text-lead font-bold text-balance text-cream">
              {product.name}
            </span>
            <div className="shrink-0 text-right">
              <div className="text-micro font-bold tracking-wide text-ash uppercase">À faire</div>
              <div
                key={remaining}
                className="font-display tnum animate-value-in text-display leading-none font-bold text-cream"
              >
                {remaining}
              </div>
            </div>
          </div>

          <div className="mt-auto pt-3">
            {/* Au-dessus de la barre : c'est une raison de lancer une cuisson
                maintenant, pas une statistique de fin de service. */}
            <DepletionHint soireeId={soireeId} productId={product.id} className="mb-1.5" />
            <ProgressBar prepared={prepared} sold={sold} />
            <div className="mt-1.5 flex items-center justify-between gap-2 text-micro text-sand">
              <span className="tnum">
                Préparé <b className="text-cream">{prepared}</b> / {sold}
              </span>
              {viaMenus > 0 && <span className="tnum text-ash">dont {viaMenus} en menu</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Geste le plus répété du service, souvent gants ou mains grasses :
          cibles portées à 64px, au-delà du minimum de 44. */}
      <div className="grid grid-cols-4 gap-2 border-t border-line p-2">
        <Button
          variant="secondary"
          size="lg"
          className="h-16"
          onClick={() => markPrepared(product.id, stationId, -1, soireeId)}
        >
          −1
        </Button>
        {[1, 5, 10].map((n) => (
          <Button
            key={n}
            variant="success"
            size="lg"
            className="h-16"
            onClick={() => markPrepared(product.id, stationId, n, soireeId)}
          >
            +{n}
          </Button>
        ))}
      </div>
    </div>
  );
}

function DoneCard({
  item,
  soireeId,
  stationId,
}: {
  item: KitchenItem;
  soireeId: string;
  stationId: string;
}) {
  const { product, sold, prepared } = item;
  return (
    <div className="flex items-center gap-2.5 rounded-control border border-line bg-surface p-2">
      <TicketBlock
        emoji={product.emoji}
        color={product.color}
        imageKey={product.imageKey}
        imageZoom={product.imageZoom}
        iconSize={18}
        className="h-10 w-10"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-body font-bold text-cream">{product.name}</div>
        <div className="tnum flex items-center gap-1 text-micro text-mint">
          <CheckCircleIcon size={13} weight="fill" />
          {prepared}/{sold}
        </div>
      </div>
      <StepButton
        aria-label={`Préparer un ${product.name} de plus`}
        onClick={() => markPrepared(product.id, stationId, 1, soireeId)}
      >
        <PlusIcon size={18} weight="bold" />
      </StepButton>
    </div>
  );
}

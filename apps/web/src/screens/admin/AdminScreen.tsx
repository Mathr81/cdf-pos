import { useState } from "react";
import {
  formatCents,
  sortedProducts,
  sortedStations,
  type ClientProduct,
  type ClientStation,
} from "@cdf/shared";
import { ChefHatIcon } from "@phosphor-icons/react/dist/csr/ChefHat";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretUpIcon } from "@phosphor-icons/react/dist/csr/CaretUp";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";

import { projection } from "../../lib/store.js";
import { useRev } from "../../lib/hooks.js";
import { newId } from "../../lib/device.js";
import { upsertProduct } from "../../lib/actions.js";
import { useUrlState } from "../../lib/urlState.js";
import { Button, EmptyState, StepButton, TextInput } from "../../components/ui.js";
import { TicketBlock } from "../../components/ProductIcon.js";
import { cn } from "../../lib/cn.js";
import { TabBtn } from "./TabBtn.js";
import { ProductEditor } from "./ProductEditor.js";
import { StationEditor } from "./StationEditor.js";
import { ResetPanel } from "./ResetPanel.js";
import { CategoryOrderEditor } from "./CategoryOrderEditor.js";

type Tab = "produits" | "stations" | "reset";

export function AdminScreen() {
  useRev();
  const [tab, setTab] = useUrlState<Tab>("onglet", "produits");
  const [q, setQ] = useState("");
  const [orderingCategories, setOrderingCategories] = useState(false);
  const [editProduct, setEditProduct] = useState<ClientProduct | null>(null);
  const [editStation, setEditStation] = useState<ClientStation | null>(null);

  const products = sortedProducts(projection);
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? products.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(needle))
    : products;

  /** Ordre des tuiles en caisse. Renumérote tout : des `sortOrder` en double
      (catalogue importé) rendaient un simple échange sans effet. */
  const move = (index: number, dir: -1 | 1) => {
    const next = [...products];
    const [it] = next.splice(index, 1);
    next.splice(index + dir, 0, it);
    next.forEach((p, i) => {
      if (p.sortOrder === i) return;
      void upsertProduct({
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        category: p.category,
        stationId: p.stationId,
        stockInitial: p.stockInitial,
        stockUnlimited: p.stockUnlimited,
        components: p.components,
        active: p.active,
        sortOrder: i,
        emoji: p.emoji,
        color: p.color,
        imageKey: p.imageKey,
        imageZoom: p.imageZoom,
      });
    });
  };
  const stations = sortedStations(projection);

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col p-4">
      <div className="mb-4 flex shrink-0 gap-2 overflow-x-auto">
        <TabBtn active={tab === "produits"} onClick={() => setTab("produits")}>
          Produits
        </TabBtn>
        <TabBtn active={tab === "stations"} onClick={() => setTab("stations")}>
          Stations cuisine
        </TabBtn>
        <TabBtn active={tab === "reset"} onClick={() => setTab("reset")}>
          {/* Postes connectés et stockage servent aussi pendant le service :
              « Remise à zéro » seul cachait ces deux panneaux. */}
          Appareils & remise à zéro
        </TabBtn>
      </div>

      {tab === "produits" && (
        <>
          <div className="mb-3 flex shrink-0 flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() =>
                setEditProduct({
                  id: newId(),
                  name: "",
                  priceCents: 0,
                  category: "Divers",
                  stationId: stations[0]?.id ?? null,
                  stockInitial: 0,
                  stockUnlimited: false,
                  components: [],
                  active: true,
                  sortOrder: products.length,
                  emoji: "hamburger",
                  color: "#f59e0b",
                  imageKey: null,
                  imageZoom: null,
                })
              }
            >
              <PlusIcon size={18} weight="bold" />
              Nouveau produit
            </Button>
            <Button variant="secondary" onClick={() => setOrderingCategories(true)}>
              Ordre des catégories
            </Button>
            <div className="relative min-w-40 flex-1">
              <MagnifyingGlassIcon
                size={17}
                weight="bold"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ash"
              />
              <TextInput
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un produit"
                aria-label="Rechercher un produit"
                className="pl-9"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            <div className="space-y-2">
              {shown.map((p, i) => (
                <div
                  key={p.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-control border border-line bg-surface p-2.5",
                    !p.active && "opacity-55",
                  )}
                >
                  <TicketBlock
                    emoji={p.emoji}
                    color={p.color}
                    imageKey={p.imageKey}
                    imageZoom={p.imageZoom}
                    iconSize={22}
                    dimmed={!p.active}
                    className="h-12 w-12"
                  />
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="truncate text-body font-bold text-cream">
                      {p.name || "(sans nom)"}
                      {!p.active && <span className="ml-1.5 text-micro text-signal">masqué</span>}
                    </div>
                    <div className="tnum truncate text-micro text-sand">
                      {formatCents(p.priceCents)} · {p.category}
                      {p.stationId &&
                        ` · ${projection.stations[p.stationId]?.name ?? p.stationId}`}{" "}
                      · {p.stockUnlimited ? "stock illimité" : `stock ${p.stockInitial}`}
                      {p.components.length > 0 &&
                        ` · avec ${p.components
                          .map(
                            (c) =>
                              `${c.qty}× ${projection.products[c.productId]?.name ?? c.productId}`,
                          )
                          .join(", ")}`}
                    </div>
                  </div>
                  {/* Ordre des tuiles en caisse ; masqué pendant une recherche,
                      où « monter d'un cran » n'aurait pas de sens visible. */}
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    {!needle && (
                      <>
                        <StepButton
                          aria-label={`Monter ${p.name}`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <CaretUpIcon size={15} weight="bold" />
                        </StepButton>
                        <StepButton
                          aria-label={`Descendre ${p.name}`}
                          disabled={i === products.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <CaretDownIcon size={15} weight="bold" />
                        </StepButton>
                      </>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="ml-1"
                      onClick={() => setEditProduct(p)}
                    >
                      Modifier
                    </Button>
                  </div>
                </div>
              ))}
              {products.length > 0 && shown.length === 0 && (
                <EmptyState
                  title="Aucun produit trouvé"
                  hint={`Rien ne correspond à « ${q.trim()} ».`}
                />
              )}
              {products.length === 0 && (
                <EmptyState
                  title="Aucun produit au catalogue"
                  hint="Crée les produits vendus par le comité. Ils resteront disponibles d'une soirée à l'autre."
                />
              )}
            </div>
          </div>
        </>
      )}

      {tab === "stations" && (
        <>
          <Button
            variant="primary"
            className="mb-3 shrink-0 self-start"
            onClick={() =>
              setEditStation({
                id: newId(),
                name: "",
                sortOrder: stations.length,
              })
            }
          >
            <PlusIcon size={18} weight="bold" />
            Nouvelle station
          </Button>
          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            <div className="space-y-2">
              {stations.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-control border border-line bg-surface p-2.5"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control border border-line bg-well text-sand">
                    <ChefHatIcon size={22} weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1 truncate text-body font-bold text-cream">
                    {s.name}
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setEditStation(s)}>
                    Modifier
                  </Button>
                </div>
              ))}
              {stations.length === 0 && (
                <EmptyState
                  icon={<ChefHatIcon size={44} weight="light" />}
                  title="Aucune station"
                  hint="Crée « Grill », « Friteuse », « Froid & desserts »… Chaque produit est ensuite rattaché à une station."
                />
              )}
            </div>
          </div>
        </>
      )}

      {tab === "reset" && <ResetPanel />}

      {editProduct && (
        <ProductEditor
          product={editProduct}
          stations={stations}
          onClose={() => setEditProduct(null)}
        />
      )}
      {editStation && <StationEditor station={editStation} onClose={() => setEditStation(null)} />}
      {orderingCategories && <CategoryOrderEditor onClose={() => setOrderingCategories(false)} />}
    </div>
  );
}

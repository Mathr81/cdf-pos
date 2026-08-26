import { useState } from "react";
import { formatCents, sortedProducts, sortedStations, type ClientProduct, type ClientStation } from "@cdf/shared";
import { ChefHatIcon } from "@phosphor-icons/react/dist/csr/ChefHat";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";

import { projection } from "../../lib/store.js";
import { useRev } from "../../lib/hooks.js";
import { newId } from "../../lib/device.js";
import { Button, EmptyState } from "../../components/ui.js";
import { TicketBlock } from "../../components/ProductIcon.js";
import { cn } from "../../lib/cn.js";
import { TabBtn } from "./TabBtn.js";
import { ProductEditor } from "./ProductEditor.js";
import { StationEditor } from "./StationEditor.js";
import { ResetPanel } from "./ResetPanel.js";

type Tab = "produits" | "stations" | "reset";

export function AdminScreen() {
  useRev();
  const [tab, setTab] = useState<Tab>("produits");
  const [editProduct, setEditProduct] = useState<ClientProduct | null>(null);
  const [editStation, setEditStation] = useState<ClientStation | null>(null);

  const products = sortedProducts(projection);
  const stations = sortedStations(projection);

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-4">
      <div className="mb-4 flex shrink-0 gap-2 overflow-x-auto">
        <TabBtn active={tab === "produits"} onClick={() => setTab("produits")}>
          Produits
        </TabBtn>
        <TabBtn active={tab === "stations"} onClick={() => setTab("stations")}>
          Stations cuisine
        </TabBtn>
        <TabBtn active={tab === "reset"} onClick={() => setTab("reset")}>
          Remise à zéro
        </TabBtn>
      </div>

      {tab === "produits" && (
        <>
          <Button
            variant="primary"
            className="mb-3 shrink-0 self-start"
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
          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            <div className="space-y-2">
              {products.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center gap-3 rounded-control border border-line bg-surface p-2.5",
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
                  <div className="min-w-0 flex-1">
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
                  <Button variant="secondary" size="sm" onClick={() => setEditProduct(p)}>
                    Modifier
                  </Button>
                </div>
              ))}
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
            onClick={() => setEditStation({ id: newId(), name: "", sortOrder: stations.length })}
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
    </div>
  );
}

import { useState } from "react";
import { sortCategories, sortedProducts } from "@cdf/shared";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretUpIcon } from "@phosphor-icons/react/dist/csr/CaretUp";

import { projection } from "../../lib/store.js";
import { setCategoryOrder } from "../../lib/actions.js";
import { plural } from "../../lib/plural.js";
import { Button, StepButton } from "../../components/ui.js";
import { Modal } from "../../components/Modal.js";

/**
 * Ordre des onglets de catégories en caisse, indépendant de l'ordre des
 * produits : on veut « Plats » en premier sans devoir remonter chaque plat
 * au-dessus de chaque entrée.
 */
export function CategoryOrderEditor({ onClose }: { onClose: () => void }) {
  const products = sortedProducts(projection).filter((p) => p.active);
  const [order, setOrder] = useState(() =>
    sortCategories(
      projection,
      products.map((p) => p.category),
    ),
  );
  const [initial] = useState(() => order.join("\n"));
  const dirty = order.join("\n") !== initial;
  const count = (c: string) => products.filter((p) => p.category === c).length;

  const move = (i: number, dir: -1 | 1) =>
    setOrder((o) => {
      const next = [...o];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });

  return (
    <Modal open onClose={onClose} dismissable={!dirty}>
      <h2 className="font-display text-lead font-bold text-cream">Ordre des catégories</h2>
      <p className="mt-1 mb-4 text-body text-sand">
        L'ordre des onglets en haut de la caisse, après « Tous ».
      </p>

      {order.length === 0 ? (
        <p className="py-6 text-center text-body text-ash">Aucune catégorie pour l'instant.</p>
      ) : (
        <ol className="space-y-1.5">
          {order.map((c, i) => (
            <li
              key={c}
              className="flex items-center gap-3 rounded-control border border-line bg-well py-1.5 pr-1.5 pl-3"
            >
              <span className="tnum w-5 text-micro font-bold text-ash">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-bold text-cream">{c}</span>
                <span className="block text-micro text-ash">{plural(count(c), "produit")}</span>
              </span>
              <StepButton aria-label={`Monter ${c}`} disabled={i === 0} onClick={() => move(i, -1)}>
                <CaretUpIcon size={15} weight="bold" />
              </StepButton>
              <StepButton
                aria-label={`Descendre ${c}`}
                disabled={i === order.length - 1}
                onClick={() => move(i, 1)}
              >
                <CaretDownIcon size={15} weight="bold" />
              </StepButton>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-5 flex gap-2">
        <Button variant="ghost" size="lg" onClick={onClose}>
          Annuler
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={!dirty}
          onClick={() => {
            void setCategoryOrder(order);
            onClose();
          }}
        >
          Enregistrer l'ordre
        </Button>
      </div>
    </Modal>
  );
}

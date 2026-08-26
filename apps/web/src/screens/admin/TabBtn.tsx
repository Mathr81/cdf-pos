import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

/** Onglet du bandeau admin, réutilisé par le sélecteur d'apparence produit. */
export function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "min-h-12 rounded-control px-4 text-body font-bold whitespace-nowrap transition-colors active:scale-[0.97]",
        active ? "bg-lantern text-night" : "border border-line bg-well text-sand hover:text-cream",
      )}
    >
      {children}
    </button>
  );
}

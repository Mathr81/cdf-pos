import { create } from "zustand";

interface CartState {
  /** productId → quantité. */
  items: Record<string, number>;
  add: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

/** Panier courant de la caisse (éphémère, non persisté). */
export const useCart = create<CartState>((set) => ({
  items: {},
  add: (productId, qty = 1) =>
    set((s) => {
      const next = (s.items[productId] ?? 0) + qty;
      if (next <= 0) {
        const { [productId]: _drop, ...rest } = s.items;
        return { items: rest };
      }
      return { items: { ...s.items, [productId]: next } };
    }),
  setQty: (productId, qty) =>
    set((s) => {
      if (qty <= 0) {
        const { [productId]: _drop, ...rest } = s.items;
        return { items: rest };
      }
      return { items: { ...s.items, [productId]: qty } };
    }),
  remove: (productId) =>
    set((s) => {
      const { [productId]: _drop, ...rest } = s.items;
      return { items: rest };
    }),
  clear: () => set({ items: {} }),
}));

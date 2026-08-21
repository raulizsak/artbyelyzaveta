"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { COWS_AT_DUSK, type Painting } from "@/lib/catalog";

type CartItem = { slug: string; quantity: 1 };
type RemovedItem = CartItem | null;
type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (painting?: Painting) => void;
  remove: (slug: string) => void;
  undoRemove: () => void;
  clear: () => void;
  removedItem: RemovedItem;
  isCartOpen: boolean;
  setCartOpen: (open: boolean) => void;
};

const STORAGE_KEY = "art-by-elyzaveta-cart-v1";
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [removedItem, setRemovedItem] = useState<RemovedItem>(null);
  const [isCartOpen, setCartOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      // Local storage is the durable cart source and is only available after client mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (value) setItems(JSON.parse(value) as CartItem[]);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  const add = useCallback((painting: Painting = COWS_AT_DUSK) => {
    setItems((current) =>
      current.some((item) => item.slug === painting.slug)
        ? current
        : [...current, { slug: painting.slug, quantity: 1 }],
    );
    setRemovedItem(null);
    setCartOpen(true);
  }, []);

  const remove = useCallback((slug: string) => {
    setItems((current) => {
      const item = current.find((entry) => entry.slug === slug) ?? null;
      setRemovedItem(item);
      return current.filter((entry) => entry.slug !== slug);
    });
  }, []);

  const undoRemove = useCallback(() => {
    if (!removedItem) return;
    setItems((current) =>
      current.some((item) => item.slug === removedItem.slug)
        ? current
        : [...current, removedItem],
    );
    setRemovedItem(null);
  }, [removedItem]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.length,
      subtotal: items.some((item) => item.slug === COWS_AT_DUSK.slug)
        ? COWS_AT_DUSK.price
        : 0,
      add,
      remove,
      undoRemove,
      clear: () => {
        setItems([]);
        setRemovedItem(null);
      },
      removedItem,
      isCartOpen,
      setCartOpen,
    }),
    [add, isCartOpen, items, remove, removedItem, undoRemove],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}

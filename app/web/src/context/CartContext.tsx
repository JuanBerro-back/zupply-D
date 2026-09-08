import { createContext, useContext, useState, ReactNode } from 'react';
import { CartItem, Product } from '../types';

interface CartContextValue {
  items: CartItem[];
  add: (product: Product, quantity: number) => void;
  remove: (productId: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  clear: () => void;
  total: number;
  count: number;
}

const CartContext = createContext<CartContextValue>(null!);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const add = (product: Product, quantity: number) => {
    setItems((prev) => {
      const found = prev.find((i) => i.product.id === product.id);
      if (found) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const remove = (productId: number) => setItems((prev) => prev.filter((i) => i.product.id !== productId));

  const setQuantity = (productId: number, quantity: number) =>
    setItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i)).filter((i) => i.quantity > 0)
    );

  const clear = () => setItems([]);

  const total = items.reduce((a, i) => a + i.product.price_per_unit * i.quantity, 0);
  const count = items.reduce((a, i) => a + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, add, remove, setQuantity, clear, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
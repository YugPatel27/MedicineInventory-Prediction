import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'medistock-cart';

const CartContext = createContext({
  items: [],
  addToCart: () => {},
  updateQuantity: () => {},
  removeFromCart: () => {},
  clearCart: () => {},
  totalItems: 0,
  subtotal: 0,
});

const readStored = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export function CartProvider({ children }) {
  const [items, setItems] = useState(readStored);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Keep multiple tabs in sync so a checkout in one tab clears the cart badge in another.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setItems(readStored());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addToCart = useCallback((medicine, quantity = 1) => {
    const id = medicine._id || medicine.medicine_id;
    const maxStock = Number(medicine.stock_quantity ?? Infinity);
    setItems((prev) => {
      const existing = prev.find((i) => i.medicineId === id);
      if (existing) {
        const nextQty = Math.min(existing.quantity + quantity, maxStock || existing.quantity);
        return prev.map((i) => (i.medicineId === id ? { ...i, quantity: nextQty } : i));
      }
      return [
        ...prev,
        {
          medicineId: id,
          medicine_id: medicine.medicine_id,
          medicine_name: medicine.medicine_name,
          batch_number: medicine.batch_number,
          unit_price: medicine.unit_price || 0,
          stock_quantity: maxStock,
          quantity: Math.min(quantity, maxStock || quantity),
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((medicineId, quantity) => {
    setItems((prev) =>
      prev
        .map((i) => (i.medicineId === medicineId ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock_quantity || quantity)) } : i))
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback((medicineId) => {
    setItems((prev) => prev.filter((i) => i.medicineId !== medicineId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0), [items]);

  const value = useMemo(
    () => ({ items, addToCart, updateQuantity, removeFromCart, clearCart, totalItems, subtotal }),
    [items, addToCart, updateQuantity, removeFromCart, clearCart, totalItems, subtotal]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}

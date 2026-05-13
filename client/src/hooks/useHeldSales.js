/**
 * useHeldSales
 *
 * Manages "held" (parked) sales in localStorage.
 * Max 5 held sales at once.
 *
 * A held sale stores: { id, heldAt, cart, customer, posData, customerDue }
 */
import { useState, useCallback } from "react";

const STORAGE_KEY = "pos_held_sales";
const MAX_HELD = 5;

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(sales) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sales));
}

export function useHeldSales() {
  const [heldSales, setHeldSales] = useState(load);

  const refresh = useCallback(() => {
    setHeldSales(load());
  }, []);

  /**
   * Hold the current sale.
   * @param {{ cart, customer, posData, customerDue }} saleState
   * @returns {{ success: boolean, message: string }}
   */
  const holdSale = useCallback((saleState) => {
    const current = load();

    if (current.length >= MAX_HELD) {
      return {
        success: false,
        message: `Maximum ${MAX_HELD} held sales reached. Resume or discard one first.`,
      };
    }

    if (!saleState.cart || saleState.cart.length === 0) {
      return { success: false, message: "Cart is empty — nothing to hold." };
    }

    const held = {
      id: `held-${Date.now()}`,
      heldAt: new Date().toISOString(),
      cart: saleState.cart,
      customer: saleState.customer,
      posData: saleState.posData,
      customerDue: saleState.customerDue || 0,
    };

    const updated = [...current, held];
    save(updated);
    setHeldSales(updated);

    return { success: true, message: "Sale held successfully." };
  }, []);

  /**
   * Resume a held sale by id.
   * @param {string} id
   * @returns {Object|null} The held sale state, or null if not found
   */
  const resumeSale = useCallback((id) => {
    const current = load();
    const held = current.find((s) => s.id === id);
    if (!held) return null;

    const updated = current.filter((s) => s.id !== id);
    save(updated);
    setHeldSales(updated);

    return held;
  }, []);

  /**
   * Discard a held sale by id.
   */
  const discardHeld = useCallback((id) => {
    const updated = load().filter((s) => s.id !== id);
    save(updated);
    setHeldSales(updated);
  }, []);

  return { heldSales, holdSale, resumeSale, discardHeld, refresh };
}

// src/context/OrderContext.tsx
import { useState, useContext, createContext, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { ShoppingCart } from "../components/ShoppingCart";
import { supabase } from "../lib/supabase";

export type OrderItem = { id: number; quantity: number };

export type CustomerInfo = {
  name: string;
  email?: string;
  phone: string;
  staffName: string;
  depositPaid: number;
};

export type CompletedOrder = {
  id: string; // local shadow id (timestamp-based)
  createdAt: string;
  customer: CustomerInfo;
  items: OrderItem[];
  totals: {
    subtotal: number;
    deposit: number;
    balance: number;
  };
  notes?: string | null;
};

type OrderListContext = {
  openCart: () => void;
  closeCart: () => void;
  cartQuantity: number;
  orderItems: OrderItem[];
  getItemQuantity: (id: number) => number;
  increaseOrderQuantity: (id: number) => void;
  decreseOrderQuantity: (id: number) => void;
  removeFromOrder: (id: number) => void;

  navigateToOrderDetails: () => void;

  orders: CompletedOrder[]; // local history (optional/offline)
  submitOrder: (
    customer: CustomerInfo,
    subtotal: number,
    notes: string
  ) => Promise<void>;
};

const OrderContext = createContext({} as OrderListContext);

export function useOrder() {
  return useContext(OrderContext);
}

export function OrderList({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [orderItems, setOrderItems] = useLocalStorage<OrderItem[]>(
    "shopping-cart",
    []
  );
  const [orders, setOrders] = useLocalStorage<CompletedOrder[]>("orders", []);
  const navigate = useNavigate();

  const cartQuantity = orderItems.reduce((q, i) => q + i.quantity, 0);

  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);

  function getItemQuantity(id: number) {
    return orderItems.find((i) => i.id === id)?.quantity || 0;
  }

  function increaseOrderQuantity(id: number) {
    setOrderItems((curr) =>
      curr.find((i) => i.id === id) == null
        ? [...curr, { id, quantity: 1 }]
        : curr.map((i) =>
            i.id === id ? { ...i, quantity: i.quantity + 1 } : i
          )
    );
  }

  function decreseOrderQuantity(id: number) {
    setOrderItems((curr) =>
      curr
        .map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0)
    );
  }

  function removeFromOrder(id: number) {
    setOrderItems((curr) => curr.filter((i) => i.id !== id));
  }

  function navigateToOrderDetails() {
    if (orderItems.length === 0) {
      alert("Your cart is empty!");
      return;
    }
    navigate("/order-details");
  }

  // --- Unique human-friendly order code, e.g. GB-Q3KF-1Z8C2L ---
  function generateOrderCode() {
    const t = Date.now().toString(36).toUpperCase().slice(-4);
    const arr = new Uint32Array(2);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(arr);
    } else {
      arr[0] = Math.floor(Math.random() * 2 ** 32);
      arr[1] = Math.floor(Math.random() * 2 ** 32);
    }
    const r = (arr[0] ^ arr[1])
      .toString(36)
      .toUpperCase()
      .padStart(6, "0")
      .slice(0, 6);
    return `GB-${t}-${r}`;
  }

  // --- Create order in Supabase, then go to receipt (auto-print) ---
  async function submitOrder(
    customer: CustomerInfo,
    subtotal: number,
    notes: string
  ) {
    const deposit = Math.max(0, customer.depositPaid || 0);
    const balance = Math.max(0, subtotal - deposit);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      alert("You must be logged in to place orders.");
      return;
    }

    // Keep a local shadow copy for offline/instant UI
    const localOrder: CompletedOrder = {
      id: String(Date.now()),
      createdAt: new Date().toISOString(),
      customer,
      items: orderItems,
      totals: { subtotal, deposit, balance },
      notes: notes?.trim() || undefined,
    };
    setOrders((prev) => [localOrder, ...prev]);

    // Insert with unique order_code (retry on rare collision)
    let inserted: { id: string; order_code: string } | null = null;
    let lastErr: any = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const orderCode = generateOrderCode();

      const { data, error } = await supabase
        .from("orders")
        .insert({
          user_id: userId,
          order_code: orderCode,
          customer_name: customer.name,
          customer_email: customer.email ?? null,
          customer_phone: customer.phone,
          staff_name: customer.staffName,
          deposit_paid: deposit,
          items: orderItems, // jsonb
          subtotal,
          balance,
          is_complete: false,
          notes: notes?.trim() || null,
        })
        .select("id, order_code")
        .single();

      if (!error && data) {
        inserted = data;
        break;
      }

      // 23505 = unique violation (order_code collision) — retry with a new code
      if (error?.code !== "23505") {
        lastErr = error;
        break;
      }
    }

    if (!inserted) {
      console.error("Order insert failed:", lastErr);
      alert("Could not save order. Please try again.");
      return;
    }

    // Clear cart and navigate to receipt; pass autoPrint=true in state
    setOrderItems([]);
    closeCart();
    navigate(`/receipt/${inserted.id}`, { state: { autoPrint: true } });
  }

  return (
    <OrderContext.Provider
      value={{
        getItemQuantity,
        increaseOrderQuantity,
        decreseOrderQuantity,
        removeFromOrder,
        openCart,
        closeCart,
        orderItems,
        cartQuantity,
        navigateToOrderDetails,
        orders,
        submitOrder,
      }}
    >
      {children}
      <ShoppingCart isOpen={isOpen} />
    </OrderContext.Provider>
  );
}

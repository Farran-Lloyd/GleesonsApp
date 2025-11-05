// src/context/OrderContext.tsx
import { useState, useContext, createContext, type ReactNode, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  staff_name: string;
  deposit_paid: number;
  items: OrderItem[];
  subtotal: number;
  balance: number;
  is_complete: boolean;
  notes?: string | null;
  order_code?: string | null;
};

type OrderListContext = {
  // cart
  openCart: () => void;
  closeCart: () => void;
  cartQuantity: number;
  orderItems: OrderItem[];
  getItemQuantity: (id: number) => number;
  increaseOrderQuantity: (id: number) => void;
  decreseOrderQuantity: (id: number) => void;
  removeFromOrder: (id: number) => void;

  // navigation
  navigateToOrderDetails: () => void;

  // orders data
  orders: CompletedOrder[];
  ordersLoading: boolean;
  ordersError: string | null;
  refreshOrders: () => Promise<void>;

  // actions
  submitOrder: (customer: CustomerInfo, subtotal: number, notes?: string) => Promise<void>;
};

const OrderContext = createContext({} as OrderListContext);
export function useOrder() { return useContext(OrderContext); }

export function OrderList({ children }: { children: ReactNode }) {
  // cart state (in-memory so it reflects current products)
  const [isOpen, setIsOpen] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  // orders state (Supabase is source of truth)
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const navigate = useNavigate();
  const cartQuantity = orderItems.reduce((sum, i) => sum + i.quantity, 0);

  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);

  function getItemQuantity(id: number) {
    return orderItems.find((i) => i.id === id)?.quantity || 0;
  }
  function increaseOrderQuantity(id: number) {
    setOrderItems((curr) =>
      curr.find((i) => i.id === id)
        ? curr.map((i) => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...curr, { id, quantity: 1 }]
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

  // ------- Orders: fetch & realtime -------
  async function refreshOrders() {
    setOrdersLoading(true);
    setOrdersError(null);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setOrdersError("Failed to load orders.");
    } else {
      setOrders((data ?? []) as CompletedOrder[]);
    }
    setOrdersLoading(false);
  }

  // helper: upsert by id (for INSERT/UPDATE)
  function upsertOrder(row: any) {
    setOrders((prev) => {
      const idx = prev.findIndex((o) => o.id === row.id);
      if (idx === -1) return [row as CompletedOrder, ...prev];
      const next = prev.slice();
      next[idx] = row as CompletedOrder;
      // keep order roughly by created_at desc if you like:
      next.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return next;
    });
  }
  // helper: remove by id (for DELETE)
  function removeOrder(row: any) {
    setOrders((prev) => prev.filter((o) => o.id !== row.id));
  }

  // set up initial fetch + realtime subscription
  const realtimeReadyRef = useRef(false);
  useEffect(() => {
    let mounted = true;

    (async () => {
      await refreshOrders();
      if (!mounted) return;

      // Avoid duplicate subscriptions (React StrictMode)
      if (realtimeReadyRef.current) return;
      realtimeReadyRef.current = true;

      const channel = supabase
        .channel("orders-context-rt")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders" },
          (payload) => upsertOrder(payload.new)
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders" },
          (payload) => upsertOrder(payload.new)
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "orders" },
          (payload) => removeOrder(payload.old)
        )
        .subscribe();

      // cleanup
      return () => {
        supabase.removeChannel(channel);
      };
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // ------- Submit order -------
  async function submitOrder(customer: CustomerInfo, subtotal: number, notes?: string) {
    const deposit = Math.max(0, customer.depositPaid || 0);
    const balance = Math.max(0, subtotal - deposit);

    // Require logged-in user (RLS)
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      alert("You must be logged in to place orders.");
      return;
    }

    // Insert
    const { data, error } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        customer_name: customer.name,
        customer_email: customer.email ?? null,
        customer_phone: customer.phone,
        staff_name: customer.staffName,
        deposit_paid: deposit,
        items: orderItems,
        subtotal,
        balance,
        is_complete: false,
        notes: notes?.trim() || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("Supabase insert failed:", error);
      alert("Could not save order. Please try again.");
      return;
    }

    // Clear cart; Realtime will push the new row into state
    setOrderItems([]);
    closeCart();
    navigate(`/receipt/${data.id}`, { state: { autoPrint: true } });
  }

  return (
    <OrderContext.Provider
      value={{
        // cart
        getItemQuantity,
        increaseOrderQuantity,
        decreseOrderQuantity,
        removeFromOrder,
        openCart,
        closeCart,
        orderItems,
        cartQuantity,

        // nav
        navigateToOrderDetails,

        // orders
        orders,
        ordersLoading,
        ordersError,
        refreshOrders,

        // actions
        submitOrder,
      }}
    >
      {children}
      <ShoppingCart isOpen={isOpen} />
    </OrderContext.Provider>
  );
}

// src/context/OrderContext.tsx
import { useState, useContext, createContext, type ReactNode } from "react";
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
  submitOrder: (customer: CustomerInfo, subtotal: number, notes?: string) => Promise<void>;
  orders: CompletedOrder[];
  refreshOrders: () => Promise<void>;
};

const OrderContext = createContext({} as OrderListContext);
export function useOrder() { return useContext(OrderContext); }

export function OrderList({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
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
        ? curr.map((i) => i.id === id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...curr, { id, quantity: 1 }]
    );
  }

  function decreseOrderQuantity(id: number) {
    setOrderItems((curr) =>
      curr
        .map((i) => i.id === id ? { ...i, quantity: i.quantity - 1 } : i)
        .filter((i) => i.quantity > 0)
    );
  }

  function removeFromOrder(id: number) {
    setOrderItems((curr) => curr.filter((i) => i.id !== id));
  }

  async function refreshOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setOrders(data as CompletedOrder[]);
  }

  async function submitOrder(customer: CustomerInfo, subtotal: number, notes?: string) {
    const deposit = Math.max(0, customer.depositPaid || 0);
    const balance = Math.max(0, subtotal - deposit);

    const { data, error } = await supabase
      .from("orders")
      .insert({
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
      alert("Could not save order.");
      return;
    }

    setOrderItems([]);
    closeCart();
    await refreshOrders(); // ✅ Refresh from Supabase immediately
    navigate(`/receipt/${data.id}`);
  }

  function navigateToOrderDetails() {
    if (orderItems.length === 0) {
      alert("Your cart is empty!");
      return;
    }
    navigate("/order-details");
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
        submitOrder,
        orders,
        refreshOrders,
      }}
    >
      {children}
      <ShoppingCart isOpen={isOpen} />
    </OrderContext.Provider>
  );
}

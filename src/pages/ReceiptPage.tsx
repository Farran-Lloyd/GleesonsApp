import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { Container, Spinner } from "react-bootstrap";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { useProducts } from "../hooks/useProducts";
import { formatCurrency } from "../utilities/formatCurrency";

type Line = { id: number; quantity: number };
type OrderRow = {
  id: string;
  order_code: string | null;
  created_at: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  staff_name: string;
  deposit_paid: number;
  items: Line[];
  subtotal: number;
  balance: number;
  notes: string | null;
};

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [params] = useSearchParams();
  const autoParam = params.get("auto") === "1";
  const autoFromState = (location.state as any)?.autoPrint === true;

  const { byId } = useProducts();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const printedRef = useRef(false); // guard against double prints (StrictMode)

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();

      if (!mounted) return;
      if (!error && data) setOrder(data as OrderRow);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Auto-print once the order is loaded if requested
  useEffect(() => {
    const shouldAutoPrint = !loading && order && (autoFromState || autoParam);
    if (!shouldAutoPrint || printedRef.current) return;

    // Small timeout ensures DOM is painted & fonts are ready
    const t = setTimeout(() => {
      try {
        window.focus();
        window.print();
      } catch (e) {
        // Silently ignore; user can use Ctrl/Cmd+P
        // (we're intentionally not rendering a button per your request)
      } finally {
        printedRef.current = true;
      }
    }, 200);

    return () => clearTimeout(t);
  }, [loading, order, autoFromState, autoParam]);

  const lines = useMemo(() => {
    if (!order) return [];
    return order.items.map((l) => {
      const p = byId.get(l.id);
      const name = p?.name ?? `Item #${l.id}`;
      const price = p?.price ?? 0;
      const total = price * l.quantity;
      return { ...l, name, price, total };
    });
  }, [order, byId]);

  if (loading) {
    return (
      <>
        <Navbar />
        <Container className="my-5 text-center">
          <Spinner animation="border" /> Loading…
        </Container>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <Navbar />
        <Container className="my-5 text-center">
          <p>Order not found.</p>
        </Container>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <Container className="my-4 receipt-container">
        {/* Header */}
        <div className="text-center mb-3">
          <h3 className="mb-0">Gleesons Butchers</h3>
          <div className="text-muted" style={{ fontSize: ".9rem" }}>
            {new Date(order.created_at).toLocaleString()}
          </div>
          <div className="fw-bold" style={{ fontSize: "1rem" }}>
            {order.order_code ? `Order ${order.order_code}` : `Order ${order.id}`}
          </div>
        </div>

        {/* Customer */}
        <div style={{ fontSize: ".95rem" }}>
          <strong>Customer:</strong> {order.customer_name}<br />
          <strong>Phone:</strong> {order.customer_phone}<br />
          <strong>Staff:</strong> {order.staff_name}
        </div>

        {order.notes && (
          <div className="mt-2" style={{ whiteSpace: "pre-wrap" }}>
            <strong>Notes:</strong> {order.notes}
          </div>
        )}

        <hr className="my-2" />

        {/* Lines */}
        <div>
          {lines.map((ln) => (
            <div key={ln.id} className="d-flex justify-content-between mb-1 small">
              <div>
                {ln.name}
                <span className="text-muted"> &times; {ln.quantity}</span>
              </div>
              <div>{formatCurrency(ln.total)}</div>
            </div>
          ))}
        </div>

        <hr className="my-2" />

        {/* Totals */}
        <div className="d-flex justify-content-between">
          <span className="fw-bold">Subtotal</span>
          <span>{formatCurrency(order.subtotal)}</span>
        </div>
        <div className="d-flex justify-content-between">
          <span>Deposit</span>
          <span>{formatCurrency(order.deposit_paid)}</span>
        </div>
        <div className="d-flex justify-content-between">
          <span className="fw-bold">Balance</span>
          <span className="fw-bold">{formatCurrency(order.balance)}</span>
        </div>
      </Container>
    </>
  );
}

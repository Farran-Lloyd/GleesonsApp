import { useEffect, useState } from "react";
import { Container, Spinner, Alert, Button } from "react-bootstrap";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Navbar from "../components/Navbar";
import { useProducts } from "../hooks/useProducts";

type OrderRow = {
  id: string;
  order_code: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  staff_name: string | null;
  notes: string | null;
  created_at: string;
  items: { id: number; quantity: number }[];
};

export default function ReceiptPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { byId } = useProducts();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderRow | null>(null);

  const normalizeItems = (raw: any): { id: number; quantity: number }[] => {
    try {
      const val = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!Array.isArray(val)) return [];
      return val
        .map((x) => ({
          id: Number((x && x.id) ?? NaN),
          quantity: Number((x && x.quantity) ?? NaN),
        }))
        .filter((x) => Number.isFinite(x.id) && Number.isFinite(x.quantity) && x.quantity > 0);
    } catch {
      return [];
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_code, customer_name, customer_email, customer_phone, staff_name, notes, created_at, items")
        .eq("id", id)
        .single();
      if (error || !data) {
        setErr("Failed to load receipt.");
        setLoading(false);
        return;
      }
      if (!mounted) return;
      setOrder({
        id: data.id,
        order_code: data.order_code,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        staff_name: data.staff_name,
        notes: data.notes,
        created_at: data.created_at,
        items: normalizeItems((data as any).items),
      });
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Optional: auto-print after load
  // useEffect(() => {
  //   if (order) {
  //     setTimeout(() => window.print(), 250);
  //   }
  // }, [order]);

  if (loading) {
    return (
      <>
        <Navbar />
        <Container className="my-4">
          <Spinner animation="border" size="sm" /> Loading…
        </Container>
      </>
    );
  }

  if (err || !order) {
    return (
      <>
        <Navbar />
        <Container className="my-4">
          <Alert variant="danger">{err || "Receipt not found."}</Alert>
        </Container>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <Container className="my-4" style={{ maxWidth: 720 }}>
        <div className="d-print-none d-flex justify-content-end gap-2 mb-2">
          <Button variant="outline-secondary" onClick={() => navigate(-1)}>
            Back
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            Print
          </Button>
        </div>

        <div className="p-3 border rounded">
          <div className="d-flex justify-content-between">
            <div>
              <h4 className="mb-0">Gleesons Butchers</h4>
              <small className="text-muted">Order Receipt</small>
            </div>
            <div className="text-end">
              <div><strong>Order Code:</strong> {order.order_code || "—"}</div>
              <div className="text-muted">
                {new Date(order.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          <hr />

          <div className="mb-2"><strong>Customer:</strong> {order.customer_name || "—"}</div>
          <div className="mb-2">
            <strong>Contact:</strong>{" "}
            {order.customer_phone || "—"}
            {order.customer_email ? ` • ${order.customer_email}` : ""}
          </div>
          <div className="mb-3"><strong>Staff:</strong> {order.staff_name || "—"}</div>

          <h6 className="mt-3 mb-2">Items</h6>
          {order.items.length === 0 ? (
            <div className="text-muted">No items.</div>
          ) : (
            <div>
              {order.items.map((line) => {
                const p = byId.get(line.id);
                return (
                  <div key={line.id} className="d-flex justify-content-between">
                    <span>{p?.name ?? `Item #${line.id}`}</span>
                    <span>Qty: {line.quantity}</span>
                  </div>
                );
              })}
            </div>
          )}

          {order.notes && (
            <>
              <hr />
              <div><strong>Notes:</strong></div>
              <div className="whitespace-prewrap">{order.notes}</div>
            </>
          )}
        </div>
      </Container>
    </>
  );
}

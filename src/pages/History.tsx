// src/pages/OrderHistory.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Card,
  Container,
  Alert,
  Spinner,
  Form,
  InputGroup,
  Button,
} from "react-bootstrap";
import Navbar from "../components/Navbar";
import { formatCurrency } from "../utilities/formatCurrency";
import { supabase } from "../lib/supabase";
import { Link, useLocation } from "react-router-dom";
import { useProducts } from "../hooks/useProducts";

type RawOrder = {
  id: string;
  created_at: string;
  order_code?: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  staff_name: string | null;
  deposit_paid: number | null;
  subtotal: number | null;
  balance: number | null;
  is_complete: boolean | null;
  items: any; // jsonb or string
  notes?: string | null;
};

type Line = { id: number; quantity: number };

const normalizeItems = (raw: any): Line[] => {
  if (raw == null) return [];
  let val: any = raw;
  try {
    if (typeof raw === "string") val = JSON.parse(raw);
  } catch {
    return [];
  }

  const out: Line[] = [];

  const pushLine = (rec: any) => {
    if (!rec) return;
    const rid = rec.id ?? rec.productId ?? rec.product_id ?? rec.ProductID ?? null;
    const rqty =
      rec.quantity ?? rec.qty ?? rec.count ?? rec.amount ?? rec.Quantity ?? null;
    const idNum = Number(rid);
    const qtyNum = Number(rqty);
    if (Number.isFinite(idNum) && Number.isFinite(qtyNum) && qtyNum > 0) {
      out.push({ id: idNum, quantity: qtyNum });
    }
  };

  if (Array.isArray(val)) {
    for (const rec of val) pushLine(rec);
    return out;
  }

  if (val && typeof val === "object") {
    for (const [k, v] of Object.entries(val)) {
      if (v != null && typeof v === "object") pushLine({ id: k, ...(v as any) });
      else pushLine({ id: k, quantity: v });
    }
    return out;
  }

  return out;
};

export default function OrderHistory() {
  const location = useLocation();
  const { products, byId, loading: loadingProducts, errorMsg: productsError } = useProducts();

  const [orders, setOrders] = useState<RawOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, created_at, order_code, customer_name, customer_email, customer_phone, staff_name, deposit_paid, subtotal, balance, is_complete, items, notes"
      )
      .order("created_at", { ascending: false });

    if (error) setErrorMsg("Failed to load order history.");
    else setOrders((data ?? []) as RawOrder[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders, location.key]);

  // Realtime sync
  useEffect(() => {
    const channel = supabase
      .channel("orders-history-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => setOrders((prev) => [payload.new as RawOrder, ...prev])
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) =>
          setOrders((prev) =>
            prev.map((o) => (o.id === (payload.new as any).id ? (payload.new as RawOrder) : o))
          )
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "orders" },
        (payload) =>
          setOrders((prev) => prev.filter((o) => o.id !== (payload.old as any).id))
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((o) => {
      const hay = [
        o.customer_name ?? "",
        o.customer_email ?? "",
        o.customer_phone ?? "",
        o.staff_name ?? "",
        o.order_code ?? "",
        o.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [q, orders]);

  return (
    <>
      <Navbar />
      <Container className="my-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="mb-0">Order History</h2>
        </div>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <InputGroup style={{ maxWidth: 420 }}>
            <InputGroup.Text>Search</InputGroup.Text>
            <Form.Control
              placeholder="Name, phone, email, staff, code, notes…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Button variant="outline-secondary" onClick={fetchOrders}>
              Refresh
            </Button>
          </InputGroup>
          <div className="text-muted">
            Products loaded: <strong>{products.length}</strong>
          </div>
        </div>

        {(loading || loadingProducts) && (
          <div className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" /> Loading…
          </div>
        )}
        {(errorMsg || productsError) && (
          <Alert variant="danger">{errorMsg || productsError}</Alert>
        )}
        {!loading && !errorMsg && filtered.length === 0 && <p>No matching orders.</p>}

        {!loading &&
          !errorMsg &&
          filtered.map((o) => {
            const lines = normalizeItems(o.items);
            return (
              <Card key={o.id} className="mb-3">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="fw-bold">
                        {o.customer_name || "Unknown"}
                        {o.order_code ? (
                          <span className="text-muted ms-2" style={{ fontSize: ".9rem" }}>
                            #{o.order_code}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-muted" style={{ fontSize: ".9rem" }}>
                        {new Date(o.created_at).toLocaleString()}
                        {o.is_complete ? " • Completed" : " • Incomplete"}
                      </div>
                      <div style={{ fontSize: ".9rem" }}>
                        Staff: {o.staff_name || "Unassigned"} • Phone: {o.customer_phone || "—"}
                        {o.customer_email ? ` • Email: ${o.customer_email}` : ""}
                      </div>
                      {o.notes ? (
                        <div className="mt-1" style={{ fontSize: ".9rem" }}>
                          <em>Notes:</em> {o.notes}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-end">
                      <div>Subtotal: {formatCurrency(o.subtotal ?? 0)}</div>
                      <div>Deposit: {formatCurrency(o.deposit_paid ?? 0)}</div>
                      <div className="fw-bold">Balance: {formatCurrency(o.balance ?? 0)}</div>
                    </div>
                  </div>

                  {/* Items list */}
                  <hr />
                  {lines.length === 0 ? (
                    <div className="text-muted">No items on this order.</div>
                  ) : (
                    <div className="d-flex flex-column gap-1">
                      {lines.map((ln) => {
                        const p = byId.get(ln.id);
                        const name = p?.name ?? `Item #${ln.id} (inactive)`;
                        return (
                          <div
                            key={`${o.id}-${ln.id}`}
                            className="d-flex justify-content-between"
                            style={{ fontSize: ".95rem" }}
                          >
                            <span>{name}</span>
                            <span>Qty: {ln.quantity}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="d-flex justify-content-end gap-2 mt-3">
                    <Button as={Link} to={`/edit-order/${o.id}`} variant="outline-primary" size="sm">
                      Edit Order
                    </Button>
                    {/* Add Mark Complete / Print buttons here if needed */}
                  </div>
                </Card.Body>
              </Card>
            );
          })}
      </Container>
    </>
  );
}

// src/pages/Inventory.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Container,
  Table,
  Spinner,
  Alert,
  Form,
  Button,
  InputGroup,
  ButtonGroup,
} from "react-bootstrap";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { useProducts } from "../hooks/useProducts";
import { formatCurrency } from "../utilities/formatCurrency";
import { useLocation } from "react-router-dom";

type OrderRow = {
  id: string;
  is_complete: boolean;
  items: { id: number; quantity: number }[];
  created_at: string;
};

export default function Inventory() {
  const location = useLocation();

  // Load all products (for names/prices)
  const { products, byId, loading: loadingProducts, errorMsg: productsError } = useProducts();

  // Orders state
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // UI filters
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [q, setQ] = useState(""); // search products by name/id

  async function fetchOrders() {
    setLoading(true);
    setErrorMsg(null);

    // We only need a few columns
    const { data, error } = await supabase
      .from("orders")
      .select("id, is_complete, items, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg("Failed to load orders.");
    } else {
      // normalize items
      const rows = (data ?? []).map((r) => ({
        ...r,
        items: Array.isArray(r.items) ? r.items : [],
      })) as OrderRow[];
      setOrders(rows);
    }
    setLoading(false);
  }

  // Initial load + refetch on route re-enter
  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // Realtime: listen for INSERT/UPDATE/DELETE on orders to keep inventory in sync
  useEffect(() => {
    const channel = supabase
      .channel("orders-inventory-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => setOrders((prev) => [payload.new as any as OrderRow, ...prev])
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) =>
          setOrders((prev) =>
            prev.map((o) => (o.id === (payload.new as any).id ? (payload.new as any as OrderRow) : o))
          )
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "orders" },
        (payload) => setOrders((prev) => prev.filter((o) => o.id !== (payload.old as any).id))
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Compute required quantities
  const requirements = useMemo(() => {
    // pick orders subset
    const relevant = includeCompleted ? orders : orders.filter((o) => !o.is_complete);

    // aggregate into productId -> qty
    const map = new Map<number, number>();
    for (const o of relevant) {
      for (const line of o.items) {
        if (!line || typeof line.id !== "number" || typeof line.quantity !== "number") continue;
        map.set(line.id, (map.get(line.id) || 0) + Math.max(0, line.quantity));
      }
    }

    // convert to array with product info
    const rows = Array.from(map.entries()).map(([productId, qty]) => {
      const p = byId.get(productId);
      return {
        productId,
        name: p?.name ?? `Item #${productId} (inactive)`,
        price: p?.price ?? 0,
        quantity: qty,
        total: (p?.price ?? 0) * qty,
        active: Boolean(p),
      };
    });

    // sort: active first, then name
    rows.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return rows;
  }, [orders, byId, includeCompleted]);

  // Search filter (by name or id)
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return requirements;
    return requirements.filter((r) => {
      return (
        r.name.toLowerCase().includes(needle) ||
        String(r.productId).includes(needle)
      );
    });
  }, [q, requirements]);

  const totalLines = filtered.length;
  const grandTotal = filtered.reduce((sum, r) => sum + r.total, 0);
  const grandQty = filtered.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <>
      <Navbar />

      <Container className="my-4">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
          <h2 className="mb-0">Inventory Requirements</h2>

          <div className="d-flex gap-2 align-items-center">
            <InputGroup style={{ maxWidth: 320 }}>
              <InputGroup.Text>Search</InputGroup.Text>
              <Form.Control
                placeholder="Product name or ID…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </InputGroup>

            <Form.Check
              type="switch"
              id="include-completed"
              label="Include completed"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.currentTarget.checked)}
            />

            <Button variant="outline-secondary" onClick={fetchOrders}>
              Refresh
            </Button>
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

        {!loading && !loadingProducts && filtered.length === 0 && (
          <Alert variant="info">
            {includeCompleted
              ? "No requirements found. There may be no orders."
              : "No open requirements. Try enabling ‘Include completed’."}
          </Alert>
        )}

        {!loading && !loadingProducts && filtered.length > 0 && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="text-muted">
                Showing <strong>{totalLines}</strong> products • Required qty{" "}
                <strong>{grandQty}</strong>
              </div>
              <div className="text-muted">
                Value (price × qty): <strong>{formatCurrency(grandTotal)}</strong>
              </div>
            </div>

            <Table hover responsive bordered>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>ID</th>
                  <th>Product</th>
                  <th style={{ width: 120, textAlign: "right" }}>Price</th>
                  <th style={{ width: 120, textAlign: "right" }}>Required Qty</th>
                  <th style={{ width: 140, textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.productId} className={!r.active ? "table-warning" : undefined}>
                    <td>{r.productId}</td>
                    <td>{r.name}</td>
                    <td style={{ textAlign: "right" }}>
                      {r.price ? formatCurrency(r.price) : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>{r.quantity}</td>
                    <td style={{ textAlign: "right" }}>
                      {r.price ? formatCurrency(r.total) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className="d-flex justify-content-end">
              <div className="text-end">
                <div>Lines: <strong>{totalLines}</strong></div>
                <div>Required Qty: <strong>{grandQty}</strong></div>
                <div>Value: <strong>{formatCurrency(grandTotal)}</strong></div>
              </div>
            </div>
          </>
        )}
      </Container>
    </>
  );
}

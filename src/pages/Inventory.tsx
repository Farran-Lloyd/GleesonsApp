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
} from "react-bootstrap";
import Navbar from "../components/Navbar";
import { useProducts } from "../hooks/useProducts";
import { formatCurrency } from "../utilities/formatCurrency";
import { useOrder } from "../context/OrderContext";
import { useLocation } from "react-router-dom";

export default function Inventory() {
  const location = useLocation();
  const { products, byId, loading: loadingProducts, errorMsg: productsError } = useProducts();
  const { orders, refreshOrders } = useOrder();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [q, setQ] = useState("");

  // Load orders from Supabase via context
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refreshOrders();
      } catch {
        setErrorMsg("Failed to load orders.");
      } finally {
        setLoading(false);
      }
    })();
  }, [location.key]);

  // Compute required quantities
  const requirements = useMemo(() => {
    const relevant = includeCompleted ? orders : orders.filter((o) => !o.is_complete);
    const map = new Map<number, number>();

    for (const o of relevant) {
      for (const line of o.items || []) {
        if (!line || typeof line.id !== "number" || typeof line.quantity !== "number") continue;
        map.set(line.id, (map.get(line.id) || 0) + Math.max(0, line.quantity));
      }
    }

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

    // sort active first, then alphabetically
    rows.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return rows;
  }, [orders, byId, includeCompleted]);

  // Filter by search query
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return requirements;
    return requirements.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        String(r.productId).includes(needle)
    );
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

            <Button variant="outline-secondary" onClick={() => refreshOrders()}>
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
                  <tr
                    key={r.productId}
                    className={!r.active ? "table-warning" : undefined}
                  >
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
                <div>
                  Lines: <strong>{totalLines}</strong>
                </div>
                <div>
                  Required Qty: <strong>{grandQty}</strong>
                </div>
                <div>
                  Value: <strong>{formatCurrency(grandTotal)}</strong>
                </div>
              </div>
            </div>
          </>
        )}
      </Container>
    </>
  );
}

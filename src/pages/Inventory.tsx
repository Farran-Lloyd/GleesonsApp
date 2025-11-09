// src/pages/Inventory.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
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
import { supabase } from "../lib/supabase";
import { useProducts } from "../hooks/useProducts";
import { formatCurrency } from "../utilities/formatCurrency";
import { useLocation } from "react-router-dom";

type OrderRow = {
  id: string;
  is_complete: boolean | null;
  items: any;             // jsonb or stringified json
  created_at: string;
  user_id?: string | null;
};

type RequirementRow = {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  total: number;
  active: boolean;
};

export default function Inventory() {
  const location = useLocation();

  // Products (for names/prices)
  const { products, byId, loading: loadingProducts, errorMsg: productsError } = useProducts();

  // Orders
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // UI filters
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [q, setQ] = useState(""); // search products by name/id

  // NEW: last year's incomplete only
  const now = new Date();
  const lastYear = now.getFullYear() - 1;
  const lastYearStartISO = new Date(lastYear, 0, 1).toISOString();      // YYYY-01-01T00:00:00Z
  const thisYearStartISO = new Date(lastYear + 1, 0, 1).toISOString();  // (YYYY+1)-01-01T00:00:00Z
  const [lastYearOnly, setLastYearOnly] = useState(false);

  // Ensure items is an array of {id:number, quantity:number}
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

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;

      let query = supabase
        .from("orders")
        .select("id, is_complete, items, created_at, user_id")
        .order("created_at", { ascending: false });

      if (userId) query = query.eq("user_id", userId);

      if (lastYearOnly) {
        // Only last year's incomplete
        query = query
          .eq("is_complete", false)
          .gte("created_at", lastYearStartISO)
          .lt("created_at", thisYearStartISO);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase select error:", error);
        setErrorMsg("Failed to load orders.");
      } else {
        const rows = (data ?? []).map((r) => ({
          ...r,
          items: normalizeItems((r as any).items),
          is_complete: !!r.is_complete,
        })) as OrderRow[];
        setOrders(rows);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, [lastYearOnly, lastYearStartISO, thisYearStartISO]);

  // Initial load + refetch on route key change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders, location.key]);

  // Realtime: keep inventory in sync (note: does not re-apply server-side filters automatically;
  // we still handle updates locally and you can click Refresh after changing the lastYearOnly toggle).
  useEffect(() => {
    const channel = supabase
      .channel("orders-inventory-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const row = payload.new as any;
          setOrders((prev) => [
            {
              id: row.id,
              is_complete: !!row.is_complete,
              items: normalizeItems(row.items),
              created_at: row.created_at,
              user_id: row.user_id ?? null,
            },
            ...prev,
          ]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const row = payload.new as any;
          setOrders((prev) =>
            prev.map((o) =>
              o.id === row.id
                ? {
                    id: row.id,
                    is_complete: !!row.is_complete,
                    items: normalizeItems(row.items),
                    created_at: row.created_at,
                    user_id: row.user_id ?? null,
                  }
                : o
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "orders" },
        (payload) => {
          const oldRow = payload.old as any;
          setOrders((prev) => prev.filter((o) => o.id !== oldRow.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Compute required quantities (client-side filter for includeCompleted unless lastYearOnly is active)
  const requirements: RequirementRow[] = useMemo(() => {
    const relevant = lastYearOnly
      ? orders // server already restricted to incomplete last year
      : includeCompleted
      ? orders
      : orders.filter((o) => !o.is_complete);

    const map = new Map<number, number>();
    for (const o of relevant) {
      for (const line of o.items as { id: number; quantity: number }[]) {
        if (!line || !Number.isFinite(line.id) || !Number.isFinite(line.quantity)) continue;
        map.set(line.id, (map.get(line.id) || 0) + Math.max(0, line.quantity));
      }
    }

    const rows: RequirementRow[] = [];
    for (const [productId, qty] of map.entries()) {
      const p = byId.get(productId);
      rows.push({
        productId,
        name: p?.name ?? `Item #${productId} (inactive)`,
        price: p?.price ?? 0,
        quantity: qty,
        total: (p?.price ?? 0) * qty,
        active: Boolean(p),
      });
    }

    rows.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return rows;
  }, [orders, byId, includeCompleted, lastYearOnly]);

  // Search filter (by name or id)
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return requirements;
    return requirements.filter((r) => {
      return (
        r.name.toLowerCase().includes(needle) ||
        String(r.productId).includes(needle)
      );
    });
  }, [search, requirements]);

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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>

            <Form.Check
              type="switch"
              id="last-year-only"
              label={`Last year's incomplete only (${lastYear})`}
              checked={lastYearOnly}
              onChange={(e) => {
                setLastYearOnly(e.currentTarget.checked);
                // when toggling this, re-fetch with server-side date filters
                setTimeout(fetchOrders, 0);
              }}
            />

            <Form.Check
              type="switch"
              id="include-completed"
              label="Include completed"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.currentTarget.checked)}
              disabled={lastYearOnly} // lastYearOnly already forces incomplete
              title={lastYearOnly ? "Disabled when filtering last year's incomplete" : ""}
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
            No matching requirements found.
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
                  <th style={{ width: 140, textAlign: "right" }}>Required Qty</th>
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
          </>
        )}
      </Container>
    </>
  );
}

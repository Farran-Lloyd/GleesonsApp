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
  created_at: string;       // timestamptz
  is_complete: boolean | null;
  items: any;               // jsonb or stringified JSON
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

  // Pull products & ID map (from your existing hook)
  const {
    products,
    byId,
    loading: loadingProducts,
    errorMsg: productsError,
  } = useProducts();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // UI state
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [lastYearOnly, setLastYearOnly] = useState(false);
  const [search, setSearch] = useState("");

  // Build ISO windows for timestamptz filters (UTC)
  const now = new Date();
  const lastYear = now.getUTCFullYear() - 1;
  const lastYearStartISO = new Date(Date.UTC(lastYear, 0, 1, 0, 0, 0)).toISOString();
  const thisYearStartISO = new Date(Date.UTC(lastYear + 1, 0, 1, 0, 0, 0)).toISOString();

  // --- TOLERANT items normalizer -------------------------------------------
  const normalizeItems = (raw: any): { id: number; quantity: number }[] => {
    if (raw == null) return [];
    let val: any = raw;
    try {
      if (typeof raw === "string") val = JSON.parse(raw);
    } catch {
      return [];
    }

    const out: { id: number; quantity: number }[] = [];

    const pushLine = (rec: any) => {
      if (!rec) return;
      // accept id | productId | product_id
      const rid = rec.id ?? rec.productId ?? rec.product_id ?? rec.ProductID ?? null;
      // accept quantity | qty | count | amount | Quantity
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
      // handle { "22": 3 } or { "22": { qty: 3 } }
      for (const [k, v] of Object.entries(val)) {
        if (v != null && typeof v === "object") {
          pushLine({ id: k, ...(v as any) });
        } else {
          pushLine({ id: k, quantity: v });
        }
      }
      return out;
    }

    return out;
  };
  // -------------------------------------------------------------------------

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;

      let query = supabase
        .from("orders")
        .select("id, created_at, is_complete, items, user_id")
        .order("created_at", { ascending: false });

      // RLS-safe: show current user's rows OR historical rows without user_id
      // (This helps with backfilled orders that have NULL user_id.)
      if (userId) {
        // Note: Supabase .or takes a single string with comma-separated clauses
        query = query.or(`user_id.eq.${userId},user_id.is.null`);
      } else {
        // Not logged in: you likely rely on anon-select policy already
        // (If RLS still blocks rows, relax policy or log in.)
      }

      if (lastYearOnly) {
        // Show last-year incomplete only — filter on the server
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
          is_complete: !!r.is_complete,
          items: normalizeItems((r as any).items),
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

  // Initial + on navigation
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders, location.key]);

  // Realtime updates to stay in sync
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
              created_at: row.created_at,
              is_complete: !!row.is_complete,
              items: normalizeItems(row.items),
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
                    created_at: row.created_at,
                    is_complete: !!row.is_complete,
                    items: normalizeItems(row.items),
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

  // Aggregate requirements
  const requirements: RequirementRow[] = useMemo(() => {
    const relevant = lastYearOnly
      ? orders // already filtered server-side
      : includeCompleted
      ? orders
      : orders.filter((o) => !o.is_complete);

    const map = new Map<number, number>();
    for (const o of relevant) {
      for (const line of o.items as { id: number; quantity: number }[]) {
        if (!line || !Number.isFinite(line.id) || !Number.isFinite(line.quantity)) continue;
        const qty = Math.max(0, line.quantity);
        map.set(line.id, (map.get(line.id) || 0) + qty);
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

  // Search (by product name or ID)
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return requirements;
    return requirements.filter(
      (r) => r.name.toLowerCase().includes(needle) || String(r.productId).includes(needle)
    );
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
                // Immediately refetch to reflect toggle
                setTimeout(fetchOrders, 0);
              }}
            />

            <Form.Check
              type="switch"
              id="include-completed"
              label="Include completed"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.currentTarget.checked)}
              disabled={lastYearOnly}
              title={lastYearOnly ? "Disabled when viewing last year's incomplete" : ""}
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
            {lastYearOnly
              ? "No incomplete orders found for last year."
              : "No requirements match the current filters."}
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

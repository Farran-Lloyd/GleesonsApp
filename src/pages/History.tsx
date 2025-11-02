// src/pages/OrderHistory.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Container,
  Alert,
  Spinner,
  Form,
  InputGroup,
  Button,
  ButtonGroup,
  ToggleButton,
} from "react-bootstrap";
import Navbar from "../components/Navbar";
import { formatCurrency } from "../utilities/formatCurrency";
import storeItems from "../data/items.json";
import { supabase } from "../lib/supabase";
import { Link, useLocation, useNavigate } from "react-router-dom";

type OrderRow = {
  id: string;
  order_code: string | null; // show/search friendly code
  created_at: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  staff_name: string;
  deposit_paid: number;
  items: { id: number; quantity: number }[];
  subtotal: number;
  balance: number;
  is_complete: boolean;
  notes: string | null;
};

type ViewMode = "incomplete" | "complete" | "all";

export default function OrderHistory() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [view, setView] = useState<ViewMode>("incomplete");
  const location = useLocation();
  const navigate = useNavigate();

  const getItemInfo = (id: number) => storeItems.find((i) => i.id === id);

  async function fetchOrders() {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setErrorMsg("Failed to load order history.");
    else setOrders((data ?? []) as OrderRow[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  useEffect(() => {
    const channel = supabase
      .channel("orders-realtime-history")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => setOrders((prev) => [payload.new as OrderRow, ...prev])
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) =>
          setOrders((prev) =>
            prev.map((o) => (o.id === (payload.new as any).id ? (payload.new as OrderRow) : o))
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

  const searched = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((o) => {
      const hay = [
        o.customer_name,
        o.customer_email ?? "",
        o.customer_phone,
        o.staff_name,
        o.id,
        o.order_code ?? "",
        o.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();
      const itemNames = o.items
        .map((it) => getItemInfo(it.id)?.name?.toLowerCase() ?? "")
        .join(" ");
      return hay.includes(needle) || itemNames.includes(needle);
    });
  }, [q, orders]);

  const visible = useMemo(() => {
    if (view === "all") return searched;
    const wantComplete = view === "complete";
    return searched.filter((o) => o.is_complete === wantComplete);
  }, [searched, view]);

  const toggleComplete = async (id: string, makeComplete: boolean) => {
    // optimistic UI
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, is_complete: makeComplete } : o)));
    const { data, error } = await supabase
      .from("orders")
      .update({ is_complete: makeComplete })
      .eq("id", id)
      .select("id");
    if (error || !data?.length) {
      // revert
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, is_complete: !makeComplete } : o)));
      alert("Failed to update order status.");
    }
  };

  const handleDelete = async (id: string) => {
    const ok = confirm("Delete this order? This cannot be undone.");
    if (!ok) return;
    const { data, error } = await supabase.from("orders").delete().eq("id", id).select("id");
    if (error || !data?.length) {
      alert("Failed to delete order.");
      return;
    }
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  // 🔔 PRINT: navigate to receipt and request auto-print using router state
  const handlePrint = (id: string) => {
    navigate(`/receipt/${id}`, { state: { autoPrint: true } });
  };

  return (
    <>
      <Navbar />
      <Container className="my-4">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
          <h2 className="mb-0">Order History</h2>

          <div className="d-flex gap-2">
            <ButtonGroup aria-label="View">
              <ToggleButton
                id="view-incomplete"
                type="radio"
                variant={view === "incomplete" ? "primary" : "outline-primary"}
                name="view"
                value="incomplete"
                checked={view === "incomplete"}
                onChange={() => setView("incomplete")}
              >
                Incomplete
              </ToggleButton>
              <ToggleButton
                id="view-complete"
                type="radio"
                variant={view === "complete" ? "primary" : "outline-primary"}
                name="view"
                value="complete"
                checked={view === "complete"}
                onChange={() => setView("complete")}
              >
                Complete
              </ToggleButton>
              <ToggleButton
                id="view-all"
                type="radio"
                variant={view === "all" ? "primary" : "outline-primary"}
                name="view"
                value="all"
                checked={view === "all"}
                onChange={() => setView("all")}
              >
                All
              </ToggleButton>
            </ButtonGroup>

            <InputGroup style={{ maxWidth: 360 }}>
              <InputGroup.Text>Search</InputGroup.Text>
              <Form.Control
                placeholder="Name, phone, email, staff, ID/code, item, notes…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </InputGroup>
          </div>
        </div>

        {loading && (
          <div className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" /> Loading…
          </div>
        )}
        {errorMsg && <Alert variant="danger">{errorMsg}</Alert>}
        {!loading && !errorMsg && visible.length === 0 && <p>No matching orders.</p>}

        {!loading &&
          !errorMsg &&
          visible.map((o) => (
            <Card key={o.id} className="mb-3">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="fw-bold">
                      {o.customer_name}{" "}
                      {o.is_complete && (
                        <span className="badge bg-success ms-2">Complete</span>
                      )}
                    </div>
                    <div className="text-muted" style={{ fontSize: ".9rem" }}>
                      {new Date(o.created_at).toLocaleString()}
                    </div>
                    <div style={{ fontSize: ".9rem" }}>
                      {o.order_code ? `Order ${o.order_code}` : `Order ${o.id}`}
                    </div>
                    <div style={{ fontSize: ".9rem" }}>
                      Staff: {o.staff_name} • Phone: {o.customer_phone}
                      {o.customer_email ? ` • Email: ${o.customer_email}` : ""}
                    </div>
                  </div>
                  <div className="text-end">
                    <div>Subtotal: {formatCurrency(o.subtotal)}</div>
                    <div>Deposit: {formatCurrency(o.deposit_paid)}</div>
                    <div className="fw-bold">Balance: {formatCurrency(o.balance)}</div>
                  </div>
                </div>

                <hr />

                {o.items.map((it) => {
                  const info = getItemInfo(it.id);
                  return (
                    <div key={`${o.id}-${it.id}`} className="d-flex justify-content-between">
                      <span>{info ? info.name : `Item #${it.id}`}</span>
                      <span>Qty: {it.quantity}</span>
                    </div>
                  );
                })}

                {Boolean(o.notes) && (
                  <>
                    <hr />
                    <div className="text-muted" style={{ whiteSpace: "pre-wrap" }}>
                      <strong>Notes:</strong> {o.notes}
                    </div>
                  </>
                )}

                <div className="d-flex justify-content-end gap-2 mt-3">
                  <Button as={Link} to={`/edit-order/${o.id}`} variant="outline-primary" size="sm">
                    Edit
                  </Button>

                  {!o.is_complete ? (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => toggleComplete(o.id, true)}
                    >
                      Mark Complete
                    </Button>
                  ) : (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => toggleComplete(o.id, false)}
                    >
                      Mark Incomplete
                    </Button>
                  )}

                  {/* 🔔 PRINT: navigate with state to auto-open the dialog */}
                  <Button
                    variant="outline-success"
                    size="sm"
                    onClick={() => handlePrint(o.id)}
                    title="Print receipt"
                  >
                    Print
                  </Button>

                  <Button variant="outline-danger" size="sm" onClick={() => handleDelete(o.id)}>
                    Delete
                  </Button>
                </div>
              </Card.Body>
            </Card>
          ))}
      </Container>
    </>
  );
}

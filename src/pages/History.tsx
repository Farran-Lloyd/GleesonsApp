import { useEffect, useMemo, useState } from "react";
import { Card, Container, Alert, Spinner, Form, InputGroup, Button } from "react-bootstrap";
import Navbar from "../components/Navbar";
import { formatCurrency } from "../utilities/formatCurrency";
import { useOrder } from "../context/OrderContext";
import storeItems from "../data/items.json";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";

type OrderRow = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  staff_name: string;
  deposit_paid: number;
  items: { id: number; quantity: number }[];
  subtotal: number;
  balance: number;
  notes?: string | null;
  is_complete: boolean;
};

export default function OrderHistory() {
  const { orders, refreshOrders } = useOrder();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refreshOrders();
      setLoading(false);
    })();
  }, []);

  async function markComplete(id: string, value: boolean) {
    const { error } = await supabase
      .from("orders")
      .update({ is_complete: value })
      .eq("id", id);
    if (error) alert("Failed to update order status.");
    else await refreshOrders();
  }

  async function deleteOrder(id: string) {
    if (!window.confirm("Are you sure you want to delete this order?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) alert("Failed to delete order.");
    else await refreshOrders();
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let data = orders;
    if (!showCompleted) data = data.filter((o) => !o.is_complete);
    if (!needle) return data;
    return data.filter((o) => {
      const hay = [
        o.customer_name,
        o.customer_email ?? "",
        o.customer_phone,
        o.staff_name,
        o.id,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [orders, q, showCompleted]);

  return (
    <>
      <Navbar />
      <Container className="my-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="mb-0">Order History</h2>
          <div className="d-flex gap-2">
            <InputGroup style={{ maxWidth: 280 }}>
              <InputGroup.Text>Search</InputGroup.Text>
              <Form.Control
                placeholder="Name, phone, staff..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </InputGroup>
            <Form.Check
              type="switch"
              id="show-complete"
              label="Show Completed"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
          </div>
        </div>

        {loading && (
          <div className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" /> Loading…
          </div>
        )}
        {errorMsg && <Alert variant="danger">{errorMsg}</Alert>}
        {!loading && filtered.length === 0 && <p>No orders found.</p>}

        {!loading &&
          filtered.map((o) => (
            <Card key={o.id} className="mb-3 shadow-sm">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="fw-bold">{o.customer_name}</div>
                    <div className="text-muted" style={{ fontSize: ".9rem" }}>
                      {new Date(o.created_at).toLocaleString()}
                    </div>
                    <div style={{ fontSize: ".9rem" }}>
                      Staff: {o.staff_name} • Phone: {o.customer_phone}
                      {o.customer_email ? ` • ${o.customer_email}` : ""}
                    </div>
                    {o.notes && (
                      <div className="text-muted mt-1" style={{ fontSize: ".9rem" }}>
                        <i>Note:</i> {o.notes}
                      </div>
                    )}
                  </div>
                  <div className="text-end">
                    <div>Subtotal: {formatCurrency(o.subtotal)}</div>
                    <div>Deposit: {formatCurrency(o.deposit_paid)}</div>
                    <div className="fw-bold">
                      Balance: {formatCurrency(o.balance)}
                    </div>
                  </div>
                </div>

                <hr />

                {o.items.map((it) => {
                  const item = storeItems.find((i) => i.id === it.id);
                  return (
                    <div
                      key={`${o.id}-${it.id}`}
                      className="d-flex justify-content-between"
                    >
                      <span>{item ? item.name : `Item #${it.id}`}</span>
                      <span>Qty: {it.quantity}</span>
                    </div>
                  );
                })}

                <div className="d-flex justify-content-end gap-2 mt-3">
                  <Button
                    size="sm"
                    variant={o.is_complete ? "outline-secondary" : "outline-success"}
                    onClick={() => markComplete(o.id, !o.is_complete)}
                  >
                    {o.is_complete ? "Mark Incomplete" : "Mark Complete"}
                  </Button>
                  <Button
                    as={Link}
                    to={`/edit-order/${o.id}`}
                    variant="outline-primary"
                    size="sm"
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => deleteOrder(o.id)}
                  >
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

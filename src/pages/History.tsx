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
} from "react-bootstrap";
import Navbar from "../components/Navbar";
import { formatCurrency } from "../utilities/formatCurrency";
import storeItems from "../data/items.json";
import { supabase } from "../lib/supabase";
import { Link, useNavigate } from "react-router-dom";
import { useOrder } from "../context/OrderContext";

export default function OrderHistory() {
  const navigate = useNavigate();
  const { orders, ordersLoading, ordersError, refreshOrders } = useOrder();

  const [q, setQ] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    // initial fetch on first mount in case context mounted before auth finished
    if (!orders.length) {
      refreshOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let data = showCompleted ? orders : orders.filter((o) => !o.is_complete);
    if (!needle) return data;
    return data.filter((o) => {
      const hay = [
        o.customer_name,
        o.customer_email ?? "",
        o.customer_phone,
        o.staff_name,
        o.order_code ?? "",
        o.id,
        o.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [orders, q, showCompleted]);

  const toggleComplete = async (id: string, makeComplete: boolean) => {
    // optimistic
    // (Optional) we could also rely purely on realtime: comment out setImmediate
    const { error } = await supabase
      .from("orders")
      .update({ is_complete: makeComplete })
      .eq("id", id);
    if (error) alert("Failed to update order status.");
    // Realtime will update the row in context automatically
  };

  const handleDelete = async (id: string) => {
    const ok = confirm("Delete this order? This cannot be undone.");
    if (!ok) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) {
      alert("Failed to delete order.");
    }
    // Realtime DELETE will remove it from the list
  };

  const handlePrint = (id: string) => {
    navigate(`/receipt/${id}`, { state: { autoPrint: true } });
  };

  return (
    <>
      <Navbar />
      <Container className="my-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="mb-0">Order History</h2>
          <div className="d-flex gap-2">
            <InputGroup style={{ maxWidth: 300 }}>
              <InputGroup.Text>Search</InputGroup.Text>
              <Form.Control
                placeholder="Name, phone, email, staff, code…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </InputGroup>
            <Form.Check
              type="switch"
              id="show-complete"
              label="Show completed"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.currentTarget.checked)}
            />
          </div>
        </div>

        {ordersLoading && (
          <div className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" /> Loading…
          </div>
        )}
        {ordersError && <Alert variant="danger">{ordersError}</Alert>}
        {!ordersLoading && !ordersError && filtered.length === 0 && (
          <p>No matching orders.</p>
        )}

        {!ordersLoading &&
          !ordersError &&
          filtered.map((o) => (
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
                    {o.notes && (
                      <div
                        className="text-muted mt-1"
                        style={{ fontSize: ".9rem" }}
                      >
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
                    as={Link}
                    to={`/edit-order/${o.id}`}
                    variant="outline-primary"
                    size="sm"
                  >
                    Edit
                  </Button>

                  <Button
                    variant={o.is_complete ? "outline-secondary" : "success"}
                    size="sm"
                    onClick={() => toggleComplete(o.id, !o.is_complete)}
                  >
                    {o.is_complete ? "Mark Incomplete" : "Mark Complete"}
                  </Button>

                  <Button
                    variant="outline-success"
                    size="sm"
                    onClick={() => handlePrint(o.id)}
                  >
                    Print
                  </Button>

                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => handleDelete(o.id)}
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

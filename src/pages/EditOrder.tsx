import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Alert,
  Spinner,
  InputGroup,
} from "react-bootstrap";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { useProducts } from "../hooks/useProducts";
import { formatCurrency } from "../utilities/formatCurrency";

type OrderRow = {
  id: string;
  order_code: string | null;
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
  notes: string | null; // NEW
};

export default function EditOrderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Products for names/prices and adding lines
  const { products, byId } = useProducts();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [order, setOrder] = useState<OrderRow | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [staffName, setStaffName] = useState("");
  const [depositPaid, setDepositPaid] = useState<number>(0);
  const [notes, setNotes] = useState(""); // NEW
  const [items, setItems] = useState<{ id: number; quantity: number }[]>([]);

  // "Add item" controls
  const [addProductId, setAddProductId] = useState<number | "">("");
  const [addQty, setAddQty] = useState<number>(1);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();

      if (!mounted) return;

      if (error || !data) {
        console.error(error);
        setErrorMsg("Could not load order.");
      } else {
        const row = data as OrderRow;
        setOrder(row);
        setCustomerName(row.customer_name);
        setCustomerEmail(row.customer_email ?? "");
        setCustomerPhone(row.customer_phone);
        setStaffName(row.staff_name);
        setDepositPaid(Number(row.deposit_paid) || 0);
        setNotes(row.notes ?? ""); // hydrate notes
        setItems(Array.isArray(row.items) ? row.items : []);
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  // Compute subtotal from current items using live product prices
  const subtotal = useMemo(() => {
    return items.reduce((sum, line) => {
      const p = byId.get(line.id);
      const price = p?.price ?? 0;
      return sum + price * line.quantity;
    }, 0);
  }, [items, byId]);

  const balance = Math.max(0, subtotal - (Number(depositPaid) || 0));

  // ----- item ops -----
  const updateQty = (productId: number, qty: number) => {
    if (Number.isNaN(qty)) return;
    if (qty <= 0) {
      setItems((prev) => prev.filter((l) => l.id !== productId));
      return;
    }
    setItems((prev) => {
      const exists = prev.find((l) => l.id === productId);
      if (!exists) return [...prev, { id: productId, quantity: qty }];
      return prev.map((l) =>
        l.id === productId ? { ...l, quantity: qty } : l
      );
    });
  };

  const removeLine = (productId: number) => {
    setItems((prev) => prev.filter((l) => l.id !== productId));
  };

  const addLine = () => {
    if (addProductId === "" || addQty <= 0) return;
    const pid = Number(addProductId);
    setItems((prev) => {
      const exists = prev.find((l) => l.id === pid);
      if (exists) {
        return prev.map((l) =>
          l.id === pid ? { ...l, quantity: l.quantity + addQty } : l
        );
      }
      return [...prev, { id: pid, quantity: addQty }];
    });
    setAddProductId("");
    setAddQty(1);
  };

  // ----- save & delete -----
  const handleSave = async () => {
    if (!customerName || !customerPhone || !staffName) {
      alert("Please provide customer name, phone, and staff name.");
      return;
    }
    if (items.length === 0) {
      const yes = confirm("This order has no items. Continue?");
      if (!yes) return;
    }

    setSaving(true);
    const payload = {
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim() || null,
      customer_phone: customerPhone.trim(),
      staff_name: staffName.trim(),
      deposit_paid: Math.max(0, Number(depositPaid) || 0),
      items,
      subtotal,
      balance,
      notes: notes.trim() || null, // include notes
    };

    const { error } = await supabase
      .from("orders")
      .update(payload)
      .eq("id", id);
    setSaving(false);

    if (error) {
      console.error(error);
      alert("Failed to save changes.");
      return;
    }
    navigate("/history");
  };

  const handleDelete = async () => {
    const yes = confirm("Delete this order? This cannot be undone.");
    if (!yes) return;

    setDeleting(true);
    const { data, error } = await supabase
      .from("orders")
      .delete()
      .eq("id", id)
      .select("id");
    setDeleting(false);

    if (error || !data?.length) {
      console.error(error);
      alert("Failed to delete order.");
      return;
    }
    navigate("/history", { replace: true });
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <Container className="my-4 d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" /> Loading order…
        </Container>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <Navbar />
        <Container className="my-4">
          <Alert variant="danger">{errorMsg || "Order not found."}</Alert>
          <Button as={Link} to="/history" variant="secondary">
            Back to History
          </Button>
        </Container>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <Container className="my-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="mb-0">Edit Order</h2>
          {order?.order_code && (
  <span className="badge bg-secondary ms-2" style={{ alignSelf: "center" }}>
    {order.order_code}
  </span>
)}
          <div className="d-flex gap-2">
            <Button
              onClick={handleDelete}
              variant="outline-danger"
              size="sm"
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete Order"}
            </Button>
            <Button
              as={Link}
              to="/history"
              variant="outline-secondary"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>

        {errorMsg && <Alert variant="danger">{errorMsg}</Alert>}

        <Row>
          {/* Left: Customer */}
          <Col md={6}>
            <Card className="mb-3">
              <Card.Body>
                <h5 className="mb-3">Customer</h5>

                <Form.Group className="mb-3">
                  <Form.Label>Customer Name</Form.Label>
                  <Form.Control
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Customer Phone</Form.Label>
                  <Form.Control
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Email (optional)</Form.Label>
                  <Form.Control
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Staff Name</Form.Label>
                  <Form.Control
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Deposit Paid</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    step="0.01"
                    value={depositPaid}
                    onChange={(e) => setDepositPaid(Number(e.target.value))}
                  />
                  <Form.Text className="text-muted">
                    Balance updates automatically.
                  </Form.Text>
                </Form.Group>

                {/* NEW: Notes */}
                <Form.Group className="mb-3">
                  <Form.Label>Notes (optional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Daughter is collecting, deposit to be paid 18/12, etc."
                  />
                </Form.Group>
              </Card.Body>
            </Card>
          </Col>

          {/* Right: Items */}
          <Col md={6}>
            <Card className="mb-3">
              <Card.Body>
                <h5 className="mb-3">Items</h5>

                {items.length === 0 && (
                  <div className="text-muted mb-2">No items in this order.</div>
                )}

                {items.map((line) => {
                  const p = byId.get(line.id);
                  const price = p?.price ?? 0;
                  const name = p?.name ?? `Item #${line.id} (inactive)`;
                  const lineTotal = price * line.quantity;

                  return (
                    <div
                      key={line.id}
                      className="d-flex align-items-center justify-content-between mb-2"
                    >
                      <div>
                        <div>{name}</div>
                        <div
                          className="text-muted"
                          style={{ fontSize: ".9rem" }}
                        >
                          {formatCurrency(price)} ×
                        </div>
                      </div>

                      <div className="d-flex align-items-center gap-2">
                        <Form.Control
                          type="number"
                          min={0}
                          value={line.quantity}
                          onChange={(e) =>
                            updateQty(
                              line.id,
                              Number((e.target as HTMLInputElement).value)
                            )
                          }
                          style={{ width: "6rem" }}
                        />
                        <div style={{ width: "7rem", textAlign: "right" }}>
                          {formatCurrency(lineTotal)}
                        </div>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => removeLine(line.id)}
                          title="Remove line"
                        >
                          ✕
                        </Button>
                      </div>
                    </div>
                  );
                })}

                <hr />

                {/* Add new item */}
                <div className="d-flex align-items-center gap-2">
                  <InputGroup>
                    <Form.Select
                      value={addProductId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAddProductId(val === "" ? "" : Number(val));
                      }}
                    >
                      <option value="">Select product…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatCurrency(p.price)}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Control
                      type="number"
                      min={1}
                      value={addQty}
                      onChange={(e) =>
                        setAddQty(Math.max(1, Number(e.target.value)))
                      }
                      style={{ maxWidth: "7rem" }}
                    />
                    <Button
                      variant="success"
                      onClick={addLine}
                      disabled={addProductId === "" || addQty <= 0}
                    >
                      Add
                    </Button>
                  </InputGroup>
                </div>
              </Card.Body>
            </Card>

            {/* Totals */}
            <Card>
              <Card.Body>
                <div className="d-flex justify-content-between">
                  <span className="fw-bold">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>Deposit</span>
                  <span>{formatCurrency(Number(depositPaid) || 0)}</span>
                </div>
                <div className="d-flex justify-content-between fw-bold fs-5">
                  <span>Balance</span>
                  <span>{formatCurrency(balance)}</span>
                </div>
              </Card.Body>
            </Card>

            <div className="d-flex justify-content-end mt-3">
              <Button onClick={handleSave} disabled={saving} variant="success">
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </Col>
        </Row>
      </Container>
    </>
  );
}

// src/pages/EditOrder.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Col,
  Container,
  Form,
  InputGroup,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { useProducts } from "../hooks/useProducts";
import { formatCurrency } from "../utilities/formatCurrency";

// ⬇️ Legacy fallback for items not present in Supabase products
import legacyItems from "../data/items.json";

// Types that match your orders table
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
  is_complete: boolean;
  notes?: string | null;
  order_code?: string | null;
};

type EditableLine = { id: number; quantity: number };

export default function EditOrder() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Products from Supabase
  const { products, byId, loading: loadingProducts, errorMsg: productsError } = useProducts();

  // Order state
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderRow | null>(null);

  // Editable fields
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [staffName, setStaffName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [depositPaid, setDepositPaid] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");

  // Add-item controls
  const [addProductId, setAddProductId] = useState<number | "">("");
  const [addQty, setAddQty] = useState<number>(1);

  // Load order
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
        setErrorMsg("Failed to load order.");
        setOrder(null);
      } else {
        const row = {
          ...data,
          items: Array.isArray(data.items) ? data.items : [],
        } as OrderRow;

        setOrder(row);
        setLines(row.items.map((x) => ({ id: x.id, quantity: x.quantity })));
        setStaffName(row.staff_name || "");
        setCustomerName(row.customer_name || "");
        setCustomerEmail(row.customer_email || "");
        setCustomerPhone(row.customer_phone || "");
        setDepositPaid(String(row.deposit_paid ?? 0));
        setNotes(row.notes ?? "");
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Lookup name/price with Supabase → fallback to legacy JSON
  const legacyById = useMemo(() => {
    const m = new Map<number, { name: string; price: number }>();
    (legacyItems as any[]).forEach((it: any) => {
      if (typeof it?.id === "number") m.set(it.id, { name: it.name, price: it.price });
    });
    return m;
  }, []);

  function getName(id: number) {
    return byId.get(id)?.name ?? legacyById.get(id)?.name ?? `Item #${id}`;
  }
  function getPrice(id: number) {
    return byId.get(id)?.price ?? legacyById.get(id)?.price ?? 0;
  }

  // Derived totals
  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + getPrice(l.id) * Math.max(0, l.quantity), 0),
    [lines, byId, legacyById]
  );
  const deposit = useMemo(() => Math.max(0, Number(depositPaid) || 0), [depositPaid]);
  const balance = useMemo(() => Math.max(0, subtotal - deposit), [subtotal, deposit]);

  // Mutations on lines
  const inc = (pid: number) =>
    setLines((prev) =>
      prev.map((l) => (l.id === pid ? { ...l, quantity: l.quantity + 1 } : l))
    );
  const dec = (pid: number) =>
    setLines((prev) =>
      prev
        .map((l) => (l.id === pid ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0)
    );
  const remove = (pid: number) => setLines((prev) => prev.filter((l) => l.id !== pid));

  const addLine = () => {
    const pid = Number(addProductId);
    if (!pid || isNaN(pid)) return;
    if (addQty <= 0) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.id === pid);
      if (existing) {
        return prev.map((l) => (l.id === pid ? { ...l, quantity: l.quantity + addQty } : l));
      }
      return [...prev, { id: pid, quantity: addQty }];
    });
    setAddProductId("");
    setAddQty(1);
  };

  // Save
  const handleSave = async () => {
    if (!order) return;
    const { error } = await supabase
      .from("orders")
      .update({
        staff_name: staffName.trim(),
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim() || null,
        customer_phone: customerPhone.trim(),
        deposit_paid: deposit,
        items: lines,
        subtotal,
        balance,
        notes: notes.trim() || null,
      })
      .eq("id", order.id);

    if (error) {
      alert("Failed to save order.");
      return;
    }
    navigate("/history");
  };

  // Delete (kept here; removed from History as requested)
  const handleDelete = async () => {
    if (!order) return;
    const ok = confirm("Delete this order? This cannot be undone.");
    if (!ok) return;
    const { error } = await supabase.from("orders").delete().eq("id", order.id);
    if (error) {
      alert("Failed to delete order.");
      return;
    }
    navigate("/history");
  };

  return (
    <>
      <Navbar />
      <Container className="my-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="mb-0">Edit Order</h2>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" as={Link} to="/history">
              Back to History
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
        {!loading && !order && !errorMsg && <Alert variant="warning">Order not found.</Alert>}

        {!loading && order && (
          <Row className="g-4">
            <Col lg={7}>
              <Card className="shadow-sm">
                <Card.Header>Items</Card.Header>
                <Card.Body>
                  <Table hover responsive>
                    <thead>
                      <tr>
                        <th style={{ width: 90 }}>ID</th>
                        <th>Product</th>
                        <th style={{ width: 120, textAlign: "right" }}>Price</th>
                        <th style={{ width: 160, textAlign: "center" }}>Quantity</th>
                        <th style={{ width: 120, textAlign: "right" }}>Line Total</th>
                        <th style={{ width: 80 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => {
                        const name = getName(l.id);
                        const price = getPrice(l.id);
                        return (
                          <tr key={l.id}>
                            <td>{l.id}</td>
                            <td>{name}</td>
                            <td style={{ textAlign: "right" }}>
                              {price ? formatCurrency(price) : "—"}
                            </td>
                            <td>
                              <div className="d-flex justify-content-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  onClick={() => dec(l.id)}
                                >
                                  −
                                </Button>
                                <Form.Control
                                  value={l.quantity}
                                  onChange={(e) => {
                                    const n = Number(e.target.value);
                                    if (!Number.isFinite(n) || n < 0) return;
                                    setLines((prev) =>
                                      prev.map((x) =>
                                        x.id === l.id ? { ...x, quantity: n } : x
                                      )
                                    );
                                  }}
                                  style={{ width: 64, textAlign: "center" }}
                                />
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  onClick={() => inc(l.id)}
                                >
                                  +
                                </Button>
                              </div>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              {price ? formatCurrency(price * l.quantity) : "—"}
                            </td>
                            <td>
                              <Button variant="outline-danger" size="sm" onClick={() => remove(l.id)}>
                                Remove
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {lines.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center text-muted">
                            No items in this order.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>

                  <Row className="g-2 align-items-end">
                    <Col md={6}>
                      <Form.Label>Add Product</Form.Label>
                      <Form.Select
                        value={addProductId}
                        onChange={(e) => setAddProductId(Number(e.target.value) || "")}
                      >
                        <option value="">Select a product…</option>
                        {/* Active Supabase products first */}
                        {products.map((p) => (
                          <option key={`p-${p.id}`} value={p.id}>
                            #{p.id} — {p.name} ({formatCurrency(p.price)})
                          </option>
                        ))}
                        {/* Legacy fallback items (only those not in products) */}
                        {Array.from(
                          new Map(
                            (legacyItems as any[]).map((it: any) => [it.id, it])
                          ).values()
                        )
                          .filter((it: any) => !byId.get(it.id))
                          .map((it: any) => (
                            <option key={`l-${it.id}`} value={it.id}>
                              #{it.id} — {it.name} (legacy {formatCurrency(it.price)})
                            </option>
                          ))}
                      </Form.Select>
                    </Col>
                    <Col md="auto">
                      <Form.Label>Qty</Form.Label>
                      <Form.Control
                        type="number"
                        min={1}
                        step={1}
                        value={addQty}
                        onChange={(e) => setAddQty(Math.max(1, Number(e.target.value) || 1))}
                        style={{ width: 100 }}
                      />
                    </Col>
                    <Col md="auto">
                      <Button onClick={addLine}>Add</Button>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={5}>
              <Card className="shadow-sm mb-3">
                <Card.Header>Customer & Staff</Card.Header>
                <Card.Body>
                  <Row className="g-3">
                    <Col md={6}>
                      <Form.Label>Customer Name</Form.Label>
                      <Form.Control
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </Col>
                    <Col md={6}>
                      <Form.Label>Staff Name</Form.Label>
                      <Form.Control
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                      />
                    </Col>
                    <Col md={6}>
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        value={customerEmail ?? ""}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                      />
                    </Col>
                    <Col md={6}>
                      <Form.Label>Phone</Form.Label>
                      <Form.Control
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                      />
                    </Col>
                    <Col md={6}>
                      <Form.Label>Deposit Paid</Form.Label>
                      <InputGroup>
                        <InputGroup.Text>€</InputGroup.Text>
                        <Form.Control
                          type="number"
                          min={0}
                          step="0.01"
                          value={depositPaid}
                          onChange={(e) => setDepositPaid(e.target.value)}
                        />
                      </InputGroup>
                    </Col>
                    <Col md={12}>
                      <Form.Label>Notes</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Customer-specific instructions…"
                      />
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              <Card className="shadow-sm">
                <Card.Header>Totals</Card.Header>
                <Card.Body>
                  <div className="d-flex justify-content-between">
                    <span>Subtotal</span>
                    <strong>{formatCurrency(subtotal)}</strong>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span>Deposit</span>
                    <strong>{formatCurrency(deposit)}</strong>
                  </div>
                  <div className="d-flex justify-content-between fs-5 mt-2">
                    <span>Balance</span>
                    <strong>{formatCurrency(balance)}</strong>
                  </div>
                  <div className="d-flex justify-content-end gap-2 mt-3">
                    <Button variant="outline-danger" onClick={handleDelete}>
                      Delete Order
                    </Button>
                    <Button variant="primary" onClick={handleSave}>
                      Save Changes
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}
      </Container>
    </>
  );
}

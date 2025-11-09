import { useEffect, useMemo, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Spinner,
  Alert,
  InputGroup,
} from "react-bootstrap";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { useProducts } from "../hooks/useProducts";

type OrderRow = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  staff_name: string | null;
  deposit_paid: number | null;
  items: { id: number; quantity: number }[]; // normalized
  notes: string | null;
  created_at: string;
  is_complete: boolean | null;
};

export default function EditOrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { byId, loading: loadingProducts, errorMsg: prodError } = useProducts();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderRow | null>(null);

  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    staff_name: "",
    deposit_paid: "",
    notes: "",
    is_complete: false,
  });

  // Utility to ensure items array
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

      if (error || !data) {
        setErrorMsg("Failed to load order.");
        setLoading(false);
        return;
      }
      if (!mounted) return;

      const items = normalizeItems((data as any).items);
      const row: OrderRow = {
        id: data.id,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        staff_name: data.staff_name,
        deposit_paid: data.deposit_paid,
        items,
        notes: data.notes,
        created_at: data.created_at,
        is_complete: !!data.is_complete,
      };
      setOrder(row);
      setForm({
        customer_name: row.customer_name || "",
        customer_email: row.customer_email || "",
        customer_phone: row.customer_phone || "",
        staff_name: row.staff_name || "",
        deposit_paid: row.deposit_paid != null ? String(row.deposit_paid) : "",
        notes: row.notes || "",
        is_complete: row.is_complete || false,
      });
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Quantity adjust
  const inc = (pid: number) => {
    if (!order) return;
    const items = order.items.slice();
    const idx = items.findIndex((x) => x.id === pid);
    if (idx === -1) items.push({ id: pid, quantity: 1 });
    else items[idx] = { ...items[idx], quantity: items[idx].quantity + 1 };
    setOrder({ ...order, items });
  };
  const dec = (pid: number) => {
    if (!order) return;
    const items = order.items
      .map((x) => (x.id === pid ? { ...x, quantity: x.quantity - 1 } : x))
      .filter((x) => x.quantity > 0);
    setOrder({ ...order, items });
  };
  const removeLine = (pid: number) => {
    if (!order) return;
    setOrder({ ...order, items: order.items.filter((x) => x.id !== pid) });
  };

  // Add new item by selecting a product id
  const [productSearch, setProductSearch] = useState("");
  const productOptions = useMemo(() => {
    const needle = productSearch.trim().toLowerCase();
    const opts: { id: number; name: string }[] = [];
    byId.forEach((p, id) => {
      if (!needle || p.name.toLowerCase().includes(needle)) {
        opts.push({ id, name: p.name });
      }
    });
    return opts.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 100);
  }, [byId, productSearch]);

  const addProductToOrder = (pid: number) => {
    if (!order) return;
    const items = order.items.slice();
    const idx = items.findIndex((x) => x.id === pid);
    if (idx === -1) items.push({ id: pid, quantity: 1 });
    else items[idx] = { ...items[idx], quantity: items[idx].quantity + 1 };
    setOrder({ ...order, items });
    setProductSearch("");
  };

  // Save (recompute subtotal server-side quietly, but do not display prices)
  const handleSave = async () => {
    if (!order) return;

    // Compute subtotal quietly (using current product prices)
    let subtotal = 0;
    for (const line of order.items) {
      const p = byId.get(line.id);
      const unit = p?.price ?? 0;
      subtotal += unit * line.quantity;
    }

    const depositNum = Number(form.deposit_paid || 0);
    const balance = Math.max(0, subtotal - (isNaN(depositNum) ? 0 : depositNum));

    const { error } = await supabase
      .from("orders")
      .update({
        customer_name: form.customer_name.trim() || null,
        customer_email: form.customer_email.trim() || null,
        customer_phone: form.customer_phone.trim() || null,
        staff_name: form.staff_name.trim() || null,
        deposit_paid: isNaN(depositNum) ? 0 : depositNum,
        items: order.items, // jsonb
        notes: form.notes.trim() || null,
        is_complete: form.is_complete,
        // keep totals consistent (not displayed on UI)
        subtotal,
        balance,
      })
      .eq("id", order.id);

    if (error) {
      console.error(error);
      alert("Failed to save order.");
      return;
    }
    navigate("/history");
  };

  if (loading || loadingProducts) {
    return (
      <>
        <Navbar />
        <Container className="my-4">
          <Spinner animation="border" size="sm" /> Loading…
        </Container>
      </>
    );
  }

  if (errorMsg || prodError) {
    return (
      <>
        <Navbar />
        <Container className="my-4">
          <Alert variant="danger">{errorMsg || prodError}</Alert>
        </Container>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <Navbar />
        <Container className="my-4">
          <Alert variant="warning">Order not found.</Alert>
        </Container>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <Container className="my-4">
        <Row className="g-4">
          {/* Left: customer details (no price fields) */}
          <Col md={6}>
            <Card>
              <Card.Header>Customer</Card.Header>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    value={form.customer_name}
                    onChange={(e) => setForm((s) => ({ ...s, customer_name: e.target.value }))}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={form.customer_email}
                    onChange={(e) => setForm((s) => ({ ...s, customer_email: e.target.value }))}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Phone</Form.Label>
                  <Form.Control
                    value={form.customer_phone}
                    onChange={(e) => setForm((s) => ({ ...s, customer_phone: e.target.value }))}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Staff</Form.Label>
                  <Form.Control
                    value={form.staff_name}
                    onChange={(e) => setForm((s) => ({ ...s, staff_name: e.target.value }))}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Deposit Paid</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.deposit_paid}
                    onChange={(e) => setForm((s) => ({ ...s, deposit_paid: e.target.value }))}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Notes</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                  />
                </Form.Group>

                <Form.Check
                  id="complete"
                  type="switch"
                  className="mt-3"
                  label="Mark as complete"
                  checked={form.is_complete}
                  onChange={(e) => setForm((s) => ({ ...s, is_complete: e.currentTarget.checked }))}
                />
              </Card.Body>
            </Card>
          </Col>

          {/* Right: items (no price columns) */}
          <Col md={6}>
            <Card>
              <Card.Header>Items</Card.Header>
              <Card.Body>
                {order.items.length === 0 && <div className="text-muted">No items yet.</div>}

                {order.items.map((line) => {
                  const p = byId.get(line.id);
                  return (
                    <div
                      key={line.id}
                      className="d-flex align-items-center justify-content-between mb-2"
                    >
                      <div className="me-2">
                        <div className="fw-semibold">{p?.name ?? `Item #${line.id}`}</div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <Button size="sm" variant="outline-secondary" onClick={() => dec(line.id)}>
                          −
                        </Button>
                        <span style={{ minWidth: 24, textAlign: "center" }}>{line.quantity}</span>
                        <Button size="sm" variant="outline-secondary" onClick={() => inc(line.id)}>
                          +
                        </Button>
                        <Button size="sm" variant="outline-danger" onClick={() => removeLine(line.id)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}

                <hr />

                {/* Add-by-search */}
                <InputGroup>
                  <Form.Control
                    placeholder="Search products to add…"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  <Button
                    variant="outline-secondary"
                    onClick={() => {
                      // if exact name match, add first result
                      if (productOptions.length > 0) addProductToOrder(productOptions[0].id);
                    }}
                  >
                    Add first match
                  </Button>
                </InputGroup>

                {productSearch && (
                  <div className="border rounded p-2 mt-2" style={{ maxHeight: 240, overflow: "auto" }}>
                    {productOptions.length === 0 ? (
                      <div className="text-muted">No matches.</div>
                    ) : (
                      productOptions.map((opt) => (
                        <Button
                          key={opt.id}
                          variant="light"
                          size="sm"
                          className="w-100 text-start mb-1"
                          onClick={() => addProductToOrder(opt.id)}
                        >
                          {opt.name}
                        </Button>
                      ))
                    )}
                  </div>
                )}
              </Card.Body>
              <Card.Footer className="bg-white">
                <div className="d-flex justify-content-end gap-2">
                  <Button variant="outline-secondary" onClick={() => navigate(-1)}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleSave}>
                    Save changes
                  </Button>
                </div>
              </Card.Footer>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}

import { useState } from "react";
import {
  Button,
  Col,
  Container,
  Form,
  Row,
  Alert,
  Spinner,
  Modal,
  ButtonGroup,
} from "react-bootstrap";
import Navbar from "../components/Navbar";
import { useProducts } from "../hooks/useProducts";
import { supabase } from "../lib/supabase";
import ProductCard from "../components/ProductCard";

export default function Home() {
  const { products, loading, errorMsg, refresh } = useProducts();

  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", price: "" });

  const resetForm = () => setNewItem({ name: "", price: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newItem.name.trim();
    const price = Number(newItem.price);

    if (!name) {
      alert("Please enter a product name.");
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      alert("Enter a valid non-negative price.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("products")
      .insert({ name, price, description: null, active: true });

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Failed to add product.");
      return;
    }

    // Close and reset. Realtime will add it automatically; refresh is optional.
    setShowAdd(false);
    resetForm();
    // await refresh();
  };

  return (
    <>
      <Navbar />

      <Container className="my-4">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
          <h2 className="mb-0">New Order</h2>
          <ButtonGroup>
            <Button onClick={() => setShowAdd(true)} variant="primary">
              + Add Item
            </Button>
            <Button onClick={refresh} variant="outline-secondary">
              Refresh
            </Button>
          </ButtonGroup>
        </div>

        {loading && (
          <div className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" /> Loading…
          </div>
        )}

        {errorMsg && <Alert variant="danger">{errorMsg}</Alert>}

        {!loading && !errorMsg && products.length === 0 && (
          <Alert variant="info">
            No products yet. Click <strong>+ Add Item</strong> to create your first product.
          </Alert>
        )}

        <Row xs={1} sm={2} md={3} lg={4} xl={5} className="g-3">
          {products.map((p) => (
            <Col key={p.id}>
              <ProductCard
                id={p.id}
                name={p.name}
                price={p.price}
                description={(p as any).description ?? undefined}
              />
            </Col>
          ))}
        </Row>
      </Container>

      {/* Add Item Modal */}
      <Modal show={showAdd} onHide={() => !saving && setShowAdd(false)}>
        <Form onSubmit={handleCreate}>
          <Modal.Header closeButton={!saving}>
            <Modal.Title>Add Item</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                value={newItem.name}
                onChange={(e) => setNewItem((s) => ({ ...s, name: e.target.value }))}
                placeholder="e.g. Ribeye steak"
                required
                disabled={saving}
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Price</Form.Label>
              <Form.Control
                type="number"
                min={0}
                step="0.01"
                value={newItem.price}
                onChange={(e) => setNewItem((s) => ({ ...s, price: e.target.value }))}
                placeholder="e.g. 12.99"
                required
                disabled={saving}
              />
            </Form.Group>
          </Modal.Body>

          <Modal.Footer>
            <Button
              variant="outline-secondary"
              onClick={() => !saving && setShowAdd(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}

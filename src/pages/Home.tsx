// src/pages/Home.tsx
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Container,
  Form,
  Row,
  Alert,
  Spinner,
  Modal,
  Accordion,
  InputGroup,
} from "react-bootstrap";
import Navbar from "../components/Navbar";
import { useProducts } from "../hooks/useProducts";
import { useOrder } from "../context/OrderContext";
import { supabase } from "../lib/supabase";
import { formatCurrency } from "../utilities/formatCurrency";

export default function Home() {
  const { products, loading, errorMsg, refresh } = useProducts();
  const { increaseOrderQuantity } = useOrder();

  // Add-product modal state
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    price: "",
    description: "",
  });

  // Category selection
  const [categoryChoice, setCategoryChoice] = useState<string>(""); // chosen existing OR "NEW"
  const [newCategory, setNewCategory] = useState<string>("");

  // Optional search to filter categories/products
  const [q, setQ] = useState("");

  // Distinct category list (sorted, '' => Uncategorized)
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      set.add(p.category?.trim() || "Uncategorized");
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  // Map of category -> product[]
  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const map = new Map<string, typeof products>();
    for (const p of products) {
      const cat = p.category?.trim() || "Uncategorized";
      if (
        !needle ||
        p.name.toLowerCase().includes(needle) ||
        cat.toLowerCase().includes(needle)
      ) {
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat)!.push(p);
      }
    }
    // sort products by name within each category
    for (const [k, arr] of map) {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    }
    // return entries sorted by category name
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products, q]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const price = Number(newItem.price);
    if (!newItem.name.trim() || isNaN(price) || price < 0) {
      alert("Enter a valid name and non-negative price.");
      return;
    }

    // Resolve category: pick existing or new text
    let categoryToUse = "";
    if (categoryChoice === "NEW") {
      categoryToUse = newCategory.trim();
    } else if (categoryChoice) {
      categoryToUse = categoryChoice.trim();
    }
    // empty string means "Uncategorized"

    const { error } = await supabase.from("products").insert({
      name: newItem.name.trim(),
      price,
      description: newItem.description.trim() || null,
      active: true,
      category: categoryToUse || null, // store null for uncategorized
    });

    if (error) {
      console.error(error);
      alert("Failed to add product.");
      return;
    }

    setShowAdd(false);
    setNewItem({ name: "", price: "", description: "" });
    setCategoryChoice("");
    setNewCategory("");
    await refresh(); // ensure fresh list
  };

  return (
    <>
      <Navbar />
      <Container className="my-4">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
          <h2 className="mb-0">New Order</h2>
          <div className="d-flex gap-2">
            <InputGroup style={{ maxWidth: 320 }}>
              <InputGroup.Text>Search</InputGroup.Text>
              <Form.Control
                placeholder="Category or product…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </InputGroup>
            <Button onClick={() => setShowAdd(true)} variant="primary">
              + Add Item
            </Button>
          </div>
        </div>

        {loading && (
          <div className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" /> Loading…
          </div>
        )}
        {errorMsg && <Alert variant="danger">{errorMsg}</Alert>}

        {/* Collapsible categories */}
        {!loading && !errorMsg && (
          <Accordion alwaysOpen>
            {grouped.map(([cat, items], idx) => (
              <Accordion.Item eventKey={String(idx)} key={cat}>
                <Accordion.Header>
                  <div className="d-flex justify-content-between w-100 pe-2">
                    <span className="fw-semibold">
                      {cat}{" "}
                      <span className="text-muted" style={{ fontSize: ".9rem" }}>
                        ({items.length})
                      </span>
                    </span>
                  </div>
                </Accordion.Header>
                <Accordion.Body>
                  <Row xs={1} sm={2} md={3} lg={4} xl={5} className="g-3">
                    {items.map((p) => (
                      <Col key={p.id}>
                        <Card className="h-100">
                          <Card.Body>
                            <Card.Title className="d-flex justify-content-between align-items-start">
                              <span>{p.name}</span>
                              <span className="fw-bold">{formatCurrency(p.price)}</span>
                            </Card.Title>
                            {p.description && (
                              <Card.Text className="text-muted" style={{ fontSize: ".9rem" }}>
                                {p.description}
                              </Card.Text>
                            )}
                          </Card.Body>
                          <Card.Footer className="bg-white border-0">
                            <Button
                              className="w-100"
                              variant="success"
                              onClick={() => increaseOrderQuantity(p.id)}
                            >
                              Add to Cart
                            </Button>
                          </Card.Footer>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </Accordion.Body>
              </Accordion.Item>
            ))}
            {grouped.length === 0 && (
              <div className="text-muted">No products match your search.</div>
            )}
          </Accordion>
        )}
      </Container>

      {/* Add Item Modal */}
      <Modal show={showAdd} onHide={() => setShowAdd(false)}>
        <Form onSubmit={handleCreate}>
          <Modal.Header closeButton>
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
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Price</Form.Label>
              <Form.Control
                type="number"
                min={0}
                step="0.01"
                value={newItem.price}
                onChange={(e) => setNewItem((s) => ({ ...s, price: e.target.value }))}
                placeholder="e.g. 12.99"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description (optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={newItem.description}
                onChange={(e) => setNewItem((s) => ({ ...s, description: e.target.value }))}
                placeholder="Short description"
              />
            </Form.Group>

            {/* Category selection */}
            <Form.Group className="mb-2">
              <Form.Label>Category</Form.Label>
              <Form.Select
                value={categoryChoice}
                onChange={(e) => setCategoryChoice(e.target.value)}
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="NEW">➕ Create new category…</option>
              </Form.Select>
            </Form.Group>

            {categoryChoice === "NEW" && (
              <Form.Group>
                <Form.Label>New Category Name</Form.Label>
                <Form.Control
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Poultry, Beef, Pork"
                  required
                />
              </Form.Group>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}

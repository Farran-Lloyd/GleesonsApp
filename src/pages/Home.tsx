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
  InputGroup,
  Dropdown,
  ButtonGroup,
} from "react-bootstrap";
import Navbar from "../components/Navbar";
import { useProducts } from "../hooks/useProducts";
import { useOrder } from "../context/OrderContext";
import { supabase } from "../lib/supabase";
import { formatCurrency } from "../utilities/formatCurrency";

type EditProduct = {
  id: number;
  name: string;
  price: string; // keep as string for input
  description: string | null;
  category: string | null;
  active: boolean;
  archived?: boolean | null;
};

export default function Home() {
  const { products, loading, errorMsg } = useProducts();
  const { increaseOrderQuantity } = useOrder();

  // UI state
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", price: "", description: "", category: "" });

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<EditProduct | null>(null);

  // Delete confirm
  const [showDelete, setShowDelete] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Group by category (hide Uncategorized by default? keep visible here)
  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const map = new Map<string, typeof products>();
    for (const p of products) {
      const cat = p.category?.trim() || "Uncategorized";
      const hits = !needle || p.name.toLowerCase().includes(needle) || cat.toLowerCase().includes(needle);
      if (!hits) continue;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    for (const [, arr] of map) arr.sort((a, b) => a.name.localeCompare(b.name));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products, q]);

  // Create Product
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(newItem.price);
    if (!newItem.name.trim() || isNaN(price) || price < 0) {
      alert("Enter a valid name and non-negative price.");
      return;
    }
    const { error } = await supabase.from("products").insert({
      name: newItem.name.trim(),
      price,
      description: newItem.description?.trim() || null,
      category: newItem.category?.trim() || null,
      active: true,
      archived: false,
    });
    if (error) {
      console.error(error);
      alert("Failed to add product.");
      return;
    }
    setShowAdd(false);
    setNewItem({ name: "", price: "", description: "", category: "" });
    // Realtime will update the list
  };

  // Open Edit
  const openEdit = (p: any) => {
    setEditing({
      id: p.id,
      name: p.name ?? "",
      price: String(p.price ?? ""),
      description: p.description ?? "",
      category: p.category ?? "",
      active: Boolean(p.active),
      archived: Boolean(p.archived),
    });
    setShowEdit(true);
  };

  // Save Edit
  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const priceNum = Number(editing.price);
    if (!editing.name.trim() || isNaN(priceNum) || priceNum < 0) {
      alert("Enter a valid name and non-negative price.");
      return;
    }
    const { error } = await supabase
      .from("products")
      .update({
        name: editing.name.trim(),
        price: priceNum,
        description: editing.description?.trim() || null,
        category: editing.category?.trim() || null,
        active: editing.active,
        archived: editing.archived ?? false,
      })
      .eq("id", editing.id);
    if (error) {
      console.error(error);
      alert("Failed to update product.");
      return;
    }
    setShowEdit(false);
    setEditing(null);
  };

  // Delete Product
  const confirmDelete = (id: number) => {
    setDeletingId(id);
    setShowDelete(true);
  };
  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from("products").delete().eq("id", deletingId);
    if (error) {
      console.error(error);
      alert("Failed to delete product.");
    }
    setShowDelete(false);
    setDeletingId(null);
  };

  return (
    <>
      <Navbar />
      <Container className="my-4">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h2 className="mb-0">New Order</h2>
          <div className="d-flex gap-2">
            <InputGroup>
              <InputGroup.Text>Search</InputGroup.Text>
              <Form.Control
                placeholder="Product or category…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ maxWidth: 280 }}
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

        {!loading && grouped.length === 0 && (
          <Alert variant="info">No products found. Try adding one.</Alert>
        )}

        {!loading &&
          grouped.map(([cat, arr]) => (
            <div key={cat} className="mb-4">
              <h5 className="mb-3">{cat}</h5>
              <Row xs={1} sm={2} md={3} lg={4} xl={5} className="g-3">
                {arr.map((p) => (
                  <Col key={p.id}>
                    <Card className="h-100">
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-start">
                          <Card.Title className="me-2">{p.name}</Card.Title>
                          <Dropdown as={ButtonGroup} align="end">
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => increaseOrderQuantity(p.id)}
                            >
                              Add
                            </Button>
                            <Dropdown.Toggle split size="sm" variant="outline-secondary" />
                            <Dropdown.Menu>
                              <Dropdown.Item onClick={() => openEdit(p)}>Edit</Dropdown.Item>
                              <Dropdown.Item onClick={() => confirmDelete(p.id)} className="text-danger">
                                Delete…
                              </Dropdown.Item>
                            </Dropdown.Menu>
                          </Dropdown>
                        </div>

                        {p.description && (
                          <Card.Text className="text-muted" style={{ fontSize: ".9rem" }}>
                            {p.description}
                          </Card.Text>
                        )}
                      </Card.Body>
                      <Card.Footer className="bg-white border-0 d-flex justify-content-between">
                        <small className="text-muted">
                          {p.category || "—"}
                          {p.archived ? " • archived" : ""}
                          {!p.active ? " • inactive" : ""}
                        </small>
                        <small className="text-muted">{p.price ? formatCurrency(p.price) : "—"}</small>
                      </Card.Footer>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          ))}
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
              <Form.Label>Category</Form.Label>
              <Form.Control
                value={newItem.category}
                onChange={(e) => setNewItem((s) => ({ ...s, category: e.target.value }))}
                placeholder="e.g. Beef"
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={newItem.description}
                onChange={(e) => setNewItem((s) => ({ ...s, description: e.target.value }))}
                placeholder="Optional"
              />
            </Form.Group>
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

      {/* Edit Item Modal */}
      <Modal show={showEdit} onHide={() => setShowEdit(false)}>
        <Form onSubmit={handleEditSave}>
          <Modal.Header closeButton>
            <Modal.Title>Edit Item</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                value={editing?.name ?? ""}
                onChange={(e) => setEditing((s) => (s ? { ...s, name: e.target.value } : s))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Price</Form.Label>
              <Form.Control
                type="number"
                min={0}
                step="0.01"
                value={editing?.price ?? ""}
                onChange={(e) => setEditing((s) => (s ? { ...s, price: e.target.value } : s))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Category</Form.Label>
              <Form.Control
                value={editing?.category ?? ""}
                onChange={(e) => setEditing((s) => (s ? { ...s, category: e.target.value } : s))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={editing?.description ?? ""}
                onChange={(e) => setEditing((s) => (s ? { ...s, description: e.target.value } : s))}
              />
            </Form.Group>
            <Form.Check
              type="switch"
              id="edit-active"
              label="Active"
              checked={!!editing?.active}
              onChange={(e) => setEditing((s) => (s ? { ...s, active: e.currentTarget.checked } : s))}
              className="mb-2"
            />
            <Form.Check
              type="switch"
              id="edit-archived"
              label="Archived (hide from new orders)"
              checked={!!editing?.archived}
              onChange={(e) => setEditing((s) => (s ? { ...s, archived: e.currentTarget.checked } : s))}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save changes
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Delete confirm */}
      <Modal show={showDelete} onHide={() => setShowDelete(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Delete product</Modal.Title>
        </Modal.Header>
        <Modal.Body>Are you sure you want to permanently delete this item?</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

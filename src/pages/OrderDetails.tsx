import { FormEvent, useState } from "react";
import { Button, Form, Container, Row, Col, Card } from "react-bootstrap";
import { useOrder } from "../context/OrderContext";
import { formatCurrency } from "../utilities/formatCurrency";
import { useProducts } from "../hooks/useProducts"; // use live products for pricing

export default function OrderDetails() {
  const { orderItems, submitOrder } = useOrder();
  const { byId } = useProducts(); // Map of productId -> product (with price/name)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    staffName: "",
    depositPaid: 0,
  });
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.phone || !formData.staffName) {
      alert("Please fill in customer name, phone and staff name.");
      return;
    }

    await submitOrder(
      {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone,
        staffName: formData.staffName,
        depositPaid: Number(formData.depositPaid) || 0,
      },
      subtotal,
      notes
    );
  };

  const subtotal = orderItems.reduce((total, orderItem) => {
    const product = byId.get(orderItem.id);
    return total + (product?.price || 0) * orderItem.quantity;
  }, 0);

  return (
    <Container className="my-5">
      <Row>
        {/* 🧾 Left side: Customer info form */}
        <Col md={6}>
          <h2 className="mb-4">Customer Information</h2>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="formName">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter customer name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formPhone">
              <Form.Label>Phone</Form.Label>
              <Form.Control
                type="tel"
                placeholder="Enter customer phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formEmail">
              <Form.Label>Email (optional)</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formStaff">
              <Form.Label>Staff Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter staff member"
                value={formData.staffName}
                onChange={(e) =>
                  setFormData({ ...formData, staffName: e.target.value })
                }
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formDeposit">
              <Form.Label>Deposit Paid</Form.Label>
              <Form.Control
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={formData.depositPaid}
                onChange={(e) =>
                  setFormData({ ...formData, depositPaid: Number(e.target.value) })
                }
              />
            </Form.Group>

            {/* NEW: Notes */}
            <Form.Group className="mb-3" controlId="formNotes">
              <Form.Label>Notes (optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="e.g. Daughter is collecting, deposit to be paid 18/12, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Form.Group>

            <Button
              type="submit"
              variant="success"
              className="w-100"
              disabled={orderItems.length === 0}
            >
              Confirm Order
            </Button>
          </Form>
        </Col>

        {/* 🛒 Right side: Cart summary */}
        <Col md={6}>
          <h2 className="mb-4">Order Summary</h2>
          <Card>
            <Card.Body>
              {orderItems.length === 0 ? (
                <p>Your cart is empty.</p>
              ) : (
                <>
                  {orderItems.map((orderItem) => {
                    const product = byId.get(orderItem.id);
                    if (!product) return null;
                    return (
                      <div
                        key={product.id}
                        className="d-flex justify-content-between mb-2"
                      >
                        <div>
                          <div>{product.name}</div>
                          <div className="text-muted" style={{ fontSize: ".9rem" }}>
                            {orderItem.quantity} × {formatCurrency(product.price)}
                          </div>
                        </div>
                        <div>
                          {formatCurrency(product.price * orderItem.quantity)}
                        </div>
                      </div>
                    );
                  })}
                  <hr />
                  <div className="d-flex justify-content-between fw-bold fs-5">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

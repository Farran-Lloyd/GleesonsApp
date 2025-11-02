import { Card, Button, ButtonGroup } from "react-bootstrap";
import { formatCurrency } from "../utilities/formatCurrency";
import { useOrder } from "../context/OrderContext";

type Product = {
  id: number;
  name: string;
  price: number;
  description?: string | null;
};

export default function ProductCard({ id, name, price, description }: Product) {
  const { increaseOrderQuantity, decreseOrderQuantity, getItemQuantity } = useOrder();
  const qty = getItemQuantity(id);

  return (
    <Card className="h-100">
      <Card.Body>
        <Card.Title className="d-flex justify-content-between align-items-start">
          <span>{name}</span>
          <span className="fw-bold">{formatCurrency(price)}</span>
        </Card.Title>

        {description && (
          <Card.Text className="text-muted" style={{ fontSize: ".9rem" }}>
            {description}
          </Card.Text>
        )}

        {/* Actions */}
        {qty === 0 ? (
          <Button
            className="w-100 mt-2"
            variant="success"
            type="button"
            onClick={() => increaseOrderQuantity(id)}
          >
            Add to Cart
          </Button>
        ) : (
          <div className="d-flex align-items-center justify-content-between mt-2">
            <ButtonGroup>
              <Button type="button" variant="outline-secondary" onClick={() => decreseOrderQuantity(id)}>
                −
              </Button>
              <Button type="button" variant="outline-secondary" disabled>
                {qty}
              </Button>
              <Button type="button" variant="outline-secondary" onClick={() => increaseOrderQuantity(id)}>
                +
              </Button>
            </ButtonGroup>
            <Button type="button" variant="outline-danger" onClick={() => decreseOrderQuantity(id)}>
              Remove 1
            </Button>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

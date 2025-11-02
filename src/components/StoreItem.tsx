import { Card } from "react-bootstrap";
import { formatCurrency } from "../utilities/formatCurrency";
import { Button } from "react-bootstrap";
import { useOrder } from "../context/OrderContext";

type StoreItemProps = {
  id: number;
  name: string;
  price: number;
  category: string;
};

export function StoreItem({ id, name, price, category }: StoreItemProps) {
  const {
    getItemQuantity,
    decreseOrderQuantity,
    removeFromOrder,
    increaseOrderQuantity,
  } = useOrder();
  const quantity = getItemQuantity(id)
  return (
    <Card className="h-100">
      <Card.Body className="d-flex flex-column">
        <Card.Title className="d-flex justify-content-between align-items-baseline mb-4">
          <span className="fs-2">{name}</span>
          <span className="ms-2 text-muted">{formatCurrency(price)}</span>
        </Card.Title>
        <div className="mt-auto">
          {quantity === 0 ? (
            <Button className="w-100" onClick={() => increaseOrderQuantity(id)}>+ Add To Cart</Button>
          ) : (
            <div
              className="d-flex align-items-center flex-column"
              style={{ gap: ".5rem" }}
            >
              <div
                className="d-flex align-items-center justify-content-center"
                style={{ gap: ".5rem" }}
              >
                <Button onClick={() => decreseOrderQuantity(id)}>-</Button>
                <div>
                  <span className="fs-3">{quantity}</span>
                </div>
                <Button onClick={() => increaseOrderQuantity(id)}>+</Button>
              </div>
              <Button variant="danger" size="sm" onClick={() => removeFromOrder(id)}>
                Remove
              </Button>
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}

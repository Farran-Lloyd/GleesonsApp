import { Button, Stack } from "react-bootstrap";
import { useOrder } from "../context/OrderContext";
import storeItems from "../data/items.json";
import { formatCurrency } from "../utilities/formatCurrency";

type OrderItemProps = {
  id: number;
  quantity: number;
};

export function OrderItem({ id, quantity }: OrderItemProps) {
  const { removeFromOrder } = useOrder();
  const item = storeItems.find((i) => i.id === id);
  if (item == null) return null;

  return (
    <Stack direction="horizontal" gap={2}>
      <div className="me-auto">
        <div>
          {item.name}{" "}
          {quantity > 1 && (
            <span className="text-muted" style={{ fontSize: ".65rem" }}>
              x{quantity}
            </span>
          )}
        </div>
        <div className="text-muted" style={{ fontSize: ".75rem" }}>
          {formatCurrency(item.price)}
        </div>
      </div>
      <div> {formatCurrency(item.price * quantity)} </div>
      <Button
        variant="outline-danger"
        size="sm"
        onClick={() => removeFromOrder(item.id)}
      >&times;</Button>
    </Stack>
  );
}

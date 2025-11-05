// src/components/OrderItem.tsx
import { Button, Stack } from "react-bootstrap";
import { useOrder, OrderItem as OrderItemType } from "../context/OrderContext";
import { useProducts } from "../hooks/useProducts";
import { formatCurrency } from "../utilities/formatCurrency";

type Props = OrderItemType; // { id: number; quantity: number }

export function OrderItem({ id, quantity }: Props) {
  const { increaseOrderQuantity, decreseOrderQuantity, removeFromOrder } = useOrder();
  const { byId } = useProducts();

  const product = byId.get(id);
  const name = product?.name ?? `Item #${id}`;
  const price = product?.price ?? 0;

  return (
    <Stack direction="horizontal" gap={2} className="d-flex align-items-center">
      <div className="me-auto">
        <div className="fw-semibold">{name}</div>
        <div className="text-muted" style={{ fontSize: ".9rem" }}>
          {quantity} × {formatCurrency(price)}
        </div>
      </div>

      <div className="text-end" style={{ minWidth: 88 }}>
        {formatCurrency(price * quantity)}
      </div>

      <div className="d-flex align-items-center gap-2">
        <Button variant="outline-secondary" size="sm" onClick={() => decreseOrderQuantity(id)}>
          −
        </Button>
        <Button variant="outline-secondary" size="sm" onClick={() => increaseOrderQuantity(id)}>
          +
        </Button>
        <Button variant="outline-danger" size="sm" onClick={() => removeFromOrder(id)}>
          Remove
        </Button>
      </div>
    </Stack>
  );
}

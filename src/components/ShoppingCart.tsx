// src/components/ShoppingCart.tsx
import { Button, Offcanvas, Stack } from "react-bootstrap";
import { useOrder } from "../context/OrderContext";
import { OrderItem } from "./OrderItem";
import { formatCurrency } from "../utilities/formatCurrency";
import { useProducts } from "../hooks/useProducts";

type ShoppingCartProps = {
  isOpen: boolean;
};

export function ShoppingCart({ isOpen }: ShoppingCartProps) {
  const { closeCart, orderItems, navigateToOrderDetails } = useOrder();
  const { byId } = useProducts();

  const total = orderItems.reduce((sum, line) => {
    const p = byId.get(line.id);
    const price = p?.price ?? 0;
    return sum + price * line.quantity;
    }, 0);

  const handleOrder = () => {
    // optional: close first for a smoother UX
    closeCart();
    navigateToOrderDetails();
  };

  return (
    <Offcanvas show={isOpen} onHide={closeCart} placement="end">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Cart</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        <Stack gap={3}>
          {orderItems.length === 0 ? (
            <div className="text-muted">Your cart is empty.</div>
          ) : (
            orderItems.map((item) => <OrderItem key={item.id} {...item} />)
          )}

          <div className="ms-auto fw-bold fs-5">
            Total {formatCurrency(total)}
          </div>
        </Stack>

        <Button
          className="mt-3 w-100"
          variant="success"
          onClick={handleOrder}
          disabled={orderItems.length === 0}
        >
          Order
        </Button>
      </Offcanvas.Body>
    </Offcanvas>
  );
}

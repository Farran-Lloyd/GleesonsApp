import { Button, Offcanvas, Stack } from "react-bootstrap";
import { useOrder } from "../context/OrderContext";
import { OrderItem } from "./OrderItem";
import { formatCurrency } from "../utilities/formatCurrency";
import storeItems from "../data/items.json";

type ShoppingCartProps = {
  isOpen: boolean;
};

export function ShoppingCart({ isOpen }: ShoppingCartProps) {
  // ✅ Get everything needed from the Order context
  const { closeCart, orderItems, navigateToOrderDetails } = useOrder();

  // (You had `addToOrder` here — removing since it's not used)
  // const { addToOrder } = useOrder();

  // 🧠 Calculate total price (unchanged)
  const total = orderItems.reduce((total, orderItem) => {
    const item = storeItems.find((i) => i.id === orderItem.id);
    return total + (item?.price || 0) * orderItem.quantity;
  }, 0);

  // 🧾 Handle Order button click
  const handleOrderClick = () => {
    closeCart(); // close the cart drawer
    navigateToOrderDetails(); // go to Order Details page
  };

  return (
    <Offcanvas show={isOpen} onHide={closeCart} placement="end">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Cart</Offcanvas.Title>
      </Offcanvas.Header>

      <Offcanvas.Body>
        <Stack gap={3}>
          {orderItems.length === 0 && <div>Your cart is empty</div>}

          {orderItems.map((item) => (
            <OrderItem key={item.id} {...item} />
          ))}

          <div className="ms-auto fw-bold fs-5">
            Total {formatCurrency(total)}
          </div>

          {/* ✅ Order Button */}
          <Button
            className="w-100 mt-3"
            variant="success"
            disabled={orderItems.length === 0}
            onClick={handleOrderClick}
          >
            Order
          </Button>
        </Stack>
      </Offcanvas.Body>
    </Offcanvas>
  );
}

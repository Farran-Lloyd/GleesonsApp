import { useState } from "react";
import {
  Navbar as BsNavbar,
  Nav,
  Container,
  Offcanvas,
  Button,
  Badge,
} from "react-bootstrap";
import { NavLink } from "react-router-dom";
import { useOrder } from "../context/OrderContext";

function Navbar() {
  const { openCart, cartQuantity } = useOrder();
  const [showMenu, setShowMenu] = useState(false);

  const handleClose = () => setShowMenu(false);
  const handleShow = () => setShowMenu(true);

  return (
    <>
      <BsNavbar
        bg="success"
        data-bs-theme="dark"
        expand="lg"
        className="mb-3"
      >
        <Container fluid>
          {/* Brand */}
          <BsNavbar.Brand as={NavLink} to="/" className="fw-semibold">
            Gleesons Butchers
          </BsNavbar.Brand>

          {/* Cart button (always visible) */}
          <Button
            variant="outline-light"
            className="order-lg-2 position-relative"
            onClick={openCart}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill="currentColor"
              className="bi bi-bag"
              viewBox="0 0 16 16"
            >
              <path d="M8 1a2.5 2.5 0 0 1 2.5 2.5V4h-5v-.5A2.5 2.5 0 0 1 8 1m3.5 3v-.5a3.5 3.5 0 1 0-7 0V4H1v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4zM2 5h12v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
            </svg>
            {!!cartQuantity && (
              <Badge
                bg="warning"
                text="dark"
                pill
                className="position-absolute top-0 start-100 translate-middle"
              >
                {cartQuantity}
              </Badge>
            )}
          </Button>

          {/* Hamburger toggler (shows Offcanvas on mobile) */}
          <BsNavbar.Toggle
            aria-controls="main-offcanvas"
            onClick={handleShow}
            className="ms-2"
          />
        </Container>
      </BsNavbar>

      {/* Offcanvas (mobile) + persistent Nav (desktop via expand) */}
      <BsNavbar expand="lg" className="d-lg-block d-none">
        <Container>
          <Nav className="me-auto">
            <Nav.Link as={NavLink} to="/" end>
              New Order
            </Nav.Link>
            <Nav.Link as={NavLink} to="/history">
              History
            </Nav.Link>
            <Nav.Link as={NavLink} to="/Inventory">
              Inventory
            </Nav.Link>
            <Nav.Link as={NavLink} to="/LogOut">
              Log Out
            </Nav.Link>
          </Nav>
        </Container>
      </BsNavbar>

      {/* Mobile menu drawer */}
      <Offcanvas
        id="main-offcanvas"
        placement="start"
        show={showMenu}
        onHide={handleClose}
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Menu</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <Nav className="flex-column" onSelect={handleClose}>
            <Nav.Link as={NavLink} to="/" end onClick={handleClose}>
              New Order
            </Nav.Link>
            <Nav.Link as={NavLink} to="/history" onClick={handleClose}>
              History
            </Nav.Link>
            <Nav.Link as={NavLink} to="/Inventory" onClick={handleClose}>
              Inventory
            </Nav.Link>
            <Nav.Link as={NavLink} to="/LogOut" onClick={handleClose}>
              Log Out
            </Nav.Link>
          </Nav>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}

export default Navbar;

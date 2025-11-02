import { Button } from "react-bootstrap";
import { useOrder } from "../context/OrderContext";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Navbar() {
  const { openCart, cartQuantity } = useOrder();

  const { user, signOut } = useAuth();

  const NavStyle = {
    backgroundColor: "rgba(18, 152, 58, 0.87)",
    fontFamily: "sans-serif",
  };

  const OrderStyle = {
    width: "4rem",
    height: "4rem",
    bottom: 0,
    right: 0,
    position: "absolute",
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-light" style={NavStyle}>
      <div className="container-fluid">
        {/* Brand should be a Link, not an <a> */}
        <Link className="navbar-brand" to="/">Gleesons Butchers</Link>

        <Button onClick={openCart} variant="outline" style={OrderStyle}>
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
          <div
            className="rounded-circle bg-danger d-flex justify-content-center align-items-center"
            style={{
              color: "black",
              width: "1.5rem",
              height: "1.5rem",
              position: "absolute",
              bottom: 2,
              right: 5,
              transform: "translation(25%, 25%)",
            }}
          >
            {cartQuantity}
          </div>
        </Button>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarSupportedContent"
          aria-controls="navbarSupportedContent"
          aria-expanded="false"
          aria-label="Toggle navigation"
          style={{ bottom: 8, right: 55, position: "absolute" }}
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarSupportedContent">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <Link className="nav-link" aria-current="page" to="/">New Order</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/history">History</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/Inventory">Inventory</Link>
            </li>
            <div className="d-flex align-items-center gap-2">
  {user && <span className="text-light small">{user.email}</span>}
  {user ? (
    <Button size="sm" variant="outline-light" onClick={signOut}>Log out</Button>
  ) : (
    <Link className="btn btn-outline-light btn-sm" to="/auth">Log in</Link>
  )}
</div>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

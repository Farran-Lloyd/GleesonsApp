import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import { OrderList } from "./context/OrderContext";
import LogOut from "./pages/Logout";
import Inventory from "./pages/Inventory";
import OrderDetailsPage from "./pages/OrderDetails";
import OrderHistory from "./pages/History";
import ReceiptPage from "./pages/ReceiptPage";
import AuthPage from "./pages/AuthPage";
import { AuthProvider } from "./context/AuthContext";
import RequireAuth from "./components/RequireAuth";
import EditOrder from "./pages/EditOrder";

export default function App() {
  return (
    <AuthProvider>
      <OrderList>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />

          {/* Protect all app routes */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <Home />
              </RequireAuth>
            }
          />
          <Route
            path="/history"
            element={
              <RequireAuth>
                <OrderHistory />
              </RequireAuth>
            }
          />
          <Route
            path="/LogOut"
            element={
              <RequireAuth>
                <LogOut />
              </RequireAuth>
            }
          />
          <Route
            path="/Inventory"
            element={
              <RequireAuth>
                <Inventory />
              </RequireAuth>
            }
          />
          <Route
            path="/order-details"
            element={
              <RequireAuth>
                <OrderDetailsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/receipt/:id"
            element={
              <RequireAuth>
                <ReceiptPage />
              </RequireAuth>
            }
          />
          <Route path="/edit-order/:id" element={<EditOrder />} />

        </Routes>
      </OrderList>
    </AuthProvider>
  );
}

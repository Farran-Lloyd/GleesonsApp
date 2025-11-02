// main.tsx or index.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { OrderList } from "./context/OrderContext";
import { HashRouter } from "react-router-dom"; // or BrowserRouter if you prefer
import "bootstrap/dist/css/bootstrap.min.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* ✅ Router must be OUTSIDE the context, not inside */}
    <HashRouter>
      <OrderList>
        <App />
      </OrderList>
    </HashRouter>
  </React.StrictMode>
);

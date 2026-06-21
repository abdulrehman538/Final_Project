import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth, getAccessToken } from "../utils/authSession";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

function formatOrderDate(order) {
  if (order.date) {
    return order.date;
  }

  if (order.created_at) {
    return new Date(order.created_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return "—";
}

function formatOrderTotal(order) {
  if (order.total) {
    return order.total;
  }

  return `$${Number(order.total_price || 0).toFixed(2)}`;
}

function getStatusBadgeClass(status) {
  const normalized = (status || "pending").toLowerCase();
  if (["delivered", "completed"].includes(normalized)) {
    return "status-badge status-badge--success";
  }
  if (["confirmed", "shipped"].includes(normalized)) {
    return "status-badge status-badge--warning";
  }
  return "status-badge status-badge--danger";
}

function loadLocalOrders() {
  try {
    const stored = localStorage.getItem("cartOrders");
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingAccountOrders, setUsingAccountOrders] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);

    if (getAccessToken()) {
      try {
        const response = await fetchWithAuth(`${API_BASE}/api/orders/`);

        if (response.ok) {
          const data = await response.json();
          setOrders(Array.isArray(data) ? data : []);
          setUsingAccountOrders(true);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error("Failed to load account orders", error);
      }
    }

    setOrders(loadLocalOrders());
    setUsingAccountOrders(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const updateLocalOrderStatus = (orderId, nextStatus) => {
    setOrders((current) => {
      const updated = current.map((order) =>
        order.id === orderId ? { ...order, status: nextStatus } : order
      );
      localStorage.setItem("cartOrders", JSON.stringify(updated));
      return updated;
    });
  };

  const confirmDelivery = async (order) => {
    if (usingAccountOrders) {
      try {
        const response = await fetchWithAuth(
          `${API_BASE}/api/orders/${order.id}/confirm-delivery/`,
          { method: "POST" }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          window.alert(errorData.detail || "Could not update this order.");
          return;
        }

        const updatedOrder = await response.json();
        setOrders((current) =>
          current.map((entry) => (entry.id === updatedOrder.id ? updatedOrder : entry))
        );
        return;
      } catch (error) {
        console.error("Confirm delivery failed", error);
        window.alert("Could not update this order.");
        return;
      }
    }

    const nextStatus = order.status === "shipped" ? "delivered" : "completed";
    updateLocalOrderStatus(order.id, nextStatus);
  };

  return (
    <div className="orders-page">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Orders</p>
            <h2>Your order history</h2>
            <p className="subtext">
              {usingAccountOrders
                ? "Orders linked to your account, synced from the server."
                : "Guest orders from this browser are saved locally until you sign in."}
            </p>
          </div>
        </div>

        <div className="table-card" style={{ marginTop: "20px" }}>
          {loading ? (
            <div className="empty-state">Loading orders…</div>
          ) : orders.length === 0 ? (
            <div className="empty-state">No orders yet. Checkout from your cart to see them here.</div>
          ) : (
            orders.map((order) => (
              <div
                className="table-row"
                key={order.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.5fr 1fr 1fr",
                  alignItems: "center",
                  padding: "20px",
                  gap: "16px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div>
                  <strong>#{order.id}</strong>
                  <p className="subtext" style={{ margin: "4px 0 0 0", fontSize: "0.9rem" }}>
                    Ordered on: {formatOrderDate(order)}
                  </p>
                </div>
                <div>
                  <span className={getStatusBadgeClass(order.status)}>{order.status}</span>
                  <p className="subtext" style={{ margin: "4px 0 0 0", fontSize: "0.82rem" }}>
                    COD Payment
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong style={{ fontSize: "1.25rem", color: "var(--text)" }}>
                    {formatOrderTotal(order)}
                  </strong>
                  {(order.status === "shipped" || order.status === "delivered") && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ marginTop: "10px", width: "100%" }}
                      onClick={() => confirmDelivery(order)}
                    >
                      {order.status === "shipped" ? "Confirm delivery" : "Mark complete"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default OrdersPage;

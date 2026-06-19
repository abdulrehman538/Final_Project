import { useEffect, useState } from "react";

function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const token = localStorage.getItem("accessToken");

  const loadOrders = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:8000/api/orders/", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Unable to load orders");
      }

      const data = await response.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load orders", e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [token]);

  const confirmDelivery = async (orderId) => {
    if (!token) return;
    setUpdatingOrderId(orderId);

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/orders/${orderId}/confirm-delivery/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Unable to confirm delivery");
      }

      const updatedOrder = await response.json();
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? { ...order, status: updatedOrder.status } : order))
      );
    } catch (error) {
      console.error("Delivery confirmation failed", error);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="orders-page">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Orders</p>
            <h2>Your order history</h2>
          </div>
        </div>

        <div className="table-card" style={{ marginTop: "20px" }}>
          {loading ? (
            <div className="empty-state">Loading orders…</div>
          ) : orders.length === 0 ? (
            <div className="empty-state">No orders found.</div>
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
                  borderBottom: "1px solid var(--border)"
                }}
              >
                <div>
                  <strong>#{order.id}</strong>
                  <p className="subtext" style={{ margin: "4px 0 0 0", fontSize: "0.9rem" }}>Ordered on: {new Date(order.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className={`status-badge ${order.status === "delivered" || order.status === "completed" ? "status-badge--success" : order.status === "confirmed" || order.status === "shipped" ? "status-badge--warning" : "status-badge--danger"}`}>
                    {order.status}
                  </span>
                  <p className="subtext" style={{ margin: "4px 0 0 0", fontSize: "0.82rem" }}>COD Payment</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong style={{ fontSize: "1.25rem", color: "var(--text)" }}>${Number(order.total_price || 0).toFixed(2)}</strong>
                  {(order.status === "shipped" || order.status === "delivered") && (
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: "10px", width: "100%" }}
                      onClick={() => confirmDelivery(order.id)}
                      disabled={updatingOrderId === order.id}
                    >
                      {updatingOrderId === order.id
                        ? "Updating..."
                        : order.status === "shipped"
                        ? "Confirm delivery"
                        : "Mark complete"}
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

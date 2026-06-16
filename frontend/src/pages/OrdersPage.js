import { useEffect, useState } from "react";

const staticMockOrders = [
  { id: "#ORD-1024", status: "Processing", total: "$149.00", date: "Jun 10, 2026" },
  { id: "#ORD-1011", status: "Delivered", total: "$74.50", date: "Jun 03, 2026" },
  { id: "#ORD-0998", status: "Shipped", total: "$129.00", date: "May 29, 2026" },
];

function OrdersPage() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cartOrders");
      if (stored) {
        setOrders(JSON.parse(stored));
      } else {
        setOrders(staticMockOrders);
      }
    } catch (e) {
      console.error("Failed to load local orders", e);
      setOrders(staticMockOrders);
    }
  }, []);

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
          {orders.length === 0 ? (
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
                  <strong>{order.id}</strong>
                  <p className="subtext" style={{ margin: "4px 0 0 0", fontSize: "0.9rem" }}>Ordered on: {order.date}</p>
                  {order.address && (
                    <div style={{ marginTop: "8px", fontSize: "0.85rem", color: "var(--primary)" }}>
                      <span>📍 Delivered to: </span>
                      <span style={{ color: "var(--text)", fontWeight: "600" }}>
                        {order.address.address1}
                        {order.address.address2 ? `, ${order.address.address2}` : ""}
                        {order.address.postal_code ? ` (${order.address.postal_code})` : ""}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <span className={`status-badge ${order.status === "Delivered" ? "status-badge--success" : order.status === "Processing" ? "status-badge--warning" : "status-badge--danger"}`}>
                    {order.status}
                  </span>
                  <p className="subtext" style={{ margin: "4px 0 0 0", fontSize: "0.82rem" }}>COD Payment</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong style={{ fontSize: "1.25rem", color: "var(--text)" }}>{order.total}</strong>
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

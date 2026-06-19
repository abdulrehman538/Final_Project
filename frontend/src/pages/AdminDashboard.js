import { useEffect, useState } from "react";
import "./AdminDashboard.css";

function AdminDashboard() {
  const [sellerRequests, setSellerRequests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const token = localStorage.getItem("accessToken");

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [requestsRes, ordersRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/admin/seller-requests/", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("http://127.0.0.1:8000/api/admin/orders/", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setSellerRequests(Array.isArray(requestsData) ? requestsData : []);
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(Array.isArray(ordersData) ? ordersData : []);
      }
    } catch (error) {
      console.error("Failed to load admin dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleApproveRequest = async (userId) => {
    if (!userId) {
      setMessage("Unable to approve request: missing user ID.");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:8000/api/admin/seller-requests/approve/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setMessage("Seller request approved.");
        await loadData();
      } else {
        setMessage(data.detail || "Failed to approve seller request.");
      }
    } catch (error) {
      console.error("Failed to approve seller request", error);
      setMessage("Failed to approve seller request.");
    }
  };

  const handleRejectRequest = async (userId) => {
    if (!userId) {
      setMessage("Unable to reject request: missing user ID.");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:8000/api/admin/seller-requests/reject/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setMessage("Seller request rejected.");
        await loadData();
      } else {
        setMessage(data.detail || "Failed to reject seller request.");
      }
    } catch (error) {
      console.error("Failed to reject seller request", error);
      setMessage("Failed to reject seller request.");
    }
  };

  const getRequestUserId = (request) => request.user_id ?? request.user?.id ?? request.user_id ?? request.id;

  const overviewCards = [
    { label: "Users", value: "1,842", note: "Active buyers and sellers" },
    { label: "Sellers", value: String(sellerRequests.length + orders.length), note: "Pending and active seller activity" },
    { label: "Products", value: "10,280", note: "Live listings across stores" },
    { label: "Revenue", value: "$76.4K", note: "This quarter" },
  ];

  return (
    <div className="dashboard-page">
      {message ? <div className="auth-alert auth-alert-success">{message}</div> : null}
      <section className="dashboard-grid">
        {overviewCards.map((card) => (
          <div className="dashboard-card" key={card.label}>
            <p className="eyebrow">{card.label}</p>
            <h3>{card.value}</h3>
            <span className="subtext">{card.note}</span>
          </div>
        ))}
      </section>

      <section className="dashboard-panels">
        <article className="stat-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Revenue</p>
              <h2>Monthly revenue trend</h2>
            </div>
            <span className="pill">+14%</span>
          </div>

          <div className="chart-bars">
            {[42, 58, 34, 72, 64, 88, 70].map((height, index) => (
              <div className="chart-bar" key={String(index)}>
                <span style={{ height: `${height}%` }} />
                <small>W{index + 1}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="stat-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Orders</p>
              <h2>Recent orders</h2>
            </div>
            <span className="pill pill-soft">Live</span>
          </div>

          <div className="table-card">
            {loading ? (
              <div className="empty-state">Loading orders…</div>
            ) : orders.length === 0 ? (
              <div className="empty-state">No orders yet.</div>
            ) : (
              orders.slice(0, 5).map((order) => (
                <div className="table-row" key={order.id}>
                  <div>
                    <strong>#{order.id}</strong>
                    <p className="subtext">{order.buyer_username || "Buyer"}</p>
                  </div>
                  <span className={`status-badge ${order.status === "delivered" || order.status === "completed" ? "status-badge--success" : order.status === "confirmed" || order.status === "shipped" ? "status-badge--warning" : "status-badge--danger"}`}>
                    {order.status}
                  </span>
                  <strong>${Number(order.total_price || 0).toFixed(2)}</strong>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="dashboard-panels">
        <article className="stat-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Stores</p>
              <h2>Seller applications</h2>
            </div>
          </div>

          <div className="table-card">
            {loading ? (
              <div className="empty-state">Loading seller requests…</div>
            ) : sellerRequests.length === 0 ? (
              <div className="empty-state">No pending seller requests.</div>
            ) : (
              sellerRequests.map((request) => {
                const requestUserId = getRequestUserId(request);

                return (
                  <div className="table-row" key={request.username}>
                    <div>
                      <strong>{request.username}</strong>
                      <p className="subtext">{request.store_name || "Store request"}</p>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button className="btn btn-primary" onClick={() => handleApproveRequest(requestUserId)}>
                        Approve
                      </button>
                      <button className="btn btn-secondary" onClick={() => handleRejectRequest(requestUserId)}>
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="stat-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Products</p>
              <h2>Low stock alerts</h2>
            </div>
            <span className="pill">4 items</span>
          </div>

          <ul className="panel-list">
            <li>Wireless Headphones - 4 left</li>
            <li>Smartwatch Series 8 - 6 left</li>
            <li>Eco-friendly Travel Mug - 2 left</li>
          </ul>
        </article>
      </section>
    </div>
  );
}

export default AdminDashboard;

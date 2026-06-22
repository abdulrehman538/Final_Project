import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth, getAccessToken } from "../utils/authSession";
import ModalCloseButton from "../components/ModalCloseButton";
import "./AdminDashboard.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

const emptyStats = {
  users_count: 0,
  active_sellers: 0,
  pending_applications: 0,
  products_count: 0,
  orders_count: 0,
  revenue_total: "0",
  low_stock_count: 0,
  out_of_stock_count: 0,
  order_volume: [],
  order_volume_max: 1,
  low_stock_products: [],
};

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseAddress(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return [
        parsed.detail,
        parsed.address1,
        parsed.address2,
        parsed.address3,
        parsed.postal_code,
      ].filter(Boolean);
    }
  } catch {
    return [raw];
  }
  return [];
}

function getStatusBadgeClass(status) {
  const normalized = (status || "pending").toLowerCase();
  if (["delivered", "completed"].includes(normalized)) return "ad-status ad-status--success";
  if (["confirmed", "shipped"].includes(normalized)) return "ad-status ad-status--warning";
  if (normalized === "cancelled") return "ad-status ad-status--muted";
  return "ad-status ad-status--danger";
}

function ApplicationDetailModal({ application, onClose, onApprove, onReject, acting }) {
  const addressLines = parseAddress(application.address);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="ad-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="ad-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ad-app-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ad-modal__head">
          <div>
            <p className="ad-modal__eyebrow">Seller application</p>
            <h2 id="ad-app-title">{application.store_name || "Store application"}</h2>
            <p className="ad-modal__meta">Submitted {formatDate(application.updated_at)}</p>
          </div>
          <ModalCloseButton inline onClick={onClose} />
        </header>

        <div className="ad-modal__body">
          <section className="ad-detail-section">
            <h3>Account</h3>
            <dl className="ad-detail-grid">
              <div><dt>Username</dt><dd>{application.username}</dd></div>
              <div><dt>Email</dt><dd>{application.email || "—"}</dd></div>
              <div><dt>Full name</dt><dd>{application.full_name || "—"}</dd></div>
              <div><dt>Phone</dt><dd>{application.phone || "—"}</dd></div>
              <div><dt>Joined</dt><dd>{formatDate(application.date_joined)}</dd></div>
              <div><dt>Status</dt><dd className="ad-status ad-status--warning">Pending review</dd></div>
            </dl>
          </section>

          <section className="ad-detail-section">
            <h3>Store application</h3>
            <dl className="ad-detail-grid">
              <div><dt>Store name</dt><dd>{application.store_name || "—"}</dd></div>
              <div><dt>Contact phone</dt><dd>{application.contact_phone || "—"}</dd></div>
              <div className="ad-detail-grid__full">
                <dt>Business description</dt>
                <dd>{application.business_description || "—"}</dd>
              </div>
              <div><dt>Terms accepted</dt><dd>{application.terms_accepted ? "Yes" : "No"}</dd></div>
            </dl>
          </section>

          {addressLines.length > 0 && (
            <section className="ad-detail-section">
              <h3>Profile address</h3>
              <address className="ad-address">
                {addressLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </address>
            </section>
          )}

          {application.bio && (
            <section className="ad-detail-section">
              <h3>Bio</h3>
              <p className="ad-detail-text">{application.bio}</p>
            </section>
          )}
        </div>

        <footer className="ad-modal__foot">
          <button
            type="button"
            className="ad-btn ad-btn--ghost"
            onClick={onClose}
            disabled={acting}
          >
            Close
          </button>
          <div className="ad-modal__foot-actions">
            <button
              type="button"
              className="ad-btn ad-btn--danger"
              onClick={() => onReject(application.user_id)}
              disabled={acting}
            >
              Reject
            </button>
            <button
              type="button"
              className="ad-btn ad-btn--primary"
              onClick={() => onApprove(application.user_id)}
              disabled={acting}
            >
              {acting ? "Processing…" : "Approve seller"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function OrderDetailModal({ order, onClose }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const address = parseAddress(order.shipping_address);

  return (
    <div className="ad-modal-overlay" onClick={onClose} role="presentation">
      <div className="ad-modal ad-modal--compact" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="ad-modal__head">
          <div>
            <p className="ad-modal__eyebrow">Order</p>
            <h2>Order #{order.id}</h2>
            <p className="ad-modal__meta">{formatDate(order.created_at)}</p>
          </div>
          <ModalCloseButton inline onClick={onClose} />
        </header>
        <div className="ad-modal__body">
          <dl className="ad-detail-grid">
            <div>
              <dt>Customer</dt>
              <dd>{order.display_customer || order.customer_name || order.customer_username || "Guest"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd><span className={getStatusBadgeClass(order.status)}>{order.status}</span></dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>${Number(order.total_price || 0).toFixed(2)}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{order.customer_phone || "—"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{order.customer_email || "—"}</dd>
            </div>
            {address.length > 0 && (
              <div className="ad-detail-grid__full">
                <dt>Shipping</dt>
                <dd>
                  <address className="ad-address">
                    {address.map((line) => <span key={line}>{line}</span>)}
                  </address>
                </dd>
              </div>
            )}
          </dl>
          {order.items?.length > 0 && (
            <section className="ad-detail-section">
              <h3>Items</h3>
              <ul className="ad-item-list">
                {order.items.map((item) => (
                  <li key={item.id}>
                    <span>{item.product_name} × {item.quantity}</span>
                    <strong>${(Number(item.price || 0) * item.quantity).toFixed(2)}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(emptyStats);
  const [sellerRequests, setSellerRequests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [applicationSearch, setApplicationSearch] = useState("");
  const [storeSearch, setStoreSearch] = useState("");
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actingOnId, setActingOnId] = useState(null);

  const loadStores = useCallback(async (query = "") => {
    const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
    const response = await fetchWithAuth(`${API_BASE}/api/admin/stores${params}`);
    if (response.ok) {
      const data = await response.json();
      setStores(Array.isArray(data) ? data : []);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!getAccessToken()) return;
    setLoading(true);
    try {
      const [statsRes, requestsRes, ordersRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/api/admin/stats/`),
        fetchWithAuth(`${API_BASE}/api/admin/seller-requests/`),
        fetchWithAuth(`${API_BASE}/api/admin/orders/`),
      ]);

      if (statsRes.ok) {
        setStats({ ...emptyStats, ...(await statsRes.json()) });
      }

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setSellerRequests(Array.isArray(data) ? data : []);
      }

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to load admin dashboard data", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadStores(storeSearch);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [storeSearch, loadStores]);

  const filteredApplications = useMemo(() => {
    const q = applicationSearch.trim().toLowerCase();
    if (!q) return sellerRequests;
    return sellerRequests.filter((req) =>
      [req.username, req.store_name, req.email, req.contact_phone, req.business_description]
        .some((field) => (field || "").toLowerCase().includes(q))
    );
  }, [sellerRequests, applicationSearch]);

  const handleApproveRequest = async (userId) => {
    if (!userId) return;
    setActingOnId(userId);
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/admin/seller-requests/approve/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setMessage("Seller request approved.");
        setSelectedApplication(null);
        await loadData();
        await loadStores(storeSearch);
      } else {
        setMessage(data.detail || "Failed to approve seller request.");
      }
    } catch {
      setMessage("Failed to approve seller request.");
    } finally {
      setActingOnId(null);
    }
  };

  const handleRejectRequest = async (userId) => {
    if (!userId) return;
    setActingOnId(userId);
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/admin/seller-requests/reject/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setMessage("Seller request rejected.");
        setSelectedApplication(null);
        await loadData();
        await loadStores(storeSearch);
      } else {
        setMessage(data.detail || "Failed to reject seller request.");
      }
    } catch {
      setMessage("Failed to reject seller request.");
    } finally {
      setActingOnId(null);
    }
  };

  const handleBanStore = async (userId, storeName) => {
    if (!userId) return;
    const label = storeName || "this store";
    if (!window.confirm(`Ban ${label}? Products will be hidden and the seller cannot list or sell.`)) {
      return;
    }
    setActingOnId(userId);
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/admin/stores/ban/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setMessage(data.detail || "Store banned.");
        await loadData();
        await loadStores(storeSearch);
      } else {
        setMessage(data.detail || "Failed to ban store.");
      }
    } catch {
      setMessage("Failed to ban store.");
    } finally {
      setActingOnId(null);
    }
  };

  const handleUnbanStore = async (userId) => {
    if (!userId) return;
    setActingOnId(userId);
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/admin/stores/unban/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setMessage(data.detail || "Store restored.");
        await loadData();
        await loadStores(storeSearch);
      } else {
        setMessage(data.detail || "Failed to restore store.");
      }
    } catch {
      setMessage("Failed to restore store.");
    } finally {
      setActingOnId(null);
    }
  };

  const volumeMax = Number(stats.order_volume_max) || 1;

  return (
    <div className="admin-dashboard">
      <header className="ad-page-head">
        <div>
          <p className="ad-page-head__eyebrow">Administration</p>
          <h1>Dashboard</h1>
          <p className="ad-page-head__sub">Live marketplace overview — users, stores, orders, and seller applications.</p>
        </div>
        <button
          type="button"
          className="ad-btn ad-btn--ghost"
          onClick={async () => {
            await loadData();
            await loadStores(storeSearch);
          }}
          disabled={loading}
        >
          Refresh data
        </button>
      </header>

      {message && <div className="auth-alert auth-alert-success">{message}</div>}

      <section className="ad-stats">
        <article className="ad-stat">
          <p className="ad-stat__label">Users</p>
          <p className="ad-stat__value">{stats.users_count}</p>
          <span className="ad-stat__hint">Registered accounts</span>
        </article>
        <article className="ad-stat">
          <p className="ad-stat__label">Active stores</p>
          <p className="ad-stat__value">{stats.active_sellers}</p>
          <span className="ad-stat__hint">{stats.pending_applications} pending application(s)</span>
        </article>
        <article className="ad-stat">
          <p className="ad-stat__label">Products</p>
          <p className="ad-stat__value">{stats.products_count}</p>
          <span className="ad-stat__hint">{stats.low_stock_count} low · {stats.out_of_stock_count} out of stock</span>
        </article>
        <article className="ad-stat">
          <p className="ad-stat__label">Revenue</p>
          <p className="ad-stat__value">${Number(stats.revenue_total || 0).toFixed(0)}</p>
          <span className="ad-stat__hint">{stats.orders_count} orders total</span>
        </article>
      </section>

      <section className="ad-panels">
        <article className="ad-panel">
          <header className="ad-panel__head">
            <div>
              <p className="ad-panel__eyebrow">Sales</p>
              <h2>Last 7 days</h2>
            </div>
          </header>
          <div className="ad-panel__body">
            {stats.order_volume.length === 0 ? (
              <p className="ad-empty">No order data yet.</p>
            ) : (
              <div className="ad-chart">
                {stats.order_volume.map((day) => {
                  const height = Math.max(8, (day.total / volumeMax) * 100);
                  return (
                    <div className="ad-chart__bar" key={day.date}>
                      <div className="ad-chart__track">
                        <span style={{ height: `${height}%` }} title={`$${day.total.toFixed(2)}`} />
                      </div>
                      <small>{day.label}</small>
                      <span className="ad-chart__meta">{day.orders} orders</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </article>

        <article className="ad-panel">
          <header className="ad-panel__head">
            <div>
              <p className="ad-panel__eyebrow">Orders</p>
              <h2>Recent orders</h2>
            </div>
            <span className="ad-panel__count">{orders.length}</span>
          </header>
          <div className="ad-panel__body ad-panel__body--scroll">
            {loading ? (
              <p className="ad-empty">Loading orders…</p>
            ) : orders.length === 0 ? (
              <p className="ad-empty">No orders yet.</p>
            ) : (
              <ul className="ad-table">
                {orders.slice(0, 8).map((order) => (
                  <li key={order.id}>
                    <button type="button" className="ad-table__row" onClick={() => setSelectedOrder(order)}>
                      <span className="ad-table__primary">#{order.id}</span>
                      <span className="ad-table__muted">
                        {order.display_customer || order.customer_name || "Guest"}
                      </span>
                      <span className={getStatusBadgeClass(order.status)}>{order.status}</span>
                      <span className="ad-table__amount">${Number(order.total_price || 0).toFixed(2)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </section>

      <section className="ad-panels ad-panels--stores">
        <article className="ad-panel ad-panel--stores-full">
          <header className="ad-panel__head ad-panel__head--split">
            <div>
              <p className="ad-panel__eyebrow">Marketplace</p>
              <h2>Store management</h2>
              <p className="ad-panel__sub">Search stores, review listings, and ban sellers who violate platform rules.</p>
            </div>
            <div className="ad-panel__head-tools">
              <input
                type="search"
                className="ad-search ad-search--inline"
                placeholder="Search by store name…"
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                aria-label="Search stores"
              />
              <span className="ad-panel__count">{stores.length}</span>
            </div>
          </header>
          <div className="ad-panel__body ad-panel__body--stores-list">
            {stores.length === 0 ? (
              <p className="ad-empty">No stores match your search.</p>
            ) : (
              <div className="ad-stores-table">
                <div className="ad-stores-table__head">
                  <span>Store</span>
                  <span>Owner</span>
                  <span>Products</span>
                  <span>Status</span>
                  <span>Action</span>
                </div>
                {stores.map((store) => {
                  const isBanned = store.seller_status === "banned";
                  return (
                    <div className="ad-stores-table__row" key={store.user_id}>
                      <div className="ad-stores-table__store">
                        <div className="ad-stores-table__thumb">
                          {store.featured_image ? (
                            <img src={store.featured_image} alt="" />
                          ) : (
                            <span>{(store.store_name || store.username || "S").slice(0, 1).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <button
                            type="button"
                            className="ad-stores-table__name ad-stores-table__name--link"
                            onClick={() => navigate(`/dashboard/stores/${store.user_id}`)}
                          >
                            {store.store_name || "Unnamed store"}
                          </button>
                          <p className="ad-stores-table__desc">
                            {store.business_description || "No description"}
                          </p>
                        </div>
                      </div>
                      <span className="ad-stores-table__owner">@{store.username}</span>
                      <span className="ad-stores-table__count">{store.product_count}</span>
                      <span
                        className={
                          isBanned
                            ? "ad-status ad-status--danger"
                            : "ad-status ad-status--success"
                        }
                      >
                        {isBanned ? "Banned" : "Active"}
                      </span>
                      <div className="ad-stores-table__actions">
                        {isBanned ? (
                          <button
                            type="button"
                            className="ad-btn ad-btn--primary ad-btn--small"
                            disabled={actingOnId === store.user_id}
                            onClick={() => handleUnbanStore(store.user_id)}
                          >
                            {actingOnId === store.user_id ? "…" : "Restore store"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ad-btn ad-btn--danger ad-btn--small"
                            disabled={actingOnId === store.user_id}
                            onClick={() => handleBanStore(store.user_id, store.store_name)}
                          >
                            {actingOnId === store.user_id ? "…" : "Ban store"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="ad-panels">
        <article className="ad-panel ad-panel--wide">
          <header className="ad-panel__head ad-panel__head--split">
            <div>
              <p className="ad-panel__eyebrow">Applications</p>
              <h2>Seller requests</h2>
            </div>
            <div className="ad-panel__head-tools">
              <input
                type="search"
                className="ad-search ad-search--inline"
                placeholder="Search applications…"
                value={applicationSearch}
                onChange={(e) => setApplicationSearch(e.target.value)}
                aria-label="Search applications"
              />
              <span className="ad-panel__count">{filteredApplications.length}</span>
            </div>
          </header>
          <div className="ad-panel__body ad-panel__body--scroll">
            {loading ? (
              <p className="ad-empty">Loading applications…</p>
            ) : filteredApplications.length === 0 ? (
              <p className="ad-empty">No pending seller applications.</p>
            ) : (
              <ul className="ad-table ad-table--apps">
                {filteredApplications.map((request) => (
                  <li key={request.user_id || request.username}>
                    <button
                      type="button"
                      className="ad-table__row"
                      onClick={() => setSelectedApplication(request)}
                    >
                      <span className="ad-table__primary">{request.store_name || "Unnamed store"}</span>
                      <span className="ad-table__muted">{request.username}</span>
                      <span className="ad-table__muted">{request.contact_phone || "—"}</span>
                      <span className="ad-status ad-status--warning">Pending</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>

        <article className="ad-panel">
          <header className="ad-panel__head">
            <div>
              <p className="ad-panel__eyebrow">Inventory</p>
              <h2>Low stock</h2>
            </div>
            <span className="ad-panel__count">{stats.low_stock_products?.length || 0}</span>
          </header>
          <div className="ad-panel__body ad-panel__body--scroll">
            {!stats.low_stock_products?.length ? (
              <p className="ad-empty">No low-stock alerts.</p>
            ) : (
              <ul className="ad-stock-list">
                {stats.low_stock_products.map((product) => (
                  <li key={product.id} className="ad-stock-item">
                    <div>
                      <strong>{product.name}</strong>
                      <span>{product.store_name || "—"}</span>
                    </div>
                    <span className={`ad-stock-badge${product.stock === 0 ? " ad-stock-badge--out" : ""}`}>
                      {product.stock} left
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </section>

      {selectedApplication && (
        <ApplicationDetailModal
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
          onApprove={handleApproveRequest}
          onReject={handleRejectRequest}
          acting={actingOnId === selectedApplication.user_id}
        />
      )}

      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}

export default AdminDashboard;

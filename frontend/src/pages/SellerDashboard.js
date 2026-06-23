import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchWithAuth, getAccessToken } from "../utils/authSession";
import { getProductMeta, resolveProductImage } from "../utils/productImage";
import { getSellerItems, getSellerTotal } from "../utils/sellerOrders";
import ModalCloseButton from "../components/ModalCloseButton";
import "./SellerDashboard.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

const ORDER_ACTIONS = {
  pending: { label: "Confirm", next: "confirmed" },
  confirmed: { label: "Ship", next: "shipped" },
  shipped: { label: "Delivered", next: "delivered" },
  delivered: { label: "Complete", next: "completed" },
};

const REJECTABLE_STATUSES = new Set(["pending", "confirmed", "shipped", "delivered"]);

const ORDER_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "active", label: "In progress" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const emptyStats = {
  store_name: "",
  products_count: 0,
  total_stock: 0,
  inventory_value: "0",
  revenue_total: "0",
  orders_count: 0,
  pending_orders_count: 0,
  active_orders_count: 0,
  completed_orders_count: 0,
  cancelled_orders_count: 0,
  low_stock_count: 0,
  out_of_stock_count: 0,
  order_volume: [],
  order_volume_max: 1,
  status_breakdown: [],
  status_breakdown_max: 1,
  low_stock_products: [],
  out_of_stock_products: [],
  top_products: [],
};

function formatOrderDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseShippingAddress(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : { detail: raw };
  } catch {
    return { detail: raw };
  }
}

function getAddressLines(address) {
  return [
    address.detail,
    address.address1,
    address.address2,
    address.address3,
    address.postal_code,
  ].filter(Boolean);
}

function getBuyerName(order) {
  return (
    order.customer_name ||
    order.display_customer ||
    order.customer_username ||
    "Guest buyer"
  );
}

function getStatusClass(status) {
  const normalized = (status || "pending").toLowerCase();
  if (["delivered", "completed", "cancelled", "confirmed", "shipped", "pending"].includes(normalized)) {
    return `sd-status sd-status--${normalized}`;
  }
  return "sd-status sd-status--pending";
}

function matchesOrderFilter(order, filterKey) {
  const status = (order.status || "pending").toLowerCase();
  if (filterKey === "all") return true;
  if (filterKey === "pending") return status === "pending";
  if (filterKey === "active") return ["confirmed", "shipped", "delivered"].includes(status);
  if (filterKey === "completed") return status === "completed";
  if (filterKey === "cancelled") return status === "cancelled";
  return true;
}

function OrderDetailModal({ order, updating, onClose, onUpdateStatus }) {
  const sellerItems = getSellerItems(order);
  const sellerTotal = getSellerTotal(order);
  const action = ORDER_ACTIONS[order.status];
  const address = parseShippingAddress(order.shipping_address);
  const addressLines = getAddressLines(address);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="sd-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="sd-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sd-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sd-modal__head">
          <div>
            <p className="sd-modal__eyebrow">Order detail</p>
            <h2 id="sd-modal-title">Order #{order.id}</h2>
            <p className="sd-modal__meta">{formatOrderDate(order.created_at)}</p>
          </div>
          <ModalCloseButton inline onClick={onClose} />
        </header>

        <div className="sd-modal__body">
          <dl className="sd-detail-grid">
            <div>
              <dt>Customer</dt>
              <dd>{getBuyerName(order)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd><span className={getStatusClass(order.status)}>{order.status}</span></dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{order.customer_phone || "—"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{order.customer_email || "—"}</dd>
            </div>
            <div>
              <dt>Your revenue</dt>
              <dd><strong>${sellerTotal.toFixed(2)}</strong></dd>
            </div>
            {addressLines.length > 0 && (
              <div className="sd-detail-grid__full">
                <dt>Shipping</dt>
                <dd>
                  <address className="sd-address">
                    {addressLines.map((line) => <span key={line}>{line}</span>)}
                  </address>
                </dd>
              </div>
            )}
          </dl>

          {sellerItems.length > 0 && (
            <section className="sd-modal__section">
              <h3>Your items</h3>
              <ul className="sd-modal__items">
                {sellerItems.map((item) => (
                  <li key={item.id}>
                    <span>{item.product_name} × {item.quantity}</span>
                    <strong>${(Number(item.price || 0) * item.quantity).toFixed(2)}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="sd-modal__actions">
            {action && (
              <button
                type="button"
                className="sd-order-btn"
                onClick={() => onUpdateStatus(order.id, action.next)}
                disabled={updating}
              >
                {updating ? "Updating…" : action.label}
              </button>
            )}
            {REJECTABLE_STATUSES.has(order.status) && (
              <button
                type="button"
                className="sd-order-btn sd-order-btn--danger"
                onClick={() => onUpdateStatus(order.id, "cancelled")}
                disabled={updating}
              >
                Reject
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SellerDashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const [stats, setStats] = useState(emptyStats);
  const [products, setProducts] = useState([]);
  const [sellerOrders, setSellerOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState("all");
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const loadData = useCallback(async () => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [statsRes, productsRes, ordersRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/api/seller/stats/`),
        fetchWithAuth(`${API_BASE}/api/seller-products/`),
        fetchWithAuth(`${API_BASE}/api/seller-orders/`),
      ]);

      if (statsRes.ok) {
        setStats({ ...emptyStats, ...(await statsRes.json()) });
      }

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(Array.isArray(productsData) ? productsData : []);
      } else {
        setProducts([]);
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setSellerOrders(Array.isArray(ordersData) ? ordersData : []);
      } else {
        setSellerOrders([]);
      }
    } catch (error) {
      console.error("Dashboard data load error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!location.state?.focusOrders) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById("seller-orders")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.state]);

  const filteredOrders = useMemo(
    () => sellerOrders.filter((order) => matchesOrderFilter(order, orderFilter)),
    [sellerOrders, orderFilter]
  );

  const volumeMax = Number(stats.order_volume_max) || 1;
  const statusMax = Number(stats.status_breakdown_max) || 1;

  const updateOrderStatus = async (orderId, nextStatus) => {
    if (!getAccessToken()) return;
    setUpdatingOrderId(orderId);

    try {
      const response = await fetchWithAuth(`${API_BASE}/api/orders/${orderId}/status/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        throw new Error("Unable to update order status");
      }

      const updatedOrder = await response.json();
      setSellerOrders((current) =>
        current.map((order) => (order.id === orderId ? { ...order, status: updatedOrder.status } : order))
      );
      setSelectedOrder((current) =>
        current?.id === orderId ? { ...current, status: updatedOrder.status } : current
      );
      await loadData();
    } catch (error) {
      console.error("Order status update failed", error);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (loading) {
    return <div className="empty-state">Loading seller dashboard…</div>;
  }

  return (
    <div className="seller-dashboard">
      <header className="sd-page-head">
        <div>
          <p className="sd-page-head__eyebrow">Seller hub</p>
          <h1>{stats.store_name || "Your store"}</h1>
          <p className="sd-page-head__sub">
            Track sales, manage inventory, and fulfill orders from one place.
          </p>
        </div>
      </header>

      <section className="sd-stats sd-stats--wide">
        <article className="sd-stat sd-stat--highlight">
          <p className="sd-stat__label">Revenue</p>
          <p className="sd-stat__value">${Number(stats.revenue_total || 0).toFixed(0)}</p>
          <span className="sd-stat__hint">${Number(stats.revenue_total || 0).toFixed(2)} from your items</span>
        </article>
        <article className="sd-stat">
          <p className="sd-stat__label">Orders</p>
          <p className="sd-stat__value">{stats.orders_count}</p>
          <span className="sd-stat__hint">{stats.completed_orders_count} completed</span>
        </article>
        <article className="sd-stat sd-stat--alert">
          <p className="sd-stat__label">Needs action</p>
          <p className="sd-stat__value">{stats.pending_orders_count}</p>
          <span className="sd-stat__hint">Pending confirmation</span>
        </article>
        <article className="sd-stat">
          <p className="sd-stat__label">Products</p>
          <p className="sd-stat__value">{stats.products_count}</p>
          <span className="sd-stat__hint">{stats.total_stock} units in stock</span>
        </article>
        <article className="sd-stat">
          <p className="sd-stat__label">Inventory</p>
          <p className="sd-stat__value">${Number(stats.inventory_value || 0).toFixed(0)}</p>
          <span className="sd-stat__hint">Stock at list price</span>
        </article>
        <article className="sd-stat">
          <p className="sd-stat__label">Stock alerts</p>
          <p className="sd-stat__value">{stats.low_stock_count + stats.out_of_stock_count}</p>
          <span className="sd-stat__hint">{stats.low_stock_count} low · {stats.out_of_stock_count} out</span>
        </article>
      </section>

      <section className="sd-analytics">
        <article className="sd-panel sd-panel--chart">
          <header className="sd-panel__head">
            <div>
              <p className="sd-panel__eyebrow">Sales analytics</p>
              <h2>Revenue — last 7 days</h2>
            </div>
          </header>
          <div className="sd-panel__body">
            {stats.order_volume.length === 0 ? (
              <div className="sd-empty">No sales data yet. Orders will appear here once customers buy your products.</div>
            ) : (
              <div className="sd-chart">
                {stats.order_volume.map((day) => {
                  const height = Math.max(8, (day.total / volumeMax) * 100);
                  return (
                    <div className="sd-chart__bar" key={day.date}>
                      <div className="sd-chart__track">
                        <span
                          style={{ height: `${height}%` }}
                          title={`$${day.total.toFixed(2)} · ${day.orders} order(s)`}
                        />
                      </div>
                      <small>{day.label}</small>
                      <span className="sd-chart__meta">${day.total.toFixed(0)}</span>
                      <span className="sd-chart__orders">{day.orders} order{day.orders === 1 ? "" : "s"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </article>

        <article className="sd-panel sd-panel--chart">
          <header className="sd-panel__head">
            <div>
              <p className="sd-panel__eyebrow">Fulfillment</p>
              <h2>Orders by status</h2>
            </div>
          </header>
          <div className="sd-panel__body">
            {stats.status_breakdown.length === 0 ? (
              <div className="sd-empty">No orders yet.</div>
            ) : (
              <ul className="sd-status-chart">
                {stats.status_breakdown.map((entry) => {
                  const width = Math.max(4, (entry.count / statusMax) * 100);
                  return (
                    <li className="sd-status-chart__row" key={entry.status}>
                      <span className={`sd-status ${getStatusClass(entry.status).replace("sd-status ", "")}`}>
                        {entry.label}
                      </span>
                      <div className="sd-status-chart__track">
                        <span
                          className={`sd-status-chart__fill sd-status-chart__fill--${entry.status}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <strong>{entry.count}</strong>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </article>
      </section>

      <section className="sd-insights">
        <article className="sd-panel">
          <header className="sd-panel__head">
            <div>
              <p className="sd-panel__eyebrow">Performance</p>
              <h2>Top selling products</h2>
            </div>
          </header>
          <div className="sd-panel__body sd-panel__body--compact">
            {stats.top_products.length === 0 ? (
              <div className="sd-empty">No sales yet.</div>
            ) : (
              <ul className="sd-top-list">
                {stats.top_products.map((item, index) => (
                  <li key={item.product_id || index}>
                    <span className="sd-top-list__rank">{index + 1}</span>
                    <div className="sd-top-list__info">
                      <p className="sd-top-list__name">{item.name}</p>
                      <p className="sd-top-list__meta">{item.units_sold} unit(s) sold</p>
                    </div>
                    <strong>${Number(item.revenue || 0).toFixed(2)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>

        <article className="sd-panel">
          <header className="sd-panel__head">
            <div>
              <p className="sd-panel__eyebrow">Inventory</p>
              <h2>Restock alerts</h2>
            </div>
            <span className="sd-panel__count">{stats.low_stock_count + stats.out_of_stock_count}</span>
          </header>
          <div className="sd-panel__body sd-panel__body--compact">
            {stats.low_stock_products.length === 0 && stats.out_of_stock_products.length === 0 ? (
              <div className="sd-empty">All products are well stocked.</div>
            ) : (
              <ul className="sd-alert-list">
                {[...stats.out_of_stock_products, ...stats.low_stock_products].slice(0, 8).map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      className="sd-alert-row"
                      onClick={() => navigate("/products", { state: { viewProductId: product.id } })}
                    >
                      <span className="sd-alert-row__name">{product.name}</span>
                      <span className={`sd-stock sd-stock--${product.stock === 0 ? "out" : "low"}`}>
                        {product.stock === 0 ? "Out of stock" : `${product.stock} left`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>

        <article className="sd-panel">
          <header className="sd-panel__head">
            <div>
              <p className="sd-panel__eyebrow">Catalog</p>
              <h2>Recent products</h2>
            </div>
            <span className="sd-panel__count">{products.length}</span>
          </header>
          <div className="sd-panel__body sd-panel__body--compact">
            {products.length === 0 ? (
              <div className="sd-empty">No products added yet.</div>
            ) : (
              <ul className="sd-product-list">
                {products.slice(0, 6).map((product) => {
                  const meta = getProductMeta(product);
                  return (
                    <li key={product.id}>
                      <button
                        type="button"
                        className="sd-product-row"
                        onClick={() => navigate("/products", { state: { viewProductId: product.id } })}
                      >
                        <img
                          className="sd-product-row__thumb"
                          src={resolveProductImage(product, "120x120")}
                          alt=""
                        />
                        <div className="sd-product-row__info">
                          <p className="sd-product-row__name">{product.name}</p>
                          <p className="sd-product-row__meta">{meta.category}</p>
                        </div>
                        <span className={`sd-stock sd-stock--${meta.stockTone}`}>{meta.stockLabel}</span>
                        <span className="sd-product-row__price">${Number(product.price || 0).toFixed(2)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </article>
      </section>

      <section className="sd-panel sd-panel--orders" id="seller-orders">
        <header className="sd-panel__head">
          <div>
            <p className="sd-panel__eyebrow">Operations</p>
            <h2>Order management</h2>
          </div>
          <span className="sd-panel__count">{filteredOrders.length}</span>
        </header>

        <div className="sd-panel__toolbar">
          {ORDER_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`sd-filter-btn${orderFilter === filter.key ? " is-active" : ""}`}
              onClick={() => setOrderFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="sd-panel__body sd-panel__body--scroll">
          {filteredOrders.length === 0 ? (
            <div className="sd-empty">No orders match this filter.</div>
          ) : (
            <div className="sd-order-list">
              {filteredOrders.map((order) => {
                const sellerTotal = getSellerTotal(order);
                const action = ORDER_ACTIONS[order.status];
                const customer = getBuyerName(order);
                const address = parseShippingAddress(order.shipping_address);
                const addressPreview = getAddressLines(address)[0] || "No address";

                return (
                  <article className="sd-order-card" key={order.id}>
                    <div className="sd-order-card__top">
                      <div>
                        <p className="sd-order-card__id">Order #{order.id}</p>
                        <p className="sd-order-card__date">{formatOrderDate(order.created_at)}</p>
                      </div>
                      <span className={getStatusClass(order.status)}>{order.status}</span>
                    </div>

                    <div className="sd-order-card__summary">
                      <span>Customer: <strong>{customer}</strong></span>
                      <span>Your revenue: <strong>${sellerTotal.toFixed(2)}</strong></span>
                      <span>Ship to: <strong>{addressPreview}</strong></span>
                    </div>

                    <div className="sd-order-items">
                      {getSellerItems(order).map((item) => (
                        <div className="sd-order-item" key={item.id}>
                          <span className="sd-order-item__name">{item.product_name} × {item.quantity}</span>
                          <span className="sd-order-item__price">
                            ${(Number(item.price || 0) * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="sd-order-card__footer">
                      <button
                        type="button"
                        className="sd-link-btn"
                        onClick={() => setSelectedOrder(order)}
                      >
                        View details
                      </button>
                      <div className="sd-order-card__actions">
                        {action && (
                          <button
                            type="button"
                            className="sd-order-btn"
                            onClick={() => updateOrderStatus(order.id, action.next)}
                            disabled={updatingOrderId === order.id}
                          >
                            {updatingOrderId === order.id ? "Updating…" : action.label}
                          </button>
                        )}
                        {REJECTABLE_STATUSES.has(order.status) && (
                          <button
                            type="button"
                            className="sd-order-btn sd-order-btn--danger"
                            onClick={() => updateOrderStatus(order.id, "cancelled")}
                            disabled={updatingOrderId === order.id}
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          updating={updatingOrderId === selectedOrder.id}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={updateOrderStatus}
        />
      )}
    </div>
  );
}

export default SellerDashboard;

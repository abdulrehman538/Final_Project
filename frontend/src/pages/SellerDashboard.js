import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchWithAuth, getAccessToken } from "../utils/authSession";
import { getProductMeta, resolveProductImage } from "../utils/productImage";
import "./SellerDashboard.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

const ORDER_ACTIONS = {
  pending: { label: "Confirm", next: "confirmed" },
  confirmed: { label: "Ship", next: "shipped" },
  shipped: { label: "Delivered", next: "delivered" },
  delivered: { label: "Complete", next: "completed" },
};

const REJECTABLE_STATUSES = new Set(["pending", "confirmed", "shipped", "delivered"]);

function formatOrderDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusClass(status) {
  const normalized = (status || "pending").toLowerCase();
  if (["delivered", "completed", "cancelled", "confirmed", "shipped", "pending"].includes(normalized)) {
    return `sd-status--${normalized}`;
  }
  return "sd-status--pending";
}

function SellerDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [sellerOrders, setSellerOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  useEffect(() => {
    const loadSellerData = async () => {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }

      try {
        const productsRes = await fetchWithAuth(`${API_BASE}/api/seller-products/`);

        if (productsRes.ok) {
          const productsData = await productsRes.json();
          setProducts(Array.isArray(productsData) ? productsData : []);
        } else {
          setProducts([]);
        }

        const ordersRes = await fetchWithAuth(`${API_BASE}/api/seller-orders/`);

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setSellerOrders(Array.isArray(ordersData) ? ordersData : []);
        } else {
          setSellerOrders([]);
        }
      } catch (error) {
        console.error("Dashboard data load error:", error);
        setProducts([]);
        setSellerOrders([]);
      } finally {
        setLoading(false);
      }
    };

    loadSellerData();
  }, []);

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

  const totalProducts = products.length;
  const totalStock = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  const inventoryValue = products.reduce(
    (sum, product) => sum + Number(product.price || 0) * Number(product.stock || 0),
    0
  );

  const updateOrderStatus = async (orderId, nextStatus) => {
    if (!getAccessToken()) return;
    setUpdatingOrderId(orderId);

    try {
      const response = await fetchWithAuth(`${API_BASE}/api/orders/${orderId}/status/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        throw new Error("Unable to update order status");
      }

      const updatedOrder = await response.json();
      setSellerOrders((current) =>
        current.map((order) => (order.id === orderId ? { ...order, status: updatedOrder.status } : order))
      );
    } catch (error) {
      console.error("Order status update failed", error);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (loading) {
    return <div className="empty-state">Loading dashboard...</div>;
  }

  return (
    <div className="seller-dashboard">
      <section className="sd-stats">
        <article className="sd-stat">
          <p className="sd-stat__label">Products</p>
          <p className="sd-stat__value">{totalProducts}</p>
          <span className="sd-stat__hint">In your store</span>
        </article>
        <article className="sd-stat">
          <p className="sd-stat__label">Stock</p>
          <p className="sd-stat__value">{totalStock}</p>
          <span className="sd-stat__hint">Units available</span>
        </article>
        <article className="sd-stat">
          <p className="sd-stat__label">Inventory</p>
          <p className="sd-stat__value">${inventoryValue.toFixed(0)}</p>
          <span className="sd-stat__hint">${inventoryValue.toFixed(2)} total value</span>
        </article>
      </section>

      <section className="sd-panels">
        <article className="sd-panel">
          <header className="sd-panel__head">
            <div>
              <p className="sd-panel__eyebrow">Catalog</p>
              <h2>Recent products</h2>
            </div>
            <span className="sd-panel__count">{products.length}</span>
          </header>

          <div className="sd-panel__body sd-panel__body--scroll">
            {products.length === 0 ? (
              <div className="sd-empty">No products added yet.</div>
            ) : (
              <ul className="sd-product-list">
                {products.slice(0, 10).map((product) => {
                  const meta = getProductMeta(product);
                  return (
                    <li key={product.id}>
                      <button
                        type="button"
                        className="sd-product-row"
                        onClick={() =>
                          navigate("/products", { state: { viewProductId: product.id } })
                        }
                        aria-label={`View ${product.name}`}
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
                        <span className={`sd-stock sd-stock--${meta.stockTone}`}>
                          {meta.stockLabel}
                        </span>
                        <span className="sd-product-row__price">
                          ${Number(product.price || 0).toFixed(2)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </article>

        <article className="sd-panel" id="seller-orders">
          <header className="sd-panel__head">
            <div>
              <p className="sd-panel__eyebrow">Orders</p>
              <h2>Overview</h2>
            </div>
            <span className="sd-panel__count">{sellerOrders.length}</span>
          </header>

          <div className="sd-panel__body sd-panel__body--scroll">
            {sellerOrders.length === 0 ? (
              <div className="sd-empty">No orders on your store yet.</div>
            ) : (
              <div className="sd-order-list">
                {sellerOrders.map((order) => {
                  const itemsTotal = order.items.reduce(
                    (sum, item) => sum + Number(item.price || 0) * item.quantity,
                    0
                  );
                  const action = ORDER_ACTIONS[order.status];
                  const customer =
                    order.display_customer ||
                    order.customer_username ||
                    order.customer_name ||
                    "Guest";

                  return (
                    <article className="sd-order-card" key={order.id}>
                      <div className="sd-order-card__top">
                        <div>
                          <p className="sd-order-card__id">Order #{order.id}</p>
                          <p className="sd-order-card__date">{formatOrderDate(order.created_at)}</p>
                        </div>
                        <span className={`sd-status ${getStatusClass(order.status)}`}>
                          {order.status}
                        </span>
                      </div>

                      <div className="sd-order-card__summary">
                        <span>
                          Customer: <strong>{customer}</strong>
                        </span>
                        <span>
                          Order total: <strong>${Number(order.total_price || 0).toFixed(2)}</strong>
                        </span>
                      </div>

                      <div className="sd-order-items">
                        {order.items.map((item, idx) => (
                          <div className="sd-order-item" key={`${order.id}-${idx}`}>
                            <span className="sd-order-item__name">
                              {item.product_name} × {item.quantity}
                            </span>
                            <span className="sd-order-item__price">
                              ${(Number(item.price || 0) * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="sd-order-card__footer">
                        <span className="sd-order-card__subtotal">
                          Your items: <strong>${itemsTotal.toFixed(2)}</strong>
                        </span>
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
        </article>
      </section>
    </div>
  );
}

export default SellerDashboard;

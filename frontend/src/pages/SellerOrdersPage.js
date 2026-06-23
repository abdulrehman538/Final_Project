import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth, getAccessToken } from "../utils/authSession";
import { getSellerItems, getSellerTotal } from "../utils/sellerOrders";
import ModalCloseButton from "../components/ModalCloseButton";
import "./SellerOrdersPage.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

const STATUS_STEPS = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "completed", label: "Completed" },
];

const ORDER_ACTIONS = {
  pending: { label: "Confirm order", next: "confirmed" },
  confirmed: { label: "Mark shipped", next: "shipped" },
  shipped: { label: "Mark delivered", next: "delivered" },
  delivered: { label: "Complete order", next: "completed" },
};

const REJECTABLE_STATUSES = new Set(["pending", "confirmed", "shipped", "delivered"]);

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
  if (
    ["delivered", "completed", "cancelled", "confirmed", "shipped", "pending"].includes(
      normalized
    )
  ) {
    return `so-status-badge so-status-badge--${normalized}`;
  }
  return "so-status-badge so-status-badge--pending";
}

function OrderStatusTrack({ status }) {
  const normalized = (status || "pending").toLowerCase();

  if (normalized === "cancelled") {
    return (
      <div className="so-status-track so-status-track--cancelled" role="status">
        <span>Order cancelled</span>
      </div>
    );
  }

  const currentIndex = STATUS_STEPS.findIndex((step) => step.key === normalized);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  return (
    <div className="so-status-track" role="list" aria-label="Order status">
      {STATUS_STEPS.map((step, index) => {
        const isCurrent = index === activeIndex;
        const isComplete = index < activeIndex;
        const stateClass = isCurrent ? "is-current" : isComplete ? "is-complete" : "is-upcoming";

        return (
          <div
            key={step.key}
            className={`so-status-step ${stateClass}`}
            role="listitem"
            aria-current={isCurrent ? "step" : undefined}
          >
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function OrderDetailModal({ order, updating, onClose, onUpdateStatus }) {
  const sellerItems = getSellerItems(order);
  const sellerTotal = getSellerTotal(order);
  const action = ORDER_ACTIONS[order.status];
  const address = parseShippingAddress(order.shipping_address);
  const addressLines = getAddressLines(address);
  const buyerName = getBuyerName(order);

  return (
    <div className="so-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="so-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="so-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="so-modal__head">
          <div>
            <p className="so-modal__eyebrow">Order detail</p>
            <h2 id="so-modal-title">Order #{order.id}</h2>
            <p className="so-modal__meta">Placed {formatOrderDate(order.created_at)}</p>
          </div>
          <ModalCloseButton inline onClick={onClose} />
        </header>

        <div className="so-modal__toolbar">
          <OrderStatusTrack status={order.status} />
          <div className="so-modal__toolbar-actions">
            {action && (
              <button
                type="button"
                className="so-action-btn"
                onClick={() => onUpdateStatus(order.id, action.next)}
                disabled={updating}
              >
                {updating ? "Updating…" : action.label}
              </button>
            )}
            {REJECTABLE_STATUSES.has(order.status) && (
              <button
                type="button"
                className="so-action-btn so-action-btn--danger"
                onClick={() => onUpdateStatus(order.id, "cancelled")}
                disabled={updating}
              >
                {updating ? "Updating…" : "Reject order"}
              </button>
            )}
          </div>
        </div>

        <div className="so-modal__body">
          <div className="so-modal__sections">
            <section className="so-section so-section--order-detail">
              <header className="so-section__head">
                <h3>Your store items</h3>
                <span className="so-section__badge">{sellerItems.length} item(s)</span>
              </header>

              {sellerItems.length === 0 ? (
                <p className="so-section__empty">No items from your store in this order.</p>
              ) : (
                <div className="so-items-table">
                  <div className="so-items-table__head">
                    <span>Product</span>
                    <span>Qty</span>
                    <span>Price</span>
                    <span>Total</span>
                  </div>
                  {sellerItems.map((item) => (
                    <div className="so-items-table__row" key={item.id}>
                      <span className="so-items-table__product">{item.product_name}</span>
                      <span>{item.quantity}</span>
                      <span>${Number(item.price || 0).toFixed(2)}</span>
                      <span className="so-items-table__line-total">
                        ${(Number(item.price || 0) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div className="so-items-table__foot">
                    <span>Your store total</span>
                    <strong>${sellerTotal.toFixed(2)}</strong>
                  </div>
                </div>
              )}
            </section>

            <section className="so-section so-section--buyer">
              <header className="so-section__head">
                <h3>Buyer info</h3>
                <span className="so-section__badge so-section__badge--muted">Checkout details</span>
              </header>

              <dl className="so-buyer-grid">
                <div className="so-buyer-field">
                  <dt>Name</dt>
                  <dd>{buyerName}</dd>
                </div>
                <div className="so-buyer-field">
                  <dt>Phone</dt>
                  <dd>{order.customer_phone || "—"}</dd>
                </div>
                <div className="so-buyer-field">
                  <dt>Email</dt>
                  <dd>{order.customer_email || "—"}</dd>
                </div>
                {order.customer_username && (
                  <div className="so-buyer-field">
                    <dt>Account</dt>
                    <dd>{order.customer_username}</dd>
                  </div>
                )}
                <div className="so-buyer-field so-buyer-field--full">
                  <dt>Shipping address</dt>
                  <dd>
                    {addressLines.length > 0 ? (
                      <address className="so-address">
                        {addressLines.map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </address>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function SellerOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const selectedOrder = orders.find((order) => order.id === selectedOrderId);

  const closeModal = useCallback(() => setSelectedOrderId(null), []);

  useEffect(() => {
    const loadOrders = async () => {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetchWithAuth(`${API_BASE}/api/seller-orders/`);
        if (response.ok) {
          const data = await response.json();
          setOrders(Array.isArray(data) ? data : []);
        } else {
          setOrders([]);
        }
      } catch (error) {
        console.error("Seller orders load error:", error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, []);

  useEffect(() => {
    if (!selectedOrderId) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") closeModal();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedOrderId, closeModal]);

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
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId ? { ...order, status: updatedOrder.status } : order
        )
      );
    } catch (error) {
      console.error("Order status update failed", error);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (loading) {
    return <div className="empty-state">Loading orders...</div>;
  }

  return (
    <div className="seller-orders-page">
      <header className="so-page-head">
        <div>
          <p className="so-page-head__eyebrow">Store orders</p>
          <h1>Orders</h1>
          <p className="so-page-head__sub">
            Each order shows only products sold from your store — not items from other sellers.
          </p>
        </div>
        <span className="so-page-head__count">{orders.length} total</span>
      </header>

      {orders.length === 0 ? (
        <div className="so-empty card">No orders on your store yet.</div>
      ) : (
        <div className="so-table-card card">
          <div className="so-table__head">
            <span>Order #</span>
            <span>Amount</span>
            <span>Buyer</span>
            <span>Status</span>
            <span>Shipping address</span>
          </div>
          <ul className="so-table__body">
            {orders.map((order) => {
              const sellerTotal = getSellerTotal(order);
              const address = parseShippingAddress(order.shipping_address);
              const addressSummary =
                getAddressLines(address).join(", ") || "—";
              const buyerName = getBuyerName(order);

              return (
                <li key={order.id}>
                  <button
                    type="button"
                    className="so-table__row"
                    onClick={() => setSelectedOrderId(order.id)}
                    aria-label={`View order ${order.id}`}
                  >
                    <span className="so-table__order-id">#{order.id}</span>
                    <span className="so-table__amount">${sellerTotal.toFixed(2)}</span>
                    <span className="so-table__buyer">{buyerName}</span>
                    <span className={getStatusClass(order.status)}>{order.status}</span>
                    <span className="so-table__address">{addressSummary}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          updating={updatingOrderId === selectedOrder.id}
          onClose={closeModal}
          onUpdateStatus={updateOrderStatus}
        />
      )}
    </div>
  );
}

export default SellerOrdersPage;

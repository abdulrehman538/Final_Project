import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getProductMeta, resolveProductImage } from "../utils/productImage";
import { fetchWithAuth, getAccessToken } from "../utils/authSession";
import { normalizePhone, validateEmail, validatePhone } from "../utils/validation";
import { getOrderStatusLabel } from "../utils/orderStatus";
import { formatPrice, SHIPPING_FEE } from "../utils/currency";
import ModalCloseButton from "../components/ModalCloseButton";
import "./CartPage.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";
const TAX_RATE = 0.08;

function CartSkeleton() {
  return (
    <div className="ct-skeleton">
      <div className="ct-skeleton__thumb" />
      <div className="ct-skeleton__lines">
        <div className="ct-skeleton__line ct-skeleton__line--short" />
        <div className="ct-skeleton__line" />
        <div className="ct-skeleton__line" />
      </div>
      <div className="ct-skeleton__qty" />
    </div>
  );
}

function formatPlacedDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatAddressPreview(address = {}) {
  return [
    address.address1,
    address.address2,
    address.address3,
    address.postal_code,
  ]
    .filter(Boolean)
    .join(", ");
}

function OrderConfirmationModal({ summary, onContinue, onTrack }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(summary.id));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your order number:", String(summary.id));
    }
  };

  return (
    <div className="ct-modal-overlay ct-modal-overlay--confirm" role="dialog" aria-modal="true">
      <div className="ct-order-confirm">
        <div className="ct-order-confirm__hero">
          <div className="ct-order-confirm__icon" aria-hidden="true">
            ✓
          </div>
          <h2>Order placed successfully</h2>
          <p>Thank you for your purchase. Save your order number below.</p>
        </div>

        <div className="ct-order-confirm__number-card">
          <span className="ct-order-confirm__number-label">Your order number</span>
          <div className="ct-order-confirm__number-row">
            <strong className="ct-order-confirm__number">#{summary.id}</strong>
            <button type="button" className="btn btn-secondary ct-order-confirm__copy" onClick={handleCopy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="ct-order-confirm__number-hint">
            Use this number on the Track order page to check delivery status.
          </p>
        </div>

        <div className="ct-order-confirm__preview">
          <div className="ct-order-confirm__preview-head">
            <h3>Order preview</h3>
            <span className="ct-order-confirm__status">{getOrderStatusLabel(summary.status)}</span>
          </div>

          <ul className="ct-order-confirm__items">
            {summary.items.map((item, index) => {
              const name = item.product_name || item.name || "Product";
              const qty = Number(item.quantity) || 1;
              const unitPrice = Number(item.price) || 0;
              const lineTotal = unitPrice * qty;

              return (
                <li key={`${item.id || item.product || name}-${index}`}>
                  <div className="ct-order-confirm__item-info">
                    <strong>{name}</strong>
                    {item.store_name ? <span>{item.store_name}</span> : null}
                  </div>
                  <div className="ct-order-confirm__item-qty">×{qty}</div>
                  <div className="ct-order-confirm__item-price">${lineTotal.toFixed(2)}</div>
                </li>
              );
            })}
          </ul>

          <div className="ct-order-confirm__summary">
            <p><span>Subtotal</span><strong>${summary.subtotal.toFixed(2)}</strong></p>
            <p><span>Shipping</span><strong>${summary.shipping.toFixed(2)}</strong></p>
            <p><span>Tax</span><strong>${summary.tax.toFixed(2)}</strong></p>
            <p className="ct-order-confirm__summary-total">
              <span>Total (COD)</span>
              <strong>${summary.total.toFixed(2)}</strong>
            </p>
          </div>

          <div className="ct-order-confirm__meta">
            <p><span>Customer</span><strong>{summary.customerName}</strong></p>
            <p><span>Phone</span><strong>{summary.customerPhone}</strong></p>
            <p><span>Deliver to</span><strong>{formatAddressPreview(summary.address) || "—"}</strong></p>
            <p><span>Payment</span><strong>Cash on Delivery</strong></p>
            <p><span>Placed on</span><strong>{formatPlacedDate(summary.placedAt)}</strong></p>
          </div>
        </div>

        <div className="ct-order-confirm__actions">
          <button type="button" className="btn btn-primary" onClick={onContinue}>
            Continue shopping
          </button>
          <button type="button" className="btn btn-secondary" onClick={onTrack}>
            Track this order
          </button>
        </div>
      </div>
    </div>
  );
}

function CartPage({ cart = [], onAddToCart, onUpdateQuantity, onRemoveItem, onClearCart, onSyncCart }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liveCart, setLiveCart] = useState([]);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [completedOrderSummary, setCompletedOrderSummary] = useState(null);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [checkoutFieldErrors, setCheckoutFieldErrors] = useState({
    phone: "",
    email: "",
  });
  const [customerFields, setCustomerFields] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [addressFields, setAddressFields] = useState({
    detail: "",
    address1: "",
    address2: "",
    address3: "",
    postal_code: "",
  });
  const onSyncCartRef = useRef(onSyncCart);
  const hydrateRequestRef = useRef(0);

  useEffect(() => {
    onSyncCartRef.current = onSyncCart;
  }, [onSyncCart]);

  const stripCartFlags = (item) => {
    const { _savedPrice, _unavailable, _priceChanged, _qtyAdjusted, _stale, ...rest } = item;
    return rest;
  };

  const hydrateCart = useCallback(async () => {
    const requestId = ++hydrateRequestRef.current;

    if (!cart.length) {
      setLiveCart([]);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/products/`);
      if (requestId !== hydrateRequestRef.current) {
        return;
      }

      if (!response.ok) {
        throw new Error("Could not load live product data.");
      }

      const data = await response.json();
      if (requestId !== hydrateRequestRef.current) {
        return;
      }

      const catalog = Array.isArray(data) ? data : data.results || [];
      const catalogById = new Map(catalog.map((product) => [String(product.id), product]));

      const hydrated = cart.map((savedItem) => {
        const fresh = catalogById.get(String(savedItem.id));
        if (!fresh) {
          return {
            ...savedItem,
            _unavailable: true,
          };
        }

        const stock = Number(fresh.stock);
        const maxQty = Number.isFinite(stock) ? stock : savedItem.quantity;
        const quantity = Math.min(savedItem.quantity, Math.max(maxQty, 0));
        const savedPrice = Number(savedItem.price || 0);
        const livePrice = Number(fresh.price || 0);

        return {
          ...fresh,
          quantity: quantity > 0 ? quantity : savedItem.quantity,
          _savedPrice: savedPrice,
          _priceChanged: Math.abs(savedPrice - livePrice) > 0.009,
          _qtyAdjusted: quantity < savedItem.quantity,
          _unavailable: maxQty <= 0,
        };
      });

      if (requestId !== hydrateRequestRef.current) {
        return;
      }

      setLiveCart(hydrated);

      const cleaned = hydrated.map(stripCartFlags);
      const cartChanged =
        cleaned.length !== cart.length ||
        cleaned.some((item) => {
          const saved = cart.find((entry) => String(entry.id) === String(item.id));
          return (
            !saved ||
            saved.quantity !== item.quantity ||
            Number(saved.price || 0) !== Number(item.price || 0) ||
            saved.name !== item.name
          );
        });

      if (cartChanged && typeof onSyncCartRef.current === "function") {
        onSyncCartRef.current(cleaned);
      }
    } catch (err) {
      if (requestId !== hydrateRequestRef.current) {
        return;
      }

      setError(err.message || "Failed to refresh cart items.");
      setLiveCart(
        cart.map((item) => ({
          ...item,
          _stale: true,
        }))
      );
    } finally {
      if (requestId === hydrateRequestRef.current) {
        setLoading(false);
      }
    }
  }, [cart]);

  useEffect(() => {
    hydrateCart();
  }, [hydrateCart]);

  const availableItems = useMemo(
    () => liveCart.filter((item) => !item._unavailable && getProductMeta(item).stock > 0),
    [liveCart]
  );

  const unavailableItems = useMemo(
    () => liveCart.filter((item) => item._unavailable || getProductMeta(item).stock <= 0),
    [liveCart]
  );

  const totals = useMemo(() => {
    const subtotal = availableItems.reduce(
      (sum, item) => sum + Number(item.price || 0) * item.quantity,
      0
    );
    const units = availableItems.reduce((sum, item) => sum + item.quantity, 0);
    const shipping = availableItems.length ? SHIPPING_FEE : 0;
    const tax = subtotal * TAX_RATE;

    return {
      items: availableItems.length,
      units,
      subtotal,
      shipping,
      tax,
      total: subtotal + shipping + tax,
    };
  }, [availableItems]);

  const hasPriceChanges = useMemo(
    () => liveCart.some((item) => item._priceChanged),
    [liveCart]
  );

  const hasQtyAdjustments = useMemo(
    () => liveCart.some((item) => item._qtyAdjusted),
    [liveCart]
  );

  const handleOpenCheckout = useCallback(() => {
    if (!availableItems.length) {
      return false;
    }
    setShowModal(true);
    setOrderSuccess(false);
    setCheckoutFieldErrors({ phone: "", email: "" });
    return true;
  }, [availableItems.length]);

  useEffect(() => {
    const buyNow = location.state?.buyNow;
    if (buyNow?.product && typeof onAddToCart === "function") {
      onAddToCart(buyNow.product, buyNow.quantity || 1);
      setCheckoutPending(true);
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    if (location.state?.openCheckout) {
      setCheckoutPending(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, onAddToCart]);

  useEffect(() => {
    if (!checkoutPending || loading) {
      return;
    }

    if (!availableItems.length) {
      window.alert("This item is not available for checkout right now.");
      setCheckoutPending(false);
      return;
    }

    handleOpenCheckout();
    setCheckoutPending(false);
  }, [checkoutPending, loading, availableItems.length, handleOpenCheckout]);

  const handleConfirmOrder = async (event) => {
    event.preventDefault();
    setPlacingOrder(true);
    setCheckoutFieldErrors({ phone: "", email: "" });

    const isGuest = !getAccessToken();
    if (isGuest) {
      const phoneError = validatePhone(customerFields.phone, { required: true });
      const emailError = validateEmail(customerFields.email, { required: true });
      if (phoneError || emailError) {
        setCheckoutFieldErrors({
          phone: phoneError || "",
          email: emailError || "",
        });
        setPlacingOrder(false);
        return;
      }
    }

    const normalizedPhone = normalizePhone(customerFields.phone);

    const addressJson = JSON.stringify({
      detail: addressFields.detail,
      address1: addressFields.address1,
      address2: addressFields.address2,
      address3: addressFields.address3,
      postal_code: addressFields.postal_code,
    });

    try {
      const checkoutItems = availableItems.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      }));

      const checkoutResponse = await fetchWithAuth(`${API_BASE}/api/checkout/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: checkoutItems,
          customer_name: customerFields.name.trim(),
          customer_phone: normalizedPhone || customerFields.phone.trim(),
          customer_email: customerFields.email.trim(),
          shipping_address: addressJson,
        }),
      });

      if (!checkoutResponse.ok) {
        const errorData = await checkoutResponse.json().catch(() => ({}));
        const message =
          errorData.detail ||
          (Array.isArray(errorData) ? errorData.join(", ") : null) ||
          "Checkout failed. Please try again.";
        window.alert(`Checkout failed: ${message}`);
        setPlacingOrder(false);
        return;
      }

      const backendOrder = await checkoutResponse.json();
      const generatedOrderId = backendOrder.id;
      const orderDate = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });

      const newOrder = {
        id: generatedOrderId,
        status: backendOrder.status,
        total: `$${Number(backendOrder.total_price || totals.total).toFixed(2)}`,
        total_price: backendOrder.total_price,
        subtotal: `$${totals.subtotal.toFixed(2)}`,
        shipping: `$${totals.shipping.toFixed(2)}`,
        tax: `$${totals.tax.toFixed(2)}`,
        date: orderDate,
        created_at: new Date().toISOString(),
        address: addressFields,
        customerName: customerFields.name.trim(),
        customerPhone: normalizedPhone || customerFields.phone.trim(),
        customerEmail: customerFields.email.trim(),
        items: availableItems.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          store_name: item.store_name,
        })),
      };

      try {
        if (!getAccessToken()) {
          const existingOrdersRaw = localStorage.getItem("cartOrders");
          const existingOrders = existingOrdersRaw ? JSON.parse(existingOrdersRaw) : [];
          localStorage.setItem("cartOrders", JSON.stringify([newOrder, ...existingOrders]));
        }
      } catch (err) {
        console.error("Failed to store local order", err);
      }

      hydrateRequestRef.current += 1;
      setLiveCart([]);
      onClearCart();

      setCompletedOrderSummary({
        id: generatedOrderId,
        status: backendOrder.status || "pending",
        total: Number(backendOrder.total_price || totals.total),
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        tax: totals.tax,
        items: Array.isArray(backendOrder.items)
          ? backendOrder.items
          : availableItems.map((item) => ({
              product_name: item.name,
              store_name: item.store_name,
              quantity: item.quantity,
              price: item.price,
            })),
        customerName: customerFields.name.trim(),
        customerPhone: normalizedPhone || customerFields.phone.trim(),
        customerEmail: customerFields.email.trim(),
        address: addressFields,
        placedAt: backendOrder.created_at || new Date().toISOString(),
      });
      setOrderSuccess(true);
    } catch (err) {
      console.error("Checkout error:", err);
      window.alert("Failed to process checkout. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  };

  const openProduct = (item) => {
    navigate(`/product/${item.id}`, { state: { product: item } });
  };

  const handleRemoveUnavailable = () => {
    unavailableItems.forEach((item) => onRemoveItem(item.id));
  };

  const handleDismissOrderConfirm = (destination = "/marketplace", navigateOptions = {}) => {
    setOrderSuccess(false);
    setShowModal(false);
    setCompletedOrderSummary(null);
    navigate(destination, navigateOptions);
  };

  if (orderSuccess && completedOrderSummary) {
    return (
      <div className="ct-page ct-page--confirm">
        <OrderConfirmationModal
          summary={completedOrderSummary}
          onContinue={() => handleDismissOrderConfirm("/marketplace")}
          onTrack={() =>
            handleDismissOrderConfirm("/track-order", {
              state: { orderId: completedOrderSummary.id },
            })
          }
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="ct-page">
        <div className="ct-hero">
          <div>
            <p className="ct-hero__eyebrow">Cart</p>
            <h1>Your shopping cart</h1>
            <p>Loading live prices and availability...</p>
          </div>
        </div>
        <div className="ct-loading">
          <CartSkeleton />
          <CartSkeleton />
        </div>
      </div>
    );
  }

  if (!cart.length) {
    return (
      <div className="ct-page">
        <div className="ct-empty">
          <div className="ct-empty__icon" aria-hidden="true">
            🛒
          </div>
          <h2>Your cart is empty</h2>
          <p>Add products from the marketplace — your cart stays saved on this device with live pricing at checkout.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate("/marketplace")}>
            Browse marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ct-page">
      <div className="ct-hero">
        <div>
          <p className="ct-hero__eyebrow">Cart</p>
          <h1>Your shopping cart</h1>
          <p>Live catalog pricing and stock — checkout as a guest, no account needed.</p>
        </div>

        <div className="ct-hero__actions">
          <div className="ct-hero__stats">
            <div className="ct-stat">
              <span>Products</span>
              <strong>{totals.items}</strong>
            </div>
            <div className="ct-stat">
              <span>Units</span>
              <strong>{totals.units}</strong>
            </div>
            <div className="ct-stat">
              <span>Subtotal</span>
              <strong>${totals.subtotal.toFixed(2)}</strong>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary ct-clear-btn"
            onClick={onClearCart}
            disabled={!cart.length}
          >
            Clear cart
          </button>
        </div>
      </div>

      {error && (
        <div className="ct-error" role="alert">
          {error} Showing your last saved cart until the API is available again.
        </div>
      )}

      {(hasPriceChanges || hasQtyAdjustments) && (
        <div className="ct-alert">
          <span>
            {hasPriceChanges && "Prices updated from the live catalog. "}
            {hasQtyAdjustments && "Some quantities were adjusted to match available stock."}
          </span>
        </div>
      )}

      <div className="ct-layout">
        <div className="ct-main">
          {unavailableItems.length > 0 && (
            <div className="ct-alert ct-alert--warn">
              <span>
                {unavailableItems.length} item{unavailableItems.length === 1 ? "" : "s"} unavailable or out of stock.
              </span>
              <button type="button" onClick={handleRemoveUnavailable}>
                Remove unavailable
              </button>
            </div>
          )}

          <div className="ct-list">
            {liveCart.map((item) => {
              const meta = getProductMeta(item);
              const outOfStock = item._unavailable || meta.stock <= 0;
              const maxQty = Number.isFinite(Number(item.stock)) ? Number(item.stock) : item.quantity;
              const lineTotal = Number(item.price || 0) * item.quantity;

              return (
                <article className={`ct-item${outOfStock ? " ct-item--muted" : ""}`} key={item.id}>
                  <button
                    type="button"
                    className="ct-item__media"
                    onClick={() => openProduct(item)}
                    aria-label={`View ${item.name}`}
                  >
                    <img src={resolveProductImage(item)} alt={item.name} loading="lazy" />
                    <span
                      className={`ct-item__badge${meta.stockTone === "low" ? " ct-item__badge--low" : ""}${meta.stockTone === "out" ? " ct-item__badge--out" : ""}`}
                    >
                      {item._unavailable ? "Unavailable" : meta.stockLabel}
                    </span>
                  </button>

                  <div className="ct-item__body">
                    <span className="ct-item__store">{meta.store}</span>
                    <button type="button" className="ct-item__title" onClick={() => openProduct(item)}>
                      {item.name}
                    </button>
                    <div className="ct-item__meta">
                      <span className="ct-item__unit">${Number(item.price || 0).toFixed(2)} each</span>
                      {item._priceChanged && (
                        <span className="ct-item__flag">Price updated</span>
                      )}
                      {item._qtyAdjusted && (
                        <span className="ct-item__flag">Qty adjusted</span>
                      )}
                      {item._stale && <span className="ct-item__flag">Offline snapshot</span>}
                    </div>
                    <p className="ct-item__line-total">${lineTotal.toFixed(2)}</p>
                  </div>

                  <div className="ct-item__aside">
                    <div className="ct-qty">
                      <button
                        type="button"
                        disabled={outOfStock || item.quantity <= 1}
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        disabled={outOfStock || item.quantity >= maxQty}
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      className="ct-item__remove"
                      onClick={() => onRemoveItem(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="ct-sidebar">
          <h3>Order summary</h3>
          <div className="ct-summary-row">
            <span>Subtotal ({totals.units} units)</span>
            <strong>${totals.subtotal.toFixed(2)}</strong>
          </div>
          <div className="ct-summary-row">
            <span>Shipping</span>
            <strong>${totals.shipping.toFixed(2)}</strong>
          </div>
          <div className="ct-summary-row">
            <span>Estimated tax</span>
            <strong>${totals.tax.toFixed(2)}</strong>
          </div>
          <div className="ct-summary-row ct-summary-row--total">
            <span>Total</span>
            <strong>${totals.total.toFixed(2)}</strong>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            disabled={!availableItems.length}
            onClick={() => {
              if (!handleOpenCheckout()) {
                window.alert("Add in-stock items to your cart before checkout.");
              }
            }}
          >
            Proceed to checkout
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate("/marketplace")}>
            Continue shopping
          </button>
          <p className="ct-sidebar__note">
            Cash on delivery available. Totals use live product prices from the marketplace catalog.
          </p>
        </aside>
      </div>

      {showModal && (
        <div className="ct-modal-overlay">
          <div className="ct-checkout-modal">
            <ModalCloseButton onClick={() => setShowModal(false)} />

            {orderSuccess ? null : (
              <form onSubmit={handleConfirmOrder} className="ct-checkout-form">
                <div className="ct-checkout-head">
                  <p className="ct-hero__eyebrow">Checkout</p>
                  <h2>Review & confirm</h2>
                  <p>No account required — enter delivery details to complete your order.</p>
                </div>

                <div className="ct-checkout-grid">
                  <div className="ct-checkout-section">
                    <h4>Contact details</h4>
                    <div className="ct-fields">
                      <label className="field-label">Full name</label>
                      <input
                        className="field-input"
                        type="text"
                        value={customerFields.name}
                        placeholder="Who should we deliver to?"
                        onChange={(e) => setCustomerFields((prev) => ({ ...prev, name: e.target.value }))}
                        required
                      />

                      <label className="field-label">Phone number</label>
                      <input
                        className="field-input"
                        type="tel"
                        inputMode="numeric"
                        maxLength={11}
                        value={customerFields.phone}
                        placeholder="e.g. 03001234567"
                        onChange={(e) => {
                          setCustomerFields((prev) => ({ ...prev, phone: e.target.value }));
                          if (checkoutFieldErrors.phone) {
                            setCheckoutFieldErrors((prev) => ({ ...prev, phone: "" }));
                          }
                        }}
                        required
                      />
                      {checkoutFieldErrors.phone ? (
                        <div className="auth-alert">{checkoutFieldErrors.phone}</div>
                      ) : null}

                      <label className="field-label">Email</label>
                      <input
                        className="field-input"
                        type="email"
                        value={customerFields.email}
                        placeholder="e.g. alex@gmail.com"
                        onChange={(e) => {
                          setCustomerFields((prev) => ({ ...prev, email: e.target.value }));
                          if (checkoutFieldErrors.email) {
                            setCheckoutFieldErrors((prev) => ({ ...prev, email: "" }));
                          }
                        }}
                        required
                      />
                      {checkoutFieldErrors.email ? (
                        <div className="auth-alert">{checkoutFieldErrors.email}</div>
                      ) : null}
                    </div>

                    <h4>Delivery address</h4>
                    <div className="ct-fields">
                      <label className="field-label">Address line 1</label>
                      <input
                        className="field-input"
                        type="text"
                        value={addressFields.address1}
                        placeholder="House / apartment, building name"
                        onChange={(e) => setAddressFields((prev) => ({ ...prev, address1: e.target.value }))}
                        required
                      />

                      <label className="field-label">Address line 2</label>
                      <input
                        className="field-input"
                        type="text"
                        value={addressFields.address2}
                        placeholder="Street, area, colony"
                        onChange={(e) => setAddressFields((prev) => ({ ...prev, address2: e.target.value }))}
                      />

                      <label className="field-label">Address line 3</label>
                      <input
                        className="field-input"
                        type="text"
                        value={addressFields.address3}
                        placeholder="Landmark, city, state"
                        onChange={(e) => setAddressFields((prev) => ({ ...prev, address3: e.target.value }))}
                      />

                      <label className="field-label">Postal / zip code</label>
                      <input
                        className="field-input"
                        type="text"
                        value={addressFields.postal_code}
                        placeholder="e.g. 10001"
                        onChange={(e) => setAddressFields((prev) => ({ ...prev, postal_code: e.target.value }))}
                        required
                      />

                      <label className="field-label">Delivery instructions</label>
                      <textarea
                        className="field-input"
                        value={addressFields.detail}
                        placeholder="Landmarks or special instructions"
                        rows="2"
                        onChange={(e) => setAddressFields((prev) => ({ ...prev, detail: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="ct-checkout-aside">
                    <div className="ct-checkout-summary">
                      <h4>Order totals</h4>
                      <ul className="ct-checkout-items">
                        {availableItems.map((item) => (
                          <li key={item.id} className="ct-checkout-items__row">
                            <span className="ct-checkout-items__name">{item.name}</span>
                            <span className="ct-checkout-items__qty">×{item.quantity}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="ct-summary-row">
                        <span>Items subtotal</span>
                        <strong>${totals.subtotal.toFixed(2)}</strong>
                      </div>
                      <div className="ct-summary-row">
                        <span>Delivery</span>
                        <strong>${totals.shipping.toFixed(2)}</strong>
                      </div>
                      <div className="ct-summary-row">
                        <span>Estimated tax</span>
                        <strong>${totals.tax.toFixed(2)}</strong>
                      </div>
                      <div className="ct-summary-row ct-summary-row--total">
                        <span>Grand total</span>
                        <strong>${totals.total.toFixed(2)}</strong>
                      </div>
                    </div>

                    <div className="ct-cod">
                      <h4>Payment method</h4>
                      <label className="ct-cod__option">
                        <input type="radio" checked readOnly />
                        <span>
                          <strong>Cash on delivery</strong>
                          <small>Pay when your package arrives.</small>
                        </span>
                      </label>
                    </div>

                    <button className="btn btn-primary ct-place-order" type="submit" disabled={placingOrder}>
                      {placingOrder ? "Placing order..." : "Confirm & place order"}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CartPage;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getProductMeta, resolveProductImage } from "../utils/productImage";
import { fetchWithAuth, getAccessToken } from "../utils/authSession";
import "./CartPage.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";
const SHIPPING_FEE = 12.99;
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

function CartPage({ cart = [], onAddToCart, onUpdateQuantity, onRemoveItem, onClearCart, onSyncCart }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liveCart, setLiveCart] = useState([]);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [newOrderId, setNewOrderId] = useState("");
  const [completedTotal, setCompletedTotal] = useState(0);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [showModal, setShowModal] = useState(false);
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

  useEffect(() => {
    onSyncCartRef.current = onSyncCart;
  }, [onSyncCart]);

  const stripCartFlags = (item) => {
    const { _savedPrice, _unavailable, _priceChanged, _qtyAdjusted, _stale, ...rest } = item;
    return rest;
  };

  const hydrateCart = useCallback(async () => {
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
      if (!response.ok) {
        throw new Error("Could not load live product data.");
      }

      const data = await response.json();
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
      setError(err.message || "Failed to refresh cart items.");
      setLiveCart(
        cart.map((item) => ({
          ...item,
          _stale: true,
        }))
      );
    } finally {
      setLoading(false);
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
          customer_phone: customerFields.phone.trim(),
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
        customerPhone: customerFields.phone.trim(),
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

      setNewOrderId(generatedOrderId);
      setCompletedTotal(totals.total);
      setOrderSuccess(true);
      onClearCart();
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
            <button type="button" className="ct-modal-close" onClick={() => setShowModal(false)} aria-label="Close">
              ×
            </button>

            {orderSuccess ? (
              <div className="ct-success">
                <div className="ct-success__icon">✓</div>
                <h3>Order placed successfully</h3>
                <p className="ct-success__text">
                  Your order <strong>#{newOrderId}</strong> has been received.
                </p>
                <div className="ct-success__box">
                  <p><span>Payment</span><strong>Cash on Delivery</strong></p>
                  <p><span>Deliver to</span><strong>{addressFields.address1}, {addressFields.postal_code}</strong></p>
                  <p><span>Total</span><strong>${completedTotal.toFixed(2)}</strong></p>
                </div>
                <button className="btn btn-primary" type="button" onClick={() => navigate("/orders")}>
                  View orders
                </button>
              </div>
            ) : (
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
                        type="text"
                        value={customerFields.phone}
                        placeholder="e.g. 03001234567"
                        onChange={(e) => setCustomerFields((prev) => ({ ...prev, phone: e.target.value }))}
                      />

                      <label className="field-label">Email (optional)</label>
                      <input
                        className="field-input"
                        type="email"
                        value={customerFields.email}
                        placeholder="For order updates"
                        onChange={(e) => setCustomerFields((prev) => ({ ...prev, email: e.target.value }))}
                      />
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

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./CartPage.css";

function CartPage({ cart = [], onUpdateQuantity, onRemoveItem, onClearCart }) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [addressFields, setAddressFields] = useState({
    detail: "",
    address1: "",
    address2: "",
    address3: "",
    postal_code: "",
  });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profile, setProfile] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [newOrderId, setNewOrderId] = useState("");

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
  const shipping = cart.length ? 12.99 : 0;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  const handleOpenCheckout = async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    setShowModal(true);
    setLoadingProfile(true);
    setOrderSuccess(false);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/profile/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        if (data.address) {
          try {
            const parsed = JSON.parse(data.address);
            setAddressFields({
              detail: parsed.detail || "",
              address1: parsed.address1 || "",
              address2: parsed.address2 || "",
              address3: parsed.address3 || "",
              postal_code: parsed.postal_code || "",
            });
          } catch {
            setAddressFields({
              detail: "",
              address1: data.address || "",
              address2: "",
              address3: "",
              postal_code: "",
            });
          }
        }
      }
    } catch (e) {
      console.error("Failed to load profile for checkout", e);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleConfirmOrder = async (e) => {
    e.preventDefault();
    setPlacingOrder(true);

    const token = localStorage.getItem("accessToken");
    const addressJson = JSON.stringify({
      detail: addressFields.detail,
      address1: addressFields.address1,
      address2: addressFields.address2,
      address3: addressFields.address3,
      postal_code: addressFields.postal_code,
    });

    // Update profile with checkout address
    if (token && profile) {
      try {
        await fetch("http://127.0.0.1:8000/api/profile/", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...profile,
            address: addressJson,
          }),
        });
      } catch (err) {
        console.error("Failed to update checkout address to profile", err);
      }
    }

    // Call backend checkout endpoint
    try {
      const checkoutItems = cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      }));

      const checkoutResponse = await fetch("http://127.0.0.1:8000/api/checkout/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: checkoutItems }),
      });

      if (!checkoutResponse.ok) {
        const errorData = await checkoutResponse.json();
        alert(`Checkout failed: ${errorData.detail || "Unknown error"}`);
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
        total: `$${Number(backendOrder.total_price || 0).toFixed(2)}`,
        subtotal: `$${subtotal.toFixed(2)}`,
        shipping: `$${shipping.toFixed(2)}`,
        tax: `$${tax.toFixed(2)}`,
        date: orderDate,
        address: addressFields,
        buyerName: profile?.username || localStorage.getItem("username") || "Buyer",
        buyerPhone: profile?.phone || "",
        buyerEmail: profile?.email || "",
        items: cart.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          store_name: item.store_name,
        })),
      };

      try {
        const existingOrdersRaw = localStorage.getItem("cartOrders");
        const existingOrders = existingOrdersRaw ? JSON.parse(existingOrdersRaw) : [];
        localStorage.setItem("cartOrders", JSON.stringify([newOrder, ...existingOrders]));
      } catch (err) {
        console.error("Failed to store local order", err);
      }

      setNewOrderId(generatedOrderId);
      setOrderSuccess(true);
      onClearCart();
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Failed to process checkout. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div className="cart-page">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Cart</p>
            <h2>Your shopping cart</h2>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClearCart} disabled={cart.length === 0}>
            Clear Cart
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="empty-state">No items in your cart yet.</div>
        ) : (
          <div className="cart-table">
            {cart.map((item) => (
              <div className="cart-table-row" key={item.id}>
                <div className="cart-table-product">
                  <img
                    src={(() => {
                      const src = (item.images && item.images[0] && item.images[0].image) || item.image_url;
                      if (!src) return `https://placehold.co/160x160/fdf2e8/f57224?text=${encodeURIComponent(item.name.slice(0, 6))}`;
                      return src.startsWith("/") ? `http://127.0.0.1:8000${src}` : src;
                    })()}
                    alt={item.name}
                  />
                  <div>
                    <strong>{item.name}</strong>
                    <p className="subtext">{item.store_name || "Marketplace Store"}</p>
                  </div>
                </div>

                <strong>${Number(item.price || 0).toFixed(2)}</strong>

                <div className="quantity-control">
                  <button type="button" className="btn btn-ghost" onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}>
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button type="button" className="btn btn-ghost" onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}>
                    +
                  </button>
                </div>

                <strong>${(Number(item.price || 0) * item.quantity).toFixed(2)}</strong>

                <button type="button" className="btn btn-danger" onClick={() => onRemoveItem(item.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <aside className="cart-summary-panel card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Summary</p>
            <h3>Order totals</h3>
          </div>
        </div>

        <div className="summary-box">
          <div>
            <span>Subtotal</span>
            <strong>${subtotal.toFixed(2)}</strong>
          </div>
          <div>
            <span>Shipping</span>
            <strong>${shipping.toFixed(2)}</strong>
          </div>
          <div>
            <span>Tax</span>
            <strong>${tax.toFixed(2)}</strong>
          </div>
          <div className="summary-total">
            <span>Grand Total</span>
            <strong>${total.toFixed(2)}</strong>
          </div>
        </div>

        {!localStorage.getItem("accessToken") && cart.length > 0 ? (
          <div className="checkout-login-prompt">
            <p>Please sign in to complete checkout.</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate("/login")}
            >
              Sign In
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={cart.length === 0}
            onClick={handleOpenCheckout}
          >
            Checkout
          </button>
        )}
      </aside>

      {showModal && (
        <div className="modal-overlay">
          <div className="checkout-modal card fade-in">
            <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            
            {orderSuccess ? (
              <div className="order-success-state">
                <div className="success-icon">✓</div>
                <h3>Order Placed Successfully!</h3>
                <p className="subtext">Your order <strong>{newOrderId}</strong> has been received.</p>
                <div className="success-summary">
                  <p><strong>Payment Method:</strong> Cash on Delivery (COD)</p>
                  <p><strong>Deliver To:</strong> {addressFields.address1}, {addressFields.postal_code}</p>
                  <p><strong>Total Paid:</strong> ${total.toFixed(2)}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(false)}>Continue Shopping</button>
              </div>
            ) : (
              <form onSubmit={handleConfirmOrder} className="checkout-form">
                <div className="modal-header">
                  <p className="eyebrow">Checkout</p>
                  <h2>Review & Confirm Order</h2>
                </div>

                <div className="modal-body-grid">
                  <div className="shipping-section">
                    <h4>Delivery Address</h4>
                    {loadingProfile ? (
                      <p className="subtext">Loading delivery address...</p>
                    ) : (
                      <div className="address-inputs">
                        <label className="field-label">Address Line 1</label>
                        <input
                          className="field-input"
                          type="text"
                          value={addressFields.address1}
                          placeholder="House/Apartment number, building name"
                          onChange={(e) => setAddressFields(prev => ({ ...prev, address1: e.target.value }))}
                          required
                        />

                        <label className="field-label">Address Line 2</label>
                        <input
                          className="field-input"
                          type="text"
                          value={addressFields.address2}
                          placeholder="Street, area, colony name"
                          onChange={(e) => setAddressFields(prev => ({ ...prev, address2: e.target.value }))}
                        />

                        <label className="field-label">Address Line 3</label>
                        <input
                          className="field-input"
                          type="text"
                          value={addressFields.address3}
                          placeholder="Landmark, city, state"
                          onChange={(e) => setAddressFields(prev => ({ ...prev, address3: e.target.value }))}
                        />

                        <label className="field-label">Postal / Zip Code</label>
                        <input
                          className="field-input"
                          type="text"
                          value={addressFields.postal_code}
                          placeholder="e.g. 10001"
                          onChange={(e) => setAddressFields(prev => ({ ...prev, postal_code: e.target.value }))}
                          required
                        />

                        <label className="field-label">Delivery Instructions / Detail</label>
                        <textarea
                          className="field-input"
                          value={addressFields.detail}
                          placeholder="Additional landmarks or special delivery instructions"
                          rows="2"
                          onChange={(e) => setAddressFields(prev => ({ ...prev, detail: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>

                  <div className="summary-payment-section">
                    <div className="checkout-summary-box">
                      <h4>Order Totals</h4>
                      <div className="summary-row">
                        <span>Items Subtotal</span>
                        <strong>${subtotal.toFixed(2)}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Delivery / Shipping</span>
                        <strong>${shipping.toFixed(2)}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Estimated Tax</span>
                        <strong>${tax.toFixed(2)}</strong>
                      </div>
                      <div className="summary-row grand-total">
                        <span>Grand Total</span>
                        <strong>${total.toFixed(2)}</strong>
                      </div>
                    </div>

                    <div className="payment-method-box">
                      <h4>Payment Method</h4>
                      <div className="cod-badge">
                        <input type="radio" checked readOnly id="cod" />
                        <label htmlFor="cod">
                          <strong>Cash on Delivery (COD)</strong>
                          <p className="subtext" style={{ margin: 0, fontSize: "0.85rem" }}>Pay with cash upon package delivery.</p>
                        </label>
                      </div>
                    </div>

                    <button className="btn btn-primary place-order-btn" type="submit" disabled={placingOrder}>
                      {placingOrder ? "Placing Order..." : "Confirm & Place Order"}
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

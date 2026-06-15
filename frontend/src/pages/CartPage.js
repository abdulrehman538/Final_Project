function CartPage({ cart = [], onUpdateQuantity, onRemoveItem, onClearCart }) {
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
  const shipping = cart.length ? 12.99 : 0;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

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

        <button
          type="button"
          className="btn btn-primary"
          disabled={cart.length === 0}
          onClick={() => window.alert("Proceed to payment from a product page or wire this button to the checkout module next.")}
        >
          Checkout
        </button>
      </aside>
    </div>
  );
}

export default CartPage;

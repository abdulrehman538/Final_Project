import { useNavigate } from "react-router-dom";

function WishlistPage({ wishlist = [], onToggleWishlist, onAddToCart, isAuthenticated = false }) {
  const navigate = useNavigate();
  return (
    <div className="wishlist-page">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Wishlist</p>
            <h2>Saved products</h2>
          </div>
          <span className="pill">{wishlist.length} items</span>
        </div>

        {wishlist.length === 0 ? (
          <div className="empty-state">Your wishlist is empty.</div>
        ) : (
          <div className="wishlist-grid">
            {wishlist.map((item) => (
              <article className="wishlist-card" key={item.id}>
                <img
                  src={(() => {
                    const src = (item.images && item.images[0] && item.images[0].image) || item.image_url;
                    if (!src) return `https://placehold.co/600x600/fdf2e8/f57224?text=${encodeURIComponent(item.name.slice(0, 6))}`;
                    return src.startsWith("/") ? `http://127.0.0.1:8000${src}` : src;
                  })()}
                  alt={item.name}
                />
                <div className="wishlist-copy">
                  <strong>{item.name}</strong>
                  <p className="subtext">${Number(item.price || 0).toFixed(2)}</p>
                  <div className="product-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => onAddToCart(item)}
                    >
                      Add to Cart
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => onToggleWishlist(item)}>
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default WishlistPage;

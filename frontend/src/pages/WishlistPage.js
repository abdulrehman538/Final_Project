import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProductMeta, resolveProductImage } from "../utils/productImage";
import "./WishlistPage.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

function WishlistSkeleton() {
  return (
    <div className="wl-skeleton">
      <div className="wl-skeleton__thumb" />
      <div className="wl-skeleton__lines">
        <div className="wl-skeleton__line wl-skeleton__line--short" />
        <div className="wl-skeleton__line" />
        <div className="wl-skeleton__line" />
      </div>
      <div className="wl-skeleton__line" />
    </div>
  );
}

function WishlistPage({ wishlist = [], onToggleWishlist, onAddToCart, onAddManyToCart }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liveProducts, setLiveProducts] = useState([]);
  const [addedIds, setAddedIds] = useState(() => new Set());

  const hydrateWishlist = useCallback(async () => {
    if (!wishlist.length) {
      setLiveProducts([]);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/products/`);
      if (!response.ok) {
        throw new Error("Could not load products from the marketplace.");
      }

      const data = await response.json();
      const catalog = Array.isArray(data) ? data : data.results || [];
      const catalogById = new Map(catalog.map((product) => [String(product.id), product]));

      const hydrated = wishlist
        .map((saved) => catalogById.get(String(saved.id)))
        .filter(Boolean);

      setLiveProducts(hydrated);
    } catch (err) {
      setError(err.message || "Failed to refresh wishlist items.");
      setLiveProducts(
        wishlist.map((item) => ({
          ...item,
          _stale: true,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [wishlist]);

  useEffect(() => {
    hydrateWishlist();
  }, [hydrateWishlist]);

  const unavailableItems = useMemo(
    () =>
      wishlist.filter(
        (saved) => !liveProducts.some((product) => String(product.id) === String(saved.id))
      ),
    [wishlist, liveProducts]
  );

  const totals = useMemo(() => {
    const inStockItems = liveProducts.filter((product) => getProductMeta(product).stock > 0);
    const value = liveProducts.reduce((sum, product) => sum + Number(product.price || 0), 0);

    return {
      count: liveProducts.length,
      inStock: inStockItems.length,
      value,
      inStockValue: inStockItems.reduce((sum, product) => sum + Number(product.price || 0), 0),
    };
  }, [liveProducts]);

  const handleRemoveUnavailable = () => {
    unavailableItems.forEach((item) => onToggleWishlist(item));
  };

  const handleAddToCart = (product) => {
    if (typeof onAddToCart !== "function") {
      return;
    }

    const meta = getProductMeta(product);
    if (meta.stock <= 0) {
      window.alert("This item is currently out of stock.");
      return;
    }

    const added = onAddToCart(product, 1);
    if (!added) {
      return;
    }

    const productId = String(product.id);
    setAddedIds((current) => new Set(current).add(productId));
    window.setTimeout(() => {
      setAddedIds((current) => {
        const next = new Set(current);
        next.delete(productId);
        return next;
      });
    }, 1800);
  };

  const handleAddAllToCart = () => {
    const inStockItems = liveProducts.filter((product) => getProductMeta(product).stock > 0);
    if (!inStockItems.length) {
      window.alert("No in-stock items to add.");
      return;
    }

    if (typeof onAddManyToCart === "function") {
      onAddManyToCart(inStockItems, 1);
    } else if (typeof onAddToCart === "function") {
      inStockItems.forEach((product) => onAddToCart(product, 1));
    }

    setAddedIds(new Set(inStockItems.map((product) => String(product.id))));
    window.setTimeout(() => setAddedIds(new Set()), 1800);
  };

  const openProduct = (product) => {
    navigate(`/product/${product.id}`, { state: { product } });
  };

  if (loading) {
    return (
      <div className="wl-page">
        <div className="wl-hero">
          <div>
            <p className="wl-hero__eyebrow">Wishlist</p>
            <h1>Your saved products</h1>
            <p>Loading live prices and availability...</p>
          </div>
        </div>
        <div className="wl-loading">
          <WishlistSkeleton />
          <WishlistSkeleton />
          <WishlistSkeleton />
        </div>
      </div>
    );
  }

  if (!wishlist.length) {
    return (
      <div className="wl-page">
        <div className="wl-empty">
          <div className="wl-empty__icon" aria-hidden="true">
            ♡
          </div>
          <h2>Your wishlist is empty</h2>
          <p>Save products you love while browsing — they will show up here with live prices and stock.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate("/marketplace")}>
            Browse marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wl-page">
      <div className="wl-hero">
        <div>
          <p className="wl-hero__eyebrow">Wishlist</p>
          <h1>Your saved products</h1>
          <p>Live data from the marketplace — prices, stock, and seller details stay up to date.</p>
        </div>

        <div className="wl-hero__stats">
          <div className="wl-stat">
            <span>Saved</span>
            <strong>{totals.count}</strong>
          </div>
          <div className="wl-stat">
            <span>In stock</span>
            <strong>{totals.inStock}</strong>
          </div>
          <div className="wl-stat">
            <span>Total value</span>
            <strong>${totals.value.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {error && (
        <div className="wl-error" role="alert">
          {error} Showing your last saved snapshot until the API is available again.
        </div>
      )}

      <div className="wl-layout">
        <div className="wl-main">
          {unavailableItems.length > 0 && (
            <div className="wl-alert">
              <span>
                {unavailableItems.length} saved item{unavailableItems.length === 1 ? "" : "s"} no longer available in the catalog.
              </span>
              <button type="button" onClick={handleRemoveUnavailable}>
                Remove unavailable
              </button>
            </div>
          )}

          <div className="wl-list">
            {liveProducts.map((product) => {
              const meta = getProductMeta(product);
              const outOfStock = meta.stock <= 0;
              const isAdded = addedIds.has(String(product.id));

              return (
                <article className="wl-item" key={product.id}>
                  <button
                    type="button"
                    className="wl-item__media"
                    onClick={() => openProduct(product)}
                    aria-label={`View ${product.name}`}
                  >
                    <img src={resolveProductImage(product)} alt={product.name} loading="lazy" />
                    <span
                      className={`wl-item__badge${meta.stockTone === "low" ? " wl-item__badge--low" : ""}${meta.stockTone === "out" ? " wl-item__badge--out" : ""}`}
                    >
                      {meta.stockLabel}
                    </span>
                  </button>

                  <div className="wl-item__body">
                    <span className="wl-item__store">{meta.store}</span>
                    <button type="button" className="wl-item__title" onClick={() => openProduct(product)}>
                      {product.name}
                    </button>
                    <div className="wl-item__meta">
                      <span className="wl-item__rating">★ {meta.rating}</span>
                      <span>{meta.category}</span>
                      {product._stale && <span>Offline snapshot</span>}
                    </div>
                    <p className="wl-item__price">${Number(product.price || 0).toFixed(2)}</p>
                  </div>

                  <div className="wl-item__actions">
                    <button
                      type="button"
                      className={`btn btn-primary${isAdded ? " is-active" : ""}`}
                      disabled={outOfStock}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleAddToCart(product);
                      }}
                    >
                      {outOfStock ? "Out of stock" : isAdded ? "Added" : "Add to cart"}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => openProduct(product)}>
                      View
                    </button>
                    <button
                      type="button"
                      className="wl-item__remove"
                      onClick={() => onToggleWishlist(product)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="wl-sidebar">
          <h3>Summary</h3>
          <div className="wl-summary-row">
            <span>Items saved</span>
            <strong>{totals.count}</strong>
          </div>
          <div className="wl-summary-row">
            <span>Ready to buy</span>
            <strong>{totals.inStock}</strong>
          </div>
          <div className="wl-summary-row">
            <span>List value</span>
            <strong>${totals.value.toFixed(2)}</strong>
          </div>
          <div className="wl-summary-row wl-summary-row--total">
            <span>In-stock value</span>
            <strong>${totals.inStockValue.toFixed(2)}</strong>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            disabled={!totals.inStock}
            onClick={handleAddAllToCart}
          >
            Add all in-stock to cart
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate("/marketplace")}>
            Continue shopping
          </button>
          <p className="wl-sidebar__note">
            Wishlist is saved on this device. Prices and stock refresh from the live product catalog.
          </p>
        </aside>
      </div>
    </div>
  );
}

export default WishlistPage;

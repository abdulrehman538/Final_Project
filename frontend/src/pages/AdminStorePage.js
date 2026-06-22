import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchWithAuth } from "../utils/authSession";
import {
  collectProductImageUrls,
  resolveMediaUrl,
  resolveProductImage,
} from "../utils/productImage";
import ModalCloseButton from "../components/ModalCloseButton";
import "../ProductCrud.css";
import "./AdminStorePage.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

function ImageGallery({ product }) {
  const urls = collectProductImageUrls(product);
  const [index, setIndex] = useState(0);
  const src = urls[index] || resolveProductImage(product, "600x600");

  return (
    <div className="store-gallery">
      <div className="store-gallery__main">
        <img src={src} alt={product.name} />
      </div>
      {urls.length > 1 && (
        <div className="store-gallery__thumbs">
          {urls.map((url, thumbIndex) => (
            <button
              key={url}
              type="button"
              className={`store-gallery__thumb${index === thumbIndex ? " is-active" : ""}`}
              onClick={() => setIndex(thumbIndex)}
              aria-label={`View image ${thumbIndex + 1}`}
            >
              <img src={url} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductDetailModal({ product, storeName, onClose }) {
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

  if (!product) return null;

  return (
    <div className="store-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="store-modal store-modal--detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-store-product-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="store-modal__topbar">
          <ModalCloseButton onClick={onClose} />
        </div>

        <div className="store-detail-layout">
          <header className="store-modal__header store-modal__header--border">
            <div>
              <p className="store-modal__eyebrow">{product.category || "Uncategorized"}</p>
              <h2 id="admin-store-product-title">{product.name}</h2>
              <p className="store-modal__meta">{product.store_name || storeName}</p>
            </div>
          </header>

          <div className="store-detail-layout__body">
            <ImageGallery product={product} />

            <div className="store-detail-stats">
              <div className="store-detail-stat">
                <span>Unit price</span>
                <strong>${Number(product.price || 0).toFixed(2)}</strong>
              </div>
              <div className="store-detail-stat">
                <span>Stock</span>
                <strong>{product.stock ?? 0}</strong>
              </div>
            </div>

            {product.description && (
              <div className="store-detail-description">
                <h3>Description</h3>
                <p>{product.description}</p>
              </div>
            )}
          </div>
        </div>

        <footer className="store-modal__footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

function AdminStorePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);

  const loadStore = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetchWithAuth(`${API_BASE}/api/admin/stores/${userId}/`);

      if (!response.ok) {
        throw new Error("Store not found or you do not have access.");
      }

      const data = await response.json();
      setStore(data);
    } catch (err) {
      setStore(null);
      setError(err.message || "Failed to load store.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  const products = Array.isArray(store?.products) ? store.products : [];
  const totalStock = products.reduce((sum, p) => sum + Number(p.stock || 0), 0);
  const isBanned = store?.seller_status === "banned";
  const heroImage = store?.featured_image
    ? resolveMediaUrl(store.featured_image)
    : null;

  return (
    <div className="admin-store-page">
      <button type="button" className="admin-store-back" onClick={() => navigate("/dashboard")}>
        ← Back to dashboard
      </button>

      {loading ? (
        <p className="admin-store-empty">Loading store…</p>
      ) : error ? (
        <p className="admin-store-empty admin-store-empty--error">{error}</p>
      ) : !store ? (
        <p className="admin-store-empty">Store not found.</p>
      ) : (
        <>
          <header className="admin-store-hero">
            <div className="admin-store-hero__visual">
              {heroImage ? (
                <img src={heroImage} alt="" />
              ) : (
                <span>{(store.store_name || store.username || "S").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="admin-store-hero__body">
              <p className="admin-store-hero__eyebrow">Seller storefront preview</p>
              <h1>{store.store_name || "Unnamed store"}</h1>
              <p className="admin-store-hero__owner">@{store.username}</p>
              {store.business_description && (
                <p className="admin-store-hero__desc">{store.business_description}</p>
              )}
              <div className="admin-store-hero__meta">
                <span
                  className={
                    isBanned ? "ad-status ad-status--danger" : "ad-status ad-status--success"
                  }
                >
                  {isBanned ? "Banned" : "Active"}
                </span>
                {store.contact_phone && <span>{store.contact_phone}</span>}
                {store.email && <span>{store.email}</span>}
              </div>
            </div>
            <div className="admin-store-hero__metrics">
              <div className="catalog-metric">
                <strong>{products.length}</strong>
                <span>Items</span>
              </div>
              <div className="catalog-metric">
                <strong>{totalStock}</strong>
                <span>Stock</span>
              </div>
            </div>
          </header>

          <section className="admin-store-products">
            <header className="store-header">
              <h2>Products</h2>
            </header>

            {products.length === 0 ? (
              <div className="empty-state">This store has no products yet.</div>
            ) : (
              <div className="my-store-products-grid">
                {products.map((product) => {
                  const image = resolveProductImage(product, "400x400");

                  return (
                    <article
                      className="my-store-product-card"
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                    >
                      <div className="product-card-img-container">
                        <img src={image} alt={product.name} />
                      </div>
                      <div className="product-card-info">
                        <span className="product-card-cat">
                          {product.category || "Uncategorized"}
                        </span>
                        <h4>{product.name}</h4>
                        <div className="product-card-price-stock">
                          <span className="price">${Number(product.price || 0).toFixed(2)}</span>
                          <span
                            className={`stock-badge ${
                              product.stock > 0 ? "in-stock" : "out-stock"
                            }`}
                          >
                            Stock: {product.stock ?? 0}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          storeName={store?.store_name}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}

export default AdminStorePage;

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getProductMeta, resolveProductImage } from "../utils/productImage";
import "./ProductDetail.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

const TRUST_ITEMS = [
  { icon: "⚡", title: "Fast dispatch", text: "Ships in 24–48h" },
  { icon: "🛡️", title: "Secure checkout", text: "COD available" },
  { icon: "↩️", title: "Easy returns", text: "14-day policy" },
];

function formatCommentDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function buildGalleryImages(product) {
  const images = [];

  if (product?.images?.length) {
    product.images.forEach((entry) => {
      const src = entry?.image || entry?.image_url;
      if (src) {
        images.push(src.startsWith("/") ? `${API_BASE}${src}` : src);
      }
    });
  }

  if (product?.image) {
    const main = product.image.startsWith("/") ? `${API_BASE}${product.image}` : product.image;
    if (!images.includes(main)) {
      images.unshift(main);
    }
  }

  if (product?.image_url && !images.length) {
    images.push(product.image_url);
  }

  if (!images.length) {
    images.push(resolveProductImage(product, "900x900"));
  }

  return images;
}

function ProductDetail({ cart = [], onAddToCart, onToggleWishlist, wishlist = [] }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("accessToken");
  const username = localStorage.getItem("username") || "Guest";
  const [product, setProduct] = useState(location.state?.product || null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const loadProduct = async () => {
      setLoadError("");

      if (location.state?.product) {
        setProduct(location.state.product);
        return;
      }

      try {
        const headers = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE}/api/products/${id}/`, { headers });

        if (!response.ok) {
          throw new Error("Product unavailable");
        }

        const data = await response.json();
        setProduct(data);
      } catch {
        setProduct(null);
        setLoadError("This product could not be loaded. It may have been removed or is temporarily unavailable.");
      }
    };

    loadProduct();
  }, [id, location.state, token]);

  useEffect(() => {
    const loadRelated = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/products/`);
        if (!response.ok) {
          throw new Error("Could not load related products");
        }

        const data = await response.json();
        const list = Array.isArray(data) ? data : data.results || [];
        setRelatedProducts(
          list.filter((item) => String(item.id) !== String(id)).slice(0, 4)
        );
      } catch {
        setRelatedProducts([]);
      }
    };

    loadRelated();
  }, [id]);

  useEffect(() => {
    const loadComments = async () => {
      setCommentLoading(true);

      try {
        const response = await fetch(`${API_BASE}/api/products/${id}/comments/`);

        if (!response.ok) {
          throw new Error("No comments available");
        }

        const data = await response.json();
        setComments(Array.isArray(data) ? data : []);
      } catch {
        const fallback = JSON.parse(localStorage.getItem(`comments-${id}`) || "[]");
        setComments(fallback);
      } finally {
        setCommentLoading(false);
      }
    };

    loadComments();
  }, [id]);

  useEffect(() => {
    setActiveImage(0);
    setQty(1);
  }, [product?.id]);

  const galleryImages = useMemo(() => (product ? buildGalleryImages(product) : []), [product]);
  const meta = useMemo(() => (product ? getProductMeta(product) : null), [product]);
  const isWishlisted = wishlist.some((item) => String(item.id) === String(id));
  const isInCart = cart.some((item) => String(item.id) === String(id));
  const heroImage = galleryImages[activeImage] || resolveProductImage(product, "900x900");
  const outOfStock = (product?.stock ?? 0) <= 0;
  const canBuyNow = isInCart && !outOfStock;

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    if (!commentBody.trim()) return;

    try {
      if (token) {
        const response = await fetch(`${API_BASE}/api/products/${id}/comments/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ body: commentBody }),
        });

        if (response.ok) {
          const created = await response.json();
          setComments((current) => [...current, created]);
          localStorage.setItem(`comments-${id}`, JSON.stringify([...comments, created]));
          setCommentBody("");
          return;
        }
      }

      throw new Error("Post comment locally");
    } catch {
      const offlineComment = {
        id: Date.now(),
        username,
        body: commentBody,
        created_at: new Date().toISOString(),
      };
      const nextComments = [...comments, offlineComment];
      setComments(nextComments);
      localStorage.setItem(`comments-${id}`, JSON.stringify(nextComments));
      setCommentBody("");
    }
  };

  const handleAddToCart = () => {
    if (outOfStock) return;
    onAddToCart(product, qty);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2000);
  };

  const handleBuyNow = () => {
    if (!canBuyNow) return;
    navigate("/cart", { state: { openCheckout: true } });
  };

  if (loadError) {
    return (
      <div className="pd-empty">
        <p>{loadError}</p>
        <button type="button" className="btn btn-secondary" onClick={() => navigate("/marketplace")}>
          Back to marketplace
        </button>
      </div>
    );
  }

  if (!product) {
    return <div className="pd-empty">Loading product details...</div>;
  }

  return (
    <div className="pd-page">
      <div className="pd-breadcrumb">
        <button type="button" className="pd-back" onClick={() => navigate("/marketplace")}>
          ← Back to shop
        </button>
        <span className="pd-crumb">
          {meta.category} / <strong>{product.name}</strong>
        </span>
      </div>

      <section className="pd-main">
        <div className="pd-gallery">
          <div className="pd-gallery__stage">
            <img src={heroImage} alt={product.name} />
            {meta && (
              <span className={`pd-gallery__badge${meta.stockTone === "low" ? " pd-gallery__badge--low" : ""}${meta.stockTone === "out" ? " pd-gallery__badge--out" : ""}`}>
                {meta.stockLabel}
              </span>
            )}
          </div>

          {galleryImages.length > 1 && (
            <div className="pd-gallery__thumbs">
              {galleryImages.map((src, index) => (
                <button
                  type="button"
                  className={`pd-gallery__thumb${activeImage === index ? " is-active" : ""}`}
                  key={`${src}-${String(index)}`}
                  onClick={() => setActiveImage(index)}
                  aria-label={`View image ${String(index + 1)}`}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pd-info">
          <div className="pd-info__head">
            <div>
              <p className="pd-info__eyebrow">{meta.category}</p>
              <h1 className="pd-info__title">{product.name}</h1>
              <div className="pd-info__sub">
                <span className="pd-info__store">{meta.store}</span>
                <span className="pd-info__dot" aria-hidden="true">·</span>
                <span className="pd-info__rating">★ {meta.rating}</span>
                <span className="pd-info__dot" aria-hidden="true">·</span>
                <span className="pd-info__reviews">{comments.length || 0} reviews</span>
              </div>
            </div>

            <button
              type="button"
              className={`pd-wishlist${isWishlisted ? " is-active" : ""}`}
              onClick={() => onToggleWishlist(product)}
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              {isWishlisted ? "♥" : "♡"}
            </button>
          </div>

          <div className="pd-price-row">
            <div className="pd-price-block">
              <p className="pd-price">${Number(product.price || 0).toFixed(2)}</p>
              <p className="pd-price-note">
                {meta.stock <= 5 && meta.stock > 0
                  ? "Almost sold out"
                  : "Marketplace price"}
              </p>
            </div>

            <div className="pd-perks">
              <div className="pd-perk">
                <span>Stock</span>
                <strong>{product.stock ?? 0}</strong>
              </div>
              <div className="pd-perk">
                <span>Delivery</span>
                <strong>2–4d</strong>
              </div>
              <div className="pd-perk">
                <span>Returns</span>
                <strong>14d</strong>
              </div>
            </div>
          </div>

          <p className="pd-description">
            {product.description || "A quality pick from our marketplace — browse details, read reviews, and checkout as a guest without creating an account."}
          </p>

          <div className="pd-buy-row">
            <div className="pd-buy-controls">
              <div className="pd-qty">
                <button
                  type="button"
                  disabled={qty <= 1}
                  onClick={() => setQty((current) => Math.max(current - 1, 1))}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span>{qty}</span>
                <button
                  type="button"
                  disabled={product.stock !== undefined && qty >= product.stock}
                  onClick={() => setQty((current) => (product.stock ? Math.min(current + 1, product.stock) : current + 1))}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <div className="pd-actions">
                <button
                  type="button"
                  className={`btn btn-secondary${justAdded ? " is-active" : ""}`}
                  disabled={outOfStock}
                  onClick={handleAddToCart}
                >
                  {justAdded ? "Added to cart" : "Add to cart"}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canBuyNow}
                  onClick={handleBuyNow}
                  title={!isInCart ? "Add this item to your cart first" : undefined}
                >
                  Buy now
                </button>
              </div>
            </div>
            <p className="pd-buy-hint">
              <span><strong>Add to cart</strong> saves the item while you keep shopping.</span>
              <span>
                <strong>Buy now</strong>{" "}
                {isInCart
                  ? "goes to checkout with your cart."
                  : "is available once this item is in your cart."}
              </span>
            </p>
          </div>

          <div className="pd-extras">
            <div className="pd-panel">
              <p className="pd-panel__title">Delivery options</p>
              <div className="pd-panel__row">
                <span>Standard delivery</span>
                <strong>Rs. 145</strong>
              </div>
              <div className="pd-panel__row">
                <span>Collection point</span>
                <strong>Rs. 35</strong>
              </div>
              <div className="pd-panel__row">
                <span>Cash on delivery</span>
                <strong>Available</strong>
              </div>
            </div>

            <div className="pd-panel">
              <p className="pd-panel__title">Seller</p>
              <strong>{meta.store}</strong>
              <p className="pd-panel__text">Verified seller with responsive support and fast dispatch.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="pd-trust">
        {TRUST_ITEMS.map((item) => (
          <div className="pd-trust__item" key={item.title}>
            <span className="pd-trust__icon" aria-hidden="true">
              {item.icon}
            </span>
            <div>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </div>
          </div>
        ))}
      </div>

      <section className="pd-reviews">
        <div className="pd-section-head">
          <div>
            <p className="pd-info__eyebrow">Reviews</p>
            <h3>Customer reviews</h3>
          </div>
        </div>

        <form className="pd-comment-form" onSubmit={handleCommentSubmit}>
          <textarea
            className="field-input"
            rows="3"
            placeholder="Share your experience with this product..."
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            Post review
          </button>
        </form>

        {commentLoading ? (
          <div className="pd-empty">Loading reviews...</div>
        ) : comments.length === 0 ? (
          <div className="pd-empty">No reviews yet. Be the first to share your thoughts.</div>
        ) : (
          <div className="pd-comment-list">
            {comments.map((comment) => (
              <article className="pd-comment" key={comment.id || `${comment.username}-${comment.created_at}`}>
                <div className="pd-comment__head">
                  <span className="pd-comment__author">{comment.username || username}</span>
                  <span className="pd-comment__date">{formatCommentDate(comment.created_at)}</span>
                </div>
                <p>{comment.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {relatedProducts.length > 0 && (
        <section className="pd-related">
          <div className="pd-section-head">
            <div>
              <p className="pd-info__eyebrow">You may also like</p>
              <h3>Related products</h3>
            </div>
          </div>

          <div className="pd-related__grid">
            {relatedProducts.map((item) => {
              const itemMeta = getProductMeta(item);
              return (
                <button
                  type="button"
                  className="pd-related__card"
                  key={item.id}
                  onClick={() => navigate(`/product/${item.id}`, { state: { product: item } })}
                >
                  <div className="pd-related__media">
                    <img src={resolveProductImage(item)} alt={item.name} />
                  </div>
                  <div className="pd-related__body">
                    <span className="pd-related__store">{itemMeta.store}</span>
                    <p className="pd-related__title">{item.name}</p>
                    <p className="pd-related__price">${Number(item.price || 0).toFixed(2)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default ProductDetail;

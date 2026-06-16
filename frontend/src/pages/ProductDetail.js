import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { demoProducts } from "../data/demoProducts";

const emptyPayment = {
  cardNumber: "",
  cardName: "",
  expiry: "",
  cvc: "",
};

function ProductDetail({ onAddToCart, onToggleWishlist, wishlist = [], isAuthenticated = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("accessToken");
  const username = localStorage.getItem("username") || "Guest";
  const [product, setProduct] = useState(location.state?.product || null);
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payment, setPayment] = useState(emptyPayment);

  useEffect(() => {
    const loadProduct = async () => {
      if (location.state?.product) {
        setProduct(location.state.product);
        return;
      }

      try {
        const headers = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`http://127.0.0.1:8000/api/products/${id}/`, {
          headers,
        });

        if (!response.ok) {
          throw new Error("Fallback to demo catalog");
        }

        const data = await response.json();
        setProduct(data);
      } catch {
        setProduct(demoProducts.find((item) => String(item.id) === String(id)) || demoProducts[0]);
      }
    };

    loadProduct();
  }, [id, location.state, token]);

  useEffect(() => {
    const loadComments = async () => {
      setCommentLoading(true);

      try {
        const response = await fetch(`http://127.0.0.1:8000/api/products/${id}/comments/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

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
  }, [id, token]);

  const relatedProducts = useMemo(
    () => demoProducts.filter((item) => String(item.id) !== String(id)).slice(0, 4),
    [id]
  );

  const isWishlisted = wishlist.some((item) => String(item.id) === String(id));
  const firstImage = (product?.images && product.images[0] && product.images[0].image) || product?.image_url;
  const resolvedFirst = firstImage ? (firstImage.startsWith("/") ? `http://127.0.0.1:8000${firstImage}` : firstImage) : null;
  const image = resolvedFirst || `https://placehold.co/900x900/fdf2e8/f57224?text=${encodeURIComponent(product?.name || "Product")}`;

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    if (!commentBody.trim()) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/products/${id}/comments/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body: commentBody }),
      });

      if (!response.ok) {
        throw new Error("Unable to post comment");
      }

      const created = await response.json();
      setComments((current) => [...current, created]);
      localStorage.setItem(`comments-${id}`, JSON.stringify([...comments, created]));
      setCommentBody("");
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

  const handlePayNow = (event) => {
    event.preventDefault();

    const cardOk = /^\d{16}$/.test(payment.cardNumber.replace(/\s+/g, ""));
    const expiryOk = /^(0[1-9]|1[0-2])\/\d{2}$/.test(payment.expiry);
    const cvcOk = /^\d{3,4}$/.test(payment.cvc);
    const nameOk = payment.cardName.trim().length > 2;

    if (!cardOk || !expiryOk || !cvcOk || !nameOk) {
      window.alert("Please enter valid card details.");
      return;
    }

    setPaymentOpen(false);
    setPayment(emptyPayment);
    window.alert("Transaction successful");
  };

  if (!product) {
    return <div className="empty-state">Loading product details...</div>;
  }

  return (
    <div className="product-detail-page">
      <section className="product-detail-layout">
        <div className="product-gallery card">
          <div className="product-gallery-main">
            <img src={image} alt={product.name} />
          </div>

          <div className="product-gallery-strip">
            {[image, ...(demoProducts.slice(0, 3).map((item) => (item.images && item.images[0] && item.images[0].image) || item.image_url))].map((src, index) => {
              const resolved = src && src.startsWith("/") ? `http://127.0.0.1:8000${src}` : src;
              return (
                <button type="button" className="gallery-thumb" key={`${resolved}-${String(index)}`}>
                  <img src={resolved} alt={`Preview ${String(index + 1)}`} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="product-buybox card">
          <div className="product-title-row">
            <div>
              <p className="eyebrow">{product.category || "Marketplace"}</p>
              <h2 className="detail-title">{product.name}</h2>
              <p className="subtext">{product.store_name || "Trusted marketplace seller"}</p>
            </div>

            <button type="button" className={`btn btn-secondary${isWishlisted ? " is-active" : ""}`} onClick={() => onToggleWishlist(product)}>
              {isWishlisted ? "Wishlisted" : "Wishlist"}
            </button>
          </div>

          <div className="detail-rating">
            <span>★ 4.7</span>
            <span>Ratings 273</span>
            <span>65 answered questions</span>
          </div>

          <div className="detail-price">
            <strong>${Number(product.price || 0).toFixed(2)}</strong>
            <span>Almost sold out, buy now!</span>
          </div>

          <p className="subtext">
            {product.description || "Product detail page with professional buying experience, comments, and secure checkout flow."}
          </p>

          <div className="detail-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onAddToCart(product)}
            >
              Add to Cart
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPaymentOpen(true)}>
              Buy Now
            </button>
          </div>

          <div className="detail-meta-grid">
            <div className="detail-meta">
              <span>Stock</span>
              <strong>{product.stock ?? 0}</strong>
            </div>
            <div className="detail-meta">
              <span>Delivery</span>
              <strong>2-4 days</strong>
            </div>
            <div className="detail-meta">
              <span>Return</span>
              <strong>14 days</strong>
            </div>
          </div>
        </div>

        <aside className="product-sidepanel card">
          <div className="sidepanel-section">
            <p className="eyebrow">Delivery Options</p>
            <div className="sidepanel-row">
              <span>Standard Delivery</span>
              <strong>Rs. 145</strong>
            </div>
            <div className="sidepanel-row">
              <span>Collection Point</span>
              <strong>Rs. 35</strong>
            </div>
            <div className="sidepanel-row">
              <span>Cash on Delivery</span>
              <strong>Available</strong>
            </div>
          </div>

          <div className="sidepanel-section">
            <p className="eyebrow">Seller Information</p>
            <strong>{product.store_name || "Marketplace Store"}</strong>
            <p className="subtext">Verified seller with responsive support and fast dispatch.</p>
          </div>
        </aside>
      </section>

      <section className="comments-section card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reviews</p>
            <h3>Buyer comments</h3>
          </div>
        </div>

        <form className="comment-form" onSubmit={handleCommentSubmit}>
          <textarea
            className="field-input"
            rows="3"
            placeholder="Write a comment about this product"
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            Post Comment
          </button>
        </form>

        {commentLoading ? (
          <div className="empty-state">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="empty-state">No comments yet. Be the first to review this product.</div>
        ) : (
          <div className="comment-list">
            {comments.map((comment) => (
              <article className="comment-item" key={comment.id || `${comment.username}-${comment.created_at}`}>
                <strong>{comment.username || username}</strong>
                <p>{comment.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="related-section card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Related Products</p>
            <h3>You may also like</h3>
          </div>
        </div>

          <div className="related-grid">
          {relatedProducts.map((item) => (
            <button
              type="button"
              className="related-card"
              key={item.id}
              onClick={() => navigate(`/product/${item.id}`, { state: { product: item } })}
            >
              <img src={(item.images && item.images[0] && item.images[0].image) || item.image_url} alt={item.name} />
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      </section>

      {paymentOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setPaymentOpen(false)}>
          <div className="payment-modal card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Payment</p>
                <h3>Secure checkout</h3>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => setPaymentOpen(false)}>
                Close
              </button>
            </div>

            <form className="payment-form" onSubmit={handlePayNow}>
              <label className="field-label">Card Number</label>
              <input
                className="field-input"
                inputMode="numeric"
                placeholder="1234 5678 9012 3456"
                value={payment.cardNumber}
                onChange={(event) => setPayment((current) => ({ ...current, cardNumber: event.target.value }))}
              />

              <label className="field-label">Cardholder Name</label>
              <input
                className="field-input"
                placeholder="Name on card"
                value={payment.cardName}
                onChange={(event) => setPayment((current) => ({ ...current, cardName: event.target.value }))}
              />

              <div className="payment-grid">
                <div>
                  <label className="field-label">Expiry Date</label>
                  <input
                    className="field-input"
                    placeholder="MM/YY"
                    value={payment.expiry}
                    onChange={(event) => setPayment((current) => ({ ...current, expiry: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="field-label">CVC</label>
                  <input
                    className="field-input"
                    placeholder="123"
                    value={payment.cvc}
                    onChange={(event) => setPayment((current) => ({ ...current, cvc: event.target.value }))}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary">
                Pay Now
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductDetail;

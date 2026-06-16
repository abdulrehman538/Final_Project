import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { demoCategories } from "../data/demoProducts";

const valueProps = [
  { label: "Fast Delivery", value: "24-48h" },
  { label: "Secure Checkout", value: "Protected" },
  { label: "Buyer Support", value: "7 days a week" },
];

function getProductMeta(product) {
  const safeName = String(product?.name || "");
  const seed = String(product?.id || safeName).length;
  const storeNames = ["Nova Store", "Prime Mart", "Bazaar Hub", "Urban Goods"];
  const store = product?.store_name || storeNames[seed % storeNames.length];
  const rating = (4.1 + (seed % 8) * 0.1).toFixed(1);
  const stock = Number.isFinite(Number(product?.stock)) ? Number(product.stock) : 12 + (seed % 18);
  const category = product?.category || "General";
  const badge = stock > 10 ? "In Stock" : stock > 0 ? "Low Stock" : "Out of Stock";

  return { store, rating, stock, category, badge };
}

function Marketplace({ onAddToCart, onToggleWishlist, wishlist = [], cart = [], isAuthenticated = false }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState("featured");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      setError("");

      try {
const headers = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch("http://127.0.0.1:8000/api/products/", {
        headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch products (${response.status})`);
        }

        const data = await response.json();
        const fetchedProducts = Array.isArray(data) ? data : [];
        
        if (fetchedProducts.length === 0) {
          setError("No products available at the moment. Check back soon!");
        }
        
        setProducts(fetchedProducts);
      } catch (err) {
        setError(err.message || "Unable to fetch products. Please try again later.");
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [token]);

  const featuredProducts = useMemo(() => products.slice(0, 4), [products]);
  const trendingProducts = useMemo(() => products.slice(0, 9), [products]);

  // Dynamically generate categories from products
  const uniqueCategories = useMemo(() => {
    const categories = new Set();
    products.forEach(product => {
      if (product.category) {
        categories.add(product.category);
      }
    });
    return Array.from(categories).sort();
  }, [products]);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = products
      .map((product) => ({ ...product, meta: getProductMeta(product) }))
      .filter((product) => {
        const productName = String(product?.name || "").toLowerCase();
        const matchesQuery =
          !normalizedQuery ||
          productName.includes(normalizedQuery) ||
          String(product.meta.store || "").toLowerCase().includes(normalizedQuery);
        const matchesCategory = activeCategory === "All" || product.meta.category === activeCategory;
        const matchesStock = !onlyInStock || product.meta.stock > 0;

        return matchesQuery && matchesCategory && matchesStock;
      });

    if (sortBy === "price-low") {
      return filtered.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    }

    if (sortBy === "price-high") {
      return filtered.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }

    if (sortBy === "rating") {
      return filtered.sort((a, b) => Number(b.meta.rating) - Number(a.meta.rating));
    }

    return filtered;
  }, [products, query, activeCategory, onlyInStock, sortBy]);

  const handleProductClick = (product) => {
    navigate(`/product/${product.id}`, { state: { product } });
  };

  const userRole = (localStorage.getItem("userRole") || "buyer").toLowerCase();
  const isBuyer = userRole === "buyer";

  return (
    <div className="marketplace-layout">
      <section className="market-hero card">
        <div className="market-hero-copy">
          <p className="eyebrow"> marketplace</p>
          <h2 className="market-title">Find products, follow stores, and check out in a few clicks.</h2>
          <p className="subtext">
            Browse a cleaner storefront experience with featured deals, categorized discovery, cart actions,
            and an interface that feels production-ready.
          </p>

          <div className="market-hero-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate("/marketplace")}> 
              Shop Now
            </button>
            {isBuyer && (
              <button type="button" className="btn btn-secondary" onClick={() => navigate("/profile")}>
                Become a Seller
              </button>
            )}
          </div>

          <div className="value-props">
            {valueProps.map((item) => (
              <div className="value-prop" key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="market-hero-panel">
          <div className="hero-badge">Top Deals</div>
          <div className="hero-card hero-card--accent">
            <p>Flash sale</p>
            <strong>Up to 40% off</strong>
            <span>On selected marketplace essentials</span>
          </div>
          <div className="hero-card">
            <p>Buyer's protection</p>
            <strong>Secure payments</strong>
            <span>Trusted checkout and order tracking</span>
          </div>
        </div>
      </section>

      <section className="category-strip">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Categories</p>
            <h3>Shop by category</h3>
          </div>
          <span className="pill">{uniqueCategories.length} categories</span>
        </div>

        <div className="category-grid">
          <button type="button" className={`category-card${activeCategory === "All" ? " is-active" : ""}`} onClick={() => setActiveCategory("All")}>
            All
          </button>
          {uniqueCategories.map((category) => (
            <button
              type="button"
              key={category}
              className={`category-card${activeCategory === category ? " is-active" : ""}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <section className="market-grid">
        <aside className="market-filters card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Filters</p>
              <h3>Refine results</h3>
            </div>
          </div>

          <label className="field-label">Search</label>
          <input
            className="field-input"
            type="search"
            placeholder="Search products"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <label className="field-label" style={{ marginTop: 18 }}>Sort by</label>
          <select className="field-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="featured">Featured</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="rating">Top Rated</option>
          </select>

          <label className="filter-check">
            <input type="checkbox" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)} />
            <span>In stock only</span>
          </label>

          <div className="filter-summary">
            <span>Wishlist items</span>
            <strong>{wishlist.length}</strong>
          </div>
          <div className="filter-summary">
            <span>Cart items</span>
            <strong>{cart.reduce((sum, item) => sum + item.quantity, 0)}</strong>
          </div>
        </aside>

        <div className="market-results">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Featured</p>
              <h3>Popular picks</h3>
            </div>
            <span className="pill">{featuredProducts.length} featured</span>
          </div>

          <div style={{ display: "grid", gap: "18px", gridTemplateColumns: "1fr auto" }}>
            <div className="featured-row">
              {featuredProducts.map((product) => {
                const meta = getProductMeta(product);
                return (
                  <article className="featured-card" key={product.id} onClick={() => handleProductClick(product)}>
                    <div className="featured-art">Deal</div>
                    <div>
                      <h4>{product.name}</h4>
                      <p className="subtext">{meta.store}</p>
                      <strong>${Number(product.price || 0).toFixed(2)}</strong>
                    </div>
                  </article>
                );
              })}
            </div>

            <div style={{ display: "grid", gap: "12px", width: "320px", maxHeight: "500px", overflowY: "auto" }}>
              <div style={{ paddingBottom: "8px", borderBottom: "1px solid rgba(229, 231, 235, 0.95)" }}>
                <p className="eyebrow" style={{ margin: "0 0 4px 0" }}>Trending Now</p>
                <h4 style={{ margin: "0" }}>Recommended for You</h4>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                {trendingProducts.map((product, index) => {
                  const meta = getProductMeta(product);
                  const firstImage = (product.images && product.images[0] && product.images[0].image) || product.image_url;
                  const resolvedImage = firstImage ? (firstImage.startsWith("/") ? `http://127.0.0.1:8000${firstImage}` : firstImage) : null;
                  const image =
                    resolvedImage ||
                    `https://placehold.co/600x600/fdf2e8/f57224?text=${encodeURIComponent(String(product.name || "Product").slice(0, 12))}`;

                  return (
                    <div
                      key={product.id}
                      onClick={() => handleProductClick(product)}
                      style={{
                        padding: "10px",
                        borderRadius: "12px",
                        background: "var(--surface)",
                        border: "1px solid rgba(229, 231, 235, 0.95)",
                        cursor: "pointer",
                        transition: "all 180ms ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = "0 8px 16px rgba(17, 24, 39, 0.1)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = "none";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <img
                        src={image}
                        alt={product.name}
                        style={{ width: "100%", height: "100px", objectFit: "cover", borderRadius: "8px", marginBottom: "6px" }}
                      />
                      <h5 style={{ margin: "0", fontSize: "0.85rem", fontWeight: "600", lineHeight: "1.2" }}>{product.name}</h5>
                      <p style={{ margin: "4px 0", fontSize: "0.75rem", color: "var(--text-secondary)" }}>{meta.store}</p>
                      <strong style={{ fontSize: "0.9rem", color: "var(--primary)" }}>${Number(product.price || 0).toFixed(2)}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="product-grid">
            {loading ? (
              <div className="empty-state product-empty">Loading products...</div>
            ) : error && products.length === 0 ? (
              <div className="alert-box product-empty">{error}</div>
            ) : visibleProducts.length === 0 ? (
              <div className="empty-state product-empty">No products match your filters.</div>
            ) : (
              visibleProducts.map((product) => {
                const meta = product.meta || getProductMeta(product);
                const isWishlisted = wishlist.some((item) => item.id === product.id);
                const firstImage = (product.images && product.images[0] && product.images[0].image) || product.image_url;
                const resolvedImage = firstImage ? (firstImage.startsWith("/") ? `http://127.0.0.1:8000${firstImage}` : firstImage) : null;
                const image =
                  resolvedImage ||
                  `https://placehold.co/600x600/fdf2e8/f57224?text=${encodeURIComponent(String(product.name || "Product").slice(0, 12))}`;

                return (
                  <article className="product-card" key={product.id}>
                    <button type="button" className="product-card-image-wrap" onClick={() => handleProductClick(product)}>
                      <img className="product-card-image" src={image} alt={product.name} />
                    </button>
                    <div className="product-card-body">
                      <div className="product-card-meta">
                        <span className="product-store">{meta.store}</span>
                        <span className={`status-badge ${meta.badge === "In Stock" ? "status-badge--success" : meta.badge === "Low Stock" ? "status-badge--warning" : "status-badge--danger"}`}>
                          {meta.badge}
                        </span>
                      </div>
                      <button type="button" className="product-title-button" onClick={() => handleProductClick(product)}>
                        <h4>{product.name || "Untitled product"}</h4>
                      </button>
                      <div className="product-rating">★ {meta.rating}</div>
                      <p className="product-price">${Number(product.price || 0).toFixed(2)}</p>
                      <div className="product-actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => onAddToCart(product)}
                        >
                          Add to cart
                        </button>
                        <button
                          type="button"
                          className={`btn btn-secondary${isWishlisted ? " is-active" : ""}`}
                          onClick={() => onToggleWishlist(product)}
                        >
                          {isWishlisted ? "Wishlisted" : "Wishlist"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Marketplace;

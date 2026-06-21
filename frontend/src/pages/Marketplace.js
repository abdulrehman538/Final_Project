import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProductMeta, resolveProductImage } from "../utils/productImage";
import "./Marketplace.css";

const TRUST_ITEMS = [
  { icon: "⚡", title: "Fast delivery", text: "24–48 hour dispatch" },
  { icon: "🛡️", title: "COD checkout", text: "Pay when it arrives" },
  { icon: "💬", title: "Live support", text: "Help 7 days a week" },
];

function ProductSkeleton() {
  return (
    <div className="mp-skeleton-card">
      <div className="mp-skeleton-image" />
      <div className="mp-skeleton-body">
        <div className="mp-skeleton-line mp-skeleton-line--short" />
        <div className="mp-skeleton-line" />
        <div className="mp-skeleton-line" />
      </div>
    </div>
  );
}

function Marketplace({ onAddToCart, onToggleWishlist, wishlist = [] }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState("featured");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const spotlightTrackRef = useRef(null);
  const [spotlightScroll, setSpotlightScroll] = useState({
    canScrollLeft: false,
    canScrollRight: false,
    isScrollable: false,
  });

  const updateSpotlightScroll = useCallback(() => {
    const track = spotlightTrackRef.current;
    if (!track) return;

    const maxScroll = track.scrollWidth - track.clientWidth;
    const isScrollable = maxScroll > 4;

    setSpotlightScroll({
      isScrollable,
      canScrollLeft: isScrollable && track.scrollLeft > 4,
      canScrollRight: isScrollable && track.scrollLeft < maxScroll - 4,
    });
  }, []);

  const scrollSpotlight = (direction) => {
    const track = spotlightTrackRef.current;
    if (!track) return;

    const card = track.querySelector(".mp-deal-card");
    const gap = 12;
    const amount = card ? card.offsetWidth + gap : 252;

    track.scrollBy({
      left: direction * amount,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const savedQuery = localStorage.getItem("marketplaceSearch") || "";
    if (savedQuery) {
      setQuery(savedQuery);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("marketplaceSearch", query);
  }, [query]);

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("http://127.0.0.1:8000/api/products/");

        if (!response.ok) {
          throw new Error(`Failed to fetch products (${response.status})`);
        }

        const data = await response.json();
        const fetchedProducts = Array.isArray(data) ? data : [];

        if (fetchedProducts.length === 0) {
          setError("No products available yet. Sellers are still stocking their stores.");
        }

        setProducts(fetchedProducts);
      } catch (err) {
        setError(err.message || "Unable to load products right now.");
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  const uniqueCategories = useMemo(() => {
    const categories = new Set();
    products.forEach((product) => {
      if (product.category) {
        categories.add(product.category);
      }
    });
    return Array.from(categories).sort();
  }, [products]);

  const enrichedProducts = useMemo(
    () => products.map((product) => ({ ...product, meta: getProductMeta(product) })),
    [products]
  );

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = enrichedProducts.filter((product) => {
      const productName = String(product?.name || "").toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        productName.includes(normalizedQuery) ||
        String(product.meta.store || "").toLowerCase().includes(normalizedQuery) ||
        String(product.meta.category || "").toLowerCase().includes(normalizedQuery);
      const matchesCategory =
        activeCategory === "All" || product.meta.category === activeCategory;
      const matchesStock = !onlyInStock || product.meta.stock > 0;

      return matchesQuery && matchesCategory && matchesStock;
    });

    if (sortBy === "price-low") {
      return [...filtered].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    }

    if (sortBy === "price-high") {
      return [...filtered].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }

    if (sortBy === "rating") {
      return [...filtered].sort((a, b) => Number(b.meta.rating) - Number(a.meta.rating));
    }

    return filtered;
  }, [enrichedProducts, query, activeCategory, onlyInStock, sortBy]);

  const heroProducts = useMemo(() => enrichedProducts.slice(0, 3), [enrichedProducts]);
  const spotlightProducts = useMemo(() => enrichedProducts.slice(3, 11), [enrichedProducts]);

  useEffect(() => {
    updateSpotlightScroll();

    const track = spotlightTrackRef.current;
    if (!track) return undefined;

    const handleScroll = () => updateSpotlightScroll();
    track.addEventListener("scroll", handleScroll, { passive: true });

    const handleWheel = (event) => {
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (maxScroll <= 0) return;

      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.shiftKey
            ? event.deltaY
            : 0;

      if (!delta) return;

      const nextScroll = track.scrollLeft + delta;
      const clamped = Math.max(0, Math.min(maxScroll, nextScroll));

      if (clamped !== track.scrollLeft) {
        track.scrollLeft = clamped;
        updateSpotlightScroll();
        event.preventDefault();
        return;
      }

      if (
        (delta > 0 && track.scrollLeft >= maxScroll - 1) ||
        (delta < 0 && track.scrollLeft <= 0)
      ) {
        event.preventDefault();
      }
    };

    track.addEventListener("wheel", handleWheel, { passive: false });

    const resizeObserver = new ResizeObserver(() => updateSpotlightScroll());
    resizeObserver.observe(track);

    return () => {
      track.removeEventListener("scroll", handleScroll);
      track.removeEventListener("wheel", handleWheel);
      resizeObserver.disconnect();
    };
  }, [spotlightProducts, updateSpotlightScroll]);

  const handleProductClick = (product) => {
    navigate(`/product/${product.id}`, { state: { product } });
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    document.getElementById("catalog-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="mp-page">
      <section className="mp-hero">
        <div className="mp-hero__copy">
          <p className="mp-hero__eyebrow">CArTGo Marketplace</p>
          <h1 className="mp-hero__title">Discover products you will actually want to buy.</h1>
          <p className="mp-hero__text">
            Curated listings from real sellers, real images, and checkout in minutes — no account required.
          </p>

          <form className="mp-hero__search" onSubmit={handleSearchSubmit}>
            <input
              type="search"
              placeholder="Search products, stores, or categories"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search marketplace"
            />
            <button type="submit">Search</button>
          </form>

          <div className="mp-hero__actions">
            <button
              type="button"
              className="mp-hero__cta"
              onClick={() => navigate("/portal")}
            >
              Become a Seller
            </button>
          </div>
        </div>

        {heroProducts.length > 0 && (
          <div className="mp-hero__mosaic" aria-hidden={heroProducts.length === 0}>
            {heroProducts.map((product, index) => (
              <button
                type="button"
                key={product.id}
                className={`mp-hero__mosaic-item${index === 0 ? " mp-hero__mosaic-item--main" : ""}`}
                onClick={() => handleProductClick(product)}
              >
                <img src={resolveProductImage(product, "800x800")} alt={product.name} />
              </button>
            ))}
          </div>
        )}
      </section>

      {!loading && spotlightProducts.length > 0 && (
        <section className="mp-deals">
          <div className="mp-section-head">
            <div>
              <h2>Spotlight</h2>
              <p>Fresh listings worth a closer look before you browse categories.</p>
            </div>
          </div>

          <div className="mp-deals__viewport">
            {spotlightScroll.isScrollable && spotlightScroll.canScrollLeft && (
              <button
                type="button"
                className="mp-deals__arrow mp-deals__arrow--prev"
                onClick={() => scrollSpotlight(-1)}
                aria-label="Scroll spotlight left"
              >
                ←
              </button>
            )}
            {spotlightScroll.isScrollable && spotlightScroll.canScrollRight && (
              <button
                type="button"
                className="mp-deals__arrow mp-deals__arrow--next"
                onClick={() => scrollSpotlight(1)}
                aria-label="Scroll spotlight right"
              >
                →
              </button>
            )}

            <div className="mp-deals__track" ref={spotlightTrackRef}>
            {spotlightProducts.map((product) => (
              <article
                className="mp-deal-card"
                key={`spotlight-${product.id}`}
                onClick={() => handleProductClick(product)}
                onKeyDown={(e) => e.key === "Enter" && handleProductClick(product)}
                role="button"
                tabIndex={0}
              >
                <img
                  className="mp-deal-card__image"
                  src={resolveProductImage(product, "640x480")}
                  alt={product.name}
                  loading="lazy"
                />
                <div className="mp-deal-card__body">
                  <span className="mp-deal-card__store">{product.meta.store}</span>
                  <h3 className="mp-deal-card__title">{product.name}</h3>
                  <p className="mp-deal-card__price">${Number(product.price || 0).toFixed(2)}</p>
                </div>
              </article>
            ))}
          </div>
          </div>
        </section>
      )}

      <section className="mp-trust" aria-label="Shopping benefits">
        {TRUST_ITEMS.map((item) => (
          <div className="mp-trust__item" key={item.title}>
            <div className="mp-trust__icon">{item.icon}</div>
            <div>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </div>
          </div>
        ))}
      </section>

      {uniqueCategories.length > 0 && (
        <section className="mp-categories">
          <div className="mp-section-head">
            <div>
              <h2>Shop by category</h2>
              <p>Browse what is live across the marketplace.</p>
            </div>
            <span className="mp-pill">{uniqueCategories.length} categories</span>
          </div>

          <div className="mp-categories__rail">
            <button
              type="button"
              className={`mp-category-chip${activeCategory === "All" ? " is-active" : ""}`}
              onClick={() => setActiveCategory("All")}
            >
              All products
            </button>
            {uniqueCategories.map((category) => (
              <button
                type="button"
                key={category}
                className={`mp-category-chip${activeCategory === category ? " is-active" : ""}`}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mp-catalog" id="catalog-section">
        <div className="mp-toolbar">
          <p className="mp-toolbar__count">
            {loading ? "Loading catalog…" : (
              <>
                {visibleProducts.length} <span>products</span>
              </>
            )}
          </p>

          <div className="mp-toolbar__controls">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort products">
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Top rated</option>
            </select>

            <label className="mp-toolbar__check">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
              />
              In stock only
            </label>
          </div>
        </div>

        {loading ? (
          <div className="mp-skeleton-grid">
            {Array.from({ length: 8 }).map((_, index) => (
              <ProductSkeleton key={`skeleton-${index}`} />
            ))}
          </div>
        ) : error && products.length === 0 ? (
          <div className="mp-empty">{error}</div>
        ) : visibleProducts.length === 0 ? (
          <div className="mp-empty">No products match your search or filters.</div>
        ) : (
          <div className="mp-grid">
            {visibleProducts.map((product) => {
              const isWishlisted = wishlist.some((item) => item.id === product.id);

              return (
                <article className="mp-card" key={product.id}>
                  <button
                    type="button"
                    className="mp-card__media"
                    onClick={() => handleProductClick(product)}
                  >
                    <img
                      src={resolveProductImage(product)}
                      alt={product.name}
                      loading="lazy"
                    />
                    <span className={`mp-card__badge${product.meta.stockTone === "low" ? " mp-card__badge--low" : product.meta.stockTone === "out" ? " mp-card__badge--out" : ""}`}>
                      {product.meta.stockLabel}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`mp-card__wishlist${isWishlisted ? " is-active" : ""}`}
                    onClick={() => onToggleWishlist(product)}
                    aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                  >
                    ♥
                  </button>

                  <div className="mp-card__body">
                    <p className="mp-card__store">{product.meta.store}</p>
                    <button
                      type="button"
                      className="mp-card__title"
                      onClick={() => handleProductClick(product)}
                    >
                      {product.name || "Untitled product"}
                    </button>

                    <div className="mp-card__meta">
                      <span className="mp-card__rating">★ {product.meta.rating}</span>
                      <p className="mp-card__price">${Number(product.price || 0).toFixed(2)}</p>
                    </div>

                    <div className="mp-card__actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => onAddToCart(product)}
                        disabled={product.meta.stock <= 0}
                      >
                        {product.meta.stock <= 0 ? "Out of stock" : "Add to cart"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleProductClick(product)}
                      >
                        View
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default Marketplace;

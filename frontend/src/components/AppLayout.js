import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "./AppLayout.css";

function AppLayout({
  children,
  onLogout,
  role = "",
  isAuthenticated = false,
  cartCount = 0,
  wishlistCount = 0,
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const normalizedRole = (
    role ||
    (isAuthenticated ? localStorage.getItem("userRole") : "buyer") ||
    "buyer"
  ).toLowerCase();

  // Search suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch suggestions when search query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const controller = new AbortController();
    fetch(`http://127.0.0.1:8000/api/products/search/?q=${encodeURIComponent(searchQuery)}`, {
      signal: controller.signal,
    })
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        setSuggestions(data);
        setShowSuggestions(true);
      })
      .catch(() => {
        setSuggestions([]);
        setShowSuggestions(false);
      });
    return () => controller.abort();
  }, [searchQuery]);

  const isAdmin = normalizedRole === "admin";
  const isSeller = normalizedRole === "seller";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target)
      ) {
        setSidebarOpen(false);
      }
    };

    if (sidebarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [sidebarOpen]);

  const closeSidebar = () => setSidebarOpen(false);

  const handleSearch = (event) => {
    event.preventDefault();
    const query = searchQuery.trim();

    if (query) {
      localStorage.setItem("marketplaceSearch", query);
    } else {
      localStorage.removeItem("marketplaceSearch");
    }

    navigate("/marketplace");
  };

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        ref={sidebarRef}
        className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}
      >
        <div className="brand-block">
          <img
            src="/Final%20App%20Logo.png"
            alt="CArTGo logo"
            className="brand-logo"
          />

          <div>
            <p className="brand-title">CArTGo</p>
            <p className="brand-subtitle">
              {localStorage.getItem("username")}
            </p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {isAuthenticated ? (
            <>
              <NavLink
                to="/profile"
                onClick={closeSidebar}
                className={({ isActive }) =>
                  `sidebar-link${isActive ? " active" : ""}`
                }
              >
                Profile
              </NavLink>

              <button
                className="sidebar-link sidebar-logout-link"
                onClick={() => {
                  closeSidebar();
                  onLogout();
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                className="sidebar-link"
                onClick={() => {
                  closeSidebar();
                  navigate("/login");
                }}
              >
                Sign In
              </button>

              <button
                className="sidebar-link"
                onClick={() => {
                  closeSidebar();
                  navigate("/register");
                }}
              >
                Sign Up
              </button>
            </>
          )}

          <button
            className="sidebar-link"
            onClick={() => {
              closeSidebar();
              navigate("/about");
            }}
          >
            About Us
          </button>
        </nav>
      </aside>

      <div className="layout-main">
        <header className="topbar">
          <div className="topbar-brand">
            <img
              src="/Final%20App%20Logo.png"
              alt="CArTGo logo"
              className="brand-logo brand-logo--compact"
            />

            <div>
              <p className="brand-title">CArTGo</p>
            </div>
          </div>

          <div className="topbar-actions">
<form className="topbar-search" onSubmit={handleSearch} autoComplete="off">
  {showSuggestions && suggestions.length > 0 && (
    <ul className="search-suggestions">
      {suggestions.map((item) => (
        <li key={item.id} onClick={() => { setSearchQuery(item.name); setShowSuggestions(false); navigate(`/product/${item.id}`); }}>
          {item.name}
        </li>
      ))}
    </ul>
  )}
  <input
    type="search"
    value={searchQuery}
    onChange={(event) => setSearchQuery(event.target.value)}
    placeholder="Search products"
    aria-label="Search products"
  />
  <button type="submit" className="btn btn-primary">Search</button>
</form>

            {isAdmin && (
              <>
                <button
                  className="btn btn-ghost"
                  onClick={() => navigate("/dashboard")}
                >
                  Dashboard
                </button>

                <button
                  className="btn btn-ghost"
                  onClick={() => navigate("/products")}
                >
                  Products
                </button>
              </>
            )}

            {isSeller && (
              <>
                <button
                  className="btn btn-ghost"
                  onClick={() => navigate("/seller-dashboard")}
                >
                  Dashboard
                </button>

                <button
                  className="btn btn-ghost"
                  onClick={() => navigate("/marketplace")}
                >
                  Marketplace
                </button>

                <button className="btn btn-ghost" onClick={() => navigate("/cart")}>
                  Cart ({cartCount})
                </button>

                <button className="btn btn-ghost" onClick={() => navigate("/wishlist")}>
                  Wishlist ({wishlistCount})
                </button>

                <button className="btn btn-ghost" onClick={() => navigate("/orders")}>
                  Orders
                </button>

                <button
                  className="btn btn-ghost"
                  onClick={() => navigate("/products")}
                >
                  My Store
                </button>
              </>
            )}

            {!isAdmin && !isSeller && (
              <>
                <button
                  className="btn btn-ghost"
                  onClick={() => navigate("/marketplace")}
                >
                  Home
                </button>

                <button className="btn btn-ghost" onClick={() => navigate("/cart")}>Cart ({cartCount})</button>
                <button className="btn btn-ghost" onClick={() => navigate("/wishlist")}>Wishlist ({wishlistCount})</button>
                {isAuthenticated ? (
                  <button className="btn btn-ghost" onClick={() => navigate("/orders")}>Orders</button>
                ) : null}
              </>
            )}
          </div>

          <button
            type="button"
            className="burger-btn"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
        </header>

        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppLayout;

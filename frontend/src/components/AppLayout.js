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

  const normalizedRole = (
    role ||
    (isAuthenticated ? localStorage.getItem("userRole") : "buyer") ||
    "buyer"
  ).toLowerCase();

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

                {isAuthenticated ? (
                  <>
                    <button
                      className="btn btn-ghost"
                      onClick={() => navigate("/cart")}
                    >
                      Cart ({cartCount})
                    </button>

                    <button
                      className="btn btn-ghost"
                      onClick={() => navigate("/wishlist")}
                    >
                      Wishlist ({wishlistCount})
                    </button>

                    <button
                      className="btn btn-ghost"
                      onClick={() => navigate("/orders")}
                    >
                      Orders
                    </button>
                  </>
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
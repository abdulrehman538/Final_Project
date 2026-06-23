import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { isAdmin, isSeller, normalizeRole } from "../utils/roles";
import "./AppLayout.css";

function CartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6h15l-1.5 9h-12L6 6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M6 6 5 3H2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="20" r="1.5" fill="currentColor" />
      <circle cx="18" cy="20" r="1.5" fill="currentColor" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20.5s-7-4.6-7-10a4 4 0 0 1 7-2.2A4 4 0 0 1 19 10.5c0 5.4-7 10-7 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PortalProfileMenu({
  menuRef,
  isOpen,
  onToggle,
  onProfile,
  onAbout,
  onLogout,
  showProfile = true,
  showLogout = true,
}) {
  return (
    <div className="nav-profile-menu" ref={menuRef}>
      <button
        type="button"
        className={`nav-profile-btn${isOpen ? " is-open" : ""}`}
        onClick={onToggle}
        aria-label="Account menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <ProfileIcon />
      </button>

      {isOpen && (
        <div className="nav-profile-dropdown" role="menu">
          {showProfile && onProfile && (
            <button
              type="button"
              role="menuitem"
              className="nav-profile-dropdown__item"
              onClick={onProfile}
            >
              My Profile
            </button>
          )}
          {onAbout && (
            <button
              type="button"
              role="menuitem"
              className="nav-profile-dropdown__item"
              onClick={onAbout}
            >
              About Us
            </button>
          )}
          {showLogout && onLogout && (
            <button
              type="button"
              role="menuitem"
              className="nav-profile-dropdown__item nav-profile-dropdown__item--logout"
              onClick={onLogout}
            >
              Logout
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AppLayout({
  children,
  onLogout,
  role = "",
  isAuthenticated = false,
  sellerStatus = "",
  cartCount = 0,
  wishlistCount = 0,
}) {
  const navigate = useNavigate();

  const normalizedRole = normalizeRole(
    role || (isAuthenticated ? localStorage.getItem("userRole") : "user")
  );

  const isAdminUser = isAdmin(normalizedRole);
  const isSellerUser = isSeller(normalizedRole);
  const resolvedSellerStatus =
    sellerStatus || (isAuthenticated ? localStorage.getItem("sellerStatus") : "") || "none";
  const isShopper = !isAdminUser && !isSellerUser;
  const showBecomeSellerLink = isShopper && !isAuthenticated;
  const showSellerPendingLink = isAuthenticated && resolvedSellerStatus === "pending";

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };

    if (profileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    };

    if (profileMenuOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileMenuOpen]);

  const closeProfileMenu = () => setProfileMenuOpen(false);

  const handleBrandClick = () => {
    if (isAdminUser) {
      navigate("/dashboard");
      return;
    }
    if (isSellerUser) {
      navigate("/seller-dashboard");
      return;
    }
    navigate("/marketplace");
  };

  const topbarClass = [
    "topbar",
    isShopper ? "topbar--shopper" : "",
    isSellerUser ? "topbar--seller" : "",
    isAdminUser ? "topbar--admin" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="app-shell">
      <div className="layout-main">
        <header className={topbarClass}>
          <div
            className="topbar-brand"
            onClick={handleBrandClick}
            onKeyDown={(e) => e.key === "Enter" && handleBrandClick()}
            role="button"
            tabIndex={0}
          >
            <img
              src="/Final%20App%20Logo.png"
              alt="CArTGo logo"
              className="brand-logo brand-logo--compact"
            />
            <div>
              <p className="brand-title">CArTGo</p>
            </div>
          </div>

          {isShopper && (
            <div className="topbar-actions topbar-actions--shopper">
              <div className="shopper-nav">
                {showBecomeSellerLink && (
                  <button
                    type="button"
                    className="nav-seller-link"
                    onClick={() => navigate("/portal")}
                  >
                    Become a Seller
                  </button>
                )}

                <button
                  type="button"
                  className="nav-seller-link nav-seller-link--track"
                  onClick={() => navigate("/track-order")}
                >
                  Track order
                </button>

                {showSellerPendingLink && (
                  <button
                    type="button"
                    className="nav-seller-link nav-seller-link--pending"
                    onClick={() => navigate("/profile")}
                  >
                    Application pending
                  </button>
                )}

                <div className="nav-icon-group">
                  <button
                    type="button"
                    className="nav-icon-btn"
                    onClick={() => navigate("/wishlist")}
                    aria-label={`Wishlist${wishlistCount ? `, ${wishlistCount} items` : ""}`}
                  >
                    <HeartIcon />
                    {wishlistCount > 0 && (
                      <span className="nav-icon-badge">{wishlistCount}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    className="nav-icon-btn"
                    onClick={() => navigate("/cart")}
                    aria-label={`Cart${cartCount ? `, ${cartCount} items` : ""}`}
                  >
                    <CartIcon />
                    {cartCount > 0 && (
                      <span className="nav-icon-badge">{cartCount}</span>
                    )}
                  </button>

                  <PortalProfileMenu
                    menuRef={profileMenuRef}
                    isOpen={profileMenuOpen}
                    onToggle={() => setProfileMenuOpen((open) => !open)}
                    showProfile={isAuthenticated}
                    onProfile={
                      isAuthenticated
                        ? () => {
                            closeProfileMenu();
                            navigate("/profile");
                          }
                        : undefined
                    }
                    onAbout={() => {
                      closeProfileMenu();
                      navigate("/about");
                    }}
                    showLogout={isAuthenticated}
                    onLogout={
                      isAuthenticated
                        ? () => {
                            closeProfileMenu();
                            onLogout();
                          }
                        : undefined
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {isAdminUser && (
            <div className="topbar-end">
              <nav className="portal-nav-links" aria-label="Admin navigation">
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) => `portal-nav-link${isActive ? " is-active" : ""}`}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/products"
                  className={({ isActive }) => `portal-nav-link${isActive ? " is-active" : ""}`}
                >
                  Products
                </NavLink>
              </nav>

              <div className="portal-nav">
                <PortalProfileMenu
                  menuRef={profileMenuRef}
                  isOpen={profileMenuOpen}
                  onToggle={() => setProfileMenuOpen((open) => !open)}
                  onProfile={() => {
                    closeProfileMenu();
                    navigate("/profile");
                  }}
                  onAbout={() => {
                    closeProfileMenu();
                    navigate("/about");
                  }}
                  onLogout={() => {
                    closeProfileMenu();
                    onLogout();
                  }}
                />
              </div>
            </div>
          )}

          {isSellerUser && (
            <div className="topbar-end">
              <nav className="portal-nav-links" aria-label="Seller navigation">
                <NavLink
                  to="/seller-dashboard"
                  className={({ isActive }) => `portal-nav-link${isActive ? " is-active" : ""}`}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/products"
                  className={({ isActive }) => `portal-nav-link${isActive ? " is-active" : ""}`}
                >
                  My Store
                </NavLink>
                <NavLink
                  to="/seller-orders"
                  className={({ isActive }) => `portal-nav-link${isActive ? " is-active" : ""}`}
                >
                  Orders
                </NavLink>
              </nav>

              <div className="portal-nav">
                <PortalProfileMenu
                  menuRef={profileMenuRef}
                  isOpen={profileMenuOpen}
                  onToggle={() => setProfileMenuOpen((open) => !open)}
                  onProfile={() => {
                    closeProfileMenu();
                    navigate("/profile");
                  }}
                  onAbout={() => {
                    closeProfileMenu();
                    navigate("/about");
                  }}
                  onLogout={() => {
                    closeProfileMenu();
                    onLogout();
                  }}
                />
              </div>
            </div>
          )}
        </header>

        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

export default AppLayout;

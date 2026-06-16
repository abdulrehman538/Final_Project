import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

import SellerDashboard from "./pages/SellerDashboard";
import AuthPage from "./pages/AuthPage";
import AdminDashboard from "./pages/AdminDashboard";
import Marketplace from "./pages/Marketplace";
import ProductDetail from "./pages/ProductDetail";
import CartPage from "./pages/CartPage";
import WishlistPage from "./pages/WishlistPage";
import OrdersPage from "./pages/OrdersPage";
import ProfilePage from "./pages/ProfilePage";
import ProductCrud from "./ProductCrud";
import AppLayout from "./components/AppLayout";
import GuestAuthModal from "./components/GuestAuthModal";
import "./App.css";

const loadJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

function App() {
  const [auth, setAuth] = useState({
    token: localStorage.getItem("accessToken"),
    role: (localStorage.getItem("userRole") || "buyer").toLowerCase(),
    username: localStorage.getItem("username") || "",
  });

  const [cart, setCart] = useState(() => loadJSON("cartItems", []));
  const [wishlist, setWishlist] = useState(() => loadJSON("wishlistItems", []));
  const [showGuestAuthModal, setShowGuestAuthModal] = useState(false);

  useEffect(() => {
    if (auth.token) {
      localStorage.setItem("accessToken", auth.token);
    } else {
      localStorage.removeItem("accessToken");
    }

    if (auth.role) {
      localStorage.setItem("userRole", auth.role);
    } else {
      localStorage.removeItem("userRole");
    }

    if (auth.username) {
      localStorage.setItem("username", auth.username);
    } else {
      localStorage.removeItem("username");
    }
  }, [auth]);

  useEffect(() => {
    localStorage.setItem("cartItems", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem("wishlistItems", JSON.stringify(wishlist));
  }, [wishlist]);

  const handleLogin = (token, role, username) => {
    setAuth({
      token,
      role: (role || "buyer").toLowerCase(),
      username: username || localStorage.getItem("username") || "",
    });
  };

  const isAuthenticated = Boolean(auth.token);
  const isGuest = !isAuthenticated;

  const handleLogout = () => {
    setAuth({ token: null, role: "buyer", username: "" });
  };

  const handleBecomeSeller = (storeName) => {
    setAuth((current) => ({ ...current, role: "seller" }));

    if (storeName) {
      localStorage.setItem("sellerStoreName", storeName);
    }
  };

  const navigate = useNavigate();

  const addToCart = (product, quantity = 1) => {
    if (!auth.token) {
      setShowGuestAuthModal(true);
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);

      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [...current, { ...product, quantity }];
    });
  };

  const updateCartQuantity = (id, quantity) => {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id ? { ...item, quantity } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id) => {
    setCart((current) =>
      current.filter((item) => item.id !== id)
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const toggleWishlist = (product) => {
    setWishlist((current) =>
      current.some((item) => item.id === product.id)
        ? current.filter((item) => item.id !== product.id)
        : [...current, product]
    );
  };

  const ProtectedRoute = ({
    children,
    allowedRoles = [],
  }) => {
    if (!auth.token) {
      return <Navigate to="/login" replace />;
    }

    if (!allowedRoles || allowedRoles.length === 0) {
      return children;
    }

    if (allowedRoles.includes(auth.role)) {
      return children;
    }

    if (auth.role === "admin") {
      return <Navigate to="/dashboard" replace />;
    }

    if (auth.role === "seller") {
      return <Navigate to="/seller-dashboard" replace />;
    }

    return <Navigate to="/marketplace" replace />;
  };

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            auth.token ? (
              <Navigate
                to={
                  auth.role === "admin"
                    ? "/dashboard"
                    : auth.role === "seller"
                    ? "/seller-dashboard"
                    : "/marketplace"
                }
                replace
              />
            ) : (
              <Navigate to="/marketplace" replace />
            )
          }
        />

      <Route
        path="/login"
        element={<AuthPage onLogin={handleLogin} />}
      />

      <Route
        path="/register"
        element={<AuthPage onLogin={handleLogin} />}
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AppLayout
              role="admin"
              title="Admin Dashboard"
              onLogout={handleLogout}
            >
              <AdminDashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/seller-dashboard"
        element={
          <ProtectedRoute allowedRoles={["seller"]}>
            <AppLayout
              role="seller"
              title="Seller Dashboard"
              onLogout={handleLogout}
            >
              <SellerDashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/products"
        element={
          <ProtectedRoute allowedRoles={["admin", "seller"]}>
            <AppLayout
              role={auth.role}
              title={
                auth.role === "seller"
                  ? "Seller Products"
                  : "Product Manager"
              }
              onLogout={handleLogout}
            >
              <ProductCrud role={auth.role} />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/marketplace"
        element={
          <AppLayout
            role={auth.role}
            isAuthenticated={isAuthenticated}
            title="Marketplace"
            onLogout={handleLogout}
            cartCount={cart.reduce(
              (sum, item) => sum + item.quantity,
              0
            )}
            wishlistCount={wishlist.length}
          >
            <Marketplace
              onAddToCart={addToCart}
              onToggleWishlist={toggleWishlist}
              wishlist={wishlist}
              cart={cart}
              isAuthenticated={isAuthenticated}
            />
          </AppLayout>
        }
      />

      <Route
        path="/product/:id"
        element={
          <AppLayout
            role={auth.role}
            isAuthenticated={isAuthenticated}
            title="Product Details"
            onLogout={handleLogout}
            cartCount={cart.reduce(
              (sum, item) => sum + item.quantity,
              0
            )}
            wishlistCount={wishlist.length}
          >
            <ProductDetail
              cart={cart}
              wishlist={wishlist}
              onAddToCart={addToCart}
              onToggleWishlist={toggleWishlist}
              isAuthenticated={isAuthenticated}
            />
          </AppLayout>
        }
      />

      <Route
        path="/cart"
        element={
          <AppLayout
            role={auth.role}
            isAuthenticated={isAuthenticated}
            title="Cart"
            onLogout={handleLogout}
            cartCount={cart.reduce(
              (sum, item) => sum + item.quantity,
              0
            )}
            wishlistCount={wishlist.length}
          >
            <CartPage
              cart={cart}
              onUpdateQuantity={updateCartQuantity}
              onRemoveItem={removeFromCart}
              onClearCart={clearCart}
            />
          </AppLayout>
        }
      />

      <Route
        path="/wishlist"
        element={
          <AppLayout
            role={auth.role}
            isAuthenticated={isAuthenticated}
            title="Wishlist"
            onLogout={handleLogout}
            cartCount={cart.reduce(
              (sum, item) => sum + item.quantity,
              0
            )}
            wishlistCount={wishlist.length}
          >
            <WishlistPage
              wishlist={wishlist}
              onToggleWishlist={toggleWishlist}
              onAddToCart={addToCart}
              isAuthenticated={isAuthenticated}
            />
          </AppLayout>
        }
      />

      <Route
        path="/orders"
        element={
          <ProtectedRoute allowedRoles={["buyer", "seller"]}>
            <AppLayout
              role={auth.role}
              title="Orders"
              onLogout={handleLogout}
              cartCount={cart.reduce(
                (sum, item) => sum + item.quantity,
                0
              )}
              wishlistCount={wishlist.length}
            >
              <OrdersPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute allowedRoles={["buyer", "seller"]}>
            <AppLayout
              role={auth.role}
              title="Profile"
              onLogout={handleLogout}
              cartCount={cart.reduce(
                (sum, item) => sum + item.quantity,
                0
              )}
              wishlistCount={wishlist.length}
            >
              <ProfilePage
                onBecomeSeller={handleBecomeSeller}
              />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={
          auth.token ? (
            <Navigate
              to={
                auth.role === "admin"
                  ? "/dashboard"
                  : auth.role === "seller"
                  ? "/seller-dashboard"
                  : "/marketplace"
              }
              replace
            />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      </Routes>

      <GuestAuthModal
        isOpen={showGuestAuthModal}
        onClose={() => setShowGuestAuthModal(false)}
        onLoginSuccess={handleLogin}
      />
    </>
  );
}

export default App;
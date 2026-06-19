import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

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
import AboutUsPage from "./pages/Aboutus";
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

  const handleLogout = () => {
    setAuth({ token: null, role: "buyer", username: "" });
    setCart([]);
    setWishlist([]);
    localStorage.removeItem("cartItems");
    localStorage.removeItem("wishlistItems");
  };

  const handleBecomeSeller = (storeName) => {
    if (storeName) {
      localStorage.setItem("sellerStoreName", storeName);
    }
  };

  const syncCartFromResponse = (cartItems) => {
    // Convert API cart items to frontend shape (include product fields)
    const formatted = cartItems.map((ci) => ({
      id: ci.product.id,
      ...ci.product,
      quantity: ci.quantity,
    }));
    setCart(formatted);
  };

  const fetchCart = async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    try {
      const res = await fetch("http://127.0.0.1:8000/api/cart/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        syncCartFromResponse(data.items);
      }
    } catch (e) {
      console.error("Failed to fetch cart", e);
    }
  };

  const formatCartItems = (items) => {
    // Ensure each item has id, quantity and product fields flattened
    return items.map((ci) => ({
      id: ci.product.id,
      ...ci.product,
      quantity: ci.quantity,
    }));
  };

  const addToCart = async (product, quantity = 1) => {
    if (!auth.token) {
      setShowGuestAuthModal(true);
      return;
    }
    const token = localStorage.getItem("accessToken");
    // Optimistic UI update before API call
    setCart((prev) => {
      const maxQty = product.stock ?? Infinity;
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        const newQty = Math.min(existing.quantity + quantity, maxQty);
        if (newQty === existing.quantity) {
          alert(`You cannot add more than ${maxQty} of this item.`);
          return prev;
        }
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: newQty } : item
        );
      }
      // Adding a brand‑new item – ensure we don’t exceed stock from the start
      if (quantity > maxQty) {
        alert(`Only ${maxQty} units are available.`);
        return prev;
      }
      return [...prev, { ...product, quantity }];
    });
    try {
      const res = await fetch("http://127.0.0.1:8000/api/cart/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ product_id: product.id, quantity }),
      });
      if (res.ok) {
        const data = await res.json();
        // Normalize response and update state
        const formatted = formatCartItems(data.items || []);
        setCart(formatted);
        // Success feedback can be added here if desired
        // For now we simply proceed without invoking undefined handlers
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to add to cart");
        // Revert optimistic update by refetching cart
        fetchCart();
      }
    } catch (e) {
      console.error(e);
      // On network error, keep optimistic update but notify user minimally
      console.warn("Network error while adding to cart. Item added locally.");
    }
  };

  const updateCartQuantity = async (id, quantity) => {
    // Optimistic UI update: adjust quantity locally first
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(quantity, 0) } : item
      )
    );
    // If quantity drops to 0, remove the item locally and call API removal
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    if (!auth.token) return;
    const token = localStorage.getItem("accessToken");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/cart/", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ item_id: id, quantity }),
      });
      if (res.ok) {
        const data = await res.json();
        syncCartFromResponse(data.items);
      } else {
        // Revert on error by refetching cart
        fetchCart();
      }
    } catch (e) {
      console.error(e);
      fetchCart();
    }
  };

  const removeFromCart = async (id) => {
    // Optimistically remove item from local state
    setCart((prev) => prev.filter((item) => item.id !== id));
    const token = localStorage.getItem("accessToken");
    if (!token) {
      // No auth token; nothing more to do
      return;
    }
    try {
      const res = await fetch("http://127.0.0.1:8000/api/cart/", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_id: id }),
      });
      if (!res.ok) {
        // Revert removal on error by refetching the cart
        fetchCart();
      }
    } catch (e) {
      console.error(e);
      fetchCart();
    }
  };

  const clearCart = () => {
    // simplest: clear locally and send delete for each item
    cart.forEach((item) => removeFromCart(item.id));
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
              isAuthenticated={isAuthenticated}
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
              isAuthenticated={isAuthenticated}
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
              isAuthenticated={isAuthenticated}
            >
              <ProductCrud role={auth.role} />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/about"
        element={
          <AppLayout
            role={auth.role}
            isAuthenticated={isAuthenticated}
            title="About Us"
            onLogout={handleLogout}
            cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
            wishlistCount={wishlist.length}
          >
            <AboutUsPage />
          </AppLayout>
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
              isAuthenticated={isAuthenticated}
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
              isAuthenticated={isAuthenticated}
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
import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { getPostLoginPath, isAdmin, isSeller, normalizeRole } from "./utils/roles";
import { clearAuthSession, setSessionExpiredHandler } from "./utils/authSession";
import {
  addServerCartItem,
  clearServerCart,
  loadAuthenticatedCart,
  removeServerCartItem,
  updateServerCartItem,
} from "./utils/cartSession";

import SellerDashboard from "./pages/SellerDashboard";
import AuthPage from "./pages/AuthPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminStorePage from "./pages/AdminStorePage";
import Marketplace from "./pages/Marketplace";
import ProductDetail from "./pages/ProductDetail";
import CartPage from "./pages/CartPage";
import WishlistPage from "./pages/WishlistPage";
import OrdersPage from "./pages/OrdersPage";
import SellerOrdersPage from "./pages/SellerOrdersPage";
import ProfilePage from "./pages/ProfilePage";
import ProductCrud from "./ProductCrud";
import AppLayout from "./components/AppLayout";
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
  const navigate = useNavigate();

  const [auth, setAuth] = useState({
    token: localStorage.getItem("accessToken"),
    role: normalizeRole(localStorage.getItem("userRole")),
    username: localStorage.getItem("username") || "",
    sellerStatus: localStorage.getItem("sellerStatus") || "none",
  });

  const [cart, setCart] = useState(() => loadJSON("cartItems", []));
  const [wishlist, setWishlist] = useState(() => loadJSON("wishlistItems", []));

  useEffect(() => {
    if (auth.token) {
      localStorage.setItem("accessToken", auth.token);
    } else {
      localStorage.removeItem("accessToken");
    }

    if (auth.token && auth.role) {
      localStorage.setItem("userRole", auth.role);
    } else {
      localStorage.removeItem("userRole");
    }

    if (auth.token && auth.sellerStatus) {
      localStorage.setItem("sellerStatus", auth.sellerStatus);
    } else {
      localStorage.removeItem("sellerStatus");
    }

    if (auth.token && auth.username) {
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

  useEffect(() => {
    if (!auth.token) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      const localItems = loadJSON("cartItems", []);
      const mergedCart = await loadAuthenticatedCart(localItems);
      if (!cancelled && mergedCart) {
        setCart(mergedCart);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.token]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearAuthSession();
      setAuth({ token: null, role: "user", username: "", sellerStatus: "none" });
      navigate("/portal", {
        replace: true,
        state: { sessionExpired: true },
      });
    });

    return () => setSessionExpiredHandler(null);
  }, [navigate]);

  const handleLogin = (token, role, username, sellerStatus = "none") => {
    const normalizedRole = normalizeRole(role);
    setAuth({
      token,
      role: normalizedRole,
      username: username || "",
      sellerStatus: sellerStatus || "none",
    });
  };

  const isAuthenticated = Boolean(auth.token);

  const handleLogout = () => {
    clearAuthSession();
    setAuth({ token: null, role: "user", username: "", sellerStatus: "none" });
  };

  const handleBecomeSeller = (storeName) => {
    if (storeName) {
      localStorage.setItem("sellerStoreName", storeName);
    }
    localStorage.setItem("sellerStatus", "pending");
    setAuth((current) => ({ ...current, sellerStatus: "pending" }));
  };

  const getProductId = (value) => String(value?.id ?? value);

  const addToCart = (product, quantity = 1) => {
    if (!product || product.id === undefined || product.id === null) {
      return false;
    }

    const productId = getProductId(product);
    const parsedStock = Number(product.stock);
    const maxQty = Number.isFinite(parsedStock) ? parsedStock : Infinity;
    const safeQty = Math.max(1, Number(quantity) || 1);

    setCart((prev) => {
      const existing = prev.find((item) => getProductId(item) === productId);

      if (existing) {
        const newQty = Math.min(existing.quantity + safeQty, maxQty);
        if (newQty === existing.quantity) {
          window.alert(`You cannot add more than ${maxQty} of this item.`);
          return prev;
        }
        return prev.map((item) =>
          getProductId(item) === productId ? { ...item, ...product, quantity: newQty } : item
        );
      }

      if (safeQty > maxQty) {
        window.alert(`Only ${maxQty} units are available.`);
        return prev;
      }

      return [...prev, { ...product, quantity: safeQty }];
    });

    if (auth.token) {
      void addServerCartItem(product.id, safeQty).then((items) => {
        if (items) {
          setCart(items);
        }
      });
    }

    return true;
  };

  const addManyToCart = (products, quantity = 1) => {
    const safeQty = Math.max(1, Number(quantity) || 1);

    setCart((prev) => {
      let next = [...prev];

      products.forEach((product) => {
        if (!product || product.id === undefined || product.id === null) {
          return;
        }

        const productId = getProductId(product);
        const parsedStock = Number(product.stock);
        const maxQty = Number.isFinite(parsedStock) ? parsedStock : Infinity;
        const existing = next.find((item) => getProductId(item) === productId);

        if (existing) {
          const newQty = Math.min(existing.quantity + safeQty, maxQty);
          next = next.map((item) =>
            getProductId(item) === productId ? { ...item, ...product, quantity: newQty } : item
          );
          return;
        }

        if (safeQty <= maxQty) {
          next.push({ ...product, quantity: safeQty });
        }
      });

      return next;
    });

    if (auth.token) {
      void Promise.all(
        products
          .filter((product) => product?.id != null)
          .map((product) => addServerCartItem(product.id, safeQty))
      ).then(async () => {
        const mergedCart = await loadAuthenticatedCart([]);
        if (mergedCart) {
          setCart(mergedCart);
        }
      });
    }
  };

  const updateCartQuantity = (id, quantity) => {
    const targetId = getProductId(id);
    if (quantity <= 0) {
      removeFromCart(targetId);
      return;
    }

    let nextQty = quantity;

    setCart((prev) =>
      prev.map((item) => {
        if (getProductId(item) !== targetId) {
          return item;
        }

        const parsedStock = Number(item.stock);
        const maxQty = Number.isFinite(parsedStock) ? parsedStock : quantity;
        nextQty = Math.min(Math.max(quantity, 1), maxQty);

        if (nextQty < quantity && Number.isFinite(parsedStock)) {
          window.alert(`Only ${maxQty} units are available for ${item.name || "this item"}.`);
        }

        return { ...item, quantity: nextQty };
      })
    );

    if (auth.token) {
      void updateServerCartItem(targetId, nextQty).then((items) => {
        if (items) {
          setCart(items);
        }
      });
    }
  };

  const removeFromCart = (id) => {
    const targetId = getProductId(id);
    setCart((prev) => prev.filter((item) => getProductId(item) !== targetId));

    if (auth.token) {
      void removeServerCartItem(targetId).then((items) => {
        if (items) {
          setCart(items);
        }
      });
    }
  };

  const clearCart = () => {
    setCart([]);

    if (auth.token) {
      void clearServerCart();
    }
  };

  const syncCart = (items) => {
    if (!Array.isArray(items)) return;
    setCart(
      items.map(({ _savedPrice, _unavailable, _priceChanged, _qtyAdjusted, ...item }) => item)
    );
  };

  const toggleWishlist = (product) => {
    const productId = getProductId(product);
    setWishlist((current) =>
      current.some((item) => getProductId(item) === productId)
        ? current.filter((item) => getProductId(item) !== productId)
        : [...current, product]
    );
  };

  const ProtectedRoute = ({
    children,
    allowedRoles = [],
  }) => {
    if (!auth.token) {
      return <Navigate to="/portal" replace />;
    }

    if (!allowedRoles || allowedRoles.length === 0) {
      return children;
    }

    if (allowedRoles.includes(auth.role)) {
      return children;
    }

    if (isAdmin(auth.role)) {
      return <Navigate to="/dashboard" replace />;
    }

    if (isSeller(auth.role)) {
      return <Navigate to="/seller-dashboard" replace />;
    }

    return <Navigate to="/marketplace" replace />;
  };

  return (
    <Routes>
        <Route
          path="/"
          element={
            auth.token && (isAdmin(auth.role) || isSeller(auth.role)) ? (
              <Navigate to={getPostLoginPath(auth.role)} replace />
            ) : (
              <Navigate to="/marketplace" replace />
            )
          }
        />

        <Route path="/portal" element={<AuthPage onLogin={handleLogin} portalOnly />} />
        <Route path="/login" element={<Navigate to="/portal" replace />} />
        <Route path="/register" element={<Navigate to="/portal?mode=signup" replace />} />

        <Route
          path="/dashboard/stores/:userId"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AppLayout
                role="admin"
                title="Store Preview"
                onLogout={handleLogout}
                isAuthenticated={isAuthenticated}
              >
                <AdminStorePage />
              </AppLayout>
            </ProtectedRoute>
          }
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
          path="/seller-orders"
          element={
            <ProtectedRoute allowedRoles={["seller"]}>
              <AppLayout
                role="seller"
                title="Orders"
                onLogout={handleLogout}
                isAuthenticated={isAuthenticated}
              >
                <SellerOrdersPage />
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
                  isSeller(auth.role)
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
              cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
              wishlistCount={wishlist.length}
            >
              <Marketplace
                onAddToCart={addToCart}
                onToggleWishlist={toggleWishlist}
                wishlist={wishlist}
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
              cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
              wishlistCount={wishlist.length}
            >
              <ProductDetail
                cart={cart}
                wishlist={wishlist}
                onAddToCart={addToCart}
                onToggleWishlist={toggleWishlist}
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
              cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
              wishlistCount={wishlist.length}
            >
              <CartPage
                cart={cart}
                onAddToCart={addToCart}
                onUpdateQuantity={updateCartQuantity}
                onRemoveItem={removeFromCart}
                onClearCart={clearCart}
                onSyncCart={syncCart}
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
              cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
              wishlistCount={wishlist.length}
            >
              <WishlistPage
                wishlist={wishlist}
                onToggleWishlist={toggleWishlist}
                onAddToCart={addToCart}
                onAddManyToCart={addManyToCart}
              />
            </AppLayout>
          }
        />

        <Route
          path="/orders"
          element={
            <AppLayout
              role={auth.role}
              isAuthenticated={isAuthenticated}
              title="Orders"
              onLogout={handleLogout}
              cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
              wishlistCount={wishlist.length}
            >
              <OrdersPage />
            </AppLayout>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <AppLayout
                role={auth.role}
                isAuthenticated={isAuthenticated}
                title="Profile"
                onLogout={handleLogout}
                cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
                wishlistCount={wishlist.length}
              >
                <ProfilePage onBecomeSeller={handleBecomeSeller} />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={<Navigate to="/marketplace" replace />}
        />
      </Routes>
  );
}

export default App;

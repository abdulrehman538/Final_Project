# CArTGo — 2-Page Defense Cram Sheet

**Stack:** Django 6 + DRF + JWT + PostgreSQL + React | **Brand:** CArTGo marketplace

---

## PAGE 1 — Architecture, Roles & Frontend Map

### 30-Second Pitch
Multi-vendor marketplace. **React SPA** talks to **Django REST API** + **PostgreSQL**. Guests shop without login. **Sellers** sell after **admin approval**. **JWT** auth. Cart: **localStorage (guest)** + **server sync (logged in)**. Checkout uses **DB transactions** — no overselling.

### How to Run
```bash
# Terminal 1 — Backend
python manage.py migrate && python manage.py runserver

# Terminal 2 — Frontend
cd frontend && npm start
```
Backend: `127.0.0.1:8000` | Frontend: `localhost:3000` | DB: PostgreSQL `ecommerce_db`

### Architecture
```
React (App.js) ──fetch/JWT──► Django API (views.py) ──ORM──► PostgreSQL
     │                              └── media/products/ (images)
     └── localStorage: tokens, cart, wishlist, guest orders
```

### 3 Roles
| Role | Access | Home after login |
|------|--------|------------------|
| **user** (shopper) | Browse, cart, checkout, profile | `/profile` |
| **seller** | + products CRUD, seller orders | `/seller-dashboard` |
| **admin** | + stats, approve sellers, all orders | `/dashboard` |

Seller flow: apply on Profile → `pending` → admin approves → `approved` + Seller group.

### Frontend Render Tree
```
index.js → BrowserRouter → App.js (auth, cart, wishlist state)
  └── Routes
        /portal          → AuthPage ONLY (no navbar)
        /marketplace     → AppLayout → Marketplace
        /product/:id     → AppLayout → ProductDetail
        /cart            → AppLayout → CartPage
        /wishlist        → AppLayout → WishlistPage
        /orders          → AppLayout → OrdersPage
        /profile         → ProtectedRoute → AppLayout → ProfilePage
        /about           → AppLayout → AboutUsPage
        /dashboard       → ProtectedRoute(admin) → AppLayout → AdminDashboard
        /seller-dashboard→ ProtectedRoute(seller) → AppLayout → SellerDashboard
        /seller-orders   → ProtectedRoute(seller) → AppLayout → SellerOrdersPage
        /products        → ProtectedRoute(admin|seller) → AppLayout → ProductCrud
```

**AppLayout** = navbar shell (logo, cart/wishlist icons for shoppers; Dashboard/Products/Orders for admin/seller).

**ProtectedRoute** = no token → `/portal`; wrong role → redirect to correct dashboard.

### What Each Page Does
| Page | File | Main API |
|------|------|----------|
| Marketplace | `pages/Marketplace.js` | GET `/api/products/` |
| Product Detail | `pages/ProductDetail.js` | GET product, GET/POST comments |
| Cart + Checkout | `pages/CartPage.js` | GET products (hydrate), POST `/api/checkout/` |
| Wishlist | `pages/WishlistPage.js` | GET products (localStorage only) |
| Orders | `pages/OrdersPage.js` | GET `/api/orders/` (logged in) OR localStorage (guest) |
| Login/Signup | `pages/AuthPage.js` | POST login, register, check-username |
| Profile | `pages/ProfilePage.js` | GET/PATCH `/api/profile/` |
| Admin Dashboard | `pages/AdminDashboard.js` | admin/stats, seller-requests, orders |
| Seller Dashboard | `pages/SellerDashboard.js` | seller-products, seller-orders |
| Seller Orders | `pages/SellerOrdersPage.js` | seller-orders, PATCH status |
| Product CRUD | `ProductCrud.js` | products CRUD, delete images |
| About | `pages/Aboutus.jsx` | None (static) |

### Key Utils
| File | Purpose |
|------|---------|
| `utils/authSession.js` | JWT storage, `fetchWithAuth`, token refresh |
| `utils/cartSession.js` | Server cart GET/POST/PATCH/DELETE |
| `utils/roles.js` | `isAdmin`, `isSeller`, post-login redirect |
| `utils/productImage.js` | Image URL helpers |

### localStorage Keys
`accessToken`, `refreshToken`, `userRole`, `username`, `sellerStatus`, `cartItems`, `wishlistItems`, `cartOrders` (guest orders only)

---

## PAGE 2 — Backend, Flows & Viva Q&A

### Database Models
**User** ↔ **UserProfile** (1:1) | **User** → **Product** (1:many, owner) | **Order** → **OrderItem** (1:many) | **Cart** → **CartItem** (1:many)

**OrderItem** stores: product, quantity, price, **seller** (multi-vendor in one order).

### Main API Endpoints
| Group | Endpoints |
|-------|-----------|
| Auth | POST `/api/login/`, POST `/api/token/refresh/` |
| Shop | GET/POST `/api/products/`, GET search, GET/PATCH/DELETE `/api/products/<id>/` |
| User | POST register, GET/PATCH profile, GET/POST/PATCH/DELETE **cart**, GET orders |
| Checkout | POST `/api/checkout/` (guest OR JWT via OptionalJWTAuthentication) |
| Seller | GET seller-products, seller-orders, PATCH order status |
| Admin | GET stats, orders, stores, seller-requests, POST approve/reject |

### Auth Flow
Login → JWT tokens → `GET /api/user-role/` → store in localStorage → `fetchWithAuth` adds Bearer header → 401 → refresh token → fail → logout to `/portal`.

### Checkout Flow (Know This!)
1. Cart items sent as `[{product_id, quantity}]`
2. `aggregate_cart_quantities()` merges duplicates
3. `transaction.atomic()` + `select_for_update()` locks products
4. Validates stock → creates Order + OrderItems → deducts stock
5. Logged-in: links `buyer`, clears server cart
6. Cancel order → `restore_order_stock()`

### Order Status
`pending → confirmed → shipped → delivered → completed` (cancel restores stock at allowed stages)

### Backend Key Files
| File | What |
|------|------|
| `api/models.py` | Database tables |
| `api/views.py` | All API logic |
| `api/serializers.py` | JSON ↔ models, validation |
| `api/urls.py` | API routes |
| `api/permissions.py` | `IsSellerOrAdminOrReadOnly` |
| `api/utils.py` | `is_admin()`, `is_seller()`, `get_user_role()` |
| `api/stock.py` | Stock deduct/restore |
| `backend/settings.py` | DB, JWT, CORS, `.env` support |

### Training Topics → Your Project (Quick Answers)

**Python/OOP:** Models & views are classes. Dict in `aggregate_cart_quantities()`. Loops in checkout stock check.

**HTTP:** GET=read, POST=create/login/checkout, PATCH=update, DELETE=remove.

**Django ORM:** `Product.objects.filter(...)`, `select_related`, `prefetch_related` — fewer DB queries.

**MVT:** Model + View (API JSON). React replaces Templates.

**DRF:** Serializers validate JSON. Generic views (`ListCreateAPIView`). Permissions on each endpoint.

**JWT vs Session:** JWT in localStorage for SPA. Django admin uses sessions.

**CORS:** `django-cors-headers` allows React:3000 → Django:8000.

**React hooks:** `useState` (data), `useEffect` (load/sync), `useNavigate`/`useParams` (routing). No Redux.

**Props:** App passes `onAddToCart`, `cart`, etc. to child pages.

### Tough Questions — Short Answers
| Question | Answer |
|----------|--------|
| Payment gateway? | **No** — COD only, order created in DB |
| Guest checkout? | **Yes** — name + address required, `buyer=null` |
| Overselling? | **No** — transaction + row lock + stock check |
| Multi-seller order? | **Yes** — each OrderItem has its own seller |
| Server cart? | **Yes** for logged-in via `/api/cart/`; guests use localStorage |
| Orders page source? | **API** if logged in; **localStorage** if guest |
| Why React + Django API? | Separation, SPA UX, API reusable for mobile |
| Not production-ready? | No real payments, email, password reset |
| Tests? | 13 Django + 7 React tests |

### 5-Min Demo Order
1. Marketplace → add to cart → 2. Guest checkout → 3. Register → 4. Apply as seller → 5. Admin approve → 6. Seller add product → 7. Update order status

---

**Full guide:** `CArTGo-Project-Defense-Guide.md` in project root | **Good luck!**

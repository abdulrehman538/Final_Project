# CArTGo — 2-Page Defense Cram Sheet

**Stack:** Django 6 + DRF + JWT + PostgreSQL + React | **App:** Multi-vendor marketplace (CArTGo)

---

## ELEVATOR PITCH (30 sec)

CArTGo is a full-stack marketplace. **Backend:** Django REST API + JWT + PostgreSQL. **Frontend:** React SPA. **Guests** browse/checkout without login. **Sellers** manage products after **admin approval**. **Admins** see stats and approve sellers. Cart = **localStorage (guests)** + **server sync (logged-in)**. Checkout uses **DB transactions** to prevent overselling.

---

## RUN PROJECT

```bash
# Backend (port 8000)
python manage.py migrate && python manage.py runserver

# Frontend (port 3000)
cd frontend && npm start
```

PostgreSQL DB: `ecommerce_db` | Optional: `python manage.py seed_demo_data` | Admin: `createsuperuser`

---

## ARCHITECTURE

```
React (App.js) ──fetch/JWT──► Django API (views.py) ──ORM──► PostgreSQL
                localStorage                              media/products/
```

React = UI only. Django = business logic + JSON. No Django templates (SPA).

---

## ROLES

| Role | Access | Home after login |
|------|--------|------------------|
| **user** (shopper) | Marketplace, cart, checkout, profile | `/profile` |
| **seller** (approved) | + `/products`, `/seller-dashboard`, `/seller-orders` | `/seller-dashboard` |
| **admin** | + `/dashboard`, all products/orders | `/dashboard` |

Seller flow: apply on Profile → `pending` → admin approves → Seller group + `is_seller=True`

---

## FRONTEND — ROUTES & COMPONENTS

| Route | Page file | Layout | Who |
|-------|-----------|--------|-----|
| `/portal` | AuthPage.js | Standalone | Public — login/signup |
| `/marketplace` | Marketplace.js | AppLayout | Public — shop |
| `/product/:id` | ProductDetail.js | AppLayout | Public — detail + reviews |
| `/cart` | CartPage.js | AppLayout | Public — checkout |
| `/wishlist` | WishlistPage.js | AppLayout | Public |
| `/orders` | OrdersPage.js | AppLayout | Public (API if logged in) |
| `/profile` | ProfilePage.js | AppLayout | Login required |
| `/about` | Aboutus.jsx | AppLayout | Public |
| `/dashboard` | AdminDashboard.js | AppLayout | Admin only |
| `/seller-dashboard` | SellerDashboard.js | AppLayout | Seller only |
| `/seller-orders` | SellerOrdersPage.js | AppLayout | Seller only |
| `/products` | ProductCrud.js | AppLayout | Admin + Seller |

**App.js** = global state (auth, cart, wishlist) + `ProtectedRoute`  
**AppLayout** = navbar (changes by role: cart/wishlist for shoppers; dashboard links for admin/seller)

---

## KEY FLOWS

**Guest checkout:** Cart (localStorage) → hydrate prices from API → POST `/api/checkout/` → order in DB → copy in `cartOrders` localStorage → view on `/orders`

**Logged-in:** Cart syncs to `/api/cart/` | Checkout uses JWT → order linked to buyer | Orders from `GET /api/orders/`

**Order status:** `pending → confirmed → shipped → delivered → completed` (cancel restores stock)

---

## MAIN API ENDPOINTS

| Endpoint | Purpose |
|----------|---------|
| POST `/api/login/` | JWT tokens |
| POST `/api/register/` | Sign up |
| GET `/api/products/` | List products |
| POST `/api/checkout/` | Place order (guest or auth) |
| GET/POST/PATCH/DELETE `/api/cart/` | Server cart (auth) |
| GET `/api/orders/` | Buyer's orders |
| GET `/api/seller-products/` | Seller's products |
| GET `/api/seller-orders/` | Seller's orders |
| PATCH `/api/orders/<id>/status/` | Update status |
| GET `/api/admin/stats/` | Dashboard stats |
| POST `/api/admin/seller-requests/approve/` | Approve seller |

---

## DATABASE MODELS

**User** + **UserProfile** (seller_status, store_name) | **Product** + **ProductImage** | **Order** + **OrderItem** (each item has seller) | **Cart** + **CartItem** | **ProductComment**

---

## IMPORTANT FILES

| Backend | Frontend |
|---------|----------|
| `api/models.py` | `App.js` (routes + state) |
| `api/views.py` | `components/AppLayout.js` |
| `api/serializers.py` | `utils/authSession.js` (JWT) |
| `api/permissions.py` | `utils/cartSession.js` (server cart) |
| `api/urls.py` | `pages/CartPage.js` (checkout) |
| `backend/settings.py` | `pages/AuthPage.js` (login) |

---

## TOP 15 VIVA Q&A

**1. Why Django + React separate?** API reusable; SPA UX; industry standard.

**2. What is JWT?** Login returns access+refresh tokens. Sent as `Authorization: Bearer`. Stored in localStorage. Refresh on 401.

**3. What is DRF serializer?** Converts model ↔ JSON + validates POST data. Example: `ProductSerializer`, `UserRegisterSerializer`.

**4. What is ORM?** Python DB queries. Ex: `Product.objects.filter(stock__lte=5)`.

**5. What is CORS?** Lets React (port 3000) call Django (8000). `django-cors-headers` in settings.

**6. Guest vs logged-in checkout?** Same endpoint. `OptionalJWTAuthentication` — token optional. Guest needs name + address.

**7. How prevent overselling?** `transaction.atomic()` + `select_for_update()` + stock check before order.

**8. Multi-vendor orders?** One Order, many OrderItems, each with `seller` FK.

**9. React hooks used?** `useState`, `useEffect`, `useNavigate`, `useParams`, `useMemo`, `useCallback`.

**10. Where is cart stored?** Guest: localStorage. Logged-in: also `/api/cart/` in PostgreSQL.

**11. Where are orders shown?** Guest: localStorage. Logged-in: `GET /api/orders/`.

**12. Permission on products?** `IsSellerOrAdminOrReadOnly` — anyone reads; seller edits own; admin edits all.

**13. What is ProtectedRoute?** Checks token + role in App.js before rendering admin/seller pages.

**14. Payment gateway?** No — COD only. Order created, no Stripe/PayPal.

**15. Production config?** `.env` for SECRET_KEY, DB password, DEBUG (see `.env.example`).

---

## DEMO ORDER (5 min)

Marketplace → add to cart → guest checkout → register → apply seller → admin approve → seller add product → update order status

---

## HONEST LIMITATIONS

No real payments | No email notifications | Wishlist client-only | Use HTTPS + strong SECRET_KEY in production

---

*Full guide: `CArTGo-Project-Defense-Guide.md` in project root*

# Atelier — Frontend for your FastAPI ecommerce backend

A premium, dependency-free storefront (HTML/CSS/vanilla JS) that talks directly
to your existing FastAPI + MySQL backend (`/auth`, `/products`, `/categories`,
`/orders`, `/users`).

## Run it

1. **Start your backend** as usual, e.g. from `ecommerce_backend/`:
   ```
   uvicorn app.main:app --reload
   ```
   By default it serves on `http://127.0.0.1:8000`. CORS is already open (`allow_origins=["*"]`)
   in your `main.py`, so the browser can call it directly.

2. **Open the frontend.** Any static file server works, e.g. from this folder:
   ```
   python3 -m http.server 5500
   ```
   then visit `http://127.0.0.1:5500/index.html`. (Opening `index.html` directly
   with `file://` also works for browsing, but some browsers block `fetch` from
   `file://` — a local server is more reliable.)

3. **Point it at your backend.** There's a small pill in the bottom-left corner
   of every page showing the current API URL (defaults to `http://127.0.0.1:8000`).
   Click it to change the address if your backend runs elsewhere (a different
   port, a deployed URL, etc). It's saved in `localStorage`.

4. **Create your first account.** Go to *Create account* — the first user ever
   registered on a fresh database is automatically made admin by your backend,
   which unlocks the **Studio** link in the header for managing products,
   categories, orders and users.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Home — hero, collections, new arrivals |
| `shop.html` | Full catalog with search, category, price and sort filters |
| `product.html?id=` | Product detail, quantity picker, add to bag / buy now |
| `login.html` / `register.html` | Auth (JWT stored in `localStorage`) |
| `account.html` | Profile summary + order history with cancel |
| `checkout.html` | Shipping address + place order |
| `admin.html` | Studio: products, categories, orders, users (admin-only) |

## Notes

- Cart state lives in the browser (`localStorage`), so it persists across
  reloads and is merged into a real order only at checkout.
- Product images: set `image_url` when creating/editing a product in the
  Studio. Products without one get an auto-generated monogram placeholder.
- All write actions (place order, admin CRUD) require sign-in; the JWT is
  attached automatically as a Bearer token.

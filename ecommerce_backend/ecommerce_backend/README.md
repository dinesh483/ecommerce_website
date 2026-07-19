# Ecommerce Backend (FastAPI + MySQL)

A complete, tested backend for an ecommerce website. Includes:

- **Auth**: register/login with JWT tokens, password hashing (bcrypt)
- **Products**: full CRUD (create, read, update, delete), search, filter by category/price, pagination, stock management
- **Categories**: full CRUD
- **Orders**: place orders (auto-checks & deducts stock), view your orders, admin view/update all orders, cancel/restock
- **Users**: admin can list users, promote to admin, activate/deactivate
- Auto-generated interactive API docs (Swagger UI)

This was smoke-tested end-to-end (register → login → create category → create product → update → order → stock deduction → delete) before being handed to you, so the logic works.

---

## 1. Prerequisites

- Python 3.9+
- MySQL Server 8.x installed and running (MySQL Workbench, XAMPP, or a plain `mysql-server` install all work)

## 2. Project structure

```
ecommerce_backend/
├── app/
│   ├── main.py            # FastAPI app entrypoint
│   ├── database.py        # DB connection/session
│   ├── models.py          # SQLAlchemy tables
│   ├── schemas.py         # Pydantic request/response models
│   ├── auth.py             # JWT + password hashing + auth dependencies
│   └── routers/
│       ├── auth_routes.py  # /auth/register, /auth/login, /auth/me
│       ├── categories.py   # /categories CRUD
│       ├── products.py     # /products CRUD + search/filter
│       ├── orders.py       # /orders create/list/status/cancel
│       └── users.py        # /users admin management
├── requirements.txt
├── .env.example
└── README.md
```

## 3. Setup steps

### Step 1 — Create the MySQL database

Open the MySQL shell (or MySQL Workbench) and run:

```sql
CREATE DATABASE ecommerce_db;
```

You don't need to create tables manually — the app creates them automatically on first run.

### Step 2 — Create a virtual environment and install dependencies

```bash
cd ecommerce_backend
python3 -m venv venv

# activate it
source venv/bin/activate        # Mac/Linux
venv\Scripts\activate           # Windows

pip install -r requirements.txt
```

### Step 3 — Configure your environment variables

Copy the example env file and edit it with your real MySQL credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```
DB_USER=root
DB_PASSWORD=your_actual_mysql_password
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ecommerce_db

SECRET_KEY=make_this_a_long_random_string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

Tip for `SECRET_KEY`: generate a strong one with:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### Step 4 — Run the server

```bash
uvicorn app.main:app --reload
```

You should see something like `Application startup complete`, and the app will auto-create all tables in `ecommerce_db`.

### Step 5 — Open the interactive docs

Go to: **http://127.0.0.1:8000/docs**

This gives you a full Swagger UI where you can try every endpoint (register, login, add products, etc.) directly in the browser — no separate frontend or Postman needed to test it.

---

## 4. How to use it (typical flow)

1. **Register** via `POST /auth/register`. ⚠️ The **first user you register automatically becomes an admin** — do this first before anyone else signs up, since only admins can add/edit/delete products and categories.
2. **Login** via `POST /auth/login` (send `username` + `password` as form data, not JSON — it's OAuth2 standard). You get back an `access_token`.
3. In Swagger UI, click the **Authorize** button (top right) and paste `your_token_here` — this authenticates all subsequent requests.
4. **Create a category**: `POST /categories/` e.g. `{"name": "Electronics"}`
5. **Add a product**: `POST /products/` e.g.
   ```json
   {
     "name": "Wireless Mouse",
     "description": "Ergonomic wireless mouse",
     "price": 19.99,
     "stock": 100,
     "category_id": 1
   }
   ```
6. **List/search products**: `GET /products/?search=mouse&category_id=1&min_price=10&max_price=50`
7. **Update a product**: `PUT /products/{id}` with just the fields you want to change
8. **Delete a product**: `DELETE /products/{id}`
9. **Place an order** (as any logged-in user): `POST /orders/` with a list of `product_id` + `quantity` — stock is automatically checked and deducted.
10. **View your orders**: `GET /orders/my-orders`
11. **Admin: view all orders / update status**: `GET /orders/` and `PATCH /orders/{id}/status`

---

## 5. Key endpoints reference

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Create account |
| POST | `/auth/login` | Public | Get JWT token |
| GET | `/auth/me` | Logged in | Current user info |
| GET | `/products/` | Public | List/search/filter products |
| GET | `/products/{id}` | Public | Get one product |
| POST | `/products/` | Admin | Add product |
| PUT | `/products/{id}` | Admin | Update product |
| PATCH | `/products/{id}/stock` | Admin | Adjust stock quantity |
| DELETE | `/products/{id}` | Admin | Delete product |
| GET/POST/PUT/DELETE | `/categories/...` | Public read / Admin write | Category CRUD |
| POST | `/orders/` | Logged in | Place an order |
| GET | `/orders/my-orders` | Logged in | Your order history |
| GET | `/orders/` | Admin | All orders |
| PATCH | `/orders/{id}/status` | Admin | Update order status |
| DELETE | `/orders/{id}` | Owner/Admin | Cancel order (restocks items) |
| GET | `/users/` | Admin | List all users |

## 6. Connecting a frontend

CORS is already open (`allow_origins=["*"]`) so any frontend (React, Vue, plain HTML/JS) can call this API during development. For production, edit `app/main.py` and replace `"*"` with your actual frontend domain.

## 7. Common issues

- **"Can't connect to MySQL server"** → make sure MySQL is running and `DB_HOST`/`DB_PORT` in `.env` are correct.
- **"Access denied for user"** → double check `DB_USER`/`DB_PASSWORD` in `.env`.
- **"Unknown database 'ecommerce_db'"** → you skipped Step 1, run the `CREATE DATABASE` command.
- **403 Forbidden on product create/update/delete** → your logged-in user isn't an admin. Only the first registered user is auto-admin; promote others via `PATCH /users/{id}/toggle-admin` (as an existing admin).

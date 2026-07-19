/* =========================================================
   ATELIER — API client
   Talks to the FastAPI + MySQL backend (see routers:
   /auth, /products, /categories, /orders, /users)
   ========================================================= */

const API = (() => {
  const DEFAULT_BASE = "http://127.0.0.1:8000";
  let base = localStorage.getItem("atelier_api_base") || DEFAULT_BASE;

  function getBase() { return base; }
  function setBase(url) {
    base = url.replace(/\/+$/, "");
    localStorage.setItem("atelier_api_base", base);
  }

  function getToken() { return localStorage.getItem("atelier_token") || ""; }
  function setToken(t) { t ? localStorage.setItem("atelier_token", t) : localStorage.removeItem("atelier_token"); }

  async function request(path, { method = "GET", body, auth = false, form = false } = {}) {
    const headers = {};
    if (!form) headers["Content-Type"] = "application/json";
    if (auth) {
      const t = getToken();
      if (t) headers["Authorization"] = `Bearer ${t}`;
    }
    let res;
    try {
      res = await fetch(base + path, {
        method,
        headers,
        body: form ? body : body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      const err = new Error(
        `Could not reach the backend at ${base}. Is it running and is CORS enabled? (${e.message})`
      );
      err.network = true;
      throw err;
    }

    if (res.status === 204) return null;

    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }

    if (!res.ok) {
      const detail = (data && data.detail) ? data.detail : res.statusText;
      const err = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function ping() {
    try {
      await request("/health");
      return true;
    } catch (_) {
      return false;
    }
  }

  return {
    getBase, setBase, getToken, setToken, ping,

    // ---- auth ----
    register: (payload) => request("/auth/register", { method: "POST", body: payload }),
    login: (username, password) => {
      const form = new URLSearchParams();
      form.set("username", username);
      form.set("password", password);
      return request("/auth/login", { method: "POST", body: form, form: true });
    },
    me: () => request("/auth/me", { auth: true }),

    // ---- categories ----
    listCategories: () => request("/categories/"),
    createCategory: (payload) => request("/categories/", { method: "POST", body: payload, auth: true }),
    updateCategory: (id, payload) => request(`/categories/${id}`, { method: "PUT", body: payload, auth: true }),
    deleteCategory: (id) => request(`/categories/${id}`, { method: "DELETE", auth: true }),

    // ---- products ----
    listProducts: (params = {}) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") q.set(k, v);
      });
      const qs = q.toString();
      return request(`/products/${qs ? "?" + qs : ""}`);
    },
    getProduct: (id) => request(`/products/${id}`),
    createProduct: (payload) => request("/products/", { method: "POST", body: payload, auth: true }),
    updateProduct: (id, payload) => request(`/products/${id}`, { method: "PUT", body: payload, auth: true }),
    updateStock: (id, delta) => request(`/products/${id}/stock?quantity_change=${delta}`, { method: "PATCH", auth: true }),
    deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE", auth: true }),

    // ---- orders ----
    createOrder: (payload) => request("/orders/", { method: "POST", body: payload, auth: true }),
    myOrders: () => request("/orders/my-orders", { auth: true }),
    getOrder: (id) => request(`/orders/${id}`, { auth: true }),
    allOrders: () => request("/orders/", { auth: true }),
    updateOrderStatus: (id, status) => request(`/orders/${id}/status`, { method: "PATCH", body: { status }, auth: true }),
    cancelOrder: (id) => request(`/orders/${id}`, { method: "DELETE", auth: true }),

    // ---- users (admin) ----
    listUsers: () => request("/users/", { auth: true }),
    toggleAdmin: (id) => request(`/users/${id}/toggle-admin`, { method: "PATCH", auth: true }),
    toggleActive: (id) => request(`/users/${id}/toggle-active`, { method: "PATCH", auth: true }),
  };
})();

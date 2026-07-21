/* =========================================================
   ATELIER — API client
   Talks to the FastAPI + MySQL backend (see routers:
   /auth, /products, /categories, /orders, /users)
   ========================================================= */

const API = (() => {
  const DEFAULT_BASE = "http://127.0.0.1:8000";
  const FALLBACK_BASES = [
    "http://127.0.0.1:8000",
    "http://127.0.0.1:8001",
    "http://localhost:8000",
    "http://localhost:8001"
  ];
  const SAVED_BASE_KEY = "atelier_api_base";
  const CACHE_TTL_MS = 30 * 1000;
  const CACHE_PREFIX = "atelier_cache:";

  function normalizeBase(url) {
    return (url || "").replace(/\/+$/, "");
  }

  function getCache(key) {
    try {
      const raw = sessionStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.ts === undefined) return null;
      if (Date.now() - parsed.ts > CACHE_TTL_MS) {
        sessionStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      return parsed.value;
    } catch (_) {
      return null;
    }
  }

  function setCache(key, value) {
    try {
      sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), value }));
    } catch (_) {
      // ignore sessionStorage failures
    }
  }

  function clearCache(prefix = "") {
    try {
      const keyPrefix = CACHE_PREFIX + prefix;
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith(keyPrefix)) {
          sessionStorage.removeItem(key);
        }
      }
    } catch (_) {
      // ignore sessionStorage failures
    }
  }

  let base = normalizeBase(localStorage.getItem(SAVED_BASE_KEY)) || DEFAULT_BASE;

  function getBase() { return base; }
  function setBase(url) {
    base = normalizeBase(url) || DEFAULT_BASE;
    localStorage.setItem(SAVED_BASE_KEY, base);
  }

  function getCandidateBases() {
    return [...new Set([base, ...FALLBACK_BASES].filter(Boolean))];
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

    const candidates = getCandidateBases();
    let lastError = null;

    for (const candidate of candidates) {
      try {
        const res = await fetch(candidate + path, {
          method,
          headers,
          body: form ? body : body !== undefined ? JSON.stringify(body) : undefined,
        });

        if (res.status === 204) {
          base = candidate;
          localStorage.setItem("atelier_api_base", base);
          return null;
        }

        const text = await res.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }

        if (res.ok) {
          base = candidate;
          localStorage.setItem("atelier_api_base", base);
          return data;
        }

        if (res.status >= 400 && res.status < 500) {
          base = candidate;
          localStorage.setItem("atelier_api_base", base);
          const detail = (data && data.detail) ? data.detail : res.statusText;
          const err = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
          err.status = res.status;
          err.data = data;
          throw err;
        }

        lastError = new Error(`Backend responded with ${res.status} at ${candidate}`);
      } catch (e) {
        lastError = e;
      }
    }

    const err = new Error(
      `Could not reach the backend. Tried: ${candidates.join(", ")}. (${lastError?.message || "unknown error"})`
    );
    err.network = true;
    throw err;
  }

  async function ping() {
    try {
      await request("/health");
      return true;
    } catch (_) {
      return false;
    }
  }

  console.info("Atelier API base:", base);

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
    listCategories: async () => {
      const cache = getCache("categories");
      if (cache) return cache;
      const categories = await request("/categories/");
      setCache("categories", categories);
      return categories;
    },
    createCategory: async (payload) => {
      const result = await request("/categories/", { method: "POST", body: payload, auth: true });
      clearCache("categories");
      return result;
    },
    updateCategory: async (id, payload) => {
      const result = await request(`/categories/${id}`, { method: "PUT", body: payload, auth: true });
      clearCache("categories");
      return result;
    },
    deleteCategory: async (id) => {
      const result = await request(`/categories/${id}`, { method: "DELETE", auth: true });
      clearCache("categories");
      return result;
    },

    // ---- products ----
    listProducts: async (params = {}) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") q.set(k, v);
      });
      const qs = q.toString();
      const cacheKey = `products:${qs || "all"}`;
      const cache = getCache(cacheKey);
      if (cache) return cache;
      const products = await request(`/products/${qs ? "?" + qs : ""}`);
      setCache(cacheKey, products);
      return products;
    },
    createProduct: async (payload) => {
      const result = await request("/products/", { method: "POST", body: payload, auth: true });
      clearCache("products");
      return result;
    },
    updateProduct: async (id, payload) => {
      const result = await request(`/products/${id}`, { method: "PUT", body: payload, auth: true });
      clearCache("products");
      return result;
    },
    updateStock: async (id, delta) => {
      const result = await request(`/products/${id}/stock?quantity_change=${delta}`, { method: "PATCH", auth: true });
      clearCache("products");
      return result;
    },
    deleteProduct: async (id) => {
      const result = await request(`/products/${id}`, { method: "DELETE", auth: true });
      clearCache("products");
      return result;
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

/* =========================================================
   ATELIER — shared app shell
   Injects: toast stack, cart drawer, API-base config pill
   Provides: CART, TOAST, AUTHUI, helpers
   ========================================================= */

/* ---------- helpers ---------- */
function money(n) {
  return "$" + Number(n).toFixed(2);
}

function initials(name) {
  return (name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function placeholderSVG(name, bg = "3f5443") {
  const label = initials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
    <rect width="400" height="400" fill="#${bg}"/>
    <text x="200" y="215" font-family="Georgia, serif" font-size="120" fill="#f6f2ea" text-anchor="middle">${label}</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function productImg(p) {
  return p && p.image_url ? p.image_url : placeholderSVG(p ? p.name : "?");
}

function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

/* ---------- TOAST ---------- */
const TOAST = (() => {
  function ensureStack() {
    let stack = qs(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    return stack;
  }
  function show(msg, type = "info", ms = 3200) {
    const stack = ensureStack();
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .25s ease";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 250);
    }, ms);
  }
  return {
    info: (m) => show(m, "info"),
    success: (m) => show(m, "success"),
    error: (m) => show(m, "error"),
  };
})();

/* ---------- CART ---------- */
const CART = (() => {
  const KEY = "atelier_cart";

  function get() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (_) { return []; }
  }
  function save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    document.dispatchEvent(new CustomEvent("cart:change", { detail: items }));
  }
  function count() {
    return get().reduce((s, i) => s + i.qty, 0);
  }
  function total() {
    return get().reduce((s, i) => s + i.qty * i.price, 0);
  }
  function add(product, qty = 1) {
    const items = get();
    const existing = items.find((i) => i.product_id === product.id);
    const maxStock = product.stock ?? 999;
    if (existing) {
      existing.qty = Math.min(existing.qty + qty, maxStock);
    } else {
      items.push({
        product_id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        stock: maxStock,
        qty: Math.min(qty, maxStock),
      });
    }
    save(items);
  }
  function setQty(product_id, qty) {
    let items = get();
    const line = items.find((i) => i.product_id === product_id);
    if (!line) return;
    if (qty <= 0) {
      items = items.filter((i) => i.product_id !== product_id);
    } else {
      line.qty = Math.min(qty, line.stock ?? 999);
    }
    save(items);
  }
  function remove(product_id) {
    save(get().filter((i) => i.product_id !== product_id));
  }
  function clear() { save([]); }

  return { get, count, total, add, setQty, remove, clear };
})();

/* ---------- AUTH UI helpers ---------- */
const AUTHUI = {
  isLoggedIn: () => !!API.getToken(),
  logout() {
    API.setToken("");
    localStorage.removeItem("atelier_user");
    TOAST.info("Signed out");
    setTimeout(() => (window.location.href = "index.html"), 400);
  },
  cachedUser() {
    try { return JSON.parse(localStorage.getItem("atelier_user")); } catch (_) { return null; }
  },
  setCachedUser(u) { localStorage.setItem("atelier_user", JSON.stringify(u)); },
};

/* ---------- shared shell injection ---------- */
function injectShell() {
  if (!qs(".toast-stack")) {
    const stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  if (!qs("#cart-overlay")) {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.id = "cart-overlay";
    document.body.appendChild(overlay);

    const drawer = document.createElement("aside");
    drawer.className = "drawer";
    drawer.id = "cart-drawer";
    drawer.innerHTML = `
      <div class="drawer-head">
        <h2>Your bag</h2>
        <button class="icon-btn" id="cart-close" aria-label="Close cart">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div class="drawer-body" id="cart-body"></div>
      <div class="drawer-foot" id="cart-foot"></div>
    `;
    document.body.appendChild(drawer);

    overlay.addEventListener("click", closeCart);
    qs("#cart-close").addEventListener("click", closeCart);
  }

  if (!qs(".api-pill")) {
    const pill = document.createElement("div");
    pill.className = "api-pill";
    pill.innerHTML = `<button id="api-pill-btn"><span class="dot" id="api-dot"></span><span id="api-label">API</span></button>`;
    document.body.appendChild(pill);
    qs("#api-pill-btn").addEventListener("click", openApiModal);
    refreshApiPill();
  }

  if (!qs("#api-modal")) {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.id = "api-modal";
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>Backend connection</h3>
          <button class="icon-btn" id="api-modal-close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>
        <div class="modal-body">
          <p style="color:var(--muted);font-size:13px;margin-top:0;">Atelier talks to your FastAPI backend directly from this browser. Point it at your server's base URL.</p>
          <div class="field">
            <label>API base URL</label>
            <input type="text" id="api-base-input" placeholder="http://127.0.0.1:8000" />
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-outline btn-sm" id="api-modal-cancel">Cancel</button>
          <button class="btn btn-primary btn-sm" id="api-modal-save">Save & test</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    qs("#api-modal-close").addEventListener("click", closeApiModal);
    qs("#api-modal-cancel").addEventListener("click", closeApiModal);
    qs("#api-modal-save").addEventListener("click", async () => {
      const val = qs("#api-base-input").value.trim();
      if (val) API.setBase(val);
      await refreshApiPill();
      TOAST.success("Backend endpoint updated");
      closeApiModal();
    });
  }
}

function openApiModal() {
  qs("#api-base-input").value = API.getBase();
  qs("#api-modal").classList.add("open");
}
function closeApiModal() { qs("#api-modal").classList.remove("open"); }

async function refreshApiPill() {
  const label = qs("#api-label");
  const dot = qs("#api-dot");
  if (!label) return;
  label.textContent = API.getBase().replace(/^https?:\/\//, "");
  const ok = await API.ping();
  dot.classList.toggle("ok", ok);
}

function openCart() {
  renderCart();
  qs("#cart-overlay").classList.add("open");
  qs("#cart-drawer").classList.add("open");
}
function closeCart() {
  qs("#cart-overlay").classList.remove("open");
  qs("#cart-drawer").classList.remove("open");
}

function renderCart() {
  const items = CART.get();
  const body = qs("#cart-body");
  const foot = qs("#cart-foot");
  if (!body) return;

  if (!items.length) {
    body.innerHTML = `<div class="empty-state" style="border:none;padding:60px 10px;">
      <h3>Your bag is empty</h3>
      <p>Browse the shop and add a few things you love.</p>
    </div>`;
    foot.innerHTML = `<a href="shop.html" class="btn btn-primary btn-block">Continue shopping</a>`;
    return;
  }

  body.innerHTML = items.map((i) => `
    <div class="cart-line" data-id="${i.product_id}">
      <img src="${productImg({ image_url: i.image_url, name: i.name })}" alt="${escapeHTML(i.name)}" />
      <div>
        <div class="cl-name">${escapeHTML(i.name)}</div>
        <div class="cl-price">${money(i.price)} each</div>
        <div class="cl-qty">
          <button data-act="dec">–</button>
          <span>${i.qty}</span>
          <button data-act="inc">+</button>
        </div>
        <span class="cl-remove" data-act="remove">Remove</span>
      </div>
      <div class="cl-total">${money(i.price * i.qty)}</div>
    </div>
  `).join("");

  foot.innerHTML = `
    <div class="summary-row"><span>Subtotal</span><span class="amt">${money(CART.total())}</span></div>
    <div class="summary-row" style="color:var(--muted);font-size:12px;">Shipping & taxes calculated at checkout</div>
    <div class="summary-row total"><span>Total</span><span class="amt">${money(CART.total())}</span></div>
    <a href="checkout.html" class="btn btn-primary btn-block" style="margin-top:14px;">Checkout</a>
  `;

  qsa(".cart-line", body).forEach((row) => {
    const id = Number(row.dataset.id);
    const item = items.find((i) => i.product_id === id);
    row.querySelector('[data-act="inc"]').addEventListener("click", () => { CART.setQty(id, item.qty + 1); renderCart(); });
    row.querySelector('[data-act="dec"]').addEventListener("click", () => { CART.setQty(id, item.qty - 1); renderCart(); });
    row.querySelector('[data-act="remove"]').addEventListener("click", () => { CART.remove(id); renderCart(); });
  });
}

function updateCartBadge() {
  qsa(".cart-badge").forEach((b) => {
    const c = CART.count();
    b.textContent = c;
    b.style.display = c > 0 ? "flex" : "none";
  });
}

/* ---------- shared product card ---------- */
function productCardHTML(p) {
  const low = p.stock > 0 && p.stock <= 5;
  const out = p.stock <= 0;
  return `
  <a class="product-card" href="product.html?id=${p.id}">
    <div class="pc-media">
      <img src="${productImg(p)}" alt="${escapeHTML(p.name)}" loading="lazy" />
      ${out ? `<span class="pc-tag low">Sold out</span>` : low ? `<span class="pc-tag low">Only ${p.stock} left</span>` : ""}
      <div class="pc-quickadd">
        <button class="btn btn-primary btn-sm btn-block" data-quickadd="${p.id}" ${out ? "disabled" : ""}>${out ? "Sold out" : "Quick add"}</button>
      </div>
    </div>
    <div class="pc-body">
      <span class="pc-cat">${p.category ? escapeHTML(p.category.name) : "General"}</span>
      <span class="pc-name">${escapeHTML(p.name)}</span>
      <div class="pc-foot">
        <span class="pc-price">${money(p.price)}</span>
        <span class="pc-stock ${out ? "out" : ""}">${out ? "Out of stock" : p.stock + " in stock"}</span>
      </div>
    </div>
  </a>`;
}

function wireQuickAdd(root) {
  qsa("[data-quickadd]", root).forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = Number(btn.dataset.quickadd);
      try {
        const p = await API.getProduct(id);
        CART.add(p, 1);
        TOAST.success(`Added "${p.name}" to your bag`);
        openCart();
      } catch (err) {
        TOAST.error(err.message || "Could not add to bag");
      }
    });
  });
}

/* ---------- header wiring (shared across pages) ---------- */
function initHeader() {
  injectShell();
  updateCartBadge();
  document.addEventListener("cart:change", updateCartBadge);

  qsa("[data-open-cart]").forEach((btn) => btn.addEventListener("click", openCart));

  const searchBtn = qs("[data-open-search]");
  const flyout = qs("#search-flyout");
  if (searchBtn && flyout) {
    searchBtn.addEventListener("click", () => {
      flyout.classList.toggle("open");
      if (flyout.classList.contains("open")) qs("input", flyout).focus();
    });
    document.addEventListener("click", (e) => {
      if (!flyout.contains(e.target) && e.target !== searchBtn && !searchBtn.contains(e.target)) {
        flyout.classList.remove("open");
      }
    });
    const input = qs("input", flyout);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) {
        window.location.href = `shop.html?search=${encodeURIComponent(input.value.trim())}`;
      }
    });
  }

  const accountLink = qs("[data-account-link]");
  if (accountLink) {
    accountLink.href = AUTHUI.isLoggedIn() ? "account.html" : "login.html";
  }
  const adminLink = qs("[data-admin-link]");
  if (adminLink) {
    const u = AUTHUI.cachedUser();
    adminLink.style.display = u && u.is_admin ? "" : "none";
  }
}

document.addEventListener("DOMContentLoaded", initHeader);

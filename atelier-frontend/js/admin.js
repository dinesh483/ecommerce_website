(async function () {
  const root = qs("#admin-root");
  qs("#admin-logout").addEventListener("click", AUTHUI.logout);

  if (!AUTHUI.isLoggedIn()) {
    window.location.href = "login.html?next=admin.html";
    return;
  }

  let me;
  try {
    me = await API.me();
    AUTHUI.setCachedUser(me);
  } catch (e) {
    AUTHUI.logout();
    return;
  }

  if (!me.is_admin) {
    root.innerHTML = `<div class="empty-state">
      <h3>Studio access required</h3>
      <p>Your account (${escapeHTML(me.username)}) doesn't have admin privileges. The first person to register on a fresh backend becomes admin automatically.</p>
      <a href="index.html" class="btn btn-primary" style="margin-top:16px;">Back to store</a>
    </div>`;
    return;
  }

  let state = { categories: [], products: [], orders: [], users: [] };

  root.innerHTML = `
    <div class="admin-shell">
      <nav class="admin-nav">
        <button data-tab="dashboard" class="active">Dashboard</button>
        <button data-tab="products">Products</button>
        <button data-tab="categories">Categories</button>
        <button data-tab="orders">Orders</button>
        <button data-tab="users">Users</button>
      </nav>
      <div id="admin-content"></div>
    </div>
  `;

  qsa(".admin-nav button").forEach(btn => {
    btn.addEventListener("click", () => {
      qsa(".admin-nav button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderTab(btn.dataset.tab);
    });
  });

  ensureGenericModal();
  await refreshAll();
  renderTab("dashboard");

  async function refreshAll() {
    const [categories, products, orders, users] = await Promise.all([
      API.listCategories().catch(() => []),
      API.listProducts({ limit: 100, active_only: false }).catch(() => []),
      API.allOrders().catch(() => []),
      API.listUsers().catch(() => []),
    ]);
    state = { categories, products, orders, users };
  }

  function renderTab(tab) {
    const content = qs("#admin-content");
    if (tab === "dashboard") content.innerHTML = dashboardHTML(state);
    if (tab === "products") { content.innerHTML = productsHTML(state); wireProducts(); }
    if (tab === "categories") { content.innerHTML = categoriesHTML(state); wireCategories(); }
    if (tab === "orders") { content.innerHTML = ordersHTML(state); wireOrders(); }
    if (tab === "users") { content.innerHTML = usersHTML(state); wireUsers(); }
  }

  /* ---------------- DASHBOARD ---------------- */
  function dashboardHTML(s) {
    const revenue = s.orders.reduce((sum, o) => sum + (o.status !== "cancelled" ? o.total_amount : 0), 0);
    const recent = [...s.orders].slice(0, 6);
    return `
      <div class="stat-cards">
        <div class="stat-card"><span class="num">${s.products.length}</span><span class="lbl">Products</span></div>
        <div class="stat-card"><span class="num">${s.categories.length}</span><span class="lbl">Categories</span></div>
        <div class="stat-card"><span class="num">${s.orders.length}</span><span class="lbl">Orders</span></div>
        <div class="stat-card"><span class="num">${money(revenue)}</span><span class="lbl">Revenue</span></div>
      </div>
      <h3 style="font-family:var(--font-display);font-size:19px;margin-bottom:14px;">Recent orders</h3>
      ${recent.length ? `
      <table class="admin-table">
        <thead><tr><th>Order</th><th>User</th><th>Total</th><th>Status</th><th>Placed</th></tr></thead>
        <tbody>
          ${recent.map(o => `<tr>
            <td style="font-family:var(--font-mono);">#${String(o.id).padStart(5,"0")}</td>
            <td>User #${o.user_id}</td>
            <td style="font-family:var(--font-mono);">${money(o.total_amount)}</td>
            <td><span class="status-pill status-${o.status}">${o.status}</span></td>
            <td style="color:var(--muted);font-size:12.5px;">${new Date(o.created_at).toLocaleDateString()}</td>
          </tr>`).join("")}
        </tbody>
      </table>` : `<div class="empty-state"><h3>No orders yet</h3></div>`}
    `;
  }

  /* ---------------- PRODUCTS ---------------- */
  function productsHTML(s) {
    return `
      <div class="admin-toolbar">
        <h3 style="font-family:var(--font-display);font-size:19px;">Products (${s.products.length})</h3>
        <button class="btn btn-primary btn-sm" id="add-product">Add product</button>
      </div>
      ${s.products.length ? `
      <table class="admin-table">
        <thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Active</th><th></th></tr></thead>
        <tbody>
          ${s.products.map(p => `<tr>
            <td><img class="admin-thumb" src="${productImg(p)}" alt=""/></td>
            <td>${escapeHTML(p.name)}</td>
            <td style="color:var(--muted);">${p.category ? escapeHTML(p.category.name) : "—"}</td>
            <td style="font-family:var(--font-mono);">${money(p.price)}</td>
            <td>${p.stock}</td>
            <td>${p.is_active ? `<span class="status-pill status-delivered">active</span>` : `<span class="status-pill status-cancelled">hidden</span>`}</td>
            <td style="text-align:right;white-space:nowrap;">
              <button class="btn btn-ghost btn-sm" data-edit-product="${p.id}">Edit</button>
              <button class="btn btn-danger btn-sm" data-del-product="${p.id}">Delete</button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>` : `<div class="empty-state"><h3>No products yet</h3><p>Add your first product to populate the shop.</p></div>`}
    `;
  }

  function productFormHTML(p) {
    const catOptions = state.categories.map(c => `<option value="${c.id}" ${p && p.category_id === c.id ? "selected" : ""}>${escapeHTML(c.name)}</option>`).join("");
    return `
      <form id="product-form">
        <div class="field"><label>Name</label><input id="pf-name" required value="${p ? escapeHTML(p.name) : ""}" /></div>
        <div class="field"><label>Description</label><textarea id="pf-desc" rows="3">${p ? escapeHTML(p.description || "") : ""}</textarea></div>
        <div class="form-grid-2">
          <div class="field"><label>Price</label><input id="pf-price" type="number" step="0.01" min="0.01" required value="${p ? p.price : ""}" /></div>
          <div class="field"><label>Stock</label><input id="pf-stock" type="number" min="0" required value="${p ? p.stock : 0}" /></div>
        </div>
        <div class="field"><label>Image URL</label><input id="pf-image" value="${p ? escapeHTML(p.image_url || "") : ""}" placeholder="https://…" /></div>
        <div class="field"><label>Category</label><select id="pf-category"><option value="">No category</option>${catOptions}</select></div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-top:4px;">
          <input type="checkbox" id="pf-active" ${!p || p.is_active ? "checked" : ""}/> Visible in the shop
        </label>
      </form>
    `;
  }

  function wireProducts() {
    qs("#add-product").addEventListener("click", () => {
      openModal("Add product", productFormHTML(null), [
        { label: "Cancel", cls: "btn-outline", close: true },
        { label: "Create product", cls: "btn-primary", action: () => submitProduct(null) },
      ]);
    });
    qsa("[data-edit-product]").forEach(btn => {
      btn.addEventListener("click", () => {
        const p = state.products.find(x => x.id === Number(btn.dataset.editProduct));
        openModal("Edit product", productFormHTML(p), [
          { label: "Cancel", cls: "btn-outline", close: true },
          { label: "Save changes", cls: "btn-primary", action: () => submitProduct(p.id) },
        ]);
      });
    });
    qsa("[data-del-product]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this product? This cannot be undone.")) return;
        try {
          await API.deleteProduct(Number(btn.dataset.delProduct));
          TOAST.success("Product deleted");
          await refreshAll(); renderTab("products");
        } catch (e) { TOAST.error(e.message || "Could not delete product"); }
      });
    });
  }

  async function submitProduct(id) {
    const payload = {
      name: qs("#pf-name").value.trim(),
      description: qs("#pf-desc").value.trim() || null,
      price: Number(qs("#pf-price").value),
      stock: Number(qs("#pf-stock").value),
      image_url: qs("#pf-image").value.trim() || null,
      category_id: qs("#pf-category").value ? Number(qs("#pf-category").value) : null,
      is_active: qs("#pf-active").checked,
    };
    if (!payload.name || !(payload.price > 0)) { TOAST.error("Name and a price above 0 are required"); return; }
    try {
      if (id) await API.updateProduct(id, payload);
      else await API.createProduct(payload);
      TOAST.success(id ? "Product updated" : "Product created");
      closeGenericModal();
      await refreshAll(); renderTab("products");
    } catch (e) { TOAST.error(e.message || "Could not save product"); }
  }

  /* ---------------- CATEGORIES ---------------- */
  function categoriesHTML(s) {
    return `
      <div class="admin-toolbar">
        <h3 style="font-family:var(--font-display);font-size:19px;">Categories (${s.categories.length})</h3>
        <button class="btn btn-primary btn-sm" id="add-category">Add category</button>
      </div>
      ${s.categories.length ? `
      <table class="admin-table">
        <thead><tr><th>Name</th><th>Description</th><th>Products</th><th></th></tr></thead>
        <tbody>
          ${s.categories.map(c => `<tr>
            <td>${escapeHTML(c.name)}</td>
            <td style="color:var(--muted);">${escapeHTML(c.description || "—")}</td>
            <td>${state.products.filter(p => p.category_id === c.id).length}</td>
            <td style="text-align:right;white-space:nowrap;">
              <button class="btn btn-ghost btn-sm" data-edit-cat="${c.id}">Edit</button>
              <button class="btn btn-danger btn-sm" data-del-cat="${c.id}">Delete</button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>` : `<div class="empty-state"><h3>No categories yet</h3><p>Group your products so shoppers can browse by collection.</p></div>`}
    `;
  }

  function categoryFormHTML(c) {
    return `
      <form id="category-form">
        <div class="field"><label>Name</label><input id="cf-name" required value="${c ? escapeHTML(c.name) : ""}" /></div>
        <div class="field"><label>Description</label><textarea id="cf-desc" rows="3">${c ? escapeHTML(c.description || "") : ""}</textarea></div>
      </form>
    `;
  }

  function wireCategories() {
    qs("#add-category").addEventListener("click", () => {
      openModal("Add category", categoryFormHTML(null), [
        { label: "Cancel", cls: "btn-outline", close: true },
        { label: "Create category", cls: "btn-primary", action: () => submitCategory(null) },
      ]);
    });
    qsa("[data-edit-cat]").forEach(btn => {
      btn.addEventListener("click", () => {
        const c = state.categories.find(x => x.id === Number(btn.dataset.editCat));
        openModal("Edit category", categoryFormHTML(c), [
          { label: "Cancel", cls: "btn-outline", close: true },
          { label: "Save changes", cls: "btn-primary", action: () => submitCategory(c.id) },
        ]);
      });
    });
    qsa("[data-del-cat]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this category? Products in it will become uncategorized.")) return;
        try {
          await API.deleteCategory(Number(btn.dataset.delCat));
          TOAST.success("Category deleted");
          await refreshAll(); renderTab("categories");
        } catch (e) { TOAST.error(e.message || "Could not delete category"); }
      });
    });
  }

  async function submitCategory(id) {
    const payload = { name: qs("#cf-name").value.trim(), description: qs("#cf-desc").value.trim() || null };
    if (!payload.name) { TOAST.error("Name is required"); return; }
    try {
      if (id) await API.updateCategory(id, payload);
      else await API.createCategory(payload);
      TOAST.success(id ? "Category updated" : "Category created");
      closeGenericModal();
      await refreshAll(); renderTab("categories");
    } catch (e) { TOAST.error(e.message || "Could not save category"); }
  }

  /* ---------------- ORDERS ---------------- */
  function ordersHTML(s) {
    const statuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
    return `
      <h3 style="font-family:var(--font-display);font-size:19px;margin-bottom:14px;">All orders (${s.orders.length})</h3>
      ${s.orders.length ? `
      <table class="admin-table">
        <thead><tr><th>Order</th><th>User</th><th>Items</th><th>Total</th><th>Status</th><th>Placed</th></tr></thead>
        <tbody>
          ${s.orders.map(o => `<tr>
            <td style="font-family:var(--font-mono);">#${String(o.id).padStart(5,"0")}</td>
            <td>User #${o.user_id}</td>
            <td style="color:var(--muted);">${o.items.reduce((n,i)=>n+i.quantity,0)} item(s)</td>
            <td style="font-family:var(--font-mono);">${money(o.total_amount)}</td>
            <td>
              <select data-order-status="${o.id}" style="font-family:var(--font-mono);font-size:11.5px;border:1px solid var(--line);border-radius:4px;padding:5px 7px;background:var(--bone);">
                ${statuses.map(st => `<option value="${st}" ${o.status===st?"selected":""}>${st}</option>`).join("")}
              </select>
            </td>
            <td style="color:var(--muted);font-size:12.5px;">${new Date(o.created_at).toLocaleDateString()}</td>
          </tr>`).join("")}
        </tbody>
      </table>` : `<div class="empty-state"><h3>No orders yet</h3></div>`}
    `;
  }

  function wireOrders() {
    qsa("[data-order-status]").forEach(sel => {
      sel.addEventListener("change", async () => {
        try {
          await API.updateOrderStatus(Number(sel.dataset.orderStatus), sel.value);
          TOAST.success("Order status updated");
          await refreshAll();
        } catch (e) { TOAST.error(e.message || "Could not update status"); }
      });
    });
  }

  /* ---------------- USERS ---------------- */
  function usersHTML(s) {
    return `
      <h3 style="font-family:var(--font-display);font-size:19px;margin-bottom:14px;">Users (${s.users.length})</h3>
      <table class="admin-table">
        <thead><tr><th>Username</th><th>Email</th><th>Admin</th><th>Active</th><th></th></tr></thead>
        <tbody>
          ${s.users.map(u => `<tr>
            <td>${escapeHTML(u.username)}${u.id === me.id ? " <span style=\"color:var(--muted);font-size:11px;\">(you)</span>" : ""}</td>
            <td style="color:var(--muted);">${escapeHTML(u.email)}</td>
            <td>${u.is_admin ? `<span class="status-pill status-delivered">admin</span>` : `<span class="status-pill status-pending">member</span>`}</td>
            <td>${u.is_active ? `<span class="status-pill status-delivered">active</span>` : `<span class="status-pill status-cancelled">disabled</span>`}</td>
            <td style="text-align:right;white-space:nowrap;">
              <button class="btn btn-ghost btn-sm" data-toggle-admin="${u.id}" ${u.id===me.id?"disabled":""}>${u.is_admin ? "Revoke admin" : "Make admin"}</button>
              <button class="btn btn-danger btn-sm" data-toggle-active="${u.id}" ${u.id===me.id?"disabled":""}>${u.is_active ? "Disable" : "Enable"}</button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    `;
  }

  function wireUsers() {
    qsa("[data-toggle-admin]").forEach(btn => {
      btn.addEventListener("click", async () => {
        try { await API.toggleAdmin(Number(btn.dataset.toggleAdmin)); TOAST.success("Updated"); await refreshAll(); renderTab("users"); }
        catch (e) { TOAST.error(e.message || "Could not update user"); }
      });
    });
    qsa("[data-toggle-active]").forEach(btn => {
      btn.addEventListener("click", async () => {
        try { await API.toggleActive(Number(btn.dataset.toggleActive)); TOAST.success("Updated"); await refreshAll(); renderTab("users"); }
        catch (e) { TOAST.error(e.message || "Could not update user"); }
      });
    });
  }
})();

/* ---------------- generic modal ---------------- */
function ensureGenericModal() {
  if (qs("#generic-modal")) return;
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = "generic-modal";
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-head"><h3 id="gm-title"></h3>
        <button class="icon-btn" id="gm-close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="modal-body" id="gm-body"></div>
      <div class="modal-foot" id="gm-foot"></div>
    </div>`;
  document.body.appendChild(modal);
  qs("#gm-close").addEventListener("click", closeGenericModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeGenericModal(); });
}

function openModal(title, bodyHTML, buttons) {
  qs("#gm-title").textContent = title;
  qs("#gm-body").innerHTML = bodyHTML;
  qs("#gm-foot").innerHTML = "";
  buttons.forEach((b, i) => {
    const btn = document.createElement("button");
    btn.className = `btn btn-sm ${b.cls}`;
    btn.textContent = b.label;
    btn.addEventListener("click", () => { if (b.close) closeGenericModal(); if (b.action) b.action(); });
    qs("#gm-foot").appendChild(btn);
  });
  qs("#generic-modal").classList.add("open");
}
function closeGenericModal() { qs("#generic-modal").classList.remove("open"); }

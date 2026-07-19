(async function () {
  const root = qs("#account-root");

  if (!AUTHUI.isLoggedIn()) {
    window.location.href = "login.html?next=account.html";
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

  root.innerHTML = `
    <div class="account-hero">
      <div class="avatar-mono">${initials(me.full_name || me.username)}</div>
      <div>
        <h1 style="font-size:24px;">${escapeHTML(me.full_name || me.username)}</h1>
        <div style="color:var(--muted);font-size:13px;font-family:var(--font-mono);">${escapeHTML(me.email)} ${me.is_admin ? "· admin" : ""}</div>
      </div>
      <button class="btn btn-outline btn-sm" id="logout-btn" style="margin-left:auto;">Sign out</button>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="orders">Order history</button>
      <button class="tab-btn" data-tab="profile">Profile</button>
    </div>

    <div id="tab-orders">
      <div id="orders-list">
        <div class="order-card"><div class="order-card-head"><div class="skeleton" style="height:14px;width:120px;"></div></div></div>
      </div>
    </div>
    <div id="tab-profile" style="display:none;">
      <div class="card-panel" style="max-width:480px;">
        <div class="field"><label>Username</label><input value="${escapeHTML(me.username)}" disabled /></div>
        <div class="field"><label>Email</label><input value="${escapeHTML(me.email)}" disabled /></div>
        <div class="field"><label>Full name</label><input value="${escapeHTML(me.full_name || "—")}" disabled /></div>
        <div class="field"><label>Member since</label><input value="${new Date(me.created_at).toLocaleDateString()}" disabled /></div>
        <p style="font-size:12px;color:var(--muted);">Profile editing isn't wired to the backend yet — this is a read-only summary pulled from <span style="font-family:var(--font-mono);">/auth/me</span>.</p>
      </div>
    </div>
  `;

  qs("#logout-btn").addEventListener("click", AUTHUI.logout);

  qsa(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      qsa(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      qs("#tab-orders").style.display = btn.dataset.tab === "orders" ? "" : "none";
      qs("#tab-profile").style.display = btn.dataset.tab === "profile" ? "" : "none";
    });
  });

  loadOrders();

  async function loadOrders() {
    const list = qs("#orders-list");
    try {
      const orders = await API.myOrders();
      if (!orders.length) {
        list.innerHTML = `<div class="empty-state">
          <h3>No orders yet</h3>
          <p>Once you place an order it'll show up here with live status.</p>
          <a href="shop.html" class="btn btn-primary" style="margin-top:16px;">Start shopping</a>
        </div>`;
        return;
      }
      list.innerHTML = orders.map(orderCardHTML).join("");
      qsa("[data-cancel-order]", list).forEach(btn => {
        btn.addEventListener("click", async () => {
          if (!confirm("Cancel this order? Items will be restocked.")) return;
          try {
            await API.cancelOrder(Number(btn.dataset.cancelOrder));
            TOAST.success("Order cancelled");
            loadOrders();
          } catch (e) { TOAST.error(e.message || "Could not cancel order"); }
        });
      });
    } catch (e) {
      list.innerHTML = `<div class="empty-state"><h3>Could not load orders</h3><p>${escapeHTML(e.message || "")}</p></div>`;
    }
  }
})();

function orderCardHTML(o) {
  const cancellable = ["pending", "processing"].includes(o.status);
  return `
  <div class="order-card">
    <div class="order-card-head">
      <div>
        <div class="order-id">ORDER #${String(o.id).padStart(5, "0")}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">${new Date(o.created_at).toLocaleString()}</div>
      </div>
      <span class="status-pill status-${o.status}">${o.status}</span>
    </div>
    <div class="order-card-body">
      ${o.items.map(i => `
        <div class="order-item-row">
          <span>${i.quantity} × ${escapeHTML(i.product ? i.product.name : "Removed product")}</span>
          <span style="font-family:var(--font-mono);">${money(i.price_at_purchase * i.quantity)}</span>
        </div>`).join("")}
      ${o.shipping_address ? `<div style="font-size:12px;color:var(--muted);margin-top:10px;">Ship to: ${escapeHTML(o.shipping_address)}</div>` : ""}
    </div>
    <div class="order-card-foot">
      <span style="font-family:var(--font-mono);font-weight:600;">${money(o.total_amount)}</span>
      ${cancellable ? `<button class="btn btn-danger btn-sm" data-cancel-order="${o.id}">Cancel order</button>` : ""}
    </div>
  </div>`;
}

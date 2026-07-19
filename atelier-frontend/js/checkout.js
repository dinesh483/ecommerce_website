(function () {
  const items = CART.get();

  renderReview();

  if (!items.length) {
    qs("#checkout-form-wrap").innerHTML = `<div class="empty-state">
      <h3>Your bag is empty</h3>
      <p>Add something to your bag before checking out.</p>
      <a href="shop.html" class="btn btn-primary" style="margin-top:16px;">Browse the shop</a>
    </div>`;
    return;
  }

  if (!AUTHUI.isLoggedIn()) {
    qs("#checkout-form-wrap").innerHTML = `<div class="card-panel">
      <p style="margin-top:0;color:var(--ink-soft);">Sign in to place your order — your bag will be waiting for you.</p>
      <a href="login.html?next=checkout.html" class="btn btn-primary btn-block">Sign in to continue</a>
      <div class="auth-switch">New here? <a href="register.html">Create an account</a></div>
    </div>`;
    return;
  }

  qs("#checkout-form-wrap").innerHTML = `
    <div class="card-panel">
      <form id="checkout-form">
        <div class="field">
          <label for="address">Shipping address</label>
          <textarea id="address" rows="3" required placeholder="Street, city, state, ZIP"></textarea>
        </div>
        <button class="btn btn-primary btn-block" type="submit" id="place-order-btn">Place order — ${money(CART.total())}</button>
      </form>
    </div>
  `;

  qs("#checkout-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = qs("#place-order-btn");
    btn.disabled = true; btn.textContent = "Placing order…";
    try {
      const payload = {
        shipping_address: qs("#address").value.trim(),
        items: CART.get().map(i => ({ product_id: i.product_id, quantity: i.qty })),
      };
      const order = await API.createOrder(payload);
      CART.clear();
      qs("#checkout-form-wrap").innerHTML = `
        <div class="card-panel" style="text-align:center;">
          <span class="eyebrow">Order confirmed</span>
          <h2 style="margin:12px 0 8px;">Thank you — order #${String(order.id).padStart(5, "0")}</h2>
          <p style="color:var(--muted);">We've received your order and it's now <strong>${order.status}</strong>. Track it any time from your account.</p>
          <div style="display:flex;gap:12px;justify-content:center;margin-top:20px;">
            <a href="account.html" class="btn btn-primary">View my orders</a>
            <a href="shop.html" class="btn btn-outline">Keep shopping</a>
          </div>
        </div>`;
      qs("#review-lines").innerHTML = "";
      qs("#review-totals").innerHTML = "";
      TOAST.success("Order placed!");
    } catch (err) {
      showMsg(err.message || "Could not place your order.");
      btn.disabled = false; btn.textContent = `Place order — ${money(CART.total())}`;
    }
  });

  function showMsg(text) {
    qs("#checkout-msg").innerHTML = `<div class="form-msg error">${escapeHTML(text)}</div>`;
  }

  function renderReview() {
    const lines = qs("#review-lines");
    const totals = qs("#review-totals");
    if (!items.length) { lines.innerHTML = ""; totals.innerHTML = ""; return; }
    lines.innerHTML = items.map(i => `
      <div class="cart-line">
        <img src="${productImg({ image_url: i.image_url, name: i.name })}" alt="${escapeHTML(i.name)}" />
        <div>
          <div class="cl-name">${escapeHTML(i.name)}</div>
          <div class="cl-price">Qty ${i.qty} × ${money(i.price)}</div>
        </div>
        <div class="cl-total">${money(i.price * i.qty)}</div>
      </div>
    `).join("");
    totals.innerHTML = `
      <div class="summary-row"><span>Subtotal</span><span class="amt">${money(CART.total())}</span></div>
      <div class="summary-row"><span>Shipping</span><span class="amt">Free</span></div>
      <div class="summary-row total"><span>Total</span><span class="amt">${money(CART.total())}</span></div>
    `;
  }
})();

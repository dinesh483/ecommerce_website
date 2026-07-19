(async function () {
  const id = Number(new URLSearchParams(window.location.search).get("id"));
  const root = qs("#pd-root");

  if (!id) {
    root.innerHTML = `<div class="empty-state"><h3>No product selected</h3><p>Head back to the <a href="shop.html">shop</a> to pick something.</p></div>`;
    return;
  }

  try {
    const p = await API.getProduct(id);
    document.title = `${p.name} — Atelier`;
    const out = p.stock <= 0;
    const low = p.stock > 0 && p.stock <= 5;

    root.innerHTML = `
      <div class="pd-layout">
        <div class="pd-media">
          <img src="${productImg(p)}" alt="${escapeHTML(p.name)}" />
        </div>
        <div class="pd-info">
          <span class="eyebrow">${p.category ? escapeHTML(p.category.name) : "General goods"}</span>
          <h1>${escapeHTML(p.name)}</h1>
          <div class="pd-price-row">
            <span class="pd-price">${money(p.price)}</span>
            ${out ? `<span class="status-pill status-cancelled">Out of stock</span>` : low ? `<span class="status-pill status-pending">Only ${p.stock} left</span>` : `<span class="status-pill status-delivered">In stock</span>`}
          </div>
          <p class="pd-desc">${escapeHTML(p.description || "No description provided for this item yet — but it's part of the current catalog and ready to ship.")}</p>

          <div class="eyebrow" style="margin-bottom:10px;">Quantity</div>
          <div class="qty-stepper">
            <button type="button" id="qty-dec">−</button>
            <input type="text" id="qty-input" value="1" inputmode="numeric" />
            <button type="button" id="qty-inc">+</button>
          </div>

          <div class="pd-actions">
            <button class="btn btn-primary" id="add-to-cart" ${out ? "disabled" : ""}>${out ? "Sold out" : "Add to bag"}</button>
            <button class="btn btn-outline" id="buy-now" ${out ? "disabled" : ""}>Buy now</button>
          </div>

          <div class="pd-meta-grid">
            <div class="pd-meta-item"><span class="eyebrow">SKU</span>#ATL-${String(p.id).padStart(4, "0")}</div>
            <div class="pd-meta-item"><span class="eyebrow">Shipping</span>Ships in 2–4 business days</div>
            <div class="pd-meta-item"><span class="eyebrow">Returns</span>30-day easy returns</div>
            <div class="pd-meta-item"><span class="eyebrow">Availability</span>${p.stock} unit${p.stock === 1 ? "" : "s"} in warehouse</div>
          </div>
        </div>
      </div>
    `;

    const qtyInput = qs("#qty-input");
    qs("#qty-dec").addEventListener("click", () => { qtyInput.value = Math.max(1, Number(qtyInput.value || 1) - 1); });
    qs("#qty-inc").addEventListener("click", () => { qtyInput.value = Math.min(p.stock || 99, Number(qtyInput.value || 1) + 1); });
    qtyInput.addEventListener("change", () => {
      let v = Math.max(1, Math.min(p.stock || 99, Number(qtyInput.value) || 1));
      qtyInput.value = v;
    });

    qs("#add-to-cart")?.addEventListener("click", () => {
      CART.add(p, Number(qtyInput.value) || 1);
      TOAST.success(`Added "${p.name}" to your bag`);
      openCart();
    });
    qs("#buy-now")?.addEventListener("click", () => {
      CART.add(p, Number(qtyInput.value) || 1);
      window.location.href = "checkout.html";
    });

    // related products
    loadRelated(p);
  } catch (e) {
    root.innerHTML = `<div class="empty-state"><h3>Product not found</h3><p>${escapeHTML(e.message || "It may have been removed from the catalog.")}</p></div>`;
  }
})();

async function loadRelated(p) {
  try {
    const list = await API.listProducts({ category_id: p.category_id || undefined, limit: 4 });
    const filtered = list.filter(x => x.id !== p.id).slice(0, 4);
    const grid = qs("#related-products");
    if (!filtered.length) {
      qs("#related-products").closest("section").style.display = "none";
      return;
    }
    grid.innerHTML = filtered.map(productCardHTML).join("");
    wireQuickAdd(grid);
  } catch (_) {
    qs("#related-products").closest("section").style.display = "none";
  }
}

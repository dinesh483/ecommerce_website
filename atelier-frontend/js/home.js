(async function () {
  try {
    const [categories, products] = await Promise.all([
      API.listCategories().catch(() => []),
      API.listProducts({ limit: 6 }).catch(() => []),
    ]);

    qs("#stat-products").textContent = products.length ? `${products.length}+` : "0";
    qs("#stat-categories").textContent = categories.length;

    // categories strip
    const catWrap = qs("#home-categories");
    if (categories.length) {
      catWrap.innerHTML = categories.map(c =>
        `<a href="shop.html?category=${c.id}" class="cat-chip">${escapeHTML(c.name)}</a>`
      ).join("");
    } else {
      catWrap.innerHTML = `<span style="color:var(--muted);font-size:13px;">No collections yet — add some from the Studio.</span>`;
    }

    // hero featured product = first in-stock product
    const featured = products.find(p => p.stock > 0) || products[0];
    if (featured) {
      qs("#hero-image").src = productImg(featured);
      qs("#hero-image").alt = featured.name;
      qs("#hero-tag").style.display = "block";
      qs("#hero-spotlight-price").textContent = money(featured.price);
      qs("#hero-spotlight-name").textContent = featured.name;
      const tagPrice = qs("#hero-tag .price");
      const tagSub = qs("#hero-tag .price-sub");
      if (tagPrice) tagPrice.textContent = money(featured.price);
      if (tagSub) tagSub.textContent = featured.name;
      qs("#hero-image").closest(".hero-art").querySelector("img").addEventListener("click", () => {
        window.location.href = `product.html?id=${featured.id}`;
      });
    } else {
      qs("#hero-image").src = placeholderSVG("Atelier");
    }

    // product grid
    const grid = qs("#home-products");
    if (!products.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
        <h3>No products yet</h3>
        <p>Once your backend has products, they'll show up here automatically.</p>
      </div>`;
    } else {
      grid.innerHTML = products.map(productCardHTML).join("");
      wireQuickAdd(grid);
    }
  } catch (e) {
    TOAST.error(e.message || "Could not load the shop.");
  }
})();



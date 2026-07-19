(async function () {
  const params = new URLSearchParams(window.location.search);
  let categories = [];
  let currentCategory = params.get("category") || "";
  let currentSearch = params.get("search") || "";

  qs("#f-search").value = currentSearch;

  try {
    categories = await API.listCategories();
  } catch (e) { /* non-fatal */ }

  const catList = qs("#f-categories");
  catList.innerHTML = `<label><input type="radio" name="cat" value="" ${!currentCategory ? "checked" : ""}/> All collections</label>` +
    categories.map(c => `<label><input type="radio" name="cat" value="${c.id}" ${String(c.id) === currentCategory ? "checked" : ""}/> ${escapeHTML(c.name)}</label>`).join("");

  qsa('input[name="cat"]', catList).forEach(r => r.addEventListener("change", () => { currentCategory = r.value; load(); }));

  let searchTimer;
  qs("#f-search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { currentSearch = e.target.value.trim(); load(); }, 350);
  });
  qs("#f-min").addEventListener("change", load);
  qs("#f-max").addEventListener("change", load);
  qs("#f-sort").addEventListener("change", load);
  qs("#f-clear").addEventListener("click", () => {
    currentCategory = ""; currentSearch = "";
    qs("#f-search").value = ""; qs("#f-min").value = ""; qs("#f-max").value = ""; qs("#f-sort").value = "default";
    qsa('input[name="cat"]', catList).forEach(r => r.checked = r.value === "");
    load();
  });

  async function load() {
    const grid = qs("#shop-grid");
    grid.innerHTML = Array.from({ length: 6 }).map(() =>
      `<div class="product-card"><div class="pc-media skeleton"></div><div class="pc-body"><div class="skeleton" style="height:14px;width:60%;"></div></div></div>`
    ).join("");

    const title = qs("#shop-title");
    const activeCat = categories.find(c => String(c.id) === currentCategory);
    title.textContent = activeCat ? activeCat.name : currentSearch ? `Results for "${currentSearch}"` : "Shop everything";

    try {
      let products = await API.listProducts({
        search: currentSearch || undefined,
        category_id: currentCategory || undefined,
        min_price: qs("#f-min").value || undefined,
        max_price: qs("#f-max").value || undefined,
        limit: 100,
      });

      const sort = qs("#f-sort").value;
      if (sort === "price-asc") products = [...products].sort((a, b) => a.price - b.price);
      if (sort === "price-desc") products = [...products].sort((a, b) => b.price - a.price);
      if (sort === "name-asc") products = [...products].sort((a, b) => a.name.localeCompare(b.name));

      qs("#result-count").textContent = `${products.length} item${products.length === 1 ? "" : "s"}`;

      if (!products.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
          <h3>Nothing matches yet</h3>
          <p>Try clearing a filter or searching a different term.</p>
        </div>`;
        return;
      }
      grid.innerHTML = products.map(productCardHTML).join("");
      wireQuickAdd(grid);
    } catch (e) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
        <h3>Couldn't load products</h3>
        <p>${escapeHTML(e.message || "Check that the backend is running and reachable.")}</p>
      </div>`;
    }
  }

  load();
})();

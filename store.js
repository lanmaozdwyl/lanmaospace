import {validateCatalog, productDetails, availabilityLabels} from './lib/catalog.mjs';
// Lanmao Space 商店页：从 products.json 加载商品数据，支持分类筛选和搜索。
// 商品数据与代码分离，修改价格只需编辑 JSON 文件，无需改动 JS。

let catalog = [];
let category = "全部";
let opener = null;

const grid = document.getElementById("products");
const search = document.getElementById("search");
const filters = document.querySelector(".shop-filters");
const detail = document.getElementById("detail");

async function loadProducts() {
    try {
        const response = await fetch("products.json", {signal: AbortSignal.timeout(15000)});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        catalog = validateCatalog(await response.json());
        document.getElementById("catalog-error").hidden = true;
        return true;
    } catch (error) {
        console.error("商品数据加载失败：", error);
        catalog = [];
        document.getElementById("catalog-error").hidden = false;
        return false;
    }
}

function buildCategoryFilters() {
    filters.replaceChildren();
    const categories = ["全部", ...new Set(catalog.map(p => p.category))];
    for (const name of categories) {
        const button = document.createElement("button");
        button.textContent = name;
        button.setAttribute("aria-pressed", String(name === category));
        button.onclick = () => {
            category = name;
            for (const el of filters.children) {
                el.setAttribute("aria-pressed", String(el === button));
            }
            render();
        };
        filters.append(button);
    }
}

function getFilteredProducts() {
    const query = search.value.trim().toLowerCase();
    return catalog.filter(p => {
        const matchesCategory = category === "全部" || p.category === category;
        const matchesSearch = !query || (p.name + " " + p.category).toLowerCase().includes(query);
        return matchesCategory && matchesSearch;
    });
}

function getProductMark(product) {
    if (product.category === "学习") return "D";
    return product.category.slice(0, 1);
}

function createProductCard(product) {
    const card = document.createElement("article");
    card.className = "product";

    if (product.image) {
        const imageWrapper = document.createElement("div");
        imageWrapper.className = "product-image";
        const img = document.createElement("img");
        img.src = product.image;
        img.alt = product.name;
        img.loading = "lazy";
        img.decoding = "async";
        imageWrapper.append(img);
        card.append(imageWrapper);
    } else {
        const mark = document.createElement("div");
        mark.className = "mark";
        mark.textContent = getProductMark(product);
        card.append(mark);
    }

    const title = document.createElement("h3");
    title.textContent = product.name;

    const info = document.createElement("p");
    info.textContent = `${product.period} · ¥${product.price}`;

    const button = document.createElement("button");
    button.textContent = "了解与咨询 ↗";
    button.setAttribute("aria-label", `了解与咨询 ${product.name}`);
    button.onclick = () => openDetail(product, button);

    const state = document.createElement("span");
    state.className = "product-availability";
    state.textContent = availabilityLabels[product.availability] || "供货请咨询";
    card.append(title, info, state, button);
    return card;
}

function openDetail(product, button) {
    opener = button;
    document.getElementById("detail-title").textContent = product.name;
    document.getElementById("detail-category").textContent = product.category;
    document.getElementById("detail-period").textContent = `${product.period} · ¥${product.price}`;
    document.getElementById("detail-note").textContent = product.note;
    const metadata = document.getElementById("detail-metadata");
    metadata.replaceChildren();
    for (const [label, value] of productDetails(product)) {
        const term = document.createElement("dt"), description = document.createElement("dd");
        term.textContent = label; description.textContent = value; metadata.append(term, description);
    }
    document.getElementById("inquiry").href = "https://wpa.qq.com/msgrd?v=3&uin=3126477562&site=qq&menu=yes";
    detail.showModal();
}

function render() {
    const visible = getFilteredProducts();
    grid.replaceChildren(...visible.map(createProductCard));
    document.getElementById("result-count").textContent = `${visible.length} 款可咨询商品`;
    document.getElementById("empty").hidden = visible.length > 0;
}

async function refreshCatalog() {
    const retry = document.getElementById("catalog-retry");
    retry.disabled = true;
    document.getElementById("result-count").textContent = "正在读取商品…";
    const ok = await loadProducts();
    category = "全部"; buildCategoryFilters(); render();
    if (!ok) { document.getElementById("empty").hidden = true; document.getElementById("result-count").textContent = "商品加载失败，请重试。"; }
    retry.disabled = false;
}
async function init() {
    document.getElementById("catalog-retry").onclick = refreshCatalog;
    await refreshCatalog();
    search.addEventListener("input", render);
    document.getElementById("close").onclick = () => detail.close();
    detail.addEventListener("close", () => opener?.focus());
}

init();

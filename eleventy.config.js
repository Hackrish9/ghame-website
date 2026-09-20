// Ghame Spice website — Eleventy configuration
// Everything the site shows comes from src/_data/*.json and the
// src/products, src/recipes and src/pages folders, all of which are
// edited through the management portal at /admin/.

import markdownIt from "markdown-it";

const md = markdownIt({ html: false, linkify: true, typographer: true });

const byOrder = (a, b) =>
  (Number(a.data.order ?? 100) - Number(b.data.order ?? 100)) ||
  String(a.data.title || "").localeCompare(String(b.data.title || ""));

const isPublished = (item) => item.data.published !== false;

const today = () => new Date().toISOString().slice(0, 10);

export default function (eleventyConfig) {
  // ---------- Static files ----------
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/admin/config.yml": "admin/config.yml" });
  eleventyConfig.addPassthroughCopy({ "src/_headers": "_headers" });
  eleventyConfig.addPassthroughCopy({ "src/_redirects": "_redirects" });
  eleventyConfig.addPassthroughCopy({ "src/site.webmanifest": "site.webmanifest" });

  // Product, recipe and page bodies are plain Markdown: never run CMS text
  // through the template engine, so a stray "{{" typed by an editor is safe.
  eleventyConfig.setLibrary("md", md);

  // ---------- Collections ----------
  eleventyConfig.addCollection("shopProducts", (api) =>
    api.getFilteredByGlob("src/products/*.md").filter(isPublished).sort(byOrder));

  eleventyConfig.addCollection("allProducts", (api) =>
    api.getFilteredByGlob("src/products/*.md").sort(byOrder));

  eleventyConfig.addCollection("recipes", (api) =>
    api.getFilteredByGlob("src/recipes/*.md").filter(isPublished).sort(byOrder));

  eleventyConfig.addCollection("infoPages", (api) =>
    api.getFilteredByGlob("src/pages/*.md").filter(isPublished).sort(byOrder));

  // ---------- Text & formatting ----------
  eleventyConfig.addFilter("md", (str) => (str ? md.render(String(str)) : ""));
  eleventyConfig.addFilter("mdInline", (str) => (str ? md.renderInline(String(str)) : ""));

  eleventyConfig.addFilter("lkr", (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "";
    return "LKR " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });

  eleventyConfig.addFilter("digits", (str) => String(str || "").replace(/\D/g, ""));

  eleventyConfig.addFilter("waLink", (number, text) => {
    const n = String(number || "").replace(/\D/g, "");
    const t = text ? `?text=${encodeURIComponent(text)}` : "";
    return `https://wa.me/${n}${t}`;
  });

  eleventyConfig.addFilter("telLink", (str) => {
    const raw = String(str || "").trim();
    const plus = raw.startsWith("+") ? "+" : "";
    return `tel:${plus}${raw.replace(/\D/g, "")}`;
  });

  eleventyConfig.addFilter("absUrl", (path, base) => {
    try { return new URL(path || "/", base || "https://example.com").href; } catch { return path; }
  });

  // Safe JSON for inline <script> blocks
  eleventyConfig.addFilter("jsonScript", (value) =>
    JSON.stringify(value ?? null).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026"));

  eleventyConfig.addFilter("isoDate", (d) => {
    if (!d) return "";
    const date = d instanceof Date ? d : new Date(d);
    return Number.isNaN(date.getTime()) ? String(d) : date.toISOString().slice(0, 10);
  });

  eleventyConfig.addFilter("longDate", (d) => {
    if (!d) return "";
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  });

  eleventyConfig.addFilter("isSvg", (src) => /\.svg($|\?)/i.test(String(src || "")));

  // ---------- Commerce helpers ----------
  const threshold = (site) => Number(site?.store?.low_stock_threshold ?? 5);

  eleventyConfig.addFilter("stockStatus", (variant, site) => {
    const stock = Number(variant?.stock ?? 0);
    if (stock <= 0) return "out";
    if (stock <= threshold(site)) return "low";
    return "in";
  });

  eleventyConfig.addFilter("totalStock", (variants) =>
    (variants || []).reduce((sum, v) => sum + Math.max(0, Number(v.stock || 0)), 0));

  eleventyConfig.addFilter("fromPrice", (variants) => {
    const prices = (variants || []).map((v) => Number(v.price)).filter((p) => p > 0);
    return prices.length ? Math.min(...prices) : 0;
  });

  eleventyConfig.addFilter("stockValue", (variants) =>
    (variants || []).reduce((sum, v) => sum + Math.max(0, Number(v.stock || 0)) * Math.max(0, Number(v.price || 0)), 0));

  eleventyConfig.addFilter("findProduct", (products, slug) =>
    (products || []).find((p) => p.fileSlug === slug));

  eleventyConfig.addFilter("findProducts", (products, slugs) =>
    (slugs || []).map((s) => (products || []).find((p) => p.fileSlug === s)).filter(Boolean));

  eleventyConfig.addFilter("inCategory", (products, id) =>
    (products || []).filter((p) => p.data.category === id));

  eleventyConfig.addFilter("featured", (products, limit) =>
    (products || []).filter((p) => p.data.featured).slice(0, Number(limit || 4)));

  eleventyConfig.addFilter("horeca", (products) => (products || []).filter((p) => p.data.horeca));

  eleventyConfig.addFilter("categoryName", (id, categories) =>
    ((categories?.items || []).find((c) => c.id === id) || {}).name || "");

  eleventyConfig.addFilter("except", (products, slug) => (products || []).filter((p) => p.fileSlug !== slug));

  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, Number(n)));

  // Pack sizes offered across a set of products, for the HORECA table
  // Pack sizes offered to HORECA across a set of products, for the Professional table
  eleventyConfig.addFilter("packColumns", (products) => {
    const seen = [];
    (products || []).forEach((p) => (p.data.variants || []).forEach((v) => {
      if (v.channel === "Retail and B2B") return;
      if (v.pack && !seen.includes(v.pack)) seen.push(v.pack);
    }));
    return seen;
  });

  eleventyConfig.addFilter("variantFor", (variants, pack) => (variants || []).find((v) => v.pack === pack));

  // Data the shopping cart reads at /products.json
  eleventyConfig.addFilter("productsFeed", (products) => JSON.stringify((products || []).map((p) => ({
    id: p.fileSlug,
    title: p.data.title,
    title_si: p.data.title_si || "",
    url: p.url,
    image: p.data.images?.[0]?.src || "",
    variants: (p.data.variants || []).map((v) => ({
      sku: v.sku,
      pack: v.pack,
      price: Number(v.price || 0),
      stock: Math.max(0, Number(v.stock || 0)),
      channel: v.channel || "",
    })),
  }))));


  // Default pack on a product page: priced and in stock, then in stock, then the first
  eleventyConfig.addFilter("firstAvailable", (variants) => {
    const list = variants || [];
    return list.find((v) => Number(v.stock || 0) > 0 && Number(v.price || 0) > 0)
      || list.find((v) => Number(v.stock || 0) > 0) || list[0] || {};
  });

  // Lowest-priced pack, for cards: "LKR 920.00 / 1 kg"
  eleventyConfig.addFilter("priceFrom", (variants) =>
    (variants || []).filter((v) => Number(v.price) > 0).sort((a, b) => a.price - b.price)[0] || null);

  eleventyConfig.addFilter("forHoreca", (variants) =>
    (variants || []).filter((v) => !v.channel || v.channel !== "Retail and B2B"));

  eleventyConfig.addFilter("recipesUsing", (recipes, slug) =>
    (recipes || []).filter((r) => (r.data.spices || []).includes(slug)));

  // schema.org Product data for search engines (price and stock per pack size)
  eleventyConfig.addFilter("productSchema", (page, title, summary, images, variants, site, meta) => {
    const base = meta?.siteUrl || "https://example.com";
    const abs = (p) => { try { return new URL(p, base).href; } catch { return p; } };
    const offers = (variants || []).filter((v) => Number(v.price) > 0).map((v) => ({
      "@type": "Offer",
      sku: v.sku,
      name: `${title} ${v.pack}`,
      price: Number(v.price).toFixed(2),
      priceCurrency: "LKR",
      availability: Number(v.stock) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: abs(page.url),
    }));
    const data = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: title,
      description: summary || "",
      image: (images || []).map((i) => abs(i.src)),
      brand: { "@type": "Brand", name: site?.brand || "Ghame" },
      sku: variants?.[0]?.sku,
    };
    if (offers.length) data.offers = offers;
    return JSON.stringify(data).replace(/</g, "\\u003c");
  });

  // ---------- Trust & verification helpers ----------
  // Certifications only publish when verified and not expired
  eleventyConfig.addFilter("liveCerts", (certs) =>
    (certs || []).filter((c) => c.verified && (!c.expiry || String(c.expiry).slice(0, 10) >= today())));

  eleventyConfig.addFilter("confirmedAddresses", (addresses) =>
    (addresses || []).filter((a) => a.confirmed && a.address));

  eleventyConfig.addFilter("statusCount", (items, status) =>
    (items || []).filter((i) => i.status === status).length);

  eleventyConfig.addFilter("overdue", (items) =>
    (items || []).filter((i) => i.status !== "Verified current" && i.due && String(i.due).slice(0, 10) < today()).length);

  eleventyConfig.addShortcode("year", () => String(new Date().getFullYear()));

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: false,
  };
}

// Content check: runs before every build (npm run build).
// If it finds an error, the build stops and Cloudflare keeps the previous
// version of the website live. The build log explains what to fix.

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = path.join(root, "src");
const errors = [];
const warnings = [];

const readJson = (rel) => {
  try { return JSON.parse(fs.readFileSync(path.join(src, rel), "utf8")); }
  catch (e) { errors.push(`${rel}: not valid JSON (${e.message})`); return {}; }
};
const readFolder = (rel) => fs.readdirSync(path.join(src, rel))
  .filter((f) => f.endsWith(".md"))
  .map((f) => {
    try { return { file: `${rel}/${f}`, slug: f.replace(/\.md$/, ""), ...matter.read(path.join(src, rel, f)) }; }
    catch (e) { errors.push(`${rel}/${f}: front matter is not valid (${e.message})`); return null; }
  })
  .filter(Boolean);

const fileExists = (url) => {
  if (!url || /^https?:\/\//.test(url)) return true;
  return fs.existsSync(path.join(src, decodeURI(url.split("?")[0])));
};
const checkImage = (where, url) => { if (url && !fileExists(url)) errors.push(`${where}: image or file not found: ${url}`); };

// ---------- Settings ----------
const site = readJson("_data/site.json");
const categories = readJson("_data/categories.json");
readJson("_data/home.json");
readJson("_data/professional.json");
readJson("_data/about.json");
const register = readJson("_data/verification.json");

const wa = String(site.contact?.whatsapp || "");
if (!/^94\d{9}$/.test(wa)) errors.push(`Settings > Contact: WhatsApp number "${wa}" must be 94 followed by 9 digits, for example 94702030100.`);
["logo", "logo_white", "og_image"].forEach((k) => checkImage(`Settings > ${k}`, site[k]));
(site.certifications || []).forEach((c) => {
  if (c.verified && !c.expiry) warnings.push(`Certification ${c.name} is verified but has no expiry date.`);
  if (c.verified && c.expiry && String(c.expiry).slice(0, 10) < new Date().toISOString().slice(0, 10)) warnings.push(`Certification ${c.name} expired on ${c.expiry}; it is hidden from the website.`);
  checkImage(`Certification ${c.name}`, c.logo);
  checkImage(`Certification ${c.name}`, c.preview);
  checkImage(`Certification ${c.name}`, c.certificate);
});

const catIds = new Set((categories.items || []).map((c) => c.id));
const dupCats = (categories.items || []).map((c) => c.id).filter((id, i, a) => a.indexOf(id) !== i);
if (dupCats.length) errors.push(`Settings > Shop categories: duplicate ID ${dupCats.join(", ")}`);

// ---------- Products ----------
const products = readFolder("products");
const skus = new Map();
let published = 0;
let priceOnRequest = 0;
products.forEach((p) => {
  const d = p.data;
  const where = `Product "${d.title || p.slug}" (${p.file})`;
  if (!d.title) errors.push(`${where}: missing product name.`);
  if (d.published !== false) published++;
  if (!catIds.has(d.category)) errors.push(`${where}: category "${d.category}" does not exist in Settings > Shop categories.`);
  if (!Array.isArray(d.variants) || !d.variants.length) errors.push(`${where}: needs at least one pack size.`);
  (d.variants || []).forEach((v, i) => {
    const vw = `${where}, pack ${v.pack || i + 1}`;
    if (!v.pack) errors.push(`${vw}: pack size is empty.`);
    if (!v.sku) errors.push(`${vw}: SKU is empty.`);
    else if (skus.has(v.sku)) errors.push(`${vw}: SKU ${v.sku} is also used by ${skus.get(v.sku)}.`);
    else skus.set(v.sku, d.title);
    if (v.channel && !["All channels", "Retail and B2B", "HORECA only"].includes(v.channel)) errors.push(`${vw}: "Sold to" must be All channels, Retail and B2B, or HORECA only.`);
    if (!(Number(v.price) >= 0)) errors.push(`${vw}: price must be a number, 0 or more.`);
    if (!Number.isInteger(Number(v.stock)) || Number(v.stock) < 0) errors.push(`${vw}: stock must be a whole number, 0 or more.`);
    if (d.published !== false && Number(v.price) === 0) priceOnRequest++;
  });
  (d.images || []).forEach((im) => {
    checkImage(where, im.src);
    if (im.src && !im.alt) warnings.push(`${where}: an image has no description (alt text).`);
  });
  (d.related || []).forEach((r) => { if (!products.find((x) => x.slug === r)) warnings.push(`${where}: related product "${r}" not found.`); });
});
if (priceOnRequest) warnings.push(`${priceOnRequest} published pack sizes have price 0 and show "Price on request".`);
if (!published) warnings.push("No products are published; the shop will be empty.");

// ---------- Recipes & pages ----------
readFolder("recipes").forEach((r) => {
  checkImage(`Recipe "${r.data.title}"`, r.data.image);
  (r.data.spices || []).forEach((s) => { if (!products.find((x) => x.slug === s)) warnings.push(`Recipe "${r.data.title}": spice product "${s}" not found.`); });
});
readFolder("pages");

// ---------- Verification register ----------
const refs = (register.items || []).map((i) => i.ref);
const dupRefs = refs.filter((r, i) => refs.indexOf(r) !== i);
if (dupRefs.length) warnings.push(`Verification register: duplicate reference ${[...new Set(dupRefs)].join(", ")}`);
const open = (register.items || []).filter((i) => i.status !== "Verified current").length;

// ---------- Report ----------
console.log(`\nGhame content check: ${products.length} products (${published} published), ${skus.size} SKUs, ${open} register items open.`);
warnings.forEach((w) => console.log(`  warning: ${w}`));
if (errors.length) {
  console.error(`\n${errors.length} error(s) must be fixed before the website can update:`);
  errors.forEach((e) => console.error(`  ERROR: ${e}`));
  console.error("\nThe live website has not changed. Fix the items above in the portal and publish again.\n");
  process.exit(1);
}
console.log("Content check passed.\n");

// Deployment settings. Values come from Cloudflare Pages environment
// variables (Settings > Variables and Secrets), with safe fallbacks.
import fs from "node:fs";

const site = JSON.parse(fs.readFileSync(new URL("./site.json", import.meta.url), "utf8"));

export default {
  siteUrl: (process.env.SITE_URL || site.url || "").replace(/\/$/, ""),
  cmsRepo: process.env.CMS_REPO || "Hackrish9/ghame-website",
  cmsBranch: process.env.CMS_BRANCH || "main",
  // Changes on every build so browsers fetch the new CSS and JS after an update
  version: (process.env.CF_PAGES_COMMIT_SHA || Date.now().toString(36)).slice(0, 10),
  builtAt: new Date().toISOString(),
};

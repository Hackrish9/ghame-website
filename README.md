# Ghame Spice website

Static website with a management portal, WhatsApp ordering and a content verification register.
Built with Eleventy 3 and Decap CMS 3, hosted free on Cloudflare Pages. No database, no monthly fee.

Every change made in the portal is saved as a Git commit in this repository, so there is a full
history of who changed what and when, and any change can be undone.

| Address | What it is |
|---|---|
| `/` | Public website |
| `/admin/` | Management portal (GitHub sign-in) |
| `/admin/stock/` | Stock and price report (print or save as PDF) |
| `/admin/register/` | Content verification register report |

Staff instructions are in `docs/ADMIN-GUIDE.md`.

## Deploy (one time, about 30 minutes)

### 1. Put the files on GitHub
1. Create a free GitHub account for the company, then a **private** repository, for example `ghame-website`.
2. Upload the contents of this folder. Use **GitHub Desktop** (recommended): the web uploader skips hidden
   files such as `.gitignore` and accepts only 100 files at a time.
3. Do not upload `node_modules` or `_site` if they exist on your computer.

### 2. Create the Cloudflare Pages project
1. Cloudflare dashboard > **Workers & Pages** > **Create** > **Pages** > **Connect to Git**, then choose the repository.
   (If the dashboard opens on Workers, pick the Pages option.)
2. Build settings: Framework preset **None**, Build command `npm run build`, Build output directory `_site`.
3. Environment variable: `NODE_VERSION` = `22`.
4. Save and deploy. The site is live at `https://<project>.pages.dev` in about two minutes.

### 3. Create the GitHub sign-in app for the portal
GitHub > Settings > Developer settings > **OAuth Apps** > New OAuth App:
- Homepage URL: `https://<project>.pages.dev`
- Authorization callback URL: `https://<project>.pages.dev/api/callback`

Copy the **Client ID**, then generate a **Client secret**.

### 4. Connect the portal
Cloudflare > your Pages project > Settings > **Variables and Secrets** (Production):

| Name | Value |
|---|---|
| `GITHUB_CLIENT_ID` | from step 3 |
| `GITHUB_CLIENT_SECRET` | from step 3 (mark as Secret) |
| `CMS_REPO` | `Hackrish9/ghame-website` |
| `CMS_BRANCH` | `main` |
| `SITE_URL` | `https://<project>.pages.dev` now, `https://ghame.lk` after step 6 |
| `NODE_VERSION` | `22` |

Redeploy (Deployments > latest > Retry deployment). Open `/admin/` and sign in with GitHub.

### 5. Give staff access
GitHub repository > Settings > Collaborators > add each editor's GitHub account with **Write** access.
Only collaborators can sign in to the portal.

### 6. Move ghame.lk to the new site
1. Cloudflare Pages > Custom domains > add `ghame.lk` and `www.ghame.lk` and follow the DNS instructions.
2. Update the GitHub OAuth App to `https://ghame.lk` and `https://ghame.lk/api/callback`.
3. Set `SITE_URL` to `https://ghame.lk` and redeploy.
4. Submit `https://ghame.lk/sitemap.xml` in Google Search Console.

### 7. Recommended: protect the reports
The stock report and register are hidden from search engines but public if someone knows the address.
Cloudflare Zero Trust (free up to 50 users) > Access > Applications > Self-hosted: protect
`ghame.lk/admin/stock/*` and `ghame.lk/admin/register/*` with company email one-time PIN.

## How a change goes live
Portal save > Git commit > Cloudflare runs `npm run build` > `scripts/check-content.mjs` checks the content >
Eleventy builds the pages > live in 1 to 2 minutes.

If the check finds an error (duplicate SKU, negative stock, missing image, wrong WhatsApp number format),
the build stops and **the previous version stays live**. The Cloudflare build log says exactly what to fix.

## Local development
```
npm install
npm start               # website at http://localhost:8080
npm run cms:local       # in a second terminal, then open http://localhost:8080/admin/
```

## Project structure
```
src/_data/          site.json (settings), home.json, professional.json, about.json,
                    categories.json, verification.json (register)
src/products/       one Markdown file per product (pack sizes, prices, stock)
src/recipes/        one file per recipe
src/pages/          information pages (privacy, terms, delivery and samples)
src/admin/          config.yml (portal fields), index.njk (portal), stock and register reports
src/assets/         css, js, img (logos, illustrations), uploads (photos, certificates)
functions/api/      GitHub sign-in for the portal (Cloudflare Pages Functions)
scripts/            content check run before every build
```

## Upgrading
- Portal: change the Decap version in `src/admin/index.njk`; Eleventy: `package.json`.
- Test on a branch first: Cloudflare builds a preview address for every branch.
- Record each upgrade in `CHANGELOG.md`.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Portal says "not connected yet" | Update to the latest site build. This repository now defaults to `Hackrish9/ghame-website`; if overridden, verify `CMS_REPO` and redeploy. |
| Sign-in popup shows a redirect error | OAuth App callback URL does not match the address the portal was opened on |
| A change does not appear | Check the Cloudflare build log for the content check message |
| Old CSS after an update | Hard refresh; files are versioned on every build |

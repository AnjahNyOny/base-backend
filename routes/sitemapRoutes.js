// routes/sitemapRoutes.js
import express from "express";
import db from "../config/db.js";

const router = express.Router();

/* ----------------------------------------
   Utils
-----------------------------------------*/

/** Échappe les caractères XML */
function xmlEscape(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Format ISO court (YYYY-MM-DD) pour <lastmod> */
function toISODate(d) {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/** Base URL fiable (respect X-Forwarded-* en prod) */
function getBaseUrl(req) {
  const env = process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.trim();
  if (env) return env.replace(/\/+$/, "");
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`;
}

/* ----------------------------------------
   Data helpers (DB)
-----------------------------------------*/

/** Récupère les page_id “Home” pour fr/en
 * 1) essaie p.code='home'
 * 2) fallback via p.slug ('accueil' côté FR, 'home' côté EN)
 */
async function getHomePageIds() {
  try {
    const [rows] = await db.query(
      `SELECT p.id AS page_id, s.langue_active AS lang
         FROM page p
         JOIN site s ON s.id = p.site_id
        WHERE p.code = 'home'
          AND s.langue_active IN ('fr','en')`
    );
    const map = {};
    for (const r of rows || []) map[r.lang] = r.page_id;
    if (map.fr || map.en) return { fr: map.fr || null, en: map.en || null };
  } catch (e) {
    console.error("[sitemap] getHomePageIds (code=home) error:", e?.message || e);
  }

  // Fallback : correspondances basées sur slug
  try {
    const [rows2] = await db.query(
      `SELECT p.id AS page_id, s.langue_active AS lang
         FROM page p
         JOIN site s ON s.id = p.site_id
        WHERE s.langue_active IN ('fr','en')
          AND (
            (s.langue_active='fr' AND p.slug IN ('accueil','home'))
            OR
            (s.langue_active='en' AND p.slug IN ('home','accueil'))
          )`
    );
    const map2 = {};
    for (const r of rows2 || []) map2[r.lang] = r.page_id;
    return { fr: map2.fr || null, en: map2.en || null };
  } catch (e2) {
    console.error("[sitemap] getHomePageIds (fallback slug) error:", e2?.message || e2);
    return { fr: null, en: null };
  }
}

/** Liste des services d’une page (slug + lastmod + tags) */
async function getServicesForPage(pageId) {
  if (!pageId) return [];
  const [rows] = await db.query(
    `
      SELECT
        c.slug,
        COALESCE(sd.updated_at, c.updated_at, c.created_at, NOW()) AS lastmod,
        sd.tags_json
      FROM contenu c
      LEFT JOIN service_detail sd ON sd.contenu_id = c.id
      WHERE c.page_id = ?
        AND c.type = 'service_list'
      ORDER BY c.id DESC
    `,
    [Number(pageId)]
  );
  return rows || [];
}

/* ----------------------------------------
   XML builders
-----------------------------------------*/

function urlTag({ loc, lastmod, changefreq = "weekly", priority = "0.7" }) {
  const lm = lastmod ? `\n    <lastmod>${xmlEscape(lastmod)}</lastmod>` : "";
  return (
`  <url>
    <loc>${xmlEscape(loc)}</loc>${lm}
    <changefreq>${xmlEscape(changefreq)}</changefreq>
    <priority>${xmlEscape(priority)}</priority>
  </url>`
  );
}

/* ----------------------------------------
   Route: /sitemap.xml
-----------------------------------------*/

router.get("/sitemap.xml", async (req, res) => {
  const base = getBaseUrl(req);

  // URLs statiques minimales (toujours présentes, même si DB HS)
  const urls = [
    // Home
    { loc: `${base}/fr`, changefreq: "daily", priority: "1.0" },
    { loc: `${base}/en`, changefreq: "daily", priority: "1.0" },
    // About
    { loc: `${base}/fr/a-propos`, changefreq: "monthly", priority: "0.6" },
    { loc: `${base}/en/about`,    changefreq: "monthly", priority: "0.6" },
    // Portfolio
    { loc: `${base}/fr/portfolio`, changefreq: "weekly", priority: "0.6" },
    { loc: `${base}/en/portfolio`, changefreq: "weekly", priority: "0.6" },
    // Contact
    { loc: `${base}/fr/contact`, changefreq: "monthly", priority: "0.5" },
    { loc: `${base}/en/contact`, changefreq: "monthly", priority: "0.5" },
  ];

  // Partie dynamique : tolérante aux erreurs
  try {
    const { fr: frHomeId, en: enHomeId } = await getHomePageIds();
    const [frServices, enServices] = await Promise.all([
      getServicesForPage(frHomeId),
      getServicesForPage(enHomeId),
    ]);

    // FR services
    for (const r of frServices || []) {
      const lastmod = toISODate(r.lastmod);
      urls.push({
        loc: `${base}/fr/services/${encodeURIComponent(r.slug)}`,
        lastmod,
        changefreq: "weekly",
        priority: "0.8",
      });
    }

    // EN services
    for (const r of enServices || []) {
      const lastmod = toISODate(r.lastmod);
      urls.push({
        loc: `${base}/en/services/${encodeURIComponent(r.slug)}`,
        lastmod,
        changefreq: "weekly",
        priority: "0.8",
      });
    }

    // Tags FR
    const tagSetFR = new Set();
    for (const r of frServices || []) {
      if (!r?.tags_json) continue;
      try {
        const arr = JSON.parse(r.tags_json);
        if (Array.isArray(arr)) arr.forEach((t) => t && tagSetFR.add(String(t)));
      } catch { /* ignore JSON invalide */ }
    }
    for (const tag of tagSetFR) {
      urls.push({
        loc: `${base}/fr/services/tag/${encodeURIComponent(tag)}`,
        changefreq: "weekly",
        priority: "0.6",
      });
    }

    // Tags EN
    const tagSetEN = new Set();
    for (const r of enServices || []) {
      if (!r?.tags_json) continue;
      try {
        const arr = JSON.parse(r.tags_json);
        if (Array.isArray(arr)) arr.forEach((t) => t && tagSetEN.add(String(t)));
      } catch { /* ignore JSON invalide */ }
    }
    for (const tag of tagSetEN) {
      urls.push({
        loc: `${base}/en/services/tag/${encodeURIComponent(tag)}`,
        changefreq: "weekly",
        priority: "0.6",
      });
    }
  } catch (err) {
    // On log, mais on renvoie quand même un sitemap statique OK
    console.error("[sitemap] dynamic section error:", err?.message || err);
  }

  // XML final (toujours 200)
  const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by sitemapRoutes.js -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(urlTag).join("\n")}
</urlset>`;

  res
    .status(200)
    .type("application/xml; charset=UTF-8")
    .set("Cache-Control", "public, max-age=3600")
    .send(xml);
});

export default router;

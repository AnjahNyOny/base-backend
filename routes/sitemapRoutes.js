// routes/sitemapRoutes.js
import express from "express";
import db from "../config/db.js";

const router = express.Router();

/* ----------------------------------------
   Utils
-----------------------------------------*/

function xmlEscape(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toISODate(d) {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

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
    return { fr: map.fr || null, en: map.en || null };
  } catch (e) {
    return { fr: null, en: null };
  }
}

/** * CORRECTION SQL : Utilisation de date_publication car updated_at n'existe pas 
 */
async function getServicesForPage(pageId) {
  if (!pageId) return [];
  const [rows] = await db.query(
    `
      SELECT
        c.slug,
        COALESCE(c.date_publication, NOW()) AS lastmod,
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
  const urls = [
    { loc: `${base}/fr`, changefreq: "daily", priority: "1.0" },
    { loc: `${base}/en`, changefreq: "daily", priority: "1.0" },
    { loc: `${base}/fr/a-propos`, changefreq: "monthly", priority: "0.6" },
    { loc: `${base}/en/about`,    changefreq: "monthly", priority: "0.6" },
    { loc: `${base}/fr/portfolio`, changefreq: "weekly", priority: "0.6" },
    { loc: `${base}/en/portfolio`, changefreq: "weekly", priority: "0.6" },
    { loc: `${base}/fr/contact`, changefreq: "monthly", priority: "0.5" },
    { loc: `${base}/en/contact`, changefreq: "monthly", priority: "0.5" },
  ];

  try {
    const { fr: frHomeId, en: enHomeId } = await getHomePageIds();
    const [frServices, enServices] = await Promise.all([
      getServicesForPage(frHomeId),
      getServicesForPage(enHomeId),
    ]);

    for (const r of frServices || []) {
      urls.push({
        loc: `${base}/fr/services/${encodeURIComponent(r.slug)}`,
        lastmod: toISODate(r.lastmod),
        changefreq: "weekly",
        priority: "0.8",
      });
    }
    for (const r of enServices || []) {
      urls.push({
        loc: `${base}/en/services/${encodeURIComponent(r.slug)}`,
        lastmod: toISODate(r.lastmod),
        changefreq: "weekly",
        priority: "0.8",
      });
    }

    const processTags = (services, lang) => {
      const set = new Set();
      services.forEach(r => {
        if (r.tags_json) {
          try {
            JSON.parse(r.tags_json).forEach(t => t && set.add(String(t)));
          } catch {}
        }
      });
      set.forEach(tag => {
        urls.push({
          loc: `${base}/${lang}/services/tag/${encodeURIComponent(tag)}`,
          changefreq: "weekly",
          priority: "0.6"
        });
      });
    };
    processTags(frServices, 'fr');
    processTags(enServices, 'en');

  } catch (err) {
    console.error("[sitemap] SQL Error:", err.message);
  }

  // XML final sur la ligne 1
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(urlTag).join("\n")}
</urlset>`;

  res
    .status(200)
    .type("application/xml; charset=UTF-8")
    .set("Cache-Control", "public, max-age=3600")
    .send(xml.trim());
});

export default router;
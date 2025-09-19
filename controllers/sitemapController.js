// controllers/sitemapController.js
import db from "../config/db.js";

// --- helpers
const XML_DATE = (d) => new Date(d || Date.now()).toISOString().slice(0, 10);
const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function parseJSONMaybe(v, fallback) {
  if (v == null) return fallback;
  try {
    if (typeof v === "string") return JSON.parse(v);
    if (Buffer.isBuffer(v)) return JSON.parse(v.toString("utf8"));
    return v;
  } catch {
    return fallback;
  }
}

// Résout un page_id à partir d'un code de page (ex: 'home') et d'une langue ('fr'|'en')
async function getPageIdByCodeAndLang(pageCode, lang) {
  const [rows] = await db.query(
    `SELECT p.id
       FROM page p
       JOIN site s ON s.id = p.site_id
      WHERE p.code = ? AND s.langue_active = ?
      LIMIT 1`,
    [String(pageCode), String(lang)]
  );
  return rows?.[0]?.id || null;
}

// Récupère services (FR+EN) groupés par service_key, pour produire les alternates correctement
async function getServicesGroupedByKey({ frPageId, enPageId }) {
  const ids = [frPageId, enPageId].filter(Boolean);
  if (!ids.length) return new Map();

  const [rows] = await db.query(
    `
    SELECT
      c.service_key,
      c.page_id,
      c.slug,
      c.titre,
      c.updated_at AS c_updated,
      sd.updated_at AS sd_updated
    FROM contenu c
    LEFT JOIN service_detail sd ON sd.contenu_id = c.id
    WHERE c.type='service_list'
      AND c.slug IS NOT NULL
      AND c.service_key IS NOT NULL
      AND c.page_id IN (?)
  `,
    [ids]
  );

  const map = new Map(); // key -> { fr: {...} | null, en: {...} | null, lastmod }
  for (const r of rows || []) {
    const key = r.service_key;
    if (!key) continue;
    const lastmod = r.sd_updated || r.c_updated || new Date();

    const lang = (r.page_id === frPageId) ? "fr" : (r.page_id === enPageId ? "en" : null);
    if (!lang) continue;

    const slot = map.get(key) || { fr: null, en: null, lastmod: null };
    slot[lang] = { slug: r.slug, titre: r.titre };
    slot.lastmod = slot.lastmod ? new Date(Math.max(+new Date(slot.lastmod), +new Date(lastmod))) : lastmod;
    map.set(key, slot);
  }
  return map;
}

// Récupère les tags par langue (on parse côté Node pour compat MySQL 5.7 sans JSON_TABLE)
async function getTagsByLang({ frPageId, enPageId }) {
  const out = { fr: new Set(), en: new Set() };

  // toutes les lignes avec tags_json pour les 2 pages
  const ids = [frPageId, enPageId].filter(Boolean);
  if (!ids.length) return out;

  const [rows] = await db.query(
    `
    SELECT c.page_id, sd.tags_json
    FROM contenu c
    LEFT JOIN service_detail sd ON sd.contenu_id = c.id
    WHERE c.type='service_list'
      AND c.page_id IN (?)
      AND sd.tags_json IS NOT NULL
  `,
    [ids]
  );

  for (const r of rows || []) {
    const tags = parseJSONMaybe(r.tags_json, []);
    if (!Array.isArray(tags)) continue;
    const bucket = (r.page_id === frPageId) ? out.fr : (r.page_id === enPageId ? out.en : null);
    if (!bucket) continue;
    for (const t of tags) {
      const slug = String(t || "").trim();
      if (slug) bucket.add(slug);
    }
  }
  return out;
}

function urlNode({ loc, lastmod, alternates = [] }) {
  // alternates: [{ lang: 'fr'|'en'|'x-default', href }]
  const altXml = alternates
    .map(a => `    <xhtml:link rel="alternate" hreflang="${esc(a.lang)}" href="${esc(a.href)}"/>`)
    .join("\n");
  return `
  <url>
    <loc>${esc(loc)}</loc>
    <lastmod>${XML_DATE(lastmod)}</lastmod>
${altXml ? altXml + "\n" : ""}  </url>`;
}

export async function generateSitemap(req, res) {
  try {
    const origin =
      process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "") ||
      `${(req.headers["x-forwarded-proto"] || req.protocol)}://${req.get("host")}`;

    // Page IDs pour 'home' FR/EN (adapte 'home' si tes services sont ailleurs)
    const frPageId = await getPageIdByCodeAndLang("home", "fr");
    const enPageId = await getPageIdByCodeAndLang("home", "en");

    // Groupement des services par service_key → alternates propres
    const grouped = await getServicesGroupedByKey({ frPageId, enPageId });

    // Tags présents côté FR et EN (on inclut un tag s’il a >=1 service dans la langue)
    const tagsByLang = await getTagsByLang({ frPageId, enPageId });

    // --- URLs statiques (accueil + pages simples)
    const staticUrls = [];
    const today = new Date();

    // Accueil (avec x-default -> EN par convention)
    staticUrls.push(
      urlNode({
        loc: `${origin}/en`,
        lastmod: today,
        alternates: [
          { lang: "en", href: `${origin}/en` },
          { lang: "fr", href: `${origin}/fr` },
          { lang: "x-default", href: `${origin}/en` },
        ],
      }),
      urlNode({
        loc: `${origin}/fr`,
        lastmod: today,
        alternates: [
          { lang: "en", href: `${origin}/en` },
          { lang: "fr", href: `${origin}/fr` },
          { lang: "x-default", href: `${origin}/en` },
        ],
      }),

      // À propos
      urlNode({
        loc: `${origin}/en/about`,
        lastmod: today,
        alternates: [
          { lang: "en", href: `${origin}/en/about` },
          { lang: "fr", href: `${origin}/fr/a-propos` },
        ],
      }),
      urlNode({
        loc: `${origin}/fr/a-propos`,
        lastmod: today,
        alternates: [
          { lang: "en", href: `${origin}/en/about` },
          { lang: "fr", href: `${origin}/fr/a-propos` },
        ],
      }),

      // Portfolio
      urlNode({
        loc: `${origin}/en/portfolio`,
        lastmod: today,
        alternates: [
          { lang: "en", href: `${origin}/en/portfolio` },
          { lang: "fr", href: `${origin}/fr/portfolio` },
        ],
      }),
      urlNode({
        loc: `${origin}/fr/portfolio`,
        lastmod: today,
        alternates: [
          { lang: "en", href: `${origin}/en/portfolio` },
          { lang: "fr", href: `${origin}/fr/portfolio` },
        ],
      }),

      // Contact
      urlNode({
        loc: `${origin}/en/contact`,
        lastmod: today,
        alternates: [
          { lang: "en", href: `${origin}/en/contact` },
          { lang: "fr", href: `${origin}/fr/contact` },
        ],
      }),
      urlNode({
        loc: `${origin}/fr/contact`,
        lastmod: today,
        alternates: [
          { lang: "en", href: `${origin}/en/contact` },
          { lang: "fr", href: `${origin}/fr/contact` },
        ],
      })
    );

    // --- Services (alternates par pair)
    const serviceUrls = [];
    for (const [, pair] of grouped.entries()) {
      const hasEN = !!pair.en?.slug;
      const hasFR = !!pair.fr?.slug;
      const lastmod = pair.lastmod || today;

      // Si on a les deux, on génère 2 nodes avec hreflang croisé
      if (hasEN) {
        serviceUrls.push(
          urlNode({
            loc: `${origin}/en/services/${pair.en.slug}`,
            lastmod,
            alternates: [
              { lang: "en", href: `${origin}/en/services/${pair.en.slug}` },
              ...(hasFR ? [{ lang: "fr", href: `${origin}/fr/services/${pair.fr.slug}` }] : []),
            ],
          })
        );
      }
      if (hasFR) {
        serviceUrls.push(
          urlNode({
            loc: `${origin}/fr/services/${pair.fr.slug}`,
            lastmod,
            alternates: [
              ...(hasEN ? [{ lang: "en", href: `${origin}/en/services/${pair.en.slug}` }] : []),
              { lang: "fr", href: `${origin}/fr/services/${pair.fr.slug}` },
            ],
          })
        );
      }
    }

    // --- Tags (on n’ajoute l’alternate que si le tag existe dans les 2 langues)
    const tagUrls = [];
    const frTags = tagsByLang.fr;
    const enTags = tagsByLang.en;

    const allTagSlugs = new Set([...frTags, ...enTags]);
    for (const tag of allTagSlugs) {
      const inFR = frTags.has(tag);
      const inEN = enTags.has(tag);

      if (inEN) {
        tagUrls.push(
          urlNode({
            loc: `${origin}/en/services/tag/${tag}`,
            lastmod: today,
            alternates: [
              { lang: "en", href: `${origin}/en/services/tag/${tag}` },
              ...(inFR ? [{ lang: "fr", href: `${origin}/fr/services/tag/${tag}` }] : []),
            ],
          })
        );
      }
      if (inFR) {
        tagUrls.push(
          urlNode({
            loc: `${origin}/fr/services/tag/${tag}`,
            lastmod: today,
            alternates: [
              ...(inEN ? [{ lang: "en", href: `${origin}/en/services/tag/${tag}` }] : []),
              { lang: "fr", href: `${origin}/fr/services/tag/${tag}` },
            ],
          })
        );
      }
    }

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[...staticUrls, ...serviceUrls, ...tagUrls].join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=UTF-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).send(body);
  } catch (e) {
    console.error("[sitemap] error:", e);
    res.status(500).type("text/plain").send("Server error");
  }
}

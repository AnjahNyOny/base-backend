// services/serviceDetailService.js
import db from "../config/db.js";

function parseJSONMaybe(v, fallback) {
  if (v == null) return fallback;
  try {
    if (typeof v === "string") return JSON.parse(v);
    if (Buffer.isBuffer(v))    return JSON.parse(v.toString("utf8"));
    // Si le driver renvoie déjà un objet/array:
    return v;
  } catch {
    return fallback;
  }
}

/** Récupérer le détail par (page_id, slug) — réponse normalisée pour l’admin */
// export async function getServiceDetailBySlug({ page_id, slug }) {
//   const pid = Number(page_id);
//   if (!Number.isFinite(pid) || !slug) {
//     const err = new Error("page_id et slug requis.");
//     err.status = 400;
//     throw err;
//   }

//   const [rows] = await db.query(
//     `
//       SELECT
//         c.id              AS contenu_id,
//         c.page_id,
//         c.titre,
//         c.slug,
//         c.description     AS intro,

//         sd.excerpt,
//         sd.body_md,
//         sd.features_json,
//         sd.faq_json,
//         sd.tags_json,
//         sd.gallery_json,
//         sd.hero_image_url,       -- peut être NULL
//         sd.status,
//         sd.created_at,
//         sd.updated_at,

//         -- fallback image depuis la carte (ContenuImage)
//         COALESCE(sd.hero_image_url, img.image_url) AS hero_image_url_fallback,
//         img.alt          AS hero_image_alt
//       FROM contenu c
//       LEFT JOIN service_detail sd ON sd.contenu_id = c.id
//       LEFT JOIN ContenuImage img   ON img.contenu_id = c.id
//       WHERE c.page_id = ?
//         AND c.type    = 'service_list'
//         AND c.slug    = ?
//       LIMIT 1
//     `,
//     [pid, String(slug)]
//   );

//   const row = rows?.[0] || null;
//   if (!row) return null;

//   // Normalisation JSON → structures prêtes pour le modal
//   const features = parseJSONMaybe(row.features_json, []);
//   const faq      = parseJSONMaybe(row.faq_json, []);
//   const tags     = parseJSONMaybe(row.tags_json, []);
//   const gallery  = parseJSONMaybe(row.gallery_json, []);

//   // Héro finale (préférence au champ sd.hero_image_url)
//   const hero_image_url =
//     row.hero_image_url && String(row.hero_image_url).trim()
//       ? row.hero_image_url
//       : row.hero_image_url_fallback || null;

//   return {
//     contenu_id: row.contenu_id,
//     page_id: row.page_id,
//     titre: row.titre,
//     slug: row.slug,
//     intro: row.intro ?? null,

//     // champs principaux
//     excerpt: row.excerpt ?? "",
//     body_md: row.body_md ?? "",

//     // champs structurés pour le formulaire
//     features,   // ← array
//     faq,        // ← array d’objets {q,a} si tu le souhaites
//     tags,       // ← array de strings
//     gallery,    // ← array de médias (selon ton schéma)

//     // média
//     hero_image_url,
//     hero_image_alt: row.hero_image_alt || row.titre || "Service",

//     // statut
//     status: row.status || "published",

//     // méta
//     created_at: row.created_at || null,
//     updated_at: row.updated_at || null,
//   };
// }


/** Upsert des détails (1–1 sur contenu_id) */
export async function upsertServiceDetail(contenu_id, payload = {}) {
  const cid = Number(contenu_id);
  if (!Number.isFinite(cid)) throw new Error("contenu_id invalide.");

  // On valide que le contenu existe et est bien un service_list
  const [chk] = await db.query(
    `SELECT id FROM contenu WHERE id = ? AND type = 'service_list' LIMIT 1`,
    [cid]
  );
  if (!chk?.length) {
    const err = new Error("contenu_id introuvable ou type != service_list.");
    err.status = 404; throw err;
  }

  const {
    excerpt = null,
    body_md = null,
    features_json = null,
    faq_json = null,
    hero_image_url = null,
    gallery_json = null,
    tags_json = null,
    status = 'published'
  } = payload || {};

  // MySQL 5.7: ON DUPLICATE KEY nécessite un unique sur contenu_id (ok)
  const [res] = await db.query(
    `
      INSERT INTO service_detail
        (contenu_id, excerpt, body_md, features_json, faq_json, hero_image_url, gallery_json, tags_json, status)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        excerpt        = VALUES(excerpt),
        body_md        = VALUES(body_md),
        features_json  = VALUES(features_json),
        faq_json       = VALUES(faq_json),
        hero_image_url = VALUES(hero_image_url),
        gallery_json   = VALUES(gallery_json),
        tags_json      = VALUES(tags_json),
        status         = VALUES(status),
        updated_at     = CURRENT_TIMESTAMP
    `,
    [
      cid,
      excerpt,
      body_md,
      features_json ? JSON.stringify(features_json) : null,
      faq_json ? JSON.stringify(faq_json) : null,
      hero_image_url,
      gallery_json ? JSON.stringify(gallery_json) : null,
      tags_json ? JSON.stringify(tags_json) : null,
      status
    ]
  );

  return { ok: true, contenu_id: cid, affected: res.affectedRows };
}

// Nouveau service
export async function translateSlug({ slug, fromPageId = null, toPageId = null, fromLang = null, toLang = null, pageCode = 'home' }) {
  // 1) Résoudre les page_id si on a reçu des langues
  async function resolvePageIdByLang(lang) {
    // réutilise la même logique que fetchPageIdByCode côté front :
    // SELECT p.id FROM page p JOIN site s ... WHERE p.code=? AND s.langue_active=? (ou table de mapping)
    // Ici on suppose que tu as déjà une fonction util côté back ; sinon, à implémenter selon ton schéma.
    const [rows] = await db.query(
      `SELECT p.id
       FROM page p
       JOIN site s ON s.id = p.site_id
       WHERE p.code = ? AND s.langue_active = ?
       LIMIT 1`,
      [pageCode, String(lang || '').trim()]
    );
    return rows?.[0]?.id || null;
  }

  const fromPid = fromPageId || (fromLang ? await resolvePageIdByLang(fromLang) : null);
  const toPid   = toPageId   || (toLang   ? await resolvePageIdByLang(toLang)   : null);
  if (!Number.isFinite(Number(fromPid)) || !Number.isFinite(Number(toPid))) {
    const err = new Error('from_page_id/to_page_id introuvables');
    err.status = 400; throw err;
  }

  // 2) Trouver la service_key à partir de la source
  const [src] = await db.query(
    `SELECT service_key
       FROM contenu
      WHERE page_id = ? AND type = 'service_list' AND slug = ?
      LIMIT 1`,
    [Number(fromPid), String(slug)]
  );
  const serviceKey = src?.[0]?.service_key || null;
  if (!serviceKey) return null;

  // 3) Trouver le slug cible avec la même clé sur la page cible
  const [dst] = await db.query(
    `SELECT slug
       FROM contenu
      WHERE page_id = ? AND type = 'service_list' AND service_key = ?
      LIMIT 1`,
    [Number(toPid), serviceKey]
  );
  return dst?.[0]?.slug || null;
}

/** Récupérer le détail par (page_id, slug) */
export async function getServiceDetailBySlug({ slug, page_id, mustBePublished = true }) {
  const pid = Number(page_id);
  const s   = String(slug || "").trim();
  if (!Number.isFinite(pid) || !s) return null;

  const [rows] = await db.query(
    `
      SELECT
        c.id                AS contenu_id,
        c.page_id,
        c.titre,
        c.slug,
        c.description,
        c.date_publication,

        img.image_url,
        img.alt,
        img.icon_alt,

        sd.excerpt,
        sd.body_md,
        sd.features_json,
        sd.faq_json,
        sd.tags_json,
        sd.hero_image_url,
        sd.status,
        sd.created_at,
        sd.updated_at
      FROM contenu c
      LEFT JOIN service_detail sd ON sd.contenu_id = c.id
      LEFT JOIN ContenuImage   img ON img.contenu_id   = c.id
      WHERE c.page_id = ?
        AND c.type    = 'service_list'
        AND c.slug    = ?
        ${mustBePublished ? "AND COALESCE(sd.status, 'draft') = 'published'" : ""}
      LIMIT 1
    `,
    [pid, s]
  );

  const row = rows?.[0] || null;
  if (!row) return null;

  const features = parseJSONMaybe(row.features_json, []);
  const faq      = parseJSONMaybe(row.faq_json, []);
  const tags     = parseJSONMaybe(row.tags_json, []);

  const hero_image_url =
    row.hero_image_url && String(row.hero_image_url).trim()
      ? row.hero_image_url
      : (row.image_url || null);

  return {
    contenu_id      : row.contenu_id,
    page_id         : row.page_id,
    titre           : row.titre,
    slug            : row.slug,
    description     : row.description ?? null,
    date_publication: row.date_publication || null,

    image_url       : row.image_url || null,
    alt             : row.alt || (row.titre || "Service"),
    icon_alt        : row.icon_alt || null,
    hero_image_url,

    excerpt         : row.excerpt ?? "",
    body_md         : row.body_md ?? "",
    features_json   : features,
    faq_json        : faq,
    tags_json       : tags,

    status          : row.status || "draft",
    created_at      : row.created_at || null,
    updated_at      : row.updated_at || null,
  };
}

/** Upsert des détails (1–1 sur contenu_id) — inchangé ici */

/** Résoudre le slug cible via service_key entre 2 pages (langues) */
export async function resolveServiceSlug({ source_page_id, slug, target_page_id }) {
  const spid = Number(source_page_id);
  const tpid = Number(target_page_id);
  const s = String(slug || "").trim();

  if (!Number.isFinite(spid) || !Number.isFinite(tpid) || !s) {
    throw Object.assign(new Error("Paramètres invalides."), { status: 400 });
  }

  // 1) récupérer la service_key depuis la source
  const [src] = await db.query(
    `
      SELECT service_key
      FROM contenu
      WHERE page_id = ? AND type = 'service_list' AND slug = ?
      LIMIT 1
    `,
    [spid, s]
  );
  const key = src?.[0]?.service_key || null;
  if (!key) return null;

  // 2) chercher la ligne correspondante sur la page cible
  const [dst] = await db.query(
    `
      SELECT id, slug
      FROM contenu
      WHERE page_id = ? AND type = 'service_list' AND service_key = ?
      LIMIT 1
    `,
    [tpid, key]
  );
  return dst?.[0] || null;
}

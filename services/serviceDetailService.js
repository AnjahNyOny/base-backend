// services/serviceDetailService.js
import db from "../config/db.js";

/** Récupérer le détail par (page_id, slug) */
export async function getServiceDetailBySlug({ page_id, slug }) {
  const pid = Number(page_id);
  if (!Number.isFinite(pid) || !slug) throw new Error("page_id et slug requis.");

  const [rows] = await db.query(
    `
      SELECT c.id            AS contenu_id,
             c.page_id,
             c.titre,
             c.slug,
             c.description   AS intro,
             sd.excerpt,
             sd.body_md,
             sd.features_json,
             sd.faq_json,
             sd.hero_image_url,
             sd.gallery_json,
             sd.tags_json,
             sd.status,
             sd.created_at,
             sd.updated_at,
             img.image_url,
             img.alt,
             img.icon_alt
      FROM contenu c
      LEFT JOIN service_detail sd ON sd.contenu_id = c.id
      LEFT JOIN ContenuImage img   ON img.contenu_id = c.id
      WHERE c.page_id = ?
        AND c.type    = 'service_list'
        AND c.slug    = ?
      LIMIT 1
    `,
    [pid, String(slug)]
  );

  return rows?.[0] || null;
}

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

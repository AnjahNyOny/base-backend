// services/servicesService.js
import db from "../config/db.js";
import { formatDateForMySQL } from "../utils/dateUtils.js";
import { randomUUID } from "crypto";

/* ===========================================================
   Helpers slug
   =========================================================== */

/** Transforme un texte en slug URL-safe (accent-insensitive). */

function parseJSONMaybe(v, fallback) {
  if (v == null) return fallback;
  try {
    if (typeof v === "string") return JSON.parse(v);
    if (Buffer.isBuffer(v))    return JSON.parse(v.toString("utf8"));
    return v;
  } catch {
    return fallback;
  }
}

function toSlug(s = "") {
  const str = String(s || "")
    .trim()
    .toLowerCase();

  // retire les accents si possible
  const noAccents = str.normalize
    ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    : str;

  return noAccents
    .replace(/[’'°]/g, "")       // apostrophes & degrés
    .replace(/[^a-z0-9]+/g, "-") // tout ce qui n'est pas a-z/0-9 => "-"
    .replace(/^-+|-+$/g, "");    // trim des "-"
}

/**
 * Garantit l'unicité d'un slug pour (page_id, type='service_list').
 * - conn: connexion (pool ou transaction) avec .query(...)
 * - excludeId: id du contenu à exclure lors d'un update
 */
async function ensureUniqueSlug(conn, pageId, baseSlug, excludeId = null) {
  let candidate = baseSlug && baseSlug.length ? baseSlug : "service";
  let suffix = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params = [pageId, candidate];
    let sql = `
      SELECT id FROM contenu
      WHERE page_id = ? AND type = 'service_list' AND slug = ?
    `;
    if (excludeId != null) {
      sql += ` AND id <> ?`;
      params.push(Number(excludeId));
    }
    sql += ` LIMIT 1`;

    const [rows] = await conn.query(sql, params);
    if (!rows || rows.length === 0) return candidate;

    suffix += 1;
    if (suffix <= 10) {
      candidate = `${baseSlug}-${suffix}`;
    } else if (excludeId) {
      candidate = `${baseSlug}-${excludeId}`;
    } else {
      candidate = `${baseSlug}-${Date.now()}`;
    }
  }
}

/**
 * Garantit l'absence de collision de service_key sur une *même page*.
 * Si "providedKey" est vide → génère un UUID.
 * Si une collision existe sur (page_id, service_key) → régénère.
 */
async function resolveServiceKeyForCreate(conn, pageId, providedKey = null) {
  let key = (providedKey && String(providedKey).trim()) || randomUUID();
  // On boucle très peu probable (uuid) mais on sécurise.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [rows] = await conn.query(
      `
        SELECT id FROM contenu
        WHERE page_id = ? AND type = 'service_list' AND service_key = ?
        LIMIT 1
      `,
      [pageId, key]
    );
    if (!rows || rows.length === 0) return key;
    key = randomUUID();
  }
}

/* ===========================================================
   UPDATE (titre + items) — conserve la transaction, MAJ slug si fourni
   =========================================================== */

/**
 * Met à jour le titre (type='service_title') + les items (type='service_list').
 * Reçoit: { servicesTitle, servicesList, page_id }
 * - Si un item contient "slug", on le normalise et on l'applique (unicité garantie).
 * - ⚠️ Ne touche *jamais* à service_key ici (readonly).
 */
export const updateService = async ({ servicesTitle, servicesList, page_id }) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const pid = Number(page_id);
    if (!Number.isFinite(pid)) {
      throw Object.assign(new Error("page_id invalide ou manquant."), { status: 400 });
    }

    const formattedDate =
      servicesTitle?.date_publication
        ? formatDateForMySQL(servicesTitle.date_publication)
        : formatDateForMySQL(new Date());

    // 🔒 MAJ du titre UNIQUEMENT si type=service_title ET page_id correspond
    const [titleRes] = await conn.query(
      `
        UPDATE contenu
        SET titre = ?, description = ?, date_publication = ?
        WHERE id = ?
          AND type = 'service_title'
          AND page_id = ?;
      `,
      [
        (servicesTitle?.titre ?? "").trim(),
        (servicesTitle?.description ?? "").trim(),
        formattedDate,
        servicesTitle?.id,
        pid,
      ]
    );

    if (!titleRes.affectedRows) {
      throw Object.assign(
        new Error("Titre introuvable OU type/page_id ne correspondent pas (service_title)."),
        { status: 404 }
      );
    }

    // 🔁 MAJ des items (titre/description/date) + slug si fourni (service_key untouched)
    for (const item of servicesList || []) {
      const itemDate = item?.date_publication
        ? formatDateForMySQL(item.date_publication)
        : formatDateForMySQL(new Date());

      // 1) MAJ titre/description/date
      const [itemRes] = await conn.query(
        `
          UPDATE contenu
          SET titre = ?, description = ?, date_publication = ?
          WHERE id = ?
            AND type = 'service_list'
            AND page_id = ?;
        `,
        [
          (item?.titre ?? "").trim(),
          (item?.description ?? "").trim(),
          itemDate,
          item?.id,
          pid,
        ]
      );

      if (!itemRes.affectedRows) {
        throw Object.assign(
          new Error(`Service #${item?.id} introuvable OU type/page_id ne correspondent pas (service_list).`),
          { status: 404 }
        );
      }

      // 2) MAJ slug si fourni
      const raw = typeof item?.slug === "string" ? item.slug : null;
      const desired = raw ? toSlug(raw) : null;

      if (desired && desired.length) {
        const unique = await ensureUniqueSlug(conn, pid, desired, item?.id);
        await conn.query(
          `
            UPDATE contenu
            SET slug = ?
            WHERE id = ?
              AND type = 'service_list'
              AND page_id = ?;
          `,
          [unique, item?.id, pid]
        );
      }
    }

    await conn.commit();
    return {
      message: "Section Services mise à jour avec succès.",
      updatedTitle: servicesTitle,
      updatedList: servicesList,
    };
  } catch (error) {
    try { await conn.rollback(); } catch { /* ignore */ }
    console.error("[ERROR] updateServicesComponent:", error?.message || error);
    throw error;
  } finally {
    conn.release();
  }
};

/* ===========================================================
   DELETE — supprime images liées, puis contenu
   =========================================================== */
export const deleteService = async (id, page_id = null) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Supprimer les images liées (inclut image_url/alt/icon_alt)
    await conn.query(`DELETE FROM ContenuImage WHERE contenu_id = ?`, [id]);

    // Supprimer le contenu principal (optionnellement sécurisé par page_id)
    let sql = `DELETE FROM contenu WHERE id = ?`;
    const params = [id];
    if (page_id != null) {
      sql += ` AND page_id = ?`;
      params.push(Number(page_id));
    }
    const [res] = await conn.query(sql, params);

    await conn.commit();
    if (!res.affectedRows) {
      return { message: "Aucun contenu supprimé (id/page_id ne correspondent pas)." };
    }
    return { message: "Service supprimé avec succès." };
  } catch (error) {
    try { await conn.rollback(); } catch { /* ignore */ }
    console.error("[ERROR] deleteService:", error?.message || error);
    throw error;
  } finally {
    conn.release();
  }
};

/* ===========================================================
   CREATE — ajoute slug + service_key
   =========================================================== */
/**
 * Crée un service_list avec :
 *  - slug unique sur (page_id)
 *  - service_key (fourni ou généré), sans collision sur la *même page*
 *  - retourne l'objet créé
 */
export async function createService({ titre, description, page_id, slug, service_key = null }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const formattedDate = formatDateForMySQL(new Date());
    const safeTitre = String(titre || "").trim();
    const safeDesc  = String(description || "").trim();
    const pid = Number(page_id);

    if (!Number.isFinite(pid)) {
      throw Object.assign(new Error("page_id invalide ou manquant."), { status: 400 });
    }
    if (!safeTitre) {
      throw Object.assign(new Error("Le titre est requis."), { status: 400 });
    }

    // Slug désiré (slug fourni ou dérivé du titre)
    const desired = toSlug(slug || safeTitre) || `service-${Date.now()}`;
    const finalSlug = await ensureUniqueSlug(conn, pid, desired, null);

    // service_key (fourni ou généré) — éviter collision pour *cette page*
    const finalServiceKey = await resolveServiceKeyForCreate(conn, pid, service_key);

    const [result] = await conn.query(
      `
        INSERT INTO contenu (type, titre, description, slug, service_key, date_publication, page_id)
        VALUES ('service_list', ?, ?, ?, ?, ?, ?)
      `,
      [safeTitre, safeDesc, finalSlug, finalServiceKey, formattedDate, pid]
    );

    await conn.commit();

    return {
      id: result.insertId,
      titre: safeTitre,
      description: safeDesc,
      slug: finalSlug,
      service_key: finalServiceKey,
      type: "service_list",
      date_publication: formattedDate,
      page_id: pid,
    };
  } catch (e) {
    try { await conn.rollback(); } catch {}
    throw e;
  } finally {
    conn.release();
  }
}

/* ===========================================================
   DUPLICATE — vers une autre page/langue en conservant service_key
   =========================================================== */
/**
 * Duplique un service source (par id) vers une page cible, en conservant la service_key.
 * - Copie aussi l'image (ContenuImage) si présente.
 * - Slug recalculé (ou override) et rendu unique sur la page cible.
 */
export async function duplicateServiceToPage({
  source_id,
  target_page_id,
  slugOverride = null,
  titreOverride = null,
  descriptionOverride = null,
}) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const tid = Number(target_page_id);
    if (!Number.isFinite(tid)) {
      throw Object.assign(new Error("target_page_id invalide."), { status: 400 });
    }

    // Récupérer la source
    const [srcRows] = await conn.query(
      `
        SELECT c.id, c.page_id, c.titre, c.description, c.slug, c.service_key
        FROM contenu c
        WHERE c.id = ? AND c.type = 'service_list'
        LIMIT 1
      `,
      [Number(source_id)]
    );
    const src = srcRows?.[0];
    if (!src) {
      const err = new Error("Service source introuvable.");
      err.status = 404; throw err;
    }

    // S'assurer que la source a une service_key (sinon on lui en attribue une)
    let key = src.service_key;
    if (!key) {
      key = randomUUID();
      await conn.query(
        `UPDATE contenu SET service_key = ? WHERE id = ? AND type = 'service_list'`,
        [key, src.id]
      );
    }

    // Préparer les champs de la cible
    const titre = (titreOverride ?? src.titre ?? "").trim();
    const description = (descriptionOverride ?? src.description ?? "").trim();

    const desiredSlug = toSlug(slugOverride || titre) || `service-${Date.now()}`;
    const finalSlug = await ensureUniqueSlug(conn, tid, desiredSlug, null);

    // ⚠️ on réutilise *la même* service_key (clé logique entre langues)
    // et on évite collision sur *cette page* (peu probable si cross-langue)
    const finalKey = await resolveServiceKeyForCreate(conn, tid, key);

    const now = formatDateForMySQL(new Date());
    const [ins] = await conn.query(
      `
        INSERT INTO contenu (type, titre, description, slug, service_key, date_publication, page_id)
        VALUES ('service_list', ?, ?, ?, ?, ?, ?)
      `,
      [titre, description, finalSlug, finalKey, now, tid]
    );
    const newId = ins.insertId;

    // Copier l'image liée si présente
    const [imgRows] = await conn.query(
      `SELECT image_url, alt, icon_alt FROM ContenuImage WHERE contenu_id = ? LIMIT 1`,
      [src.id]
    );
    if (imgRows?.length) {
      const img = imgRows[0];
      await conn.query(
        `
          INSERT INTO ContenuImage (contenu_id, image_url, alt, icon_alt)
          VALUES (?, ?, ?, ?)
        `,
        [newId, img.image_url || "", img.alt || null, img.icon_alt || null]
      );
    }

    await conn.commit();
    return { id: newId, slug: finalSlug, service_key: finalKey, page_id: tid };
  } catch (e) {
    try { await conn.rollback(); } catch {}
    throw e;
  } finally {
    conn.release();
  }
}

/* ===========================================================
   GETTER front — expose aussi le service_key
   =========================================================== */

/**
 * Getter front basé sur page_id :
 * Renvoie { serviceTitle, services, boutons }
 * - services[].slug        : slug du service
 * - services[].service_key : clé logique de liaison inter-langues
 * - services[].image_url   : URL de l’image (si existante)
 * - services[].alt         : alt de l’image (si existant)
 * - services[].icon_alt    : token icône "icon:fa-solid fa-…" (si existant)
 */
export async function getServicesWithDetails({ pageId, includeDraft = false }) {
  const pid = Number(pageId);
  if (!Number.isFinite(pid)) {
    const err = new Error("pageId invalide.");
    err.status = 400; throw err;
  }

  // 1) Titre de section (tolérant: services_title ou service_title)
  const [titleRows] = await db.query(
    `
      SELECT id, titre, description
      FROM contenu
      WHERE page_id = ?
        AND type IN ('services_title','service_title')
      ORDER BY id DESC
      LIMIT 1
    `,
    [pid]
  );
  const serviceTitle = titleRows?.[0] || null;

  // 2) Liste des cartes services
  const statusWhere = includeDraft ? "" : "AND COALESCE(sd.status, 'draft') = 'published'";

  const [rows] = await db.query(
    `
      SELECT
        c.id,
        c.titre,
        c.description,
        c.slug,
        c.service_key,
        c.date_publication,

        img.image_url,
        img.alt,
        img.icon_alt,

        sd.status,
        sd.tags_json
      FROM contenu c
      LEFT JOIN service_detail sd ON sd.contenu_id = c.id
      LEFT JOIN ContenuImage   img ON img.contenu_id   = c.id
      WHERE c.page_id = ?
        AND c.type = 'service_list'
        ${statusWhere}
      ORDER BY c.id DESC
    `,
    [pid]
  );

  const services = (rows || []).map(r => ({
    id: r.id,
    titre: r.titre,
    description: r.description,
    slug: r.slug,
    service_key: r.service_key || null,
    date_publication: r.date_publication || null,
    image_url: r.image_url || null,
    alt: r.alt || null,
    icon_alt: r.icon_alt || null,
    status: r.status || "draft",
    tags: parseJSONMaybe(r.tags_json, []),
  }));

  // 3) Boutons (si tu en as — sinon, laisse vide)
  const boutons = [];

  return { serviceTitle, services, boutons };
}


/* ===========================================================
   LIST BY TAG — liste les services ayant un tag précis
   =========================================================== */
/**
 * Liste paginée des services pour un tag donné sur une page donnée.
 * Params: { page_id, tag, limit=12, offset=0, sort='recent' }
 * Retour: { items: [...], paging: { total, limit, offset } }
 */
export async function listServicesByTag({ page_id, tag, limit = 12, offset = 0, sort = "recent", includeDraft = false }) {
  const pid = Number(page_id);
  const t = String(tag || "").trim();
  if (!Number.isFinite(pid) || !t) {
    const err = new Error("page_id et tag requis.");
    err.status = 400; throw err;
  }
  const lim = Math.max(1, Math.min(Number(limit) || 12, 50));
  const off = Math.max(0, Number(offset) || 0);

  const orderBy =
    sort === "alpha"
      ? "c.titre ASC, c.id DESC"
      : "c.date_publication DESC, c.id DESC";

  const statusWhere = includeDraft ? "" : "AND COALESCE(sd.status, 'draft') = 'published'";

  const [rows] = await db.query(
    `
      SELECT
        c.id,
        c.titre,
        c.slug,
        c.description,
        COALESCE(sd.excerpt, c.description) AS excerpt,
        img.image_url,
        img.alt,
        img.icon_alt,
        sd.tags_json,
        c.date_publication
      FROM contenu c
      LEFT JOIN service_detail sd ON sd.contenu_id = c.id
      LEFT JOIN ContenuImage   img ON img.contenu_id   = c.id
      WHERE c.page_id = ?
        AND c.type = 'service_list'
        ${statusWhere}
        AND JSON_CONTAINS(
              COALESCE(NULLIF(sd.tags_json, ''), '[]'),
              JSON_QUOTE(?),
              '$'
            )
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `,
    [pid, t, lim, off]
  );

  const [countRows] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM contenu c
      LEFT JOIN service_detail sd ON sd.contenu_id = c.id
      WHERE c.page_id = ?
        AND c.type = 'service_list'
        ${statusWhere}
        AND JSON_CONTAINS(
              COALESCE(NULLIF(sd.tags_json, ''), '[]'),
              JSON_QUOTE(?),
              '$'
            )
    `,
    [pid, t]
  );

  const total = Number(countRows?.[0]?.total || 0);
  const items = (rows || []).map(r => ({
    id: r.id,
    titre: r.titre,
    slug: r.slug,
    description: r.description,
    excerpt: r.excerpt,
    image_url: r.image_url || null,
    alt: r.alt || null,
    icon_alt: r.icon_alt || null,
    tags: parseJSONMaybe(r.tags_json, []),
    date_publication: r.date_publication,
  }));

  return { items, paging: { total, limit: lim, offset: off } };
}

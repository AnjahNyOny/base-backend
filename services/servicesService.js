// services/servicesService.js
import db from "../config/db.js";
import { formatDateForMySQL } from "../utils/dateUtils.js";

/* ===========================================================
   Helpers slug
   =========================================================== */

/** Transforme un texte en slug URL-safe (accent-insensitive). */
function toSlug(s = "") {
  const str = String(s || "")
    .trim()
    .toLowerCase();

  // retire les accents si possible
  const noAccents = str.normalize
    ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    : str;

  return noAccents
    .replace(/[’'°]/g, "")      // apostrophes & degrés courants
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

  // On boucle tant qu'un doublon existe
  // (sécurise en cas d'index unique en DB et/ou multi-serveurs)
  // NOTE: on borne la boucle et fallback sur Date.now() si collision improbable.
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

/* ===========================================================
   UPDATE (titre + items) — conserve ta transaction et ajoute le slug
   =========================================================== */

/**
 * Met à jour le titre (type='service_title') + les items (type='service_list').
 * Reçoit: { servicesTitle, servicesList, page_id }
 * - Si un item contient "slug", on le normalise et on l'applique (unicité garantie).
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

    // 🔁 MAJ des items (titre/description/date) + slug si fourni
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
   DELETE — inchangé (supprime images liées, puis contenu)
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
   CREATE — ajoute le slug (unicité garantie)
   =========================================================== */

export async function createService({ titre, description, page_id, slug }) {
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
  const finalSlug = await ensureUniqueSlug(db, pid, desired, null);

  const [result] = await db.query(
    `
      INSERT INTO contenu (type, titre, description, slug, date_publication, page_id)
      VALUES ('service_list', ?, ?, ?, ?, ?)
    `,
    [safeTitre, safeDesc, finalSlug, formattedDate, pid]
  );

  return {
    id: result.insertId,
    titre: safeTitre,
    description: safeDesc,
    slug: finalSlug,
    type: "service_list",
    date_publication: formattedDate,
    page_id: pid,
  };
}

/* ===========================================================
   GETTER front — expose le slug aussi
   =========================================================== */

/**
 * Getter front basé sur page_id :
 * Renvoie { serviceTitle, services, boutons }
 * - services[].slug      : slug du service
 * - services[].image_url : URL de l’image (si existante)
 * - services[].alt       : alt de l’image (si existant)
 * - services[].icon_alt  : token icône "icon:fa-solid fa-…" (si existant)
 */
export const getServicesWithDetails = async ({ pageId }) => {
  const conn = await db.getConnection();
  try {
    const pid = Number(pageId);
    if (!Number.isFinite(pid)) {
      throw new Error("pageId requis (numérique).");
    }

    // Titre (service_title)
    const [titleRows] = await conn.query(
      `
        SELECT id, type, titre, description, date_publication, page_id
        FROM contenu
        WHERE type = 'service_title' AND page_id = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [pid]
    );
    const serviceTitle = titleRows?.[0] || null;

    // Items (service_list) — on expose aussi le slug
    const [serviceRows] = await conn.query(
      `
        SELECT id, type, titre, description, slug, date_publication, page_id
        FROM contenu
        WHERE type = 'service_list' AND page_id = ?
        ORDER BY date_publication DESC, id DESC
      `,
      [pid]
    );

    // Images + Icônes (1 ligne ContenuImage par contenu_id)
    let images = [];
    const ids = (serviceRows || []).map(s => s.id);
    if (ids.length > 0) {
      const [imageRows] = await conn.query(
        `
          SELECT id, contenu_id, image_url, alt, icon_alt
          FROM ContenuImage
          WHERE contenu_id IN (?)
        `,
        [ids]
      );
      images = imageRows || [];
    }

    // Boutons (optionnels)
    let boutons = [];
    try {
      const [btnRows] = await conn.query(
        `SELECT * FROM ContenuBouton WHERE section = 'services' AND page_id = ?`,
        [pid]
      );
      boutons = btnRows || [];
    } catch {
      boutons = [];
    }

    // Merge
    const servicesWithImages = (serviceRows || []).map(svc => {
      const img = images.find(i => i.contenu_id === svc.id);
      return {
        ...svc,
        image_url: img?.image_url || null,
        alt: img?.alt || null,            // alt de l'image uniquement
        icon_alt: img?.icon_alt || null,  // token icône icon:fa-solid fa-...
      };
    });

    return { serviceTitle, services: servicesWithImages, boutons };
  } finally {
    conn.release();
  }
};

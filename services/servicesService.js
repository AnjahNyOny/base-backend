// services/servicesService.js
import db from "../config/db.js";
import { formatDateForMySQL } from "../utils/dateUtils.js";

/**
 * Met à jour le titre (type='service_title') + les items (type='service_list') pour une page donnée.
 * Reçoit: { servicesTitle, servicesList, page_id }
 * Sécurisé par: type + page_id.
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

    // 🔁 MAJ des items UNIQUEMENT si type=service_list ET page_id correspond
    for (const item of servicesList || []) {
      const itemDate = item?.date_publication
        ? formatDateForMySQL(item.date_publication)
        : formatDateForMySQL(new Date());

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
    }

    await conn.commit();
    return {
      message: "Section Services mise à jour avec succès.",
      updatedTitle: servicesTitle,
      updatedList: servicesList,
    };
  } catch (error) {
    try { await conn.rollback(); } catch { }
    console.error("[ERROR] updateServicesComponent:", error?.message || error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Suppression d’un service + images liées pour la page donnée (sécurisé par page_id).
 * Reçoit (id, page_id). Si tu ne veux pas vérifier page_id ici, retire la clause AND page_id.
 */
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
    try { await conn.rollback(); } catch { }
    console.error("[ERROR] deleteService:", error?.message || error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Création d’un item service (type='service_list') pour une page.
 */
export async function createService({ titre, description, page_id }) {
  const formattedDate = formatDateForMySQL(new Date());
  const safeTitre = String(titre || "").trim();
  const safeDesc = String(description || "").trim();
  const pid = Number(page_id);

  if (!Number.isFinite(pid)) {
    throw Object.assign(new Error("page_id invalide ou manquant."), { status: 400 });
  }

  const [result] = await db.query(
    `
      INSERT INTO contenu (type, titre, description, date_publication, page_id)
      VALUES ('service_list', ?, ?, ?, ?)
    `,
    [safeTitre, safeDesc, formattedDate, pid]
  );

  return {
    id: result.insertId,
    titre: safeTitre,
    description: safeDesc,
    type: "service_list",
    date_publication: formattedDate,
    page_id: pid,
  };
}

/**
 * Getter front basé sur page_id :
 * Renvoie { serviceTitle, services, boutons }
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

    // Items (service_list)
    const [serviceRows] = await conn.query(
      `
        SELECT id, type, titre, description, date_publication, page_id
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

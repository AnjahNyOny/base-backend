// services/companyOverviewService.js
import db from "../config/db.js";
import { formatDateForMySQL } from "../utils/dateUtils.js";

const OVERVIEW_TITLE = "company_overview_title";
const OVERVIEW_ITEM  = "company_overview";

/** GET agrégé par page_id (→ maintenant retourne aussi les images liées aux items) */
// services/companyOverviewService.js
export const getCompanyOverviewByPage = async (page_id) => {
  const conn = await db.getConnection();
  try {
    // Title
    const [titleRows] = await conn.query(
      `SELECT id, type, titre, description, date_publication, page_id
       FROM contenu
       WHERE type = 'company_overview_title' AND page_id = ?
       LIMIT 1`,
      [page_id]
    );
    const overviewTitle = titleRows[0] || null;

    // Items
    const [itemRows] = await conn.query(
      `SELECT id, type, titre, description, date_publication, page_id
       FROM contenu
       WHERE type = 'company_overview' AND page_id = ?
       ORDER BY id ASC`,
      [page_id]
    );

    // 🔗 Images & icônes
    let images = [];
    const ids = (itemRows || []).map(r => r.id);
    if (ids.length > 0) {
      const [imageRows] = await conn.query(
        `SELECT id, contenu_id, image_url, alt, icon_alt
         FROM ContenuImage
         WHERE contenu_id IN (?)`,
        [ids]
      );
      images = imageRows || [];
    }

    const companyOverviewSections = (itemRows || []).map(it => {
      const media = images.find(m => m.contenu_id === it.id);
      return {
        ...it,
        image_url: media?.image_url || null,
        alt: media?.alt || null,          // alt = description de l’image
        icon_alt: media?.icon_alt || null // token "icon:fa-solid fa-..."
      };
    });

    return { overviewTitle, companyOverviewSections };
  } finally {
    conn.release();
  }
};


/** POST / PUT / DELETE inchangés ci-dessous */
export async function createCompanyOverview({ titre, description, page_id }) {
  const formattedDate = formatDateForMySQL(new Date());
  const safeTitre = String(titre || "").trim();
  const safeDesc  = description != null ? String(description).trim() : null;

  const insertQuery = `
    INSERT INTO contenu (type, titre, description, date_publication, page_id)
    VALUES (?, ?, ?, ?, ?)
  `;
  const values = [OVERVIEW_ITEM, safeTitre, safeDesc, formattedDate, Number(page_id)];
  const [result] = await db.query(insertQuery, values);

  return {
    id: result.insertId,
    titre: safeTitre,
    description: safeDesc,
    type: OVERVIEW_ITEM,
    date_publication: formattedDate,
    page_id: Number(page_id),
  };
}

export const updateCompanyOverview = async ({ overviewTitle, companyOverviewSections }) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const titleDate = overviewTitle?.date_publication
      ? formatDateForMySQL(overviewTitle.date_publication)
      : formatDateForMySQL(new Date());

    const [titleRes] = await conn.query(
      `UPDATE contenu
          SET titre = ?, description = ?, date_publication = ?
        WHERE id = ? AND type = ?`,
      [
        (overviewTitle?.titre || "").trim(),
        overviewTitle?.description != null ? String(overviewTitle.description).trim() : null,
        titleDate,
        overviewTitle?.id,
        OVERVIEW_TITLE,
      ]
    );
    if (!titleRes.affectedRows) {
      throw Object.assign(new Error("CompanyOverview title introuvable ou mauvais type."), { status: 404 });
    }

    for (const item of (companyOverviewSections || [])) {
      const itemDate = item?.date_publication
        ? formatDateForMySQL(item.date_publication)
        : formatDateForMySQL(new Date());

      const [itemRes] = await conn.query(
        `UPDATE contenu
            SET titre = ?, description = ?, date_publication = ?
          WHERE id = ? AND type = ?`,
        [
          (item?.titre || "").trim(),
          item?.description != null ? String(item.description).trim() : null,
          itemDate,
          item?.id,
          OVERVIEW_ITEM,
        ]
      );
      if (!itemRes.affectedRows) {
        throw Object.assign(new Error(`Section #${item?.id} introuvable ou mauvais type.`), { status: 404 });
      }
    }

    await conn.commit();
    return {
      message: "Section Company Overview mise à jour avec succès.",
      updatedTitle: overviewTitle,
      updatedList: companyOverviewSections,
    };
  } catch (error) {
    await (conn?.rollback?.() ?? Promise.resolve());
    console.error("[ERROR] updateCompanyOverview:", error?.message || error);
    throw error;
  } finally {
    conn.release();
  }
};

export const deleteCompanyOverview = async (id) => {
  const conn = await db.getConnection();
  try {
    const [res] = await conn.query(
      `DELETE FROM contenu WHERE id = ? AND type = ?`,
      [id, OVERVIEW_ITEM]
    );
    if (!res.affectedRows) {
      return { message: "Aucun élément supprimé (introuvable ou mauvais type)." };
    }
    return { message: "Élément supprimé avec succès." };
  } catch (error) {
    console.error("[ERROR] deleteCompanyOverview:", error?.message || error);
    throw error;
  } finally {
    conn.release();
  }
};

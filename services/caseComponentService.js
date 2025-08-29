// services/caseComponentService.js
import db from "../config/db.js";
import { formatDateForMySQL } from "../utils/dateUtils.js";

/** Types dédiés à la section */
const CASE_TITLE = "caseComponent_title";
const CASE_ITEM  = "caseComponent_list";

/** GET agrégé par page_id */
export const getCaseComponentByPage = async (page_id) => {
  const conn = await db.getConnection();
  try {
    // Titre
    const [titleRows] = await conn.query(
      `SELECT id, type, titre, description, date_publication, page_id
         FROM contenu
        WHERE type = ? AND page_id = ?
        LIMIT 1`,
      [CASE_TITLE, page_id]
    );
    const caseTitle = titleRows[0] || null;

    // Items
    const [itemRows] = await conn.query(
      `SELECT id, type, titre, description, date_publication, page_id
         FROM contenu
        WHERE type = ? AND page_id = ?
        ORDER BY id ASC`,
      [CASE_ITEM, page_id]
    );

    // Images liées
    let images = [];
    if (itemRows.length) {
      const ids = itemRows.map(r => r.id);
      const [imgRows] = await conn.query(
        `SELECT id, contenu_id, image_url, alt
           FROM contenuimage
          WHERE contenu_id IN (?)`,
        [ids]
      );
      images = imgRows;
    }

    // Associer image à chaque item
    const cases = itemRows.map(it => {
      const img = images.find(i => i.contenu_id === it.id);
      return {
        ...it,
        image_url: img?.image_url || null,
        alt: img?.alt || "",
        image_id: img?.id || null, 
      };
    });

    return { caseTitle, cases, boutons: [] }; // boutons si tu en as plus tard
  } finally {
    conn.release();
  }
};

/** POST: créer un item (ligne contenu) */
export const createCaseComponent = async ({ titre, description, page_id }) => {
  const formattedDate = formatDateForMySQL(new Date());
  const safeTitre = String(titre || "").trim();
  const safeDesc  = String(description || "").trim();

  const insertQuery = `
    INSERT INTO contenu (type, titre, description, date_publication, page_id)
    VALUES (?, ?, ?, ?, ?)
  `;
  const values = [CASE_ITEM, safeTitre, safeDesc, formattedDate, Number(page_id)];
  const [result] = await db.query(insertQuery, values);

  return {
    id: result.insertId,
    type: CASE_ITEM,
    titre: safeTitre,
    description: safeDesc,
    date_publication: formattedDate,
    page_id: Number(page_id),
  };
};

/** PUT bulk: mettre à jour titre + items existants */
export const updateCaseComponent = async ({ caseTitle, caseList }) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // --- Titre (type check) ---
    const titleDate = caseTitle?.date_publication
      ? formatDateForMySQL(caseTitle.date_publication)
      : formatDateForMySQL(new Date());

    const [titleRes] = await conn.query(
      `UPDATE contenu
          SET titre = ?, description = ?, date_publication = ?
        WHERE id = ? AND type = ?`,
      [
        (caseTitle?.titre || "").trim(),
        (caseTitle?.description || "").trim(),
        titleDate,
        caseTitle?.id,
        CASE_TITLE,
      ]
    );
    if (!titleRes.affectedRows) {
      throw Object.assign(
        new Error("Case title introuvable ou mauvais type."),
        { status: 404 }
      );
    }

    // --- Items (type check) ---
    for (const item of (caseList || [])) {
      const itemDate = item?.date_publication
        ? formatDateForMySQL(item.date_publication)
        : formatDateForMySQL(new Date());

      const [itemRes] = await conn.query(
        `UPDATE contenu
            SET titre = ?, description = ?, date_publication = ?
          WHERE id = ? AND type = ?`,
        [
          (item?.titre || "").trim(),
          (item?.description || "").trim(),
          itemDate,
          item?.id,
          CASE_ITEM,
        ]
      );
      if (!itemRes.affectedRows) {
        throw Object.assign(
          new Error(`Case #${item?.id} introuvable ou mauvais type.`),
          { status: 404 }
        );
      }
    }

    await conn.commit();
    return {
      message: "Case studies mis à jour avec succès.",
      updatedTitle: caseTitle,
      updatedList: caseList,
    };
  } catch (err) {
    await (conn?.rollback?.() ?? Promise.resolve());
    console.error("[ERROR] updateCaseComponent:", err?.message || err);
    throw err;
  } finally {
    conn.release();
  }
};

/** DELETE: supprimer un item + ses images */
export const deleteCaseComponent = async (id) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`DELETE FROM contenuimage WHERE contenu_id = ?`, [id]);
    await conn.query(`DELETE FROM contenu WHERE id = ? AND type = ?`, [id, CASE_ITEM]);

    await conn.commit();
    return { message: "Case study supprimé avec succès." };
  } catch (err) {
    await conn.rollback();
    console.error("[ERROR] deleteCaseComponent:", err?.message || err);
    throw err;
  } finally {
    conn.release();
  }
};
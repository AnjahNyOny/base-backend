// services/gallerieComponentService.js
import db from "../config/db.js";
import { formatDateForMySQL } from "../utils/dateUtils.js";

const GALLERIE_TITLE = "gallerie_title";
const GALLERIE_ITEM  = "gallerie_list";

/** GET agrégé par page_id */
export const getGallerieComponentByPage = async (page_id) => {
  const conn = await db.getConnection();
  try {
    // Titre
    const [titleRows] = await conn.query(
      `SELECT id, type, titre, description, date_publication, page_id
         FROM contenu
        WHERE type = ? AND page_id = ?
        LIMIT 1`,
      [GALLERIE_TITLE, page_id]
    );
    const galleryTitle = titleRows[0] || null;

    // Items (sans image_url/alt dans contenu)
    const [itemRows] = await conn.query(
      `SELECT id, type, titre, description, date_publication, page_id
         FROM contenu
        WHERE type = ? AND page_id = ?
        ORDER BY id ASC`,
      [GALLERIE_ITEM, page_id]
    );

    // Images liées (table 'contenuimage')
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

    const gallery = itemRows.map(it => {
      const img = images.find(i => i.contenu_id === it.id);
      return {
        ...it,
        image_id: img?.id ?? null,
        image_url: img?.image_url ?? null,
        alt: img?.alt ?? "",
      };
    });

    return { galleryTitle, gallery, boutons: [] };
  } finally {
    conn.release();
  }
};

/** POST: créer un item (ligne contenu) */
export const createGallerieComponent = async ({ titre, description, page_id }) => {
  const formattedDate = formatDateForMySQL(new Date());
  const safeTitre = String(titre || "").trim();
  const safeDesc  = String(description || "").trim();

  const insertQuery = `
    INSERT INTO contenu (type, titre, description, date_publication, page_id)
    VALUES (?, ?, ?, ?, ?)
  `;
  const values = [GALLERIE_ITEM, safeTitre, safeDesc, formattedDate, Number(page_id)];
  const [result] = await db.query(insertQuery, values);

  return {
    id: result.insertId,
    type: GALLERIE_ITEM,
    titre: safeTitre,
    description: safeDesc,
    date_publication: formattedDate,
    page_id: Number(page_id),
  };
};

/** PUT bulk: mettre à jour titre + items existants (sans images) */
export const updateGallerieComponent = async ({ galleryTitle, galleryList }) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // --- Titre ---
    const titleDate = galleryTitle?.date_publication
      ? formatDateForMySQL(galleryTitle.date_publication)
      : formatDateForMySQL(new Date());

    const [titleRes] = await conn.query(
      `UPDATE contenu
          SET titre = ?, description = ?, date_publication = ?
        WHERE id = ? AND type = ?`,
      [
        (galleryTitle?.titre || "").trim(),
        (galleryTitle?.description || "").trim(),
        titleDate,
        galleryTitle?.id,
        GALLERIE_TITLE,
      ]
    );
    if (!titleRes.affectedRows) {
      throw Object.assign(new Error("Gallery title introuvable ou mauvais type."), { status: 404 });
    }

    // --- Items ---
    for (const item of (galleryList || [])) {
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
          GALLERIE_ITEM,
        ]
      );
      if (!itemRes.affectedRows) {
        throw Object.assign(new Error(`Gallery item #${item?.id} introuvable ou mauvais type.`), { status: 404 });
      }
    }

    await conn.commit();
    return {
      message: "Galerie mise à jour avec succès.",
      updatedTitle: galleryTitle,
      updatedList: galleryList,
    };
  } catch (err) {
    await (conn?.rollback?.() ?? Promise.resolve());
    console.error("[ERROR] updateGallerieComponent:", err?.message || err);
    throw err;
  } finally {
    conn.release();
  }
};

/** DELETE: supprimer un item + ses images */
export const deleteGallerieComponent = async (id) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`DELETE FROM contenuimage WHERE contenu_id = ?`, [id]);
    await conn.query(`DELETE FROM contenu WHERE id = ? AND type = ?`, [id, GALLERIE_ITEM]);

    await conn.commit();
    return { message: "Élément de galerie supprimé avec succès." };
  } catch (err) {
    await conn.rollback();
    console.error("[ERROR] deleteGallerieComponent:", err?.message || err);
    throw err;
  } finally {
    conn.release();
  }
};
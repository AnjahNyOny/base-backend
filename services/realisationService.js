// services/realisationService.js
import db from "../config/db.js";
import { formatDateForMySQL } from "../utils/dateUtils.js";

/**
 * GET agrégé par page_id
 * Renvoie { title, list, images }
 */
export async function getRealisationByPageId(pageId) {
  // 1) Titre
  const [rowsTitle] = await db.query(
    `
    SELECT id, titre, description, date_publication, page_id, type
    FROM contenu
    WHERE page_id = ? AND type = 'realisation_title'
    LIMIT 1
    `,
    [pageId]
  );
  const title = rowsTitle?.[0] || null;

  // 2) Liste
  const [rowsList] = await db.query(
    `
    SELECT id, titre, description, date_publication, page_id, type
    FROM contenu
    WHERE page_id = ? AND type = 'realisation_stats'
    ORDER BY id ASC
    `,
    [pageId]
  );
  const list = rowsList || [];

  // 3) Images liées aux items
  let images = [];
  const ids = list.map((r) => r.id);
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    const [rowsImages] = await db.query(
      `
      SELECT contenu_id, image_url, alt
      FROM ContenuImage
      WHERE contenu_id IN (${placeholders})
      `,
      ids
    );
    images = rowsImages || [];
  }

  return { title, list, images };
}

/**
 * Bulk update du titre + items
 * Attendu: {
 *   realisationTitle: { id, titre, description, date_publication? },
 *   realisationList: [
 *     { id, titre, description, image_url?, alt?, date_publication? }, ...
 *   ]
 * }
 * - Met à jour le texte dans `contenu`
 * - Upsert l'image dans `ContenuImage` (INSERT/UPDATE/DELETE selon presence de image_url)
 */
export const updateRealisation = async ({ realisationTitle, realisationList }) => {
  try {
    const formattedDate = realisationTitle?.date_publication
      ? formatDateForMySQL(realisationTitle.date_publication)
      : formatDateForMySQL(new Date());

    // --- Title (contenu)
    await db.query(
      `
      UPDATE contenu
      SET titre = ?, description = ?, date_publication = ?
      WHERE id = ?;
      `,
      [
        realisationTitle.titre,
        realisationTitle.description ?? null,
        formattedDate,
        realisationTitle.id,
      ]
    );

    // --- Items
    const updateItems = (realisationList || []).map(async (item) => {
      const itemDate = item?.date_publication
        ? formatDateForMySQL(item.date_publication)
        : formatDateForMySQL(new Date());

      // 1) Texte dans `contenu`
      await db.query(
        `
        UPDATE contenu
        SET titre = ?, description = ?, date_publication = ?
        WHERE id = ?;
        `,
        [
          item.titre,
          item.description ?? null,
          itemDate,
          item.id,
        ]
      );

      // 2) Upsert image dans `ContenuImage`
      const url = (item.image_url || "").trim();
      const alt = (item.alt || "").trim();

      const [existingRows] = await db.query(
        `SELECT id FROM ContenuImage WHERE contenu_id = ? LIMIT 1`,
        [item.id]
      );
      const current = existingRows?.[0] || null;

      if (!url) {
        // pas d'URL → supprimer s'il existe
        if (current?.id) {
          await db.query(`DELETE FROM ContenuImage WHERE id = ?`, [current.id]);
        }
      } else if (current?.id) {
        await db.query(
          `UPDATE ContenuImage SET image_url = ?, alt = ? WHERE id = ?`,
          [url, alt || null, current.id]
        );
      } else {
        await db.query(
          `INSERT INTO ContenuImage (contenu_id, image_url, alt) VALUES (?, ?, ?)`,
          [item.id, url, alt || null]
        );
      }
    });

    await Promise.all(updateItems);

    return {
      message: "Section Réalisations mise à jour avec succès.",
      updatedTitle: realisationTitle,
      updatedList: realisationList,
    };
  } catch (error) {
    console.error("[ERROR] updateRealisationComponent:", error?.message || error);
    throw error;
  }
};

/**
 * Suppression d’un item (et de ses images liées).
 */
export const deleteRealisation = async (id) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(`DELETE FROM ContenuImage WHERE contenu_id = ?`, [id]);
    await connection.query(`DELETE FROM contenu WHERE id = ?`, [id]);

    await connection.commit();
    return { message: "deleteRealisation supprimé avec succès." };
  } catch (error) {
    await connection.rollback();
    console.error("[ERROR] deleteRealisation:", error?.message || error);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Création d’un item (type: 'realisation_stats')
 * Attendu: { titre, description, page_id }
 */
export async function createRealisation({ titre, description, page_id }) {
  const formattedDate = formatDateForMySQL(new Date());
  const [result] = await db.query(
    `
    INSERT INTO contenu (type, titre, description, date_publication, page_id)
    VALUES (?, ?, ?, ?, ?)
    `,
    ["realisation_stats", titre, description, formattedDate, page_id]
  );

  return {
    id: result.insertId,
    titre,
    description,
    type: "realisation_stats",
    date_publication: formattedDate,
    page_id,
  };
}
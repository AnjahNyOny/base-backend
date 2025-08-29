// services/clientLogoComponentService.js
import db from "../config/db.js";
import { formatDateForMySQL } from "../utils/dateUtils.js";

/**
 * GET agrégé par page_id — comme les autres composants avec images:
 * Renvoie { title, list } et chaque item de `list` inclut image_url, alt.
 */
export async function getClientLogoByPageId(pageId) {
  // 1) Titre
  const [rowsTitle] = await db.query(
    `
    SELECT id, titre, description, date_publication, page_id, type
    FROM contenu
    WHERE page_id = ? AND type = 'logo_title'
    LIMIT 1
    `,
    [pageId]
  );
  const title = rowsTitle?.[0] || null;

  // 2) Liste + images (LEFT JOIN ContenuImage)
  const [rowsList] = await db.query(
    `
    SELECT
      c.id,
      c.titre,
      c.description,
      c.date_publication,
      c.page_id,
      c.type,
      ci.image_url,
      ci.alt
    FROM contenu c
    LEFT JOIN ContenuImage ci ON ci.contenu_id = c.id
    WHERE c.page_id = ? AND c.type = 'logo_list'
    ORDER BY c.id ASC
    `,
    [pageId]
  );
  const list = rowsList || [];

  return { title, list };
}

/**
 * Bulk update (titre + items texte) + upsert des images dans ContenuImage.
 * Attendu: {
 *   partnerTitle: { id, titre, description, date_publication? },
 *   logoList: [{ id, titre, description, image_url?, alt?, date_publication? }, ...]
 * }
 */
export const updateClientLogoComponent = async ({ partnerTitle, logoList }) => {
  try {
    // -- Update du titre (table contenu)
    const formattedDate =
      partnerTitle?.date_publication
        ? formatDateForMySQL(partnerTitle.date_publication)
        : formatDateForMySQL(new Date());

    await db.query(
      `
      UPDATE contenu
      SET titre = ?, description = ?, date_publication = ?
      WHERE id = ?;
      `,
      [partnerTitle.titre, partnerTitle.description ?? null, formattedDate, partnerTitle.id]
    );

    // -- Update de chaque item texte + upsert image
    for (const item of logoList || []) {
      const itemDate =
        item?.date_publication
          ? formatDateForMySQL(item.date_publication)
          : formatDateForMySQL(new Date());

      // 1) Texte dans contenu
      await db.query(
        `
        UPDATE contenu
        SET titre = ?, description = ?, date_publication = ?
        WHERE id = ?;
        `,
        [item.titre, item.description ?? null, itemDate, item.id]
      );

      // 2) Image dans ContenuImage (upsert)
      const url = (item.image_url || "").trim();
      const alt = (item.alt || "").trim();

      const [rowsImg] = await db.query(
        `SELECT id FROM ContenuImage WHERE contenu_id = ? LIMIT 1`,
        [item.id]
      );
      const current = rowsImg?.[0];

      if (!url) {
        // pas d'URL => delete si existante
        if (current?.id) {
          await db.query(`DELETE FROM ContenuImage WHERE id = ?`, [current.id]);
        }
      } else {
        if (current?.id) {
          // update
          await db.query(
            `UPDATE ContenuImage SET image_url = ?, alt = ? WHERE id = ?`,
            [url, alt || null, current.id]
          );
        } else {
          // create
          await db.query(
            `INSERT INTO ContenuImage (contenu_id, image_url, alt) VALUES (?, ?, ?)`,
            [item.id, url, alt || null]
          );
        }
      }
    }

    return {
      message: "Section Client Logo mise à jour avec succès.",
      updatedTitle: partnerTitle,
      updatedList: logoList,
    };
  } catch (error) {
    console.error("[ERROR] updateClientLogoComponent:", error.message);
    throw error;
  }
};

/**
 * Suppression d’un item (et de ses images liées).
 */
export const deleteClientLogoComponent = async (id) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(`DELETE FROM ContenuImage WHERE contenu_id = ?`, [id]);
    await connection.query(`DELETE FROM contenu WHERE id = ?`, [id]);

    await connection.commit();
    return { message: "deleteClientLogoComponent supprimé avec succès." };
  } catch (error) {
    await connection.rollback();
    console.error("[ERROR] deleteClientLogoComponent:", error.message);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Création d’un item (une ligne 'logo_list')
 * Attendu: { titre, description, page_id }
 */
export async function createClientLogoComponent({ titre, description, page_id }) {
  const formattedDate = formatDateForMySQL(new Date());

  const [result] = await db.query(
    `
    INSERT INTO contenu (type, titre, description, date_publication, page_id)
    VALUES (?, ?, ?, ?, ?)
    `,
    ["logo_list", titre, description ?? null, formattedDate, page_id]
  );

  return {
    id: result.insertId,
    titre,
    description: description ?? null,
    type: "logo_list",
    date_publication: formattedDate,
    page_id,
  };
}
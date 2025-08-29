// services/qualityCommitmentService.js
import db from "../config/db.js";
import { formatDateForMySQL } from "../utils/dateUtils.js";

/**
 * GET agrégé par page_id
 * Renvoie { title, list, images }
 * - title: contenu.type = 'quality_commitment_title'
 * - list : contenu.type = 'quality_commitment'
 * - images: ContenuImage (contenu_id, image_url, alt) pour les items
 */
export async function getQualityCommitmentByPageId(pageId) {
  // 1) Titre
  const [rowsTitle] = await db.query(
    `
    SELECT id, titre, description, date_publication, page_id, type
    FROM contenu
    WHERE page_id = ? AND type = 'quality_commitment_title'
    LIMIT 1
    `,
    [pageId]
  );
  const title = rowsTitle?.[0] || null;

  // 2) Liste d'items
  const [rowsList] = await db.query(
    `
    SELECT id, titre, description, date_publication, page_id, type
    FROM contenu
    WHERE page_id = ? AND type = 'quality_commitment'
    ORDER BY id ASC
    `,
    [pageId]
  );
  const list = rowsList || [];

  // 3) Images liées aux items
  let images = [];
  const ids = list.map((r) => r.id);
  if (ids.length) {
    const [rowsImages] = await db.query(
      `
      SELECT contenu_id, image_url, alt
      FROM ContenuImage
      WHERE contenu_id IN (${ids.map(() => "?").join(",")})
      `,
      ids
    );
    images = rowsImages || [];
  }

  return { title, list, images };
}

/**
 * Bulk update (titre + items texte) + upsert des images dans ContenuImage.
 * Attendu: {
 *   qualityCommitmentTitle: {id, titre, description, date_publication?},
 *   qualityCommitmentList: [{id, titre, description, image_url?, alt?, date_publication?}, ...]
 * }
 */
export const updateQualityCommitment = async ({
  qualityCommitmentTitle,
  qualityCommitmentList,
}) => {
  try {
    // -- Update du Titre (table contenu)
    const formattedDate = qualityCommitmentTitle?.date_publication
      ? formatDateForMySQL(qualityCommitmentTitle.date_publication)
      : formatDateForMySQL(new Date());

    await db.query(
      `
      UPDATE contenu
      SET titre = ?, description = ?, date_publication = ?
      WHERE id = ?;
      `,
      [
        qualityCommitmentTitle.titre,
        qualityCommitmentTitle.description ?? null,
        formattedDate,
        qualityCommitmentTitle.id,
      ]
    );

    // -- Update des items + upsert image (ContenuImage)
    for (const item of qualityCommitmentList || []) {
      const itemDate = item?.date_publication
        ? formatDateForMySQL(item.date_publication)
        : formatDateForMySQL(new Date());

      // 1) Texte dans contenu (PAS d'image ici)
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

      // Existe déjà ?
      const [rowsImg] = await db.query(
        `SELECT id FROM ContenuImage WHERE contenu_id = ? LIMIT 1`,
        [item.id]
      );
      const current = rowsImg?.[0];

      if (!url) {
        // aucune URL => supprime l’éventuelle image liée
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
      message: "Section Quality Commitment mise à jour avec succès.",
      updatedTitle: qualityCommitmentTitle,
      updatedList: qualityCommitmentList,
    };
  } catch (error) {
    console.error("[ERROR] updateQualityCommitment:", error.message);
    throw error;
  }
};

/**
 * Suppression d’un item (et de ses images liées).
 */
export const deleteQualityCommitment = async (id) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(`DELETE FROM ContenuImage WHERE contenu_id = ?`, [id]);
    await connection.query(`DELETE FROM contenu WHERE id = ?`, [id]);

    await connection.commit();
    return { message: "Élément supprimé avec succès." };
  } catch (error) {
    await connection.rollback();
    console.error("[ERROR] deleteQualityCommitment:", error.message);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Création d’un item (ligne 'quality_commitment')
 * Attendu: { titre, description, page_id }
 */
export async function createQualityCommitment({ titre, description, page_id }) {
  const formattedDate = formatDateForMySQL(new Date());

  const [result] = await db.query(
    `
    INSERT INTO contenu (type, titre, description, date_publication, page_id)
    VALUES (?, ?, ?, ?, ?)
    `,
    ["quality_commitment", titre, description ?? null, formattedDate, page_id]
  );

  return {
    id: result.insertId,
    titre,
    description: description ?? null,
    type: "quality_commitment",
    date_publication: formattedDate,
    page_id,
  };
}
// services/qualityCommitmentService.js
import db from "../config/db.js";
import { formatDateForMySQL } from "../utils/dateUtils.js";

/** Types */
const QC_TITLE = "quality_commitment_title";
const QC_ITEM  = "quality_commitment";

/**
 * GET agrégé par page_id
 * Renvoie { title, list }
 * - title: contenu.type = 'quality_commitment_title' + icon_alt (depuis ContenuImage)
 * - list : contenu.type = 'quality_commitment' (pas d'icône par item)
 */
export async function getQualityCommitmentByPageId(pageId) {
  // 1) Titre
  const [rowsTitle] = await db.query(
    `
    SELECT id, titre, description, date_publication, page_id, type
    FROM contenu
    WHERE page_id = ? AND type = ?
    LIMIT 1
    `,
    [pageId, QC_TITLE]
  );
  const title = rowsTitle?.[0] || null;

  // 1.b) Icône du titre (ContenuImage.icon_alt)
  let icon_alt = "";
  if (title?.id) {
    const [rowsIcon] = await db.query(
      `SELECT icon_alt FROM ContenuImage WHERE contenu_id = ? LIMIT 1`,
      [title.id]
    );
    icon_alt = rowsIcon?.[0]?.icon_alt || "";
  }

  // 2) Liste d'items (sans icônes)
  const [rowsList] = await db.query(
    `
    SELECT id, titre, description, date_publication, page_id, type
    FROM contenu
    WHERE page_id = ? AND type = ?
    ORDER BY id ASC
    `,
    [pageId, QC_ITEM]
  );
  const list = rowsList || [];

  return { title: title ? { ...title, icon_alt } : null, list };
}

/**
 * Bulk update (titre + items texte) + upsert de l’icône du titre (icon_alt)
 * Attendu: {
 *   qualityCommitmentTitle: {id, titre, description, date_publication?, icon_alt?},
 *   qualityCommitmentList: [{id, titre, description, date_publication?}, ...]
 * }
 */
export const updateQualityCommitment = async ({
  qualityCommitmentTitle,
  qualityCommitmentList,
}) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // -- Update du Titre (table contenu)
    const formattedDate = qualityCommitmentTitle?.date_publication
      ? formatDateForMySQL(qualityCommitmentTitle.date_publication)
      : formatDateForMySQL(new Date());

    const [resTitle] = await conn.query(
      `
      UPDATE contenu
         SET titre = ?, description = ?, date_publication = ?
       WHERE id = ? AND type = ?
      `,
      [
        (qualityCommitmentTitle?.titre ?? "").trim(),
        qualityCommitmentTitle?.description ?? null,
        formattedDate,
        qualityCommitmentTitle?.id,
        QC_TITLE,
      ]
    );
    if (!resTitle.affectedRows) {
      throw Object.assign(new Error("Titre introuvable ou mauvais type."), { status: 404 });
    }

    // -- Upsert de l'icône du titre (ContenuImage.icon_alt)
    const token = (qualityCommitmentTitle?.icon_alt || "").trim();
    // ⚠️ on conserve image_url/alt vides car on n'utilise que l'icône
    const [rowImg] = await conn.query(
      `SELECT id FROM ContenuImage WHERE contenu_id = ? LIMIT 1`,
      [qualityCommitmentTitle.id]
    );
    const cur = rowImg?.[0];
    if (!token) {
      if (cur?.id) await conn.query(`DELETE FROM ContenuImage WHERE id = ?`, [cur.id]);
    } else {
      if (cur?.id) {
        await conn.query(
          `UPDATE ContenuImage SET icon_alt = ?, image_url = '', alt = '' WHERE id = ?`,
          [token, cur.id]
        );
      } else {
        await conn.query(
          `INSERT INTO ContenuImage (contenu_id, icon_alt, image_url, alt) VALUES (?, ?, '', '')`,
          [qualityCommitmentTitle.id, token]
        );
      }
    }

    // -- Update des items (texte uniquement)
    for (const item of qualityCommitmentList || []) {
      const itemDate = item?.date_publication
        ? formatDateForMySQL(item.date_publication)
        : formatDateForMySQL(new Date());

      await conn.query(
        `
        UPDATE contenu
           SET titre = ?, description = ?, date_publication = ?
         WHERE id = ? AND type = ?
        `,
        [
          (item?.titre ?? "").trim(),
          item?.description ?? null,
          itemDate,
          item?.id,
          QC_ITEM,
        ]
      );
    }

    await conn.commit();
    return {
      message: "Quality Commitment mis à jour avec succès.",
      updatedTitle: qualityCommitmentTitle,
      updatedList: qualityCommitmentList,
    };
  } catch (error) {
    await conn.rollback();
    console.error("[ERROR] updateQualityCommitment:", error?.message || error);
    throw error;
  } finally {
    conn.release();
  }
};

/** Suppression d’un item (et de ses images liées) */
export const deleteQualityCommitment = async (id) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(`DELETE FROM ContenuImage WHERE contenu_id = ?`, [id]);
    await connection.query(`DELETE FROM contenu WHERE id = ? AND type = ?`, [id, QC_ITEM]);
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

/** Création d’un item */
export async function createQualityCommitment({ titre, description, page_id }) {
  const formattedDate = formatDateForMySQL(new Date());
  const [result] = await db.query(
    `
    INSERT INTO contenu (type, titre, description, date_publication, page_id)
    VALUES (?, ?, ?, ?, ?)
    `,
    [QC_ITEM, (titre ?? "").trim(), description ?? null, formattedDate, Number(page_id)]
  );

  return {
    id: result.insertId,
    titre,
    description: description ?? null,
    type: QC_ITEM,
    date_publication: formattedDate,
    page_id: Number(page_id),
  };
}

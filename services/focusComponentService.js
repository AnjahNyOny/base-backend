// services/focusComponentService.js
import db from "../config/db.js";
import { formatDateForMySQL } from "../utils/dateUtils.js";

/** Types dédiés à la section */
const FOCUS_TITLE = "focusComponent_title";
const FOCUS_ITEM  = "focusComponent_list";

/** GET agrégé par page_id (→ expose aussi icon_alt) */
export const getFocusComponentByPage = async (page_id) => {
  const conn = await db.getConnection();
  try {
    // Titre
    const [titleRows] = await conn.query(
      `SELECT id, type, titre, description, date_publication, page_id
         FROM contenu
        WHERE type = ? AND page_id = ?
        LIMIT 1`,
      [FOCUS_TITLE, page_id]
    );
    const focusTitle = titleRows[0] || null;

    // Items
    const [itemRows] = await conn.query(
      `SELECT id, type, titre, description, date_publication, page_id
         FROM contenu
        WHERE type = ? AND page_id = ?
        ORDER BY id ASC`,
      [FOCUS_ITEM, page_id]
    );

    // Images liées (⚠️ table: ContenuImage + sélection icon_alt)
    let images = [];
    if (itemRows.length) {
      const ids = itemRows.map(r => r.id);
      const [imgRows] = await conn.query(
        `SELECT id, contenu_id, image_url, alt, icon_alt
           FROM ContenuImage
          WHERE contenu_id IN (?)`,
        [ids]
      );
      images = imgRows || [];
    }

    // Associer image/icône à chaque item
    const focusList = itemRows.map(it => {
      const img = images.find(i => i.contenu_id === it.id);
      return {
        ...it,
        image_url: img?.image_url || null, // image optionnelle
        alt: img?.alt || "",               // alt descriptif de l'image
        icon_alt: img?.icon_alt || null,   // 🎯 token d’icône "icon:fa-solid fa-…"
      };
    });

    return { focusTitle, focusList };
  } finally {
    conn.release();
  }
};

/** POST: créer un item (ligne contenu) */
export const createFocusComponent = async ({ titre, description, page_id }) => {
  const formattedDate = formatDateForMySQL(new Date());
  const safeTitre = String(titre || "").trim();
  const safeDesc  = String(description || "").trim();

  const insertQuery = `
    INSERT INTO contenu (type, titre, description, date_publication, page_id)
    VALUES (?, ?, ?, ?, ?)
  `;
  const values = [FOCUS_ITEM, safeTitre, safeDesc, formattedDate, Number(page_id)];
  const [result] = await db.query(insertQuery, values);

  return {
    id: result.insertId,
    type: FOCUS_ITEM,
    titre: safeTitre,
    description: safeDesc,
    date_publication: formattedDate,
    page_id: Number(page_id),
  };
};

/** PUT bulk: mettre à jour titre + items existants (sans images) */
export const updateFocusComponent = async ({ focusTitle, focusList }) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // --- Titre ---
    const titleDate = focusTitle?.date_publication
      ? formatDateForMySQL(focusTitle.date_publication)
      : formatDateForMySQL(new Date());

    const [titleRes] = await conn.query(
      `UPDATE contenu
          SET titre = ?, description = ?, date_publication = ?
        WHERE id = ? AND type = ?`,
      [
        (focusTitle?.titre || "").trim(),
        (focusTitle?.description || "").trim(),
        titleDate,
        focusTitle?.id,
        FOCUS_TITLE,
      ]
    );
    if (!titleRes.affectedRows) {
      throw Object.assign(new Error("Focus title introuvable ou mauvais type."), { status: 404 });
    }

    // --- Items ---
    for (const item of (focusList || [])) {
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
          FOCUS_ITEM,
        ]
      );
      if (!itemRes.affectedRows) {
        throw Object.assign(new Error(`Focus #${item?.id} introuvable ou mauvais type.`), { status: 404 });
      }
    }

    await conn.commit();
    return {
      message: "Focus mis à jour avec succès.",
      updatedTitle: focusTitle,
      updatedList: focusList,
    };
  } catch (err) {
    await (conn?.rollback?.() ?? Promise.resolve());
    console.error("[ERROR] updateFocusComponent:", err?.message || err);
    throw err;
  } finally {
    conn.release();
  }
};

/** DELETE: supprimer un item + ses images/icônes */
export const deleteFocusComponent = async (id) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`DELETE FROM ContenuImage WHERE contenu_id = ?`, [id]);
    await conn.query(`DELETE FROM contenu WHERE id = ? AND type = ?`, [id, FOCUS_ITEM]);

    await conn.commit();
    return { message: "Focus supprimé avec succès." };
  } catch (err) {
    await conn.rollback();
    console.error("[ERROR] deleteFocusComponent:", err?.message || err);
    throw err;
  } finally {
    conn.release();
  }
};

// services/whyChooseUsService.js
import db from "../config/db.js";
import { formatDateForMySQL } from "../utils/dateUtils.js";

export const updateWhyChooseUs = async ({ whyChooseUsTitle, whyChooseUsList }) => {
  try {
    const formattedDate = whyChooseUsTitle?.date_publication
      ? formatDateForMySQL(whyChooseUsTitle.date_publication)
      : formatDateForMySQL(new Date());

    // Titre
    await db.query(
      `
      UPDATE contenu
      SET titre = ?, description = ?, date_publication = ?
      WHERE id = ?;
      `,
      [
        (whyChooseUsTitle?.titre ?? "").trim(),
        (whyChooseUsTitle?.description ?? null),
        formattedDate,
        whyChooseUsTitle?.id,
      ]
    );

    // Items
    const updates = (whyChooseUsList || []).map(async (item) => {
      const itemDate = item?.date_publication
        ? formatDateForMySQL(item.date_publication)
        : formatDateForMySQL(new Date());

      await db.query(
        `
        UPDATE contenu
        SET titre = ?, description = ?, date_publication = ?
        WHERE id = ?;
        `,
        [
          (item?.titre ?? "").trim(),
          (item?.description ?? null),
          itemDate,
          item?.id,
        ]
      );
    });
    await Promise.all(updates);

    return {
      message: "Section Why Choose Us mise à jour avec succès.",
      updatedTitle: whyChooseUsTitle,
      updatedList: whyChooseUsList,
    };
  } catch (error) {
    console.error("[SRV Why] updateWhyChooseUs error:", error?.message || error);
    throw error;
  }
};

export const deleteWhyChooseUs = async (id) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`DELETE FROM ContenuImage WHERE contenu_id = ?`, [id]);
    await conn.query(`DELETE FROM contenu WHERE id = ?`, [id]);

    await conn.commit();
    return { message: "Why Choose Us supprimé avec succès." };
  } catch (error) {
    await conn.rollback();
    console.error("[SRV Why] deleteWhyChooseUs error:", error?.message || error);
    throw error;
  } finally {
    conn.release();
  }
};

export async function createWhyChooseUs({ titre, description, page_id }) {
  const formattedDate = formatDateForMySQL(new Date());
  const type = "why_choose_us";

  const [result] = await db.query(
    `
    INSERT INTO contenu (type, titre, description, date_publication, page_id)
    VALUES (?, ?, ?, ?, ?)
    `,
    [type, (titre ?? "").trim(), (description ?? "").trim(), formattedDate, Number(page_id)]
  );

  return {
    id: result.insertId,
    titre,
    description,
    type,
    date_publication: formattedDate,
    page_id: Number(page_id),
  };
}

// GET agrégé, avec override optionnel de page_id
export async function getWhyChooseUsByLang(langue = "fr", pageIdOverride = null) {
  // 1) Résoudre page_id
  let pageId = pageIdOverride;
  if (!pageId) {
    const [rowsPage] = await db.query(
      `
      SELECT p.id
      FROM page p
      INNER JOIN site s ON p.site_id = s.id
      WHERE s.langue_active = ?
        AND (p.slug = 'about' OR p.titre IN ('À propos','About'))
      LIMIT 1
      `,
      [langue]
    );
    const pageRow = rowsPage?.[0];
    if (!pageRow) return { title: null, list: [], images: [] };
    pageId = pageRow.id;
  }

  // 2) Titre
  const [rowsTitle] = await db.query(
    `
    SELECT id, titre, description, date_publication, page_id, type
    FROM contenu
    WHERE page_id = ? AND type = 'why_choose_us_title'
    LIMIT 1
    `,
    [pageId]
  );
  const title = rowsTitle?.[0] || null;

  // 3) Liste
  const [rowsList] = await db.query(
    `
    SELECT id, titre, description, date_publication, page_id, type
    FROM contenu
    WHERE page_id = ? AND type = 'why_choose_us'
    ORDER BY id ASC
    `,
    [pageId]
  );
  const list = rowsList || [];

  // 4) Images associées (icônes) — inclure icon_alt
  let images = [];
  if (list.length) {
    const ids = list.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const [rowsImages] = await db.query(
      `
      SELECT id, contenu_id, image_url, alt, icon_alt
      FROM ContenuImage
      WHERE contenu_id IN (${placeholders})
      `,
      ids
    );
    images = rowsImages || [];
  }

  return { title, list, images };
}

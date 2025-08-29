import db from "../config/db.js";

export const fetchPageIdByLangAndSlug = async (langue, slug) => {
  const [rows] = await db.query(
    `
    SELECT p.id
    FROM page p
    JOIN site s ON p.site_id = s.id
    WHERE p.slug = ? AND s.langue_active = ?
    LIMIT 1
    `,
    [slug, langue]
  );

  return rows.length > 0 ? rows[0].id : null;
};
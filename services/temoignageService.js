// services/temoignageService.js
import db from "../config/db.js";

/* -------- existant (on garde) -------- */
export const listTemoignages = async () => {
  const [rows] = await db.query(
    `SELECT id, nom, email, message, est_approuve, created_at
     FROM temoignages
     ORDER BY id DESC`
  );
  return rows;
};

export const listTemoignagesApprouves = async () => {
  const [rows] = await db.query(
    `SELECT id, nom, email, message, est_approuve, created_at
     FROM temoignages
     WHERE est_approuve = 1
     ORDER BY id DESC`
  );
  return rows;
};

export const createTemoignage = async ({ nom, email, message }) => {
  const [res] = await db.query(
    `INSERT INTO temoignages (nom, email, message, est_approuve, created_at)
     VALUES (?, ?, ?, 0, NOW())`,
    [nom, email || null, message]
  );
  return res.insertId;
};

export const approveTemoignage = async (id) => {
  const [res] = await db.query(`UPDATE temoignages SET est_approuve = 1 WHERE id = ?`, [id]);
  return res.affectedRows > 0;
};

export const unapproveTemoignage = async (id) => {
  const [res] = await db.query(`UPDATE temoignages SET est_approuve = 0 WHERE id = ?`, [id]);
  return res.affectedRows > 0;
};

export const deleteTemoignage = async (id) => {
  const [res] = await db.query(`DELETE FROM temoignages WHERE id = ?`, [id]);
  return res.affectedRows > 0;
};

/* -------- AJOUTS -------- */

// Recherche + filtres + pagination + counts
export const searchTemoignages = async ({
  status = "all",
  q = "",
  page = 1,
  pageSize = 20,
}) => {
  const where = [];
  const params = [];

  if (status === "pending") {
    where.push("est_approuve = 0");
  } else if (status === "approved") {
    where.push("est_approuve = 1");
  }

  if (q) {
    const like = `%${q}%`;
    where.push("(nom LIKE ? OR email LIKE ? OR message LIKE ?)");
    params.push(like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.max(1, Number(pageSize) || 20);
  const offset = Math.max(0, (Number(page) || 1) - 1) * limit;

  // Rows paginés
  const [rows] = await db.query(
    `
    SELECT id, nom, email, message, est_approuve, created_at
    FROM temoignages
    ${whereSql}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  // Counts (globaux, pas affectés par q)
  const [[counts]] = await db.query(`
    SELECT
      SUM(est_approuve = 0) AS pending,
      SUM(est_approuve = 1) AS approved,
      COUNT(*) AS allCount
    FROM temoignages
  `);

  return {
    rows,
    counts: {
      pending: Number(counts.pending) || 0,
      approved: Number(counts.approved) || 0,
      all: Number(counts.allCount) || 0,
    },
  };
};

// Update (édition inline admin)
export const updateTemoignage = async (id, { nom, email, message }) => {
  const [res] = await db.query(
    `UPDATE temoignages SET nom = ?, email = ?, message = ? WHERE id = ?`,
    [nom, email || null, message, id] // Ajout de || null ici
  );
  return res.affectedRows > 0;
};

// Bulk helpers (optionnels, pratiques)
export const approveMany = async (ids = []) => {
  if (!ids.length) return 0;
  const [res] = await db.query(`UPDATE temoignages SET est_approuve = 1 WHERE id IN (?)`, [ids]);
  return res.affectedRows || 0;
};

export const unapproveMany = async (ids = []) => {
  if (!ids.length) return 0;
  const [res] = await db.query(`UPDATE temoignages SET est_approuve = 0 WHERE id IN (?)`, [ids]);
  return res.affectedRows || 0;
};

export const deleteMany = async (ids = []) => {
  if (!ids.length) return 0;
  const [res] = await db.query(`DELETE FROM temoignages WHERE id IN (?)`, [ids]);
  return res.affectedRows || 0;
};

/* -------- UI existant -------- */
export const getTemoignageUIByLangue = async (langue) => {
  const [rows] = await db.query(
    `
    SELECT c.titre, c.description
    FROM contenu c
    JOIN page p ON c.page_id = p.id
    JOIN site s ON p.site_id = s.id
    WHERE c.type = 'temoignage_ui' AND s.langue_active = ?
    ORDER BY c.id ASC
    `,
    [langue]
  );
  const ui = {};
  for (const r of rows) {
    const k = (r.titre || "").toLowerCase().trim();
    if (k) ui[k] = r.description || "";
  }
  return ui;
};

// === GET titre/description par langue ===
export const getTemoignageTitleByLangue = async (langue = "fr") => {
  const [rows] = await db.query(
    `
    SELECT c.id, c.page_id, c.titre, c.description
    FROM contenu c
    JOIN page p ON c.page_id = p.id
    JOIN site s ON p.site_id = s.id
    WHERE c.type = 'temoignage_title' AND s.langue_active = ?
    ORDER BY c.id ASC
    LIMIT 1
    `,
    [langue]
  );
  return rows[0] || null;
};

// === UPSERT titre/description par langue ===
export const saveTemoignageTitle = async (langue = "fr", { titre = "", description = "" } = {}) => {
  // 1) Existe déjà ?
  const existing = await getTemoignageTitleByLangue(langue);
  if (existing?.id) {
    const [res] = await db.query(
      `UPDATE contenu SET titre = ?, description = ? WHERE id = ?`,
      [titre, description, existing.id]
    );
    return { id: existing.id, updated: res.affectedRows > 0 };
  }

  // 2) Sinon, trouver un page_id pour cette langue
  const [[pageRow]] = await db.query(
    `
    SELECT p.id AS page_id
    FROM page p
    JOIN site s ON p.site_id = s.id
    WHERE s.langue_active = ?
    ORDER BY p.id ASC
    LIMIT 1
    `,
    [langue]
  );
  const pageId = pageRow?.page_id;
  if (!pageId) {
    // Impossible d'insérer sans page
    return { id: null, created: false };
  }

  // 3) Insérer
  const [ins] = await db.query(
    `INSERT INTO contenu (page_id, type, titre, description) VALUES (?, 'temoignage_title', ?, ?)`,
    [pageId, titre, description]
  );
  return { id: ins.insertId, created: true };
};
// backend/services/footerService.js
import db from "../config/db.js";

/** Récupère TOUT le footer pour une langue via page 'footer' */
export const getFooterContentByLang = async (pageId) => {
  // main
  const [mainRows] = await db.query(
    `SELECT id, titre, description FROM contenu WHERE type='footer_main' AND page_id=? LIMIT 1`,
    [pageId]
  );
  const main = mainRows[0] || null;

  // links
  const [links] = await db.query(
    `SELECT id, titre, description FROM contenu WHERE type='footer_link' AND page_id=? ORDER BY id ASC`,
    [pageId]
  );

  // socials
  const [socials] = await db.query(
    `SELECT id, titre, description FROM contenu WHERE type='footer_social' AND page_id=? ORDER BY id ASC`,
    [pageId]
  );

  // contact
  const [contact] = await db.query(
    `SELECT id, titre, description FROM contenu WHERE type='footer_contact' AND page_id=? ORDER BY id ASC`,
    [pageId]
  );

  // note
  const [noteRows] = await db.query(
    `SELECT id, description FROM contenu WHERE type='footer_note' AND page_id=? LIMIT 1`,
    [pageId]
  );
  const note = noteRows[0] || null;

  return { main, links, socials, contact, note };
};

/** MAIN */
export const upsertFooterMain = async (pageId, { id, titre, description }) => {
  const now = new Date();
  if (id) {
    const [r] = await db.query(
      `UPDATE contenu SET titre=?, description=?, date_publication=? 
       WHERE id=? AND type='footer_main'`,
      [titre, description ?? "", now, id]
    );
    return r.affectedRows > 0 ? id : null;
  }
  const [r] = await db.query(
    `INSERT INTO contenu (titre, description, type, page_id, date_publication)
     VALUES (?, ?, 'footer_main', ?, ?)`,
    [titre, description ?? "", pageId, now]
  );
  return r.insertId;
};

export const deleteFooterMain = async (id) => {
  await db.query(`DELETE FROM contenu WHERE id=? AND type='footer_main'`, [id]);
};

/** LINKS */
export const createFooterLink = async (pageId, { titre, description }) => {
  const now = new Date();
  const [r] = await db.query(
    `INSERT INTO contenu (titre, description, type, page_id, date_publication)
     VALUES (?, ?, 'footer_link', ?, ?)`,
    [titre, description ?? "", pageId, now]
  );
  return r.insertId;
};

export const updateFooterLink = async (id, { titre, description }) => {
  const now = new Date();
  const [r] = await db.query(
    `UPDATE contenu SET titre=?, description=?, date_publication=? 
     WHERE id=? AND type='footer_link'`,
    [titre, description ?? "", now, id]
  );
  return r.affectedRows > 0;
};

export const deleteFooterLink = async (id) => {
  await db.query(`DELETE FROM contenu WHERE id=? AND type='footer_link'`, [id]);
};

/** SOCIALS */
export const createFooterSocial = async (pageId, { titre, description }) => {
  const now = new Date();
  const [r] = await db.query(
    `INSERT INTO contenu (titre, description, type, page_id, date_publication)
     VALUES (?, ?, 'footer_social', ?, ?)`,
    [titre, description ?? "", pageId, now]
  );
  return r.insertId;
};

export const updateFooterSocial = async (id, { titre, description }) => {
  const now = new Date();
  const [r] = await db.query(
    `UPDATE contenu SET titre=?, description=?, date_publication=? 
     WHERE id=? AND type='footer_social'`,
    [titre, description ?? "", now, id]
  );
  return r.affectedRows > 0;
};

export const deleteFooterSocial = async (id) => {
  await db.query(`DELETE FROM contenu WHERE id=? AND type='footer_social'`, [id]);
};

/** CONTACT */
export const createFooterContact = async (pageId, { titre, description }) => {
  // titre attendu: address | email | phone
  const now = new Date();
  const [r] = await db.query(
    `INSERT INTO contenu (titre, description, type, page_id, date_publication)
     VALUES (?, ?, 'footer_contact', ?, ?)`,
    [titre, description ?? "", pageId, now]
  );
  return r.insertId;
};

export const updateFooterContact = async (id, { titre, description }) => {
  const now = new Date();
  const [r] = await db.query(
    `UPDATE contenu SET titre=?, description=?, date_publication=? 
     WHERE id=? AND type='footer_contact'`,
    [titre, description ?? "", now, id]
  );
  return r.affectedRows > 0;
};

export const deleteFooterContact = async (id) => {
  await db.query(`DELETE FROM contenu WHERE id=? AND type='footer_contact'`, [id]);
};

/** NOTE */
export const upsertFooterNote = async (pageId, { id, description }) => {
  const now = new Date();
  if (id) {
    const [r] = await db.query(
      `UPDATE contenu SET description=?, date_publication=? 
       WHERE id=? AND type='footer_note'`,
      [description ?? "", now, id]
    );
    return r.affectedRows > 0 ? id : null;
  }
  const [r] = await db.query(
    `INSERT INTO contenu (titre, description, type, page_id, date_publication)
     VALUES ('', ?, 'footer_note', ?, ?)`,
    [description ?? "", pageId, now]
  );
  return r.insertId;
};

export const deleteFooterNote = async (id) => {
  await db.query(`DELETE FROM contenu WHERE id=? AND type='footer_note'`, [id]);
};
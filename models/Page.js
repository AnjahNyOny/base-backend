import db from '../config/db.js';

export const getPages = async (langue) => {
  const [pages] = await db.query('SELECT * FROM pages WHERE langue = ?', [langue]);
  return pages;
};

export const createPage = async (titre, description, site_id) => {
  const [result] = await db.query('INSERT INTO pages (titre, description, site_id) VALUES (?, ?, ?)', [titre, description, site_id]);
  return result.insertId;
};
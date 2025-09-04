// services/pageService.js
import db from "../config/db.js";
import { getPagesByLangue } from "../models/pageModel.js";

export const fetchPagesByLangue = async (langue) => {
  try {
    return await getPagesByLangue(langue);
  } catch (e) {
    console.error("Erreur dans fetchPagesByLangue :", e);
    throw new Error("Impossible de récupérer les pages");
  }
};

export const getPageIdByLangAndTitle = async (langue, titre) => { // existant
  const sql = `
    SELECT p.id AS page_id
    FROM page p
    JOIN site s ON p.site_id = s.id
    WHERE s.langue_active = ? AND p.titre = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [langue, titre]);
  if (!rows.length) throw new Error("Page introuvable");
  return rows[0].page_id;
};

export const getPageIdByLangAndSlug = async (langue, slug) => {  // nouveau
  const sql = `
    SELECT p.id AS page_id
    FROM page p
    JOIN site s ON p.site_id = s.id
    WHERE s.langue_active = ? AND p.slug = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [langue, slug]);
  if (!rows.length) throw new Error("Page introuvable");
  return rows[0].page_id;
};

export const getPageIdByLangAndCode = async (langue, code) => {
  const sql = `
    SELECT p.id AS page_id
    FROM page p
    JOIN site s ON s.id = p.site_id
    WHERE s.langue_active = ? AND p.code = ?
    LIMIT 1;
  `;
  const [rows] = await db.query(sql, [langue, code]);
  if (!rows.length) {
    throw new Error("Page introuvable");
  }
  return rows[0].page_id;
};

import { getPagesByLangue } from '../models/pageModel.js';
import db from "../config/db.js";

export const fetchPagesByLangue = async (langue) => {
  try {
    return await getPagesByLangue(langue);
  } catch (error) {
    console.error('Erreur dans fetchPagesByLangue :', error);
    throw new Error('Impossible de récupérer les pages'); // Message d'erreur plus clair
  }
};

export const getPageIdByLangAndTitle = async (langue, titre) => {
  const query = `
    SELECT p.id AS page_id
    FROM page p
    JOIN site s ON p.site_id = s.id
    WHERE s.langue_active = ? AND p.titre = ?
    LIMIT 1;
  `;

  const [rows] = await db.query(query, [langue, titre]);

  if (rows.length === 0) {
    throw new Error("Page introuvable");
  }

  return rows[0].page_id;
};
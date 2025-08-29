// services/contactClientService.js
import dotenv from "dotenv";
import db from "../config/db.js";

dotenv.config();

/**
 * Récupère le contenu de la page de contact via slug et langue.
 */
export const getContactContentByLangue = async (langue) => {
  const [rows] = await db.query(
    `
      SELECT c.id, c.titre, c.description, c.type
      FROM contenu c
      JOIN page p ON c.page_id = p.id
      JOIN site s ON p.site_id = s.id
      WHERE p.slug = 'contact' AND s.langue_active = ?
    `,
    [langue]
  );

  const titleRow = rows.find((r) => r.type === "contactTitle") || null;
  const labels = rows.filter((r) => r.type === "contact_label");

  return {
    id: titleRow?.id ?? null,
    titre: titleRow?.titre ?? "",
    description: titleRow?.description ?? "",
    labels,
  };
};

// Ajout du contenu principal (titre + description)
export const addContactMainContent = async (pageId, titre, description) => {
  const now = new Date();
  const [result] = await db.query(
    `INSERT INTO contenu (titre, description, type, page_id, date_publication)
     VALUES (?, ?, 'contactTitle', ?, ?)`,
    [titre, description, pageId, now]
  );
  return result.insertId;
};

// Mise à jour du contenu principal
export const updateContactMainContent = async (id, titre, description) => {
  const now = new Date();
  const [result] = await db.query(
    `UPDATE contenu
     SET titre = ?, description = ?, date_publication = ?
     WHERE id = ? AND type = 'contactTitle'`,
    [titre, description, now, id]
  );
  return result.affectedRows > 0;
};

// Suppression du contenu principal
export const deleteContactMainContent = async (id) => {
  await db.query(`DELETE FROM contenu WHERE id = ? AND type = 'contactTitle'`, [id]);
};

// Récupération des labels pour la page de contact
export const getContactLabels = async (pageId) => {
  const [result] = await db.query(
    `SELECT id, titre, description
     FROM contenu
     WHERE type = 'contact_label' AND page_id = ?
     ORDER BY id ASC`,
    [pageId]
  );
  return result;
};

// Ajout d'un nouveau label
export const addContactLabel = async (pageId, titre, description) => {
  const now = new Date();
  const [result] = await db.query(
    `INSERT INTO contenu (titre, description, type, page_id, date_publication)
     VALUES (?, ?, 'contact_label', ?, ?)`,
    [titre, description, pageId, now]
  );
  return result.insertId;
};

// Modification d’un label existant
export const updateContactLabel = async (id, titre, description) => {
  const now = new Date();
  const [result] = await db.query(
    `UPDATE contenu
     SET titre = ?, description = ?, date_publication = ?
     WHERE id = ? AND type = 'contact_label'`,
    [titre, description, now, id]
  );
  return result.affectedRows > 0;
};

// Suppression d’un label
export const deleteContactLabel = async (id) => {
  await db.query(`DELETE FROM contenu WHERE id = ? AND type = 'contact_label'`, [id]);
};


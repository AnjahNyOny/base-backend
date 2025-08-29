// services/teamSectionService.js
import db from "../config/db.js";
import { formatDateForMySQL } from "../utils/dateUtils.js";

// Types dédiés à la section
const TEAM_TITLE = "team_section_title";
const TEAM_ITEM  = "team_section";

/**
 * GET agrégé par page_id
 * Retourne { teamTitle, teamMembers, boutons: [] }
 */
export const getTeamSectionByPage = async (page_id) => {
  const conn = await db.getConnection();
  try {
    // Titre
    const [titleRows] = await conn.query(
      `SELECT id, type, titre, description, date_publication, page_id
         FROM contenu
        WHERE type = ? AND page_id = ?
        LIMIT 1`,
      [TEAM_TITLE, page_id]
    );
    const teamTitle = titleRows[0] || null;

    // Membres
    const [memberRows] = await conn.query(
      `SELECT id, type, titre, description, date_publication, page_id
         FROM contenu
        WHERE type = ? AND page_id = ?
        ORDER BY id ASC`,
      [TEAM_ITEM, page_id]
    );

    // Images liées (si utilisées)
    let images = [];
    if (memberRows.length) {
      const ids = memberRows.map((r) => r.id);
      const [imgRows] = await conn.query(
        `SELECT id, contenu_id, image_url, alt
           FROM contenuimage
          WHERE contenu_id IN (?)`,
        [ids]
      );
      images = imgRows;
    }

    // Associer image à chaque membre
    const teamMembers = memberRows.map((m) => {
      const img = images.find((i) => i.contenu_id === m.id);
      return {
        ...m,
        image_url: img?.image_url || null,
        alt: img?.alt || "",
      };
    });

    return { teamTitle, teamMembers, boutons: [] };
  } finally {
    conn.release();
  }
};

/**
 * Création d’un membre (ligne contenu + type).
 * Attendu: { titre, description, page_id }
 */
export async function createTeamMember({ titre, description, page_id }) {
  const formattedDate = formatDateForMySQL(new Date());

  const insertQuery = `
    INSERT INTO contenu (type, titre, description, date_publication, page_id)
    VALUES (?, ?, ?, ?, ?)
  `;

  const values = [TEAM_ITEM, String(titre || "").trim(), String(description || "").trim(), formattedDate, Number(page_id)];
  const [result] = await db.query(insertQuery, values);

  return {
    id: result.insertId,
    titre: String(titre || "").trim(),
    description: String(description || "").trim(),
    type: TEAM_ITEM,
    date_publication: formattedDate,
    page_id: Number(page_id),
  };
}

/**
 * Met à jour le titre + chaque membre existant (bulk) avec contrôle de type.
 * Attendu: { teamTitle: {id, titre, description, date_publication?}, teamMembers: [{id, titre, description, date_publication?}, ...] }
 */
export const updateTeamSection = async ({ teamTitle, teamMembers }) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // --- Titre ---
    const titleDate = teamTitle?.date_publication
      ? formatDateForMySQL(teamTitle.date_publication)
      : formatDateForMySQL(new Date());

    const [titleRes] = await conn.query(
      `UPDATE contenu
          SET titre = ?, description = ?, date_publication = ?
        WHERE id = ? AND type = ?`,
      [
        String(teamTitle?.titre || "").trim(),
        String(teamTitle?.description || "").trim(),
        titleDate,
        teamTitle?.id,
        TEAM_TITLE,
      ]
    );
    if (!titleRes.affectedRows) {
      throw new Error("Titre de section introuvable ou type invalide.");
    }

    // --- Membres ---
    for (const member of (teamMembers || [])) {
      const itemDate = member?.date_publication
        ? formatDateForMySQL(member.date_publication)
        : formatDateForMySQL(new Date());

      const [itemRes] = await conn.query(
        `UPDATE contenu
            SET titre = ?, description = ?, date_publication = ?
          WHERE id = ? AND type = ?`,
        [
          String(member?.titre || "").trim(),
          String(member?.description || "").trim(),
          itemDate,
          member?.id,
          TEAM_ITEM,
        ]
      );
      if (!itemRes.affectedRows) {
        throw new Error(`Membre #${member?.id} introuvable ou type invalide.`);
      }
    }

    await conn.commit();
    return {
      message: "Section Équipe mise à jour avec succès.",
      updatedTitle: teamTitle,
      updatedList: teamMembers,
    };
  } catch (error) {
    await conn.rollback();
    console.error("[ERROR] updateTeamSection:", error?.message || error);
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Suppression d’un membre (et de ses images liées).
 */
export const deleteTeamMember = async (id) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Supprimer les images liées (table cohérente avec les autres services)
    await conn.query(`DELETE FROM contenuimage WHERE contenu_id = ?`, [id]);

    // Supprimer le contenu
    await conn.query(`DELETE FROM contenu WHERE id = ? AND type = ?`, [id, TEAM_ITEM]);

    await conn.commit();
    return { message: "Membre supprimé avec succès." };
  } catch (error) {
    await conn.rollback();
    console.error("[ERROR] deleteTeamMember:", error?.message || error);
    throw error;
  } finally {
    conn.release();
  }
};
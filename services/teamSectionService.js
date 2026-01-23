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
    // 1. Titre de la section
    const [titleRows] = await conn.query(
      `SELECT id, type, titre, description, date_publication, page_id
         FROM Contenu
        WHERE type = ? AND page_id = ?
        LIMIT 1`,
      [TEAM_TITLE, page_id]
    );
    const teamTitle = titleRows[0] || null;

    // 2. Membres de l'équipe
    const [memberRows] = await conn.query(
      `SELECT id, type, titre, description, date_publication, page_id
         FROM Contenu
        WHERE type = ? AND page_id = ?
        ORDER BY id ASC`,
      [TEAM_ITEM, page_id]
    );

    // 3. Récupération des données liées (Images et Réseaux)
    let images = [];
    let reseaux = [];

    if (memberRows.length > 0) {
      const ids = memberRows.map((r) => r.id);

      // A. Images
      const [imgRows] = await conn.query(
        `SELECT id, contenu_id, image_url, alt
           FROM ContenuImage
          WHERE contenu_id IN (?)`,
        [ids]
      );
      images = imgRows;

      // B. Réseaux Sociaux (Nouveau)
      const [netRows] = await conn.query(
        `SELECT id, contenu_id, plateforme, url, icon_alt
           FROM ContenuReseau
          WHERE contenu_id IN (?)
          ORDER BY id ASC`,
        [ids]
      );
      reseaux = netRows;
    }

    // 4. Construction de l'objet final
    const teamMembers = memberRows.map((m) => {
      // Image associée
      const img = images.find((i) => i.contenu_id === m.id);
      
      // Réseaux associés au membre
      const memberNetworks = reseaux.filter((r) => r.contenu_id === m.id);

      return {
        ...m,
        image_url: img?.image_url || null,
        alt: img?.alt || "",
        reseaux: memberNetworks || [] // Ajout du tableau reseaux
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
    INSERT INTO Contenu (type, titre, description, date_publication, page_id)
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
    reseaux: [] // Retourne un tableau vide pour l'UI
  };
}

/**
 * Met à jour le titre + chaque membre existant (bulk) avec contrôle de type.
 * Gère aussi la mise à jour des réseaux sociaux (Full Sync).
 */
export const updateTeamSection = async ({ teamTitle, teamMembers }) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // --- 1. Mise à jour du Titre de Section ---
    const titleDate = teamTitle?.date_publication
      ? formatDateForMySQL(teamTitle.date_publication)
      : formatDateForMySQL(new Date());

    const [titleRes] = await conn.query(
      `UPDATE Contenu
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

    // --- 2. Mise à jour des Membres ---
    for (const member of (teamMembers || [])) {
      const itemDate = member?.date_publication
        ? formatDateForMySQL(member.date_publication)
        : formatDateForMySQL(new Date());

      // A. Update infos de base
      const [itemRes] = await conn.query(
        `UPDATE Contenu
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

      // B. Gestion des Réseaux Sociaux (Suppression puis Réinsertion)
      // On supprime les anciens pour éviter de gérer des IDs complexes
      await conn.query(`DELETE FROM ContenuReseau WHERE contenu_id = ?`, [member.id]);

      // On insère les nouveaux s'ils existent et ont une URL
      if (member.reseaux && Array.isArray(member.reseaux)) {
        for (const net of member.reseaux) {
          if (net.url && String(net.url).trim() !== "") {
            await conn.query(
              `INSERT INTO ContenuReseau (contenu_id, plateforme, url, icon_alt)
               VALUES (?, ?, ?, ?)`,
              [
                member.id,
                String(net.plateforme || "autre").trim(),
                String(net.url).trim(),
                String(net.icon_alt || "").trim()
              ]
            );
          }
        }
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
 * Suppression d’un membre.
 * Nettoie Images, Réseaux et Boutons AVANT de supprimer le membre pour éviter les FK errors.
 */
export const deleteTeamMember = async (id) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Supprimer les IMAGES liées (Table enfant)
    await conn.query(`DELETE FROM ContenuImage WHERE contenu_id = ?`, [id]);

    // 2. Supprimer les RÉSEAUX liés (Table enfant - Nouveau)
    await conn.query(`DELETE FROM ContenuReseau WHERE contenu_id = ?`, [id]);

    // 3. Supprimer les BOUTONS liés (Table enfant - Sécurité)
    await conn.query(`DELETE FROM ContenuBouton WHERE contenu_id = ?`, [id]);

    // 4. Supprimer le CONTENU parent
    await conn.query(`DELETE FROM Contenu WHERE id = ? AND type = ?`, [id, TEAM_ITEM]);

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
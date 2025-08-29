import db from '../config/db.js'; // Configuration de la base de données

// Récupérer le contenu global par type et langue
export const getGlobalContentDetails = async (type, langue) => {
  const query = `
    SELECT gc.id AS GlobalContent_id, gc.titre, gc.description, gc.type, gc.date_publication, gc.site_id,
           gb.id AS bouton_id, gb.label, gb.action,
           gi.id AS image_id, gi.image_url, gi.alt
    FROM GlobalContent gc
    LEFT JOIN GlobalButton gb ON gc.id = gb.GlobalContent_id
    LEFT JOIN GlobalImage gi ON gc.id = gi.GlobalContent_id
    LEFT JOIN site s ON gc.site_id = s.id
    WHERE gc.type = ? AND s.langue_active = ?;
  `;

  const [rows] = await db.query(query, [type, langue]);
  if (rows.length === 0) {
    throw new Error(`Aucun contenu trouvé pour le type ${type} et la langue ${langue}`);
  }

  // Structuration de la réponse
  const singleContenu = {
    id: rows[0].GlobalContent_id,
    titre: rows[0].titre,
    description: rows[0].description,
    type: rows[0].type,
    date_publication: rows[0].date_publication,
    site_id: rows[0].site_id,
  };

  const contenu = rows.map(row => ({
    id: row.GlobalContent_id,
    titre: row.titre,
    description: row.description,
    type: row.type,
    date_publication: row.date_publication,
    site_id: row.site_id,
  }));

  const boutons = rows
    .filter(row => row.bouton_id)
    .map(row => ({
      id: row.bouton_id,
      label: row.label,
      action: row.action,
    }));

  const images = rows
    .filter(row => row.image_id)
    .map(row => ({
      id: row.image_id,
      GlobalContent_id: row.GlobalContent_id,
      image_url: row.image_url,
      alt: row.alt,
    }));

  return { singleContenu, contenu, boutons, images };
};

// Autres méthodes : création, mise à jour, suppression
export const createGlobalContent = async (req, res) => {
  // Logique pour créer du contenu global
};

export const updateGlobalContent = async (req, res) => {
  // Logique pour mettre à jour du contenu global
};

export const deleteGlobalContent = async (req, res) => {
  // Logique pour supprimer du contenu global
};

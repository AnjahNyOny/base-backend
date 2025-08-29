import db from '../config/db.js';

export const getPagesByLangue = async (langue) => {
  try {
    const query = `
      SELECT p.id, p.titre, p.description, p.slug
      FROM page p
      INNER JOIN site s ON p.site_id = s.id
      WHERE s.langue_active = ?
    `;

    // console.log("Requête exécutée : ", query); // Debugging
    // console.log("Paramètres : ", [langue]); // Debugging

    const [rows] = await db.query(query, [langue]);
    return rows;
  } catch (error) {
    console.error('Erreur lors de la récupération des pages par langue :', error);
    throw error; // Rejette l'erreur pour que le service la gère
  }
};
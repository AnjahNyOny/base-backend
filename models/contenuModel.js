import db from '../config/db.js'; // Vérifie que le chemin vers dbConnection.js est correct

// Fonction pour récupérer les contenus depuis la base de données
const getContenuByPageId = (pageId) => {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM contenu WHERE page_id = ?', [pageId], (err, results) => {
        if (err) reject(err);
        resolve(results);
      });
    });
  };

export default {
  getContenuByPageId
};
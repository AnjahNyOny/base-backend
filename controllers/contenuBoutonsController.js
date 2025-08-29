import db from '../config/db.js';

// Récupérer tous les boutons liés à un contenu
export const getBoutonsByContenuId = async (req, res) => {
  const { contenuId } = req.params;
  try {
    const boutons = await db.query('SELECT * FROM contenuBouton WHERE contenu_id = ?', [contenuId]);
    res.json(boutons);
  } catch (error) {
    console.error('Erreur lors de la récupération des boutons :', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};

// Créer un bouton lié à un contenu
export const createBouton = async (req, res) => {
  const { contenuId } = req.params;
  const { label, link } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO contenuBouton (contenu_id, label, link) VALUES (?, ?, ?)',
      [contenuId, label, link]
    );
    res.json({ id: result.insertId, contenu_id: contenuId, label, link });
  } catch (error) {
    console.error('Erreur lors de la création d\'un bouton :', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};

// Mettre à jour un bouton
export const updateBouton = async (req, res) => {
  const { boutonId } = req.params;
  const { label, link } = req.body;
  try {
    await db.query('UPDATE contenuBouton SET label = ?, link = ? WHERE id = ?', [label, link, boutonId]);
    res.json({ id: boutonId, label, link });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du bouton :', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};

// Supprimer un bouton
export const deleteBouton = async (req, res) => {
  const { boutonId } = req.params;
  try {
    await db.query('DELETE FROM contenuBouton WHERE id = ?', [boutonId]);
    res.json({ message: 'Bouton supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du bouton :', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};
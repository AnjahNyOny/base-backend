import db from '../config/db.js';

// Récupérer toutes les images liées à un contenu
export const getImagesByContenuId = async (req, res) => {
  const { contenuId } = req.params;
  try {
    const images = await db.query('SELECT * FROM contenuImage WHERE contenu_id = ?', [contenuId]);
    res.json(images);
  } catch (error) {
    console.error('Erreur lors de la récupération des images :', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};

// Créer une image liée à un contenu
export const createImage = async (req, res) => {
  const { contenuId } = req.params;
  const { url, altText } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO contenuImage (contenu_id, image_url, alt) VALUES (?, ?, ?)',
      [contenuId, url, altText]
    );
    res.json({ id: result.insertId, contenu_id: contenuId, url, alt_text: altText });
  } catch (error) {
    console.error('Erreur lors de la création d\'une image :', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};

// Mettre à jour une image
export const updateImage = async (req, res) => {
  const { imageId } = req.params;
  const { url, altText } = req.body;
  try {
    await db.query('UPDATE contenuImage SET image_url = ?, alt = ? WHERE id = ?', [url, altText, imageId]);
    res.json({ id: imageId, url, alt_text: altText });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'image :', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};

// Supprimer une image
export const deleteImage = async (req, res) => {
  const { imageId } = req.params;
  try {
    await db.query('DELETE FROM contenuImage WHERE id = ?', [imageId]);
    res.json({ message: 'Image supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'image :', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
};

export async function addImage(req, res) {
  try {
    const { contenu_id, image_url, alt } = req.body;

    const sql = `
      INSERT INTO ContenuImage (contenu_id, image_url, alt)
      VALUES (?, ?, ?)
    `;

    await db.query(sql, [contenu_id, image_url, alt]);
    res.status(201).json({ message: "Image ajoutée avec succès" });
  } catch (error) {
    console.error("Erreur lors de l'ajout d'image :", error);
    res.status(500).json({ error: "Erreur serveur lors de l'ajout d'image" });
  }
}
import express from 'express';
import {
  getGlobalContentDetails,
  createGlobalContent,
  updateGlobalContent,
  deleteGlobalContent,
} from '../controllers/globalContentController.js';

const router = express.Router();

// Route pour récupérer le contenu global en fonction du type et de la langue
router.get('/', async (req, res) => {
  const { type, langue } = req.query;

  if (!type || !langue) {
    return res
      .status(400)
      .json({ message: "Les paramètres 'type' et 'langue' sont requis." });
  }

  try {
    const data = await getGlobalContentDetails(type, langue);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du contenu global.' });
  }
});

// Créer un contenu global
router.post('/', createGlobalContent);

// Mettre à jour un contenu global
router.put('/:contenuId', updateGlobalContent);

// Supprimer un contenu global
router.delete('/:contenuId', deleteGlobalContent);

export default router;

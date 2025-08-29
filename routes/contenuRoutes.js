import express from 'express';
import { 
  getContenus, 
  updateHero,

  createService,
  updateRealisations,
  deleteService,
  updateCompanyOverview,
  updateTeamSection,
  updateWhyChooseUsSection,
  updateCaseStudies,
  updateClientLogos,
  updateGalerieSection,
  updateFocusSection,
  updateQualityCommitment,
  updateContent
} from '../controllers/contenusController.js';
import { 
  getBoutonsByContenuId, 
  createBouton, 
  updateBouton, 
  deleteBouton 
} from '../controllers/contenuBoutonsController.js';
import { 
  getImagesByContenuId,
  addImage,
  createImage, 
  updateImage, 
  deleteImage 
} from '../controllers/contenuImagesController.js';
import contenuService from '../services/contenuService.js'; // Service central pour les données liées
const router = express.Router();
// Route pour récupérer le contenu en fonction du type et de la langue
router.get('/contenu', async (req, res) => {
  const { type, langue } = req.query;

  if (!type || !langue) {
    return res.status(400).json({ message: "Les paramètres 'type' et 'langue' sont requis." });
  }

  try {
    const data = await contenuService.getContenuDetails(type, langue);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la récupération du contenu." });
  }
});
// Créer un nouveau contenu
// router.post('/:pageId', createContenu);
// router.post('/services', createService);
// router.put('/hero', updateHero);
// router.put('/services', updateServices);
// router.put('/realisations', updateRealisations);
// router.put('/company-overview', updateCompanyOverview);
// router.put("/team-section", updateTeamSection);
// router.put('/why-choose-us-section', updateWhyChooseUsSection);
// router.put('/case-studies', updateCaseStudies);
// router.put("/client-logos", updateClientLogos);
// router.put("/galerie-section", updateGalerieSection);
// router.put("/focus-section", updateFocusSection);
// router.put("/quality-commitment", updateQualityCommitment);
//update général de contenu
// router.put('/:contentType', updateContent);
// Supprimer un service
// router.delete('/services/:id', deleteService);
// Routes pour les boutons associés à un contenu
router.get('/:contenuId/boutons', getBoutonsByContenuId); // Récupérer tous les boutons liés à un contenu
router.post('/:contenuId/boutons', createBouton); // Ajouter un bouton lié à un contenu
router.put('/boutons/:boutonId', updateBouton); // Mettre à jour un bouton
router.delete('/boutons/:boutonId', deleteBouton); // Supprimer un bouton
// Routes pour les images associées à un contenu
// router.get('/:contenuId/images', getImagesByContenuId); // Récupérer toutes les images liées à un contenu
// router.post('/:contenuId/images', createImage); // Ajouter une image liée à un contenu
// router.put('/images/:imageId', updateImage); // Mettre à jour une image
// router.delete('/images/:imageId', deleteImage); // Supprimer une image
// router.post("/images", addImage);

export default router;
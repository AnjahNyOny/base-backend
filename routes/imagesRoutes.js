// routes/imagesRoutes.js
import express from 'express';
import {
  listImages,
  createImage,
  updateImage,
  deleteImage,
  legacyGetImagesByContenuId,
  legacyCreateImage,
  upsertImageByContenu,
} from '../controllers/imagesController.js';


const router = express.Router();

// New, preferred
router.get('/images', listImages);             // ?contenu_id=123
router.post('/images', createImage);
router.put('/images/:id', updateImage);
router.delete('/images/:id', deleteImage);

// Upsert by contenu_id (NOUVEAU)
router.put('/images/by-contenu/:contenuId', upsertImageByContenu);

// Legacy (optional)
router.get('/:contenuId/images', legacyGetImagesByContenuId);
router.post('/:contenuId/images', legacyCreateImage);

export default router;
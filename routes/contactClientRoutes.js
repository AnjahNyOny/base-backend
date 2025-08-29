// routes/contactClientRoutes.js
import express from "express";
import {
  getContactLabelsController,
  addContactLabelController,
  updateContactLabelController,
  deleteContactLabelController,
  getContactPageContent,
  addContactMainContentController,
  updateContactMainContentController,
  deleteContactMainContentController,
} from "../controllers/contactClientController.js";

const router = express.Router();

// Contenu principal (titre + description)
router.post("/contactClient-main", addContactMainContentController);
router.put("/contactClient-main/:id", updateContactMainContentController);
router.delete("/contactClient-main/:id", deleteContactMainContentController);

// Labels dynamiques
router.get("/contactClient-labels", getContactLabelsController);
router.post("/contactClient-labels", addContactLabelController);
router.put("/contactClient-labels/:id", updateContactLabelController);
router.delete("/contactClient-labels/:id", deleteContactLabelController);

// Contenu complet pour la page Contact (front)
router.get("/contactClient-content", getContactPageContent);

export default router;
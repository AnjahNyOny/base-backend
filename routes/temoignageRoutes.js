// routes/temoignageRoutes.js
import express from "express";
import {
  getTemoignagesApprouvesController,
  postTemoignageController,
  getTemoignagesController,
  putTemoignageController,              // +
  approveTemoignageController,
  unapproveTemoignageController,
  deleteTemoignageController,
  bulkApproveTemoignagesController,     // +
  bulkUnapproveTemoignagesController,   // +
  bulkDeleteTemoignagesController,      // +
  getTemoignageUIController,
    getTemoignageTitleController,   // +++
  putTemoignageTitleController, 
} from "../controllers/temoignageController.js";

const router = express.Router();

/* Public */
router.get("/temoignages/approuves", getTemoignagesApprouvesController);
router.post("/temoignages", postTemoignageController);

// Titre

router.get("/temoignage-title", getTemoignageTitleController);
router.put("/temoignage-title", putTemoignageTitleController);

/* Admin (protège ces routes par auth si besoin) */
router.get("/temoignages", getTemoignagesController);
router.put("/temoignages/:id", putTemoignageController);                // EDIT INLINE
router.patch("/temoignages/:id/approve", approveTemoignageController);
router.patch("/temoignages/:id/unapprove", unapproveTemoignageController);
router.delete("/temoignages/:id", deleteTemoignageController);

/* Bulk (optionnel) */
router.patch("/temoignages/bulk/approve", bulkApproveTemoignagesController);
router.patch("/temoignages/bulk/unapprove", bulkUnapproveTemoignagesController);
router.post("/temoignages/bulk/delete", bulkDeleteTemoignagesController);

/* UI (texte dynamique bouton + modal) */
router.get("/temoignage-ui", getTemoignageUIController);

export default router;
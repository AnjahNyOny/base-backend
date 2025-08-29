// routes/gallerieComponentRoutes.js
import express from "express";
import {
  fetchGallerieByPage,
  handleCreateGallerieComponent,
  handleUpdateGallerieComponent,
  handleDeleteGallerieComponent,
} from "../controllers/gallerieComponentController.js";

const router = express.Router();

// Getter agrégé par page_id
router.get("/gallerie", fetchGallerieByPage);

// CRUD
router.post("/gallerie", handleCreateGallerieComponent);
router.put("/gallerie", handleUpdateGallerieComponent);
router.delete("/gallerie/:id", handleDeleteGallerieComponent);

export default router;
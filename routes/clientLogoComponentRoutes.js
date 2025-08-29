// routes/clientLogoComponentRoutes.js
import express from "express";
import {
  handleCreateClientLogoComponent,
  handleUpdateClientLogoComponent,
  handleDeleteClientLogoComponent,
  handleGetClientLogo,
} from "../controllers/clientLogoComponentController.js";

const router = express.Router();

// 🔹 GET agrégé par page_id
router.get("/client-logo", handleGetClientLogo);

// 🔹 CRUD
router.post("/client-logo", handleCreateClientLogoComponent);
router.put("/client-logo", handleUpdateClientLogoComponent);
router.delete("/client-logo/:id", handleDeleteClientLogoComponent);

export default router;
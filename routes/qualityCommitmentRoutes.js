// routes/qualityCommitmentRoutes.js
import express from "express";
import {
  handleCreateQualityCommitment,
  handleUpdateQualityCommitment,
  handleDeleteQualityCommitment,
  handleGetQualityCommitment,
} from "../controllers/qualityCommitmentController.js";

const router = express.Router();

// 🔹 GET agrégé par page_id
router.get("/quality-commitment", handleGetQualityCommitment);

// 🔹 CRUD
router.post("/quality-commitment", handleCreateQualityCommitment);
router.put("/quality-commitment", handleUpdateQualityCommitment);
router.delete("/quality-commitment/:id", handleDeleteQualityCommitment);

export default router;
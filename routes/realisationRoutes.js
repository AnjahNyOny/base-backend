// routes/realisationRoutes.js
import express from "express";
import {
  handleCreateRealisation,
  handleUpdateRealisation,
  handleDeleteRealisation,
  handleGetRealisation,
} from "../controllers/realisationController.js";

const router = express.Router();

// GET agrégé par page_id
router.get("/realisation", handleGetRealisation);

// CRUD
router.post("/realisation", handleCreateRealisation);
router.put("/realisation", handleUpdateRealisation);
router.delete("/realisation/:id", handleDeleteRealisation);

export default router;
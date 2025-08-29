// routes/heroRoutes.js
import express from "express";
import {
  handleGetHero,
  handleCreateHero,
  handleUpdateHero,
  handleDeleteHero,
} from "../controllers/heroController.js";

const router = express.Router();

// GET agrégé
router.get("/hero", handleGetHero);

// CRUD
router.post("/hero", handleCreateHero);
router.put("/hero", handleUpdateHero);
router.delete("/hero/:id", handleDeleteHero);

export default router;
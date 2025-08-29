// routes/teamSectionRoutes.js
import express from "express";
import {
  fetchTeamSectionByPage,
  handleCreateTeamMember,
  handleUpdateTeamSection,
  handleDeleteTeamMember,
} from "../controllers/teamSectionController.js";

const router = express.Router();

// GET agrégé par page
router.get("/team-section", fetchTeamSectionByPage);

// CRUD
router.post("/team-section", handleCreateTeamMember);
router.put("/team-section", handleUpdateTeamSection);
router.delete("/team-section/:id", handleDeleteTeamMember);

export default router;
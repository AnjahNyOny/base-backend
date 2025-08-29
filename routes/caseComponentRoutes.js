// routes/caseComponentRoutes.js
import express from "express";
import {
  fetchCaseComponentByPage,
  handleCreateCaseComponent,
  handleUpdateCaseComponent,
  handleDeleteCaseComponent,
} from "../controllers/caseComponentController.js";

const router = express.Router();

// Getter agrégé par page_id
router.get("/case-component", fetchCaseComponentByPage);

// CRUD
router.post("/case-component", handleCreateCaseComponent);
router.put("/case-component", handleUpdateCaseComponent);
router.delete("/case-component/:id", handleDeleteCaseComponent);

export default router;
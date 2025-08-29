// routes/focusComponentRoutes.js
import express from "express";
import {
  fetchFocusComponentByPage,
  handleCreateFocusComponent,
  handleUpdateFocusComponent,
  handleDeleteFocusComponent,
} from "../controllers/focusComponentController.js";

const router = express.Router();

// Getter agrégé par page_id
router.get("/focus", fetchFocusComponentByPage);

// CRUD
router.post("/focus", handleCreateFocusComponent);
router.put("/focus", handleUpdateFocusComponent);
router.delete("/focus/:id", handleDeleteFocusComponent);

export default router;
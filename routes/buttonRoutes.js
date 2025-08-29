// routes/buttonRoutes.js
import express from "express";
import {
  handleGetButtons,
  handleCreateButton,
  handleUpdateButton,
  handleDeleteButton,
  handleUpsertButtonsBulk,
} from "../controllers/buttonController.js";

const router = express.Router();

router.get("/buttons", handleGetButtons);            // ?contenu_id=ID
router.post("/button", handleCreateButton);          // body: {contenu_id, label, action?}
router.put("/button/:id", handleUpdateButton);       // body: {label, action?}
router.delete("/button/:id", handleDeleteButton);    // delete by id
router.put("/buttons/bulk", handleUpsertButtonsBulk);// body: {contenu_id, buttons:[...]}

export default router;
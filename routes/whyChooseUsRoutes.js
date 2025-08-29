// routes/whyChooseUsRoutes.js
import express from "express";
import {
  handleCreateWhyChooseUs,
  handleUpdateWhyChooseUs,
  handleDeleteWhyChooseUs,
  handleGetWhyChooseUs,
} from "../controllers/whyChooseUsController.js";

const router = express.Router();

router.get("/why-choose-us", handleGetWhyChooseUs);
router.post("/why-choose-us", handleCreateWhyChooseUs);
router.put("/why-choose-us", handleUpdateWhyChooseUs);
router.delete("/why-choose-us/:id", handleDeleteWhyChooseUs);

export default router;
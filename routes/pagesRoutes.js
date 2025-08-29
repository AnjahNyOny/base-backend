import express from "express";
import { getPages, fetchPageId } from "../controllers/pagesController.js";

const router = express.Router();

// Route pour récupérer toutes les pages selon la langue
router.get("/pages", getPages);
router.get("/page-id", fetchPageId);


export default router;
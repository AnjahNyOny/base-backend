// routes/pages.js
import express from "express";
import { getPages, fetchPageId, fetchPageIdBySlug, fetchPageIdByCode } from "../controllers/pagesController.js";
const router = express.Router();

router.get("/pages", getPages);
router.get("/page-id", fetchPageId);              // legacy (langue+titre)
router.get("/page-id-by-slug", fetchPageIdBySlug); // nouveau (langue+slug)
router.get("/page-id-by-code", fetchPageIdByCode); // nouveau (langue+code)

export default router;

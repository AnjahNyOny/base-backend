// routes/serviceDetailRoutes.js
import express from "express";
import { fetchServiceDetailBySlug, putServiceDetail } from "../controllers/serviceDetailController.js";

const router = express.Router();

/** GET /api/service-detail/by-slug?slug=...&page_id=... */
router.get("/service-detail/by-slug", fetchServiceDetailBySlug);

/** PUT /api/service-detail/:contenu_id  (upsert 1–1) */
router.put("/service-detail/:contenu_id", putServiceDetail);

export default router;

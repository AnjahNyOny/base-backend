// routes/serviceDetailRoutes.js
import express from "express";
import {
  fetchServiceDetailBySlug,
  putServiceDetail,
  resolveSlugAcrossLanguages,
  resolveSlug,
  handleGetServiceDetailBySlug
} from "../controllers/serviceDetailController.js";

const router = express.Router();

/** GET /api/service-detail/by-slug?slug=...&page_id=... */
// router.get("/service-detail/by-slug", fetchServiceDetailBySlug);

/** GET /api/service-detail/resolve-slug?source_page_id=...&target_page_id=...&slug=... */
// router.get("/service-detail/resolve-slug", resolveSlugAcrossLanguages);
router.get("/service-detail/resolve-slug", resolveSlug); 

router.get("/service-detail/by-slug", handleGetServiceDetailBySlug);

/** PUT /api/service-detail/:contenu_id  (upsert 1–1) */
router.put("/service-detail/:contenu_id", putServiceDetail);

export default router;

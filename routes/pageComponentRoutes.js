import express from "express";
import {
  getPageComponents,
  upsertPageComponents,
  setOnePageComponent
} from "../controllers/pageComponentController.js";

const router = express.Router();

// GET /api/page-components?page_id=123
router.get("/page-components", getPageComponents);

// PUT /api/page-components/:page_id   { items: [{code,is_enabled,sort_order,config_json?}, ...] }
router.put("/page-components/:page_id", upsertPageComponents);

// PUT /api/page-components/:page_id/:code   { is_enabled, sort_order?, config_json? }
router.put("/page-components/:page_id/:code", setOnePageComponent);

export default router;

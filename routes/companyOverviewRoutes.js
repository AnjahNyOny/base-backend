// routes/companyOverviewRoutes.js
import express from "express";
import {
  fetchCompanyOverviewByPage,
  handleCreateCompanyOverview,
  handleUpdateCompanyOverview,
  handleDeleteCompanyOverview,
} from "../controllers/companyOverviewController.js";

const router = express.Router();

// Agrégé par page_id
router.get("/company-overview", fetchCompanyOverviewByPage);

// CRUD
router.post("/company-overview", handleCreateCompanyOverview);
router.put("/company-overview", handleUpdateCompanyOverview);
router.delete("/company-overview/:id", handleDeleteCompanyOverview);

export default router;
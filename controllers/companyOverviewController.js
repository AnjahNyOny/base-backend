// controllers/companyOverviewController.js
import {
  getCompanyOverviewByPage,
  createCompanyOverview,
  updateCompanyOverview,
  deleteCompanyOverview,
} from "../services/companyOverviewService.js";

// GET /api/company-overview?page_id=123
export const fetchCompanyOverviewByPage = async (req, res) => {
  try {
    const page_id = Number(req.query.page_id);
    if (!Number.isFinite(page_id) || page_id <= 0) {
      return res.status(400).json({ message: "Paramètre 'page_id' requis et valide." });
    }
    const data = await getCompanyOverviewByPage(page_id);
    res.json(data);
  } catch (error) {
    console.error("[CompanyOverview] GET error:", error?.message || error);
    res.status(500).json({ message: "Erreur lors de la récupération de CompanyOverview." });
  }
};

// POST /api/company-overview  { titre, description, page_id }
export const handleCreateCompanyOverview = async (req, res) => {
  try {
    const { titre, description, page_id } = req.body || {};
    if (!titre || !page_id) {
      return res.status(400).json({ message: "Champs requis manquants (titre, page_id)." });
    }
    const result = await createCompanyOverview({ titre, description, page_id });
    res.status(201).json(result);
  } catch (error) {
    console.error("[ERROR] Erreur lors de l'ajout CompanyOverview :", error?.message || error);
    res.status(500).json({ message: "Erreur lors de l'ajout." });
  }
};

// PUT /api/company-overview   { overviewTitle: {...}, companyOverviewSections: [{...}] }
export const handleUpdateCompanyOverview = async (req, res) => {
  try {
    const { overviewTitle, companyOverviewSections } = req.body || {};
    if (!overviewTitle || typeof overviewTitle !== "object") {
      return res.status(400).json({ message: "Le champ 'overviewTitle' est manquant ou invalide." });
    }
    if (!Array.isArray(companyOverviewSections)) {
      return res.status(400).json({ message: "Le champ 'companyOverviewSections' doit être un tableau." });
    }
    const result = await updateCompanyOverview({ overviewTitle, companyOverviewSections });
    res.json(result);
  } catch (error) {
    console.error("[CompanyOverview] PUT error:", error?.message || error);
    const status = error?.status || 500;
    res.status(status).json({ message: error?.message || "Erreur lors de la mise à jour." });
  }
};

// DELETE /api/company-overview/:id
export const handleDeleteCompanyOverview = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteCompanyOverview(id);
    res.json(result);
  } catch (error) {
    console.error("[CompanyOverview] DELETE error:", error?.message || error);
    res.status(500).json({ message: "Erreur lors de la suppression." });
  }
};
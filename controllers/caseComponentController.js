// controllers/caseComponentController.js
import {
  createCaseComponent,
  updateCaseComponent,
  deleteCaseComponent,
  getCaseComponentByPage,
} from "../services/caseComponentService.js";

// GET /api/case-component?page_id=123
export const fetchCaseComponentByPage = async (req, res) => {
  try {
    const page_id = Number(req.query.page_id);
    if (!Number.isFinite(page_id) || page_id <= 0) {
      return res.status(400).json({ message: "Paramètre 'page_id' requis et valide." });
    }
    const data = await getCaseComponentByPage(page_id);
    res.json(data);
  } catch (error) {
    console.error("[CaseComponent] GET error:", error?.message || error);
    res.status(500).json({ message: "Erreur lors de la récupération des case studies." });
  }
};

// POST /api/case-component  { titre, description, page_id }
export const handleCreateCaseComponent = async (req, res) => {
  try {
    const newItem = await createCaseComponent(req.body);
    res.status(201).json(newItem);
  } catch (error) {
    console.error("[CaseComponent] Erreur création :", error?.message || error);
    res.status(500).json({ message: "Erreur lors de la création du case study." });
  }
};

// PUT /api/case-component   { caseTitle: {...}, caseList: [{...}] }
export const handleUpdateCaseComponent = async (req, res) => {
  try {
    const { caseTitle, caseList } = req.body || {};
    if (!caseTitle || typeof caseTitle !== "object") {
      return res.status(400).json({ message: "Le champ 'caseTitle' est manquant ou invalide." });
    }
    if (!Array.isArray(caseList)) {
      return res.status(400).json({ message: "Le champ 'caseList' doit être un tableau." });
    }
    const updated = await updateCaseComponent({ caseTitle, caseList });
    res.json(updated);
  } catch (error) {
    console.error("[CaseComponent] Erreur modification :", error?.message || error);
    const status = error?.status || 500;
    res.status(status).json({ message: error?.message || "Erreur lors de la mise à jour." });
  }
};

// DELETE /api/case-component/:id
export const handleDeleteCaseComponent = async (req, res) => {
  try {
    const deleted = await deleteCaseComponent(req.params.id);
    res.json(deleted);
  } catch (error) {
    console.error("[CaseComponent] Erreur suppression :", error?.message || error);
    res.status(500).json({ message: "Erreur lors de la suppression du case study." });
  }
};
// controllers/focusComponentController.js
import {
  createFocusComponent,
  updateFocusComponent,
  deleteFocusComponent,
  getFocusComponentByPage,
} from "../services/focusComponentService.js";

// GET /api/focus?page_id=123
export const fetchFocusComponentByPage = async (req, res) => {
  try {
    const page_id = Number(req.query.page_id);
    if (!Number.isFinite(page_id) || page_id <= 0) {
      return res.status(400).json({ message: "Paramètre 'page_id' requis et valide." });
    }
    const data = await getFocusComponentByPage(page_id);
    res.json(data);
  } catch (error) {
    console.error("[FocusComponent] GET error:", error?.message || error);
    res.status(500).json({ message: "Erreur lors de la récupération du focus." });
  }
};

// POST /api/focus   { titre, description, page_id }
export const handleCreateFocusComponent = async (req, res) => {
  try {
    const newItem = await createFocusComponent(req.body);
    res.status(201).json(newItem);
  } catch (error) {
    console.error("[FocusComponent] Erreur création :", error?.message || error);
    res.status(500).json({ message: "Erreur lors de la création du focus." });
  }
};

// PUT /api/focus   { focusTitle: {...}, focusList: [{...}] }
export const handleUpdateFocusComponent = async (req, res) => {
  try {
    const { focusTitle, focusList } = req.body || {};
    if (!focusTitle || typeof focusTitle !== "object") {
      return res.status(400).json({ message: "Le champ 'focusTitle' est manquant ou invalide." });
    }
    if (!Array.isArray(focusList)) {
      return res.status(400).json({ message: "Le champ 'focusList' doit être un tableau." });
    }
    const updated = await updateFocusComponent({ focusTitle, focusList });
    res.json(updated);
  } catch (error) {
    console.error("[FocusComponent] Erreur modification :", error?.message || error);
    const status = error?.status || 500;
    res.status(status).json({ message: error?.message || "Erreur lors de la mise à jour." });
  }
};

// DELETE /api/focus/:id
export const handleDeleteFocusComponent = async (req, res) => {
  try {
    const deleted = await deleteFocusComponent(req.params.id);
    res.json(deleted);
  } catch (error) {
    console.error("[FocusComponent] Erreur suppression :", error?.message || error);
    res.status(500).json({ message: "Erreur lors de la suppression du focus." });
  }
};
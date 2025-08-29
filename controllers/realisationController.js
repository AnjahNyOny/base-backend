// controllers/realisationController.js
import {
  createRealisation,
  updateRealisation,
  deleteRealisation,
  getRealisationByPageId,
} from "../services/realisationService.js";

// 🔹 GET agrégé par page_id → { title, list, images }
export const handleGetRealisation = async (req, res) => {
  try {
    const pageId = Number(req.query.page_id);
    if (!Number.isFinite(pageId) || pageId <= 0) {
      return res.status(400).json({ message: "Paramètre 'page_id' requis et valide." });
    }
    const data = await getRealisationByPageId(pageId);
    return res.status(200).json({
      title: data.title,
      list: data.list,
      images: data.images,
    });
  } catch (error) {
    console.error("[Realisation] GET error:", error?.message || error);
    return res.status(500).json({ message: "Erreur lors de la récupération." });
  }
};

// 🔹 Créer un item (realisation_stats)
export const handleCreateRealisation = async (req, res) => {
  try {
    const { titre, description, page_id } = req.body || {};
    if (!titre || !description || !page_id) {
      return res.status(400).json({ message: "Champs requis: titre, description, page_id." });
    }
    const newData = await createRealisation({ titre, description, page_id });
    return res.status(201).json(newData);
  } catch (error) {
    console.error("[Realisation] CREATE error:", error?.message || error);
    return res.status(500).json({ message: "Erreur lors de l'ajout." });
  }
};

// 🔹 Modifier (bulk: titre + items)
export const handleUpdateRealisation = async (req, res) => {
  try {
    const { realisationTitle, realisationList } = req.body || {};
    if (!realisationTitle || typeof realisationTitle !== "object") {
      return res.status(400).json({ message: "Le champ 'realisationTitle' est manquant ou invalide." });
    }
    if (!Array.isArray(realisationList)) {
      return res.status(400).json({ message: "Le champ 'realisationList' doit être un tableau." });
    }
    await updateRealisation({ realisationTitle, realisationList });
    return res.status(200).json({ message: "Mise à jour réussie." });
  } catch (error) {
    console.error("[Realisation] UPDATE error:", error?.message || error);
    return res.status(500).json({ message: "Erreur lors de la mise à jour." });
  }
};

// 🔹 Supprimer un item
export const handleDeleteRealisation = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Paramètre 'id' invalide." });
    }
    await deleteRealisation(id);
    return res.status(200).json({ message: "Suppression réussie." });
  } catch (error) {
    console.error("[Realisation] DELETE error:", error?.message || error);
    return res.status(500).json({ message: "Erreur lors de la suppression." });
  }
};
// controllers/qualityCommitmentController.js
import {
  createQualityCommitment,
  updateQualityCommitment,
  deleteQualityCommitment,
  getQualityCommitmentByPageId,
} from "../services/qualityCommitmentService.js";

// 🔹 GET agrégé par page_id ?page_id=123
export const handleGetQualityCommitment = async (req, res) => {
  try {
    const pageId = Number(req.query.page_id);
    if (!Number.isFinite(pageId) || pageId <= 0) {
      return res
        .status(400)
        .json({ message: "Paramètre 'page_id' requis et valide." });
    }

    const data = await getQualityCommitmentByPageId(pageId);
    return res.status(200).json({
      title: data.title,
      list: data.list,
      images: data.images,
    });
  } catch (error) {
    console.error("❌ Erreur GET /quality-commitment :", error);
    return res.status(500).json({ message: "Erreur lors de la récupération." });
  }
};

// 🔹 Créer un item (ligne 'quality_commitment')
export const handleCreateQualityCommitment = async (req, res) => {
  try {
    const newData = await createQualityCommitment(req.body);
    res.status(201).json(newData);
  } catch (error) {
    console.error("❌ Erreur lors de la création de QualityCommitment :", error);
    res.status(500).json({ message: "Erreur lors de l'ajout." });
  }
};

// 🔹 Modifier (bulk: titre + items, images upsert côté service)
export const handleUpdateQualityCommitment = async (req, res) => {
  try {
    await updateQualityCommitment(req.body);
    res.status(200).json({ message: "Mise à jour réussie." });
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour de QualityCommitment :", error);
    res.status(500).json({ message: "Erreur lors de la mise à jour." });
  }
};

// 🔹 Supprimer un item
export const handleDeleteQualityCommitment = async (req, res) => {
  const { id } = req.params;
  try {
    await deleteQualityCommitment(id);
    res.status(200).json({ message: "Suppression réussie." });
  } catch (error) {
    console.error("❌ Erreur lors de la suppression de QualityCommitment :", error);
    res.status(500).json({ message: "Erreur lors de la suppression." });
  }
};
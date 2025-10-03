// controllers/heroController.js
import {
  createHero,
  updateHero,
  deleteHero,
  getHeroByPageId,
} from "../services/heroService.js";

// 🔹 GET agrégé ?page_id=...
export const handleGetHero = async (req, res) => {
  try {
    const pageId = Number(req.query.page_id);
    if (!Number.isFinite(pageId) || pageId <= 0) {
      return res.status(400).json({ message: "Paramètre 'page_id' requis et valide." });
    }
    const data = await getHeroByPageId(pageId);
    return res.status(200).json(data); // { title, buttons, images }
  } catch (error) {
    console.error("[Hero] GET agrégé :", error);
    return res.status(500).json({ message: "Erreur lors de la récupération." });
  }
};

export const handleCreateHero = async (req, res) => {
  try {
    const newData = await createHero(req.body);
    res.status(201).json(newData);
  } catch (error) {
    console.error("❌ Erreur lors de la création de Hero :", error);
    res.status(500).json({ message: "Erreur lors de l'ajout." });
  }
};

export const handleUpdateHero = async (req, res) => {
  try {
    const heroTitle = req.body?.heroTitle || req.body?.heroContent || null;
    const heroButtons = Array.isArray(req.body?.heroButtons) ? req.body.heroButtons : [];
    if (!heroTitle || !Number(heroTitle.id)) {
      return res.status(400).json({ message: "Payload invalide: 'heroTitle.id' est requis." });
    }
    const result = await updateHero({ heroTitle, heroButtons });
    // ⬅️ renvoie les boutons actuels
    res.status(200).json({ message: result.message, buttons: result.buttons });
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour de Hero :", error);
    res.status(500).json({ message: "Erreur lors de la mise à jour." });
  }
};


export const handleDeleteHero = async (req, res) => {
  const { id } = req.params;
  try {
    await deleteHero(id);
    res.status(200).json({ message: "Suppression réussie." });
  } catch (error) {
    console.error("❌ Erreur lors de la suppression de Hero :", error);
    res.status(500).json({ message: "Erreur lors de la suppression." });
  }
};
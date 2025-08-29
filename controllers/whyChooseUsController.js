// controllers/whyChooseUsController.js
import {
  createWhyChooseUs,
  updateWhyChooseUs,
  deleteWhyChooseUs,
  getWhyChooseUsByLang,
} from "../services/whyChooseUsService.js";

// POST /api/why-choose-us
export const handleCreateWhyChooseUs = async (req, res) => {
  try {
    console.log("[CTRL Why] POST /why-choose-us body:", JSON.stringify(req.body, null, 2));
    const { titre, description, page_id } = req.body || {};
    if (!titre || !description || !page_id) {
      return res.status(400).json({ message: "Champs requis: titre, description, page_id." });
    }
    const created = await createWhyChooseUs({ titre, description, page_id });
    console.log("[CTRL Why] ✓ created:", created);
    return res.status(201).json(created);
  } catch (error) {
    console.error("[CTRL Why] ❌ create error:", error?.message || error);
    return res.status(500).json({ message: "Erreur lors de l'ajout." });
  }
};

// PUT /api/why-choose-us
// payload: { whyChooseUsTitle: {...}, whyChooseUsList: [{...}] }
export const handleUpdateWhyChooseUs = async (req, res) => {
  try {
    console.log("[CTRL Why] PUT /why-choose-us body:", JSON.stringify(req.body, null, 2));
    const { whyChooseUsTitle, whyChooseUsList } = req.body || {};
    if (!whyChooseUsTitle || typeof whyChooseUsTitle !== "object") {
      return res.status(400).json({ message: "Le champ 'whyChooseUsTitle' est manquant ou invalide." });
    }
    if (!Array.isArray(whyChooseUsList)) {
      return res.status(400).json({ message: "Le champ 'whyChooseUsList' doit être un tableau." });
    }
    await updateWhyChooseUs({ whyChooseUsTitle, whyChooseUsList });
    return res.status(200).json({ message: "Mise à jour réussie." });
  } catch (error) {
    console.error("[CTRL Why] ❌ update error:", error?.message || error);
    return res.status(500).json({ message: "Erreur lors de la mise à jour." });
  }
};

// DELETE /api/why-choose-us/:id
export const handleDeleteWhyChooseUs = async (req, res) => {
  try {
    const { id } = req.params || {};
    console.log("[CTRL Why] DELETE /why-choose-us/:id =", id);
    if (!id) return res.status(400).json({ message: "Paramètre 'id' requis." });
    await deleteWhyChooseUs(id);
    return res.status(200).json({ message: "Suppression réussie." });
  } catch (error) {
    console.error("[CTRL Why] ❌ delete error:", error?.message || error);
    return res.status(500).json({ message: "Erreur lors de la suppression." });
  }
};

// GET /api/why-choose-us?langue=fr
export const handleGetWhyChooseUs = async (req, res) => {
  try {
    const langue = (req.query.langue || "fr").trim();
    console.log("[CTRL Why] GET /why-choose-us langue:", langue);
    const data = await getWhyChooseUsByLang(langue);
    return res.status(200).json({
      title: data.title,
      list: data.list,
      images: data.images,
    });
  } catch (error) {
    console.error("[CTRL Why] ❌ get error:", error?.message || error);
    return res.status(500).json({ message: "Erreur lors de la récupération." });
  }
};
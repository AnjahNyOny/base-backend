// controllers/clientLogoComponentController.js
import {
  createClientLogoComponent,
  updateClientLogoComponent,
  deleteClientLogoComponent,
  getClientLogoByPageId,
} from "../services/clientLogoComponentService.js";

export const handleGetClientLogo = async (req, res) => {
  try {
    const pageId = Number(req.query.page_id);
    if (!Number.isFinite(pageId) || pageId <= 0) {
      return res.status(400).json({ message: "Paramètre 'page_id' requis et valide." });
    }
    const data = await getClientLogoByPageId(pageId);
    return res.status(200).json({ title: data.title, list: data.list });
  } catch (error) {
    console.error("❌ [ClientLogo] Erreur GET agrégé :", error);
    return res.status(500).json({ message: "Erreur lors de la récupération." });
  }
};

export const handleCreateClientLogoComponent = async (req, res) => {
  try {
    const newItem = await createClientLogoComponent(req.body); // image_url/alt passés tels quels
    res.status(201).json(newItem);
  } catch (error) {
    console.error("[ClientLogo] Erreur création :", error.message);
    res.status(500).json({ error: "Erreur lors de la création du client logo." });
  }
};

export const handleUpdateClientLogoComponent = async (req, res) => {
  try {
    const updated = await updateClientLogoComponent(req.body);
    res.json(updated);
  } catch (error) {
    console.error("[ClientLogo] Erreur modification :", error.message);
    res.status(500).json({ error: "Erreur lors de la mise à jour du client logo." });
  }
};

export const handleDeleteClientLogoComponent = async (req, res) => {
  try {
    const deleted = await deleteClientLogoComponent(req.params.id);
    res.json(deleted);
  } catch (error) {
    console.error("[ClientLogo] Erreur suppression :", error.message);
    res.status(500).json({ error: "Erreur lors de la suppression du client logo." });
  }
};

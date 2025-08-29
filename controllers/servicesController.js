// controllers/servicesController.js
import {
  createService,
  updateService,
  deleteService,
  getServicesWithDetails,
} from "../services/servicesService.js";

console.log("[CTRL] servicesController loaded ✅");

/**
 * POST /api/services
 * Body: { titre, description, page_id }
 */
export const handleCreateService = async (req, res) => {
  try {
    const { titre, description, page_id } = req.body || {};

    const pid = Number(page_id);
    if (!Number.isFinite(pid)) {
      return res.status(400).json({ message: "page_id requis (numérique)." });
    }
    if (!titre || !String(titre).trim()) {
      return res.status(400).json({ message: "Le titre est requis." });
    }

    const newData = await createService({
      titre: String(titre),
      description: String(description || ""),
      page_id: pid,
    });

    return res.status(201).json(newData);
  } catch (error) {
    console.error("❌ Erreur lors de la création du service :", error);
    return res.status(500).json({ message: "Erreur lors de l'ajout." });
  }
};

/**
 * PUT /api/services
 * Body: { servicesTitle, servicesList, page_id }
 * - servicesTitle: { id, titre, description, ... }
 * - servicesList : [{ id, titre, description, ... }, ...]
 */
export const handleUpdateService = async (req, res) => {
  try {
    const { servicesTitle, servicesList, page_id } = req.body || {};

    const pid = Number(page_id);
    if (!Number.isFinite(pid)) {
      return res.status(400).json({ message: "Paramètre 'page_id' manquant ou invalide." });
    }
    if (!servicesTitle || typeof servicesTitle !== "object") {
      return res.status(400).json({ message: "Le champ 'servicesTitle' est manquant ou invalide." });
    }
    if (!Array.isArray(servicesList)) {
      return res.status(400).json({ message: "Le champ 'servicesList' doit être un tableau." });
    }
    if (!servicesTitle.id) {
      return res.status(400).json({ message: "servicesTitle.id requis." });
    }
    for (const item of servicesList) {
      if (!item?.id) {
        return res.status(400).json({ message: "Chaque élément de 'servicesList' doit avoir un id." });
      }
    }

    await updateService({ servicesTitle, servicesList, page_id: pid });
    return res.status(200).json({ message: "Mise à jour réussie." });
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour du service :", error);
    const status = error?.status || 500;
    return res.status(status).json({ message: error?.message || "Erreur lors de la mise à jour." });
  }
};

/**
 * DELETE /api/services/:id
 * Optionnel: ?page_id=123 (ou page_id dans body) pour sécuriser par page
 */
export const handleDeleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const pidRaw = req.query.page_id ?? req.body?.page_id ?? null;

    if (!/^\d+$/.test(String(id))) {
      return res.status(400).json({ message: "Paramètre 'id' invalide." });
    }

    const pid = pidRaw != null ? Number(pidRaw) : null;
    if (pidRaw != null && !Number.isFinite(pid)) {
      return res.status(400).json({ message: "Paramètre 'page_id' invalide." });
    }

    const data = await deleteService(Number(id), pid);
    return res.status(200).json(data);
  } catch (error) {
    console.error("❌ Erreur lors de la suppression du service :", error);
    return res.status(500).json({ message: "Erreur lors de la suppression." });
  }
};

/**
 * GET /api/services?page_id=123
 * Renvoie { serviceTitle, services, boutons } pour la page
 */
export const fetchServicesByPage = async (req, res) => {
  try {
    const pageId = Number(req.query.page_id);
    if (!Number.isFinite(pageId)) {
      return res.status(400).json({ message: "Paramètre 'page_id' requis (numérique)." });
    }

    const data = await getServicesWithDetails({ pageId });
    return res.json(data);
  } catch (error) {
    console.error("[services] fetchServicesByPage error:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};
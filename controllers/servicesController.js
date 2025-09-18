// controllers/servicesController.js
import {
  createService,
  updateService,
  deleteService,
  getServicesWithDetails,
  duplicateServiceToPage, // ✅ nouveau
} from "../services/servicesService.js";

console.log("[CTRL] servicesController loaded ✅");

/**
 * POST /api/services
 * Body: { titre, description, page_id, slug?, service_key? }
 * - service_key est optionnel à la création (si non fourni, généré côté service)
 * - slug est optionnel (sinon dérivé du titre, unicité garantie)
 */
export const handleCreateService = async (req, res) => {
  try {
    const { titre, description, page_id, slug, service_key } = req.body || {};

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
      slug: slug ? String(slug) : undefined,
      service_key: service_key ? String(service_key) : null,
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
 * - servicesList : [{ id, titre, description, slug? ... }, ...]
 * ⚠️ Le service_key est *readonly* (ignoré côté update).
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
 * - services[].service_key présent dans la réponse (exposé côté service)
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

/**
 * POST /api/services/:id/duplicate
 * Body: { target_page_id, slugOverride?, titreOverride?, descriptionOverride? }
 * -> duplique un service vers une autre page/langue *en conservant la service_key*
 * <- { id, slug, service_key, page_id }
 */
export const handleDuplicateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { target_page_id, slugOverride, titreOverride, descriptionOverride } = req.body || {};

    if (!/^\d+$/.test(String(id))) {
      return res.status(400).json({ message: "Paramètre 'id' invalide." });
    }
    const tid = Number(target_page_id);
    if (!Number.isFinite(tid)) {
      return res.status(400).json({ message: "target_page_id requis (numérique)." });
    }

    const out = await duplicateServiceToPage({
      source_id: Number(id),
      target_page_id: tid,
      slugOverride: slugOverride ? String(slugOverride) : null,
      titreOverride: titreOverride ? String(titreOverride) : null,
      descriptionOverride: descriptionOverride ? String(descriptionOverride) : null,
    });

    return res.status(201).json(out);
  } catch (error) {
    console.error("❌ Erreur duplication de service :", error);
    const status = error?.status || 500;
    return res.status(status).json({ message: error?.message || "Erreur lors de la duplication." });
  }
};


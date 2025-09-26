// controllers/servicesController.js
import {
  createService,
  updateService,
  deleteService,
  getServicesWithDetails,
  duplicateServiceToPage, 
  listServicesByTag,
  upsertServiceTitle
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
    const includeDraft = String(req.query.includeDraft || req.query.preview || "") === "1";

    if (!Number.isFinite(pageId)) {
      return res.status(400).json({ message: "Paramètre 'page_id' requis (numérique)." });
    }

    const data = await getServicesWithDetails({ pageId, includeDraft });
    return res.json(data);
  } catch (error) {
    console.error("[services] fetchServicesByPage error:", error?.sqlMessage || error);
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

/**
 * GET /api/services/by-tag?tag=...&page_id=...&limit=12&offset=0&sort=recent|alpha
 */
export const handleGetServicesByTag = async (req, res) => {
  try {
    const page_id = Number(req.query.page_id);
   const tag = String(req.query.tag || "").trim();
   const sort = (req.query.sort || "recent").toString();

   // Supporte page/pageSize ET limit/offset
   const pageParam = Number(req.query.page || 1);
   const pageSizeParam = Number(req.query.pageSize || req.query.limit || 12);
   const limit = Math.min(Math.max(1, pageSizeParam || 12), 50);
   // si "offset" est fourni explicitement on l’utilise, sinon on le dérive de page/pageSize
   const offset = req.query.offset != null
     ? Math.max(0, Number(req.query.offset) || 0)
     : (Math.max(1, pageParam) - 1) * limit;

    if (!Number.isFinite(page_id) || !tag) {
      return res.status(400).json({ message: "Paramètres 'page_id' et 'tag' requis." });
    }

   const data = await listServicesByTag({ page_id, tag, limit, offset, sort });


   // Réponse front-friendly
   return res.json({
     tag,
     page_id,
     total: data?.paging?.total ?? 0,
     page:  data?.paging?.page  ?? (offset / limit + 1),
     pageSize: data?.paging?.pageSize ?? limit,
     items: data?.items || [],
   });

  } catch (error) {
    console.error("[services] by-tag error:", error);
    return res.status(error?.status || 500).json({ message: error?.message || "Erreur serveur" });
  }
};

export const handleUpsertServiceTitle = async (req, res) => {
  try {
    const { page_id, titre, description, date_publication } = req.body || {};
    const pid = Number(page_id);
    if (!Number.isFinite(pid)) {
      return res.status(400).json({ message: "page_id requis (numérique)." });
    }
    const out = await upsertServiceTitle({ page_id: pid, titre, description, date_publication });
    return res.status(200).json(out);
  } catch (error) {
    console.error("❌ upsert servicesTitle:", error);
    return res.status(error?.status || 500).json({ message: error?.message || "Erreur upsert servicesTitle." });
  }
};


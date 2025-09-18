// controllers/serviceDetailController.js
import { getServiceDetailBySlug, upsertServiceDetail } from "../services/serviceDetailService.js";

export const fetchServiceDetailBySlug = async (req, res) => {
  try {
    const { slug, page_id } = req.query || {};
    const data = await getServiceDetailBySlug({ page_id, slug });
    if (!data) return res.status(404).json({ message: "Service introuvable." });
    res.json(data);
  } catch (e) {
    console.error("[serviceDetail] fetch by slug:", e);
    res.status(e.status || 500).json({ message: e.message || "Erreur serveur" });
  }
};

export const putServiceDetail = async (req, res) => {
  try {
    const { contenu_id } = req.params;
    const payload = req.body || {};
    const out = await upsertServiceDetail(contenu_id, payload);
    res.json({ message: "Détails sauvegardés.", ...out });
  } catch (e) {
    console.error("[serviceDetail] upsert:", e);
    res.status(e.status || 500).json({ message: e.message || "Erreur serveur" });
  }
};

export async function handleGetServiceDetailBySlug(req, res) {
  try {
    const page_id = Number(req.query.page_id);
    const { slug } = req.query;
    if (!Number.isFinite(page_id) || !slug) {
      return res.status(400).json({ message: "page_id et slug requis" });
    }
    const row = await getServiceDetailBySlug({ pageId: page_id, slug });
    if (!row) return res.status(404).json({ message: "Introuvable" });
    return res.json(row);
  } catch (e) {
    console.error("[service-detail] by-slug error:", e);
    return res.status(500).json({ message: "Erreur serveur" });
  }
}

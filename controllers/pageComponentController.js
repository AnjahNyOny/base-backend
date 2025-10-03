import {
  fetchPageComponentsByPageId,
  upsertComponentsForPage,
  upsertOneComponentForPage,
} from "../services/pageComponentService.js";

export async function getPageComponents(req, res) {
  try {
    const page_id = Number(req.query.page_id);
    if (!Number.isFinite(page_id)) {
      return res.status(400).json({ message: "page_id requis (numérique)." });
    }
    const items = await fetchPageComponentsByPageId(page_id);
    return res.json({ page_id, items });
  } catch (e) {
    console.error("[page-components] get:", e);
    return res.status(500).json({ message: "Erreur serveur" });
  }
}

export async function upsertPageComponents(req, res) {
  try {
    const page_id = Number(req.params.page_id);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!Number.isFinite(page_id)) {
      return res.status(400).json({ message: "page_id invalide." });
    }
    await upsertComponentsForPage(page_id, items);
    return res.json({ message: "OK" });
  } catch (e) {
    console.error("[page-components] put bulk:", e);
    return res.status(500).json({ message: "Erreur serveur" });
  }
}

export async function setOnePageComponent(req, res) {
  try {
    const page_id = Number(req.params.page_id);
    const code = String(req.params.code || "").trim();
    const { is_enabled = 1, sort_order = null, config_json = null } = req.body || {};
    if (!Number.isFinite(page_id) || !code) {
      return res.status(400).json({ message: "Params invalides." });
    }
    await upsertOneComponentForPage(page_id, { code, is_enabled, sort_order, config_json });
    return res.json({ message: "OK" });
  } catch (e) {
    console.error("[page-components] put one:", e);
    return res.status(500).json({ message: "Erreur serveur" });
  }
}

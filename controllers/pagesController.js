// controllers/pagesController.js
import { fetchPagesByLangue, getPageIdByLangAndTitle, getPageIdByLangAndSlug, getPageIdByLangAndCode } from "../services/pageService.js";

export const getPages = async (req, res) => {
  const langue = req.query.langue || "fr";
  try {
    const pages = await fetchPagesByLangue(langue);
    res.status(200).json(pages);
  } catch (e) {
    console.error("Erreur dans getPages :", e);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des pages" });
  }
};

export const fetchPageId = async (req, res) => { // legacy
  const { langue, titre } = req.query;
  if (!langue || !titre) return res.status(400).json({ message: "Langue et titre requis" });
  try {
    const pageId = await getPageIdByLangAndTitle(langue, titre);
    res.json({ page_id: pageId });
  } catch (e) {
    console.error("[PageController] fetchPageId error:", e?.message || e);
    res.status(404).json({ message: "Page non trouvée" });
  }
};

export const fetchPageIdBySlug = async (req, res) => { // nouveau
  const { langue, slug } = req.query;
  if (!langue || !slug) return res.status(400).json({ message: "Langue et slug requis" });
  try {
    const pageId = await getPageIdByLangAndSlug(langue, slug);
    res.json({ page_id: pageId });
  } catch (e) {
    console.error("[PageController] fetchPageIdBySlug error:", e?.message || e);
    res.status(404).json({ message: "Page non trouvée" });
  }
};

export const fetchPageIdByCode = async (req, res) => {
  const { langue, code } = req.query;
  if (!langue || !code) {
    return res.status(400).json({ message: "Paramètres requis: langue, code" });
  }
  try {
    const pageId = await getPageIdByLangAndCode(langue, code);
    res.json({ page_id: pageId });
  } catch (err) {
    console.error("[PageController] fetchPageIdByCode:", err.message || err);
    res.status(404).json({ message: "Page non trouvée" });
  }
};
import { fetchPagesByLangue } from '../services/pageService.js';
import { getPageIdByLangAndTitle } from "../services/pageService.js";

export const getPages = async (req, res) => {
  const langue = req.query.langue || 'fr';

  try {
    const pages = await fetchPagesByLangue(langue);
    res.status(200).json(pages);
  } catch (error) {
    console.error('Erreur dans getPages :', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des pages' });
  }
};

export const fetchPageId = async (req, res) => {
  const { langue, titre } = req.query;

  if (!langue || !titre) {
    return res.status(400).json({ message: "Langue et titre requis" });
  }

  try {
    const pageId = await getPageIdByLangAndTitle(langue, titre);
    res.json({ page_id: pageId });
  } catch (error) {
    console.error("[PageController] Erreur :", error.message);
    res.status(404).json({ message: "Page non trouvée" });
  }
};
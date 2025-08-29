// controllers/contactClientController.js
import {
  getContactContentByLangue,
  getContactLabels,
  addContactLabel,
  updateContactLabel,
  deleteContactLabel,
  addContactMainContent,
  updateContactMainContent,
  deleteContactMainContent,
} from "../services/contactClientService.js";

import { fetchPageIdByLangAndSlug } from "../utils/pageUtils.js";

// POST ajout du contenu principal (titre + description)
export const addContactMainContentController = async (req, res) => {
  const { langue, titre, description } = req.body;
  try {
    const pageId = await fetchPageIdByLangAndSlug(langue, "contact");
    if (!pageId) return res.status(404).json({ message: "Page non trouvée" });

    const newId = await addContactMainContent(pageId, titre, description);
    res.status(201).json({ success: true, id: newId });
  } catch (error) {
    console.error("Erreur addContactMainContentController:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// PUT mise à jour du contenu principal
export const updateContactMainContentController = async (req, res) => {
  const { id } = req.params;
  const { titre, description } = req.body;
  try {
    const success = await updateContactMainContent(id, titre, description);
    res.json({ success });
  } catch (error) {
    console.error("Erreur updateContactMainContentController:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// DELETE suppression du contenu principal
export const deleteContactMainContentController = async (req, res) => {
  const { id } = req.params;
  try {
    await deleteContactMainContent(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur deleteContactMainContentController:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// GET labels dynamiques
export const getContactLabelsController = async (req, res) => {
  const langue = req.query.langue || "fr";
  try {
    const pageId = await fetchPageIdByLangAndSlug(langue, "contact");
    if (!pageId) return res.status(404).json({ message: "Page non trouvée" });

    const labels = await getContactLabels(pageId);
    res.json(labels);
  } catch (error) {
    console.error("Erreur récupération labels contact :", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// POST ajout label
export const addContactLabelController = async (req, res) => {
  const { langue, titre, description } = req.body;
  try {
    const pageId = await fetchPageIdByLangAndSlug(langue, "contact");
    if (!pageId) return res.status(404).json({ message: "Page non trouvée" });

    const newId = await addContactLabel(pageId, titre, description);
    res.status(201).json({ success: true, id: newId });
  } catch (error) {
    console.error("Erreur addContactLabelController:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// PUT modification label
export const updateContactLabelController = async (req, res) => {
  const { id } = req.params;
  const { titre, description } = req.body;
  try {
    await updateContactLabel(id, titre, description);
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur updateContactLabelController:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// DELETE label
export const deleteContactLabelController = async (req, res) => {
  const { id } = req.params;
  try {
    await deleteContactLabel(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur deleteContactLabelController:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// GET contenu multilingue structuré pour le front
export const getContactPageContent = async (req, res) => {
  const langue = req.query.langue || "fr";
  try {
    const pageId = await fetchPageIdByLangAndSlug(langue, "contact");
    if (!pageId) return res.status(404).json({ message: "Page non trouvée" });

    const mainContent = await getContactContentByLangue(langue);
    const labels = await getContactLabels(pageId);

    res.json({
      mainId: mainContent.id || null,
      titre: mainContent.titre || "Contact",
      description: mainContent.description || "",
      labels: labels || [],
    });
  } catch (error) {
    console.error("Erreur dans getContactPageContent:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

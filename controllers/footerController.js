// backend/controllers/footerController.js
import {
  getFooterContentByLang,
  upsertFooterMain,
  deleteFooterMain,
  createFooterLink,
  updateFooterLink,
  deleteFooterLink,
  createFooterSocial,
  updateFooterSocial,
  deleteFooterSocial,
  createFooterContact,
  updateFooterContact,
  deleteFooterContact,
  upsertFooterNote,
  deleteFooterNote,
} from "../services/footerService.js";
import { fetchPageIdByLangAndSlug } from "../utils/pageUtils.js";

// GET /api/footer-content?langue=fr
export const getFooterContent = async (req, res) => {
  const langue = req.query.langue || "fr";
  try {
    const pageId = await fetchPageIdByLangAndSlug(langue, "footer");
    if (!pageId) return res.status(404).json({ message: "Page 'footer' non trouvée" });

    const data = await getFooterContentByLang(pageId);
    res.json(data);
  } catch (e) {
    console.error("getFooterContent error:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/** MAIN */
// POST|PUT upsert main
export const saveFooterMain = async (req, res) => {
  const { langue, main } = req.body; // main = { id?, titre, description }
  if (!main?.titre) return res.status(400).json({ error: "Titre requis" });
  try {
    const pageId = await fetchPageIdByLangAndSlug(langue || "fr", "footer");
    if (!pageId) return res.status(404).json({ message: "Page 'footer' non trouvée" });

    const id = await upsertFooterMain(pageId, main);
    res.json({ success: true, id });
  } catch (e) {
    console.error("saveFooterMain error:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const removeFooterMain = async (req, res) => {
  const { id } = req.params;
  try {
    await deleteFooterMain(id);
    res.json({ success: true });
  } catch (e) {
    console.error("removeFooterMain error:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/** LINKS */
export const addFooterLink = async (req, res) => {
  const { langue, titre, description } = req.body;
  if (!titre || !description) return res.status(400).json({ error: "titre & url requis" });
  try {
    const pageId = await fetchPageIdByLangAndSlug(langue || "fr", "footer");
    const id = await createFooterLink(pageId, { titre, description });
    res.status(201).json({ success: true, id });
  } catch (e) {
    console.error("addFooterLink error:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const editFooterLink = async (req, res) => {
  const { id } = req.params;
  const { titre, description } = req.body;
  try {
    await updateFooterLink(id, { titre, description });
    res.json({ success: true });
  } catch (e) {
    console.error("editFooterLink error:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const removeFooterLink = async (req, res) => {
  const { id } = req.params;
  try {
    await deleteFooterLink(id);
    res.json({ success: true });
  } catch (e) {
    console.error("removeFooterLink error:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/** SOCIALS */
export const addFooterSocial = async (req, res) => {
  const { langue, titre, description } = req.body; // titre = platform
  if (!titre || !description) return res.status(400).json({ error: "plateforme & url requis" });
  try {
    const pageId = await fetchPageIdByLangAndSlug(langue || "fr", "footer");
    const id = await createFooterSocial(pageId, { titre, description });
    res.status(201).json({ success: true, id });
  } catch (e) {
    console.error("addFooterSocial error:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const editFooterSocial = async (req, res) => {
  const { id } = req.params;
  const { titre, description } = req.body;
  try {
    await updateFooterSocial(id, { titre, description });
    res.json({ success: true });
  } catch (e) {
    console.error("editFooterSocial error:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const removeFooterSocial = async (req, res) => {
  const { id } = req.params;
  try {
    await deleteFooterSocial(id);
    res.json({ success: true });
  } catch (e) {
    console.error("removeFooterSocial error:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/** CONTACT */
export const addFooterContact = async (req, res) => {
  const { langue, titre, description } = req.body; // titre in {address,email,phone}
  if (!titre || !description) return res.status(400).json({ error: "clé & valeur requis" });
  try {
    const pageId = await fetchPageIdByLangAndSlug(langue || "fr", "footer");
    const id = await createFooterContact(pageId, { titre, description });
    res.status(201).json({ success: true, id });
  } catch (e) {
    console.error("addFooterContact error:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const editFooterContact = async (req, res) => {
  const { id } = req.params;
  const { titre, description } = req.body;
  try {
    await updateFooterContact(id, { titre, description });
    res.json({ success: true });
  } catch (e) {
    console.error("editFooterContact error:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const removeFooterContact = async (req, res) => {
  const { id } = req.params;
  try {
    await deleteFooterContact(id);
    res.json({ success: true });
  } catch (e) {
    console.error("removeFooterContact error:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/** NOTE */
export const saveFooterNote = async (req, res) => {
  const { langue, note } = req.body; // note = { id?, description }
  if (!note?.description) return res.status(400).json({ error: "description requise" });
  try {
    const pageId = await fetchPageIdByLangAndSlug(langue || "fr", "footer");
    const id = await upsertFooterNote(pageId, note);
    res.json({ success: true, id });
  } catch (e) {
    console.error("saveFooterNote error:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const removeFooterNote = async (req, res) => {
  const { id } = req.params;
  try {
    await deleteFooterNote(id);
    res.json({ success: true });
  } catch (e) {
    console.error("removeFooterNote error:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};
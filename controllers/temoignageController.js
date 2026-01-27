// controllers/temoignageController.js
import {
  listTemoignages,
  listTemoignagesApprouves,
  createTemoignage,
  approveTemoignage,
  unapproveTemoignage,
  deleteTemoignage,
  getTemoignageUIByLangue,
  searchTemoignages,        // +
  updateTemoignage,         // +
  approveMany, unapproveMany, deleteMany, // +
  getTemoignageTitleByLangue,      // +++
  saveTemoignageTitle,
} from "../services/temoignageService.js";

/* ---- Public ---- */
export const getTemoignagesApprouvesController = async (_req, res) => {
  try {
    const data = await listTemoignagesApprouves();
    res.json({ temoignages: data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

export const postTemoignageController = async (req, res) => {
  try {
    const { nom, email, message } = req.body || {};
    
    // On ne vérifie que le nom et le message. L'email sort du "if".
    if (!nom?.trim() || !message?.trim()) {
      return res.status(400).json({ error: "Le nom et le message sont requis." });
    }
    
    // On nettoie l'email s'il existe, sinon on met null
    const emailData = email?.trim() || null;

    const id = await createTemoignage({ 
      nom: nom.trim(), 
      email: emailData, 
      message: message.trim() 
    });
    
    res.status(201).json({ success: true, id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

/* ---- Admin ---- */
export const getTemoignagesController = async (req, res) => {
  try {
    // supporte status, q, page, pageSize
    const { status = "all", q = "", page = 1, pageSize = 20 } = req.query || {};
    const { rows, counts } = await searchTemoignages({
      status: String(status).toLowerCase(),
      q: String(q || ""),
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
    });
    res.json({ temoignages: rows, counts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

export const putTemoignageController = async (req, res) => {
  try {
    const id = req.params.id;
    const { nom = "", email = "", message = "" } = req.body || {};
    
    // Retrait de !String(email).trim()
    if (!String(nom).trim() || !String(message).trim()) {
      return res.status(400).json({ error: "Champs requis manquants (nom/message)." });
    }
    
    const ok = await updateTemoignage(id, { 
      nom: nom.trim(), 
      email: email?.trim() || null, 
      message: message.trim() 
    });
    
    if (!ok) return res.status(404).json({ error: "Non trouvé" });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

export const approveTemoignageController = async (req, res) => {
  try {
    const ok = await approveTemoignage(req.params.id);
    if (!ok) return res.status(404).json({ error: "Non trouvé" });
    res.json({ success: true, message: "Approuvé." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

export const unapproveTemoignageController = async (req, res) => {
  try {
    const ok = await unapproveTemoignage(req.params.id);
    if (!ok) return res.status(404).json({ error: "Non trouvé" });
    res.json({ success: true, message: "Désapprouvé." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

export const deleteTemoignageController = async (req, res) => {
  try {
    const ok = await deleteTemoignage(req.params.id);
    if (!ok) return res.status(404).json({ error: "Non trouvé" });
    res.json({ success: true, message: "Supprimé." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

/* ---- Bulk (optionnels) ---- */
export const bulkApproveTemoignagesController = async (req, res) => {
  try {
    const { ids = [] } = req.body || {};
    const n = await approveMany(ids);
    res.json({ success: true, updated: n });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

export const bulkUnapproveTemoignagesController = async (req, res) => {
  try {
    const { ids = [] } = req.body || {};
    const n = await unapproveMany(ids);
    res.json({ success: true, updated: n });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

export const bulkDeleteTemoignagesController = async (req, res) => {
  try {
    const { ids = [] } = req.body || {};
    const n = await deleteMany(ids);
    res.json({ success: true, deleted: n });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

/* ---- UI dynamique (existant) ---- */
export const getTemoignageUIController = async (req, res) => {
  try {
    const langue = req.query.langue || "fr";
    const ui = await getTemoignageUIByLangue(langue);
    res.json({ ui });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

export const getTemoignageTitleController = async (req, res) => {
  try {
    const langue = String(req.query.langue || "fr");
    const single = await getTemoignageTitleByLangue(langue);
    res.json({ singleContenu: single }); // même forme que l’ancien front attendait
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// --- PUT /temoignage-title  body: { langue, titre, description } ---
export const putTemoignageTitleController = async (req, res) => {
  try {
    const langue = String(req.body.langue || "fr");
    const titre = String(req.body.titre || "");
    const description = String(req.body.description || "");
    if (!titre.trim() && !description.trim()) {
      return res.status(400).json({ error: "Renseignez au moins un champ (titre ou description)." });
    }
    const result = await saveTemoignageTitle(langue, { titre, description });
    if (!result.id) return res.status(500).json({ error: "Insertion/maj impossible (page introuvable pour cette langue ?)" });
    res.json({ success: true, id: result.id, created: !!result.created, updated: !!result.updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
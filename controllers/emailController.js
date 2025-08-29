// controllers/emailController.js
import {
  queueUserMessage,
  listInbox,
  getThread,
  markInboxStatus,
  replyToInbox,
  deleteThread,
  listOutbox,
  setOutboxStatus,
  sendAndPersistOutbox,
  bulkArchiveInbox,
} from "../services/emailService.js";

/* ========== INBOX (messages reçus) ========== */

// Public: déposer un message depuis le formulaire de contact
export const postInboxMessage = async (req, res) => {
  try {
    const id = await queueUserMessage(req.body || {});
    res.status(201).json({ id, success: true });
  } catch (e) {
    console.error("[email] postInboxMessage:", e);
    res.status(400).json({ error: e.message || "Requête invalide" });
  }
};

// Admin: liste paginée (q, status, page, pageSize)
export const getInbox = async (req, res) => {
  try {
    const { q, status, page, pageSize } = req.query || {};
    const data = await listInbox({ q, status, page, pageSize });
    res.json(data);
  } catch (e) {
    console.error("[email] getInbox:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// Admin: détail d’un thread (inbox + réponses)
export const getInboxThread = async (req, res) => {
  try {
    const thread = await getThread(req.params.id);
    if (!thread?.inbox) return res.status(404).json({ error: "Non trouvé" });
    res.json(thread);
  } catch (e) {
    console.error("[email] getInboxThread:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// Admin: changer le statut (read/handled/archived…)
export const patchInboxStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    const ok = await markInboxStatus(req.params.id, status);
    if (!ok) return res.status(404).json({ error: "Non trouvé" });
    res.json({ success: true });
  } catch (e) {
    console.error("[email] patchInboxStatus:", e);
    res.status(400).json({ error: e.message || "Requête invalide" });
  }
};

// Admin: répondre à un message (envoie email + outbox)
export const postInboxReply = async (req, res) => {
  try {
    const { subject, message, html } = req.body || {};
    const result = await replyToInbox({
      inboxId: req.params.id,
      subject,
      message,
      html,
    });
    res.status(201).json(result);
  } catch (e) {
    console.error("[email] postInboxReply:", e);
    res.status(400).json({ error: e.message || "Requête invalide" });
  }
};

// Admin: supprimer tout le thread (inbox + outbox liés)
export const deleteInboxThread = async (req, res) => {
  try {
    const ok = await deleteThread(req.params.id);
    if (!ok) return res.status(404).json({ error: "Non trouvé" });
    res.json({ success: true });
  } catch (e) {
    console.error("[email] deleteInboxThread:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// Admin: archiver en masse
export const postInboxBulkArchive = async (req, res) => {
  try {
    const { ids } = req.body || {};
    const n = await bulkArchiveInbox(Array.isArray(ids) ? ids : []);
    res.json({ success: true, updated: n });
  } catch (e) {
    console.error("[email] postInboxBulkArchive:", e);
    res.status(400).json({ error: e.message || "Requête invalide" });
  }
};

/* ========== OUTBOX (messages envoyés) ========== */

// Admin: liste paginée des emails envoyés (q, status, page, pageSize)
export const getOutbox = async (req, res) => {
  try {
    const { q, status, page, pageSize } = req.query || {};
    const data = await listOutbox({ q, status, page, pageSize });
    res.json(data);
  } catch (e) {
    console.error("[email] getOutbox:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// Admin: envoi direct (hors reply) et persistence
export const postSendDirect = async (req, res) => {
  try {
    const { to, subject, text, html } = req.body || {};
    const result = await sendAndPersistOutbox({ to, subject, text, html });
    res.status(201).json(result);
  } catch (e) {
    console.error("[email] postSendDirect:", e);
    res.status(400).json({ error: e.message || "Requête invalide" });
  }
};

// Admin: MAJ statut manuel (ex: suite à un callback provider)
export const patchOutboxStatus = async (req, res) => {
  try {
    const { status, error } = req.body || {};
    const ok = await setOutboxStatus(req.params.id, status, error);
    if (!ok) return res.status(404).json({ error: "Non trouvé" });
    res.json({ success: true });
  } catch (e) {
    console.error("[email] patchOutboxStatus:", e);
    res.status(400).json({ error: e.message || "Requête invalide" });
  }
};
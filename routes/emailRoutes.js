// routes/emailRoutes.js
import express from "express";
import {
  // INBOX
  postInboxMessage,
  getInbox,
  getInboxThread,
  patchInboxStatus,
  postInboxReply,
  deleteInboxThread,
  postInboxBulkArchive,
  // OUTBOX
  getOutbox,
  postSendDirect,
  patchOutboxStatus,
} from "../controllers/emailController.js";

// (optionnel) middleware d'auth admin
// import { requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

/* ===== INBOX (messages entrants) ===== */

// Public: créer un message (formulaire contact)
router.post("/emails/inbox", postInboxMessage);

// Admin: lister inbox (q, status, page, pageSize)
router.get("/emails/inbox", /* requireAdmin, */ getInbox);

// Admin: thread détaillé (inbox + outbox)
router.get("/emails/inbox/:id", /* requireAdmin, */ getInboxThread);

// Admin: MAJ statut d’un message
router.patch("/emails/inbox/:id/status", /* requireAdmin, */ patchInboxStatus);

// Admin: répondre à un message (envoi + enregistrement)
router.post("/emails/inbox/:id/reply", /* requireAdmin, */ postInboxReply);

// Admin: supprimer tout le thread
router.delete("/emails/inbox/:id", /* requireAdmin, */ deleteInboxThread);

// Admin: archiver en masse
router.post("/emails/inbox/bulk-archive", /* requireAdmin, */ postInboxBulkArchive);

/* ===== OUTBOX (messages envoyés) ===== */

// Admin: lister outbox
router.get("/emails/outbox", /* requireAdmin, */ getOutbox);

// Admin: envoi direct (hors reply)
router.post("/emails/send", /* requireAdmin, */ postSendDirect);

// Admin: MAJ statut outbox
router.patch("/emails/outbox/:id/status", /* requireAdmin, */ patchOutboxStatus);

export default router;
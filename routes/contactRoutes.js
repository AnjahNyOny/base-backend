// routes/contactRoutes.js
import express from "express";
import {
  getThreadsController,
  getThreadController,
  postInboundController,
  replyController,
  setStatusController,
  bulkSetStatusController,
  deleteThreadController,
  getLabelsController,
  upsertLabelController,
  deleteLabelController,
  setThreadLabelsController,
  bulkDeleteController,
} from "../controllers/contactController.js";
import { contactMessageLimiter } from "../middlewares/rateLimit.js"; // 👈 NEW
import { authenticate } from "../middlewares/authMiddleware.js"; 

const router = express.Router();

/* Threads + messages */
router.get("/contact/threads", getThreadsController);
router.get("/contact/threads/:id", getThreadController);

// 🔒 rate-limit sur l’endpoint public
router.post("/contact/messages", contactMessageLimiter, postInboundController);

// router.post("/contact/threads/:id/reply", replyController);
// router.patch("/contact/threads/:id/status", setStatusController);
// router.post("/contact/threads/bulk/status", bulkSetStatusController);
// router.delete("/contact/threads/:id", deleteThreadController);
// router.delete("/contact/threads", bulkDeleteController);

router.post("/contact/threads/:id/reply", authenticate, replyController);
router.patch("/contact/threads/:id/status", authenticate, setStatusController);
router.post("/contact/threads/bulk/status", authenticate, bulkSetStatusController);
router.delete("/contact/threads/:id", authenticate, deleteThreadController);
router.delete("/contact/threads", authenticate, bulkDeleteController);

/* Labels */
// router.get("/contact/labels", getLabelsController);
// router.post("/contact/labels", upsertLabelController);
// router.delete("/contact/labels/:id", deleteLabelController);
// router.post("/contact/threads/:id/labels", setThreadLabelsController);

router.get("/contact/labels",  getLabelsController);
router.post("/contact/labels", authenticate, upsertLabelController);
router.delete("/contact/labels/:id", authenticate, deleteLabelController);
router.post("/contact/threads/:id/labels", authenticate, setThreadLabelsController);

router.get("/contact/ping", (req, res) => {
  res.json({ ok: true, where: "contactRoutes", time: new Date().toISOString() });
});

export default router;
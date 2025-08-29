// routes/notifyRoutes.js
import express from "express";
import { broadcastAdmin } from "../services/realtime.js";

const router = express.Router();

router.post("/inbound/notify", express.json(), (req, res) => {
  const secret = (process.env.INTERNAL_NOTIFY_SECRET || "").trim();
  const got = (req.header("x-internal-secret") || "").trim();
  if (!secret || got !== secret) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const body = req.body || {};
  const event = body.event || "message.ingested";
  const payload = body.data ?? body; // “déroule” data

  // 🔒 n’émet QUE vers le namespace admin
  broadcastAdmin(event, payload);

  return res.json({ ok: true });
});

export default router;
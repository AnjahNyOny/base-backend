// controllers/inbound.controller.js
import { broadcastNewInbound } from '../services/realtime.js';

export async function notifyFromWorker(req, res) {
  const { threadId, subject, fromEmail, fromName, preview, messageId } = req.body || {};

  broadcastNewInbound({
    source: 'imap-worker',
    threadId,
    subject,
    fromEmail,
    fromName,
    preview: preview ?? '',
    messageId: messageId ?? null,
    at: new Date().toISOString()
  });

  return res.json({ ok: true });
}

export async function webhookProvider(req, res) {
  // À adapter si tu branches un provider (Mailgun/SendGrid…)
  const { threadId, subject, fromEmail, fromName, text } = req.body || {};

  broadcastNewInbound({
    source: 'webhook',
    threadId: threadId ?? null,
    subject,
    fromEmail,
    fromName,
    preview: (text ?? '').slice(0, 200),
    at: new Date().toISOString()
  });

  return res.json({ ok: true });
}
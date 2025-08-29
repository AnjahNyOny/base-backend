// middlewares/verifySecret.js
export function verifyInternalSecret(req, res, next) {
  const secret = req.get('x-internal-secret') || '';
  if (!process.env.INTERNAL_NOTIFY_SECRET || secret !== process.env.INTERNAL_NOTIFY_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

export function verifyWebhookSecret(req, res, next) {
  const secret = req.get('x-inbound-secret') || '';
  if (!process.env.INBOUND_WEBHOOK_SECRET || secret !== process.env.INBOUND_WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}
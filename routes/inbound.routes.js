// routes/inbound.routes.js
import { Router } from 'express';
import { notifyFromWorker, webhookProvider } from '../controllers/inbound.controller.js';
import { verifyInternalSecret, verifyWebhookSecret } from '../middlewares/verifySecret.js';

const router = Router();

router.post('/notify', verifyInternalSecret, notifyFromWorker);
router.post('/webhook', verifyWebhookSecret, webhookProvider);

export default router;
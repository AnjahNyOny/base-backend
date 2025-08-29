// workers/emailOutboxWorker.js
import { processOutboxBatch } from "../services/emailService.js";

async function runOnce() {
  try {
    const res = await processOutboxBatch({ limit: 50 });
    console.log("[EmailWorker] batch:", res);
  } catch (e) {
    console.error("[EmailWorker] error:", e);
  }
}

// Boucle simple (toutes les 30s)
setInterval(runOnce, 30_000);
runOnce();
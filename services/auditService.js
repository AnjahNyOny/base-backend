// services/auditService.js
import db from "../config/db.js";

/**
 * Log d’audit d’une action admin.
 * @param {object} p
 * @param {number|null} p.adminId - id utilisateur admin si dispo (req.user?.id), sinon null
 * @param {string} p.action       - ex: "thread.reply", "thread.delete", "status.set", "labels.set", "label.upsert", "label.delete", "threads.bulkDelete", "threads.bulkStatus"
 * @param {number|null} p.threadId
 * @param {object} [p.meta]       - payload JSON (ex. { status:"archived", ids:[1,2] })
 * @param {string} [p.ip]         - adresse IP (req.ip)
 * @param {string} [p.ua]         - user-agent
 */
export async function logAdminAction({ adminId = null, action, threadId = null, meta = null, ip = null, ua = null }) {
  try {
    await db.query(
      `INSERT INTO admin_audit_logs
         (admin_id, action, thread_id, meta, ip, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        adminId ?? null,
        String(action || ""),
        threadId ?? null,
        meta ? JSON.stringify(meta) : null,
        ip ?? null,
        ua ?? null,
      ]
    );
  } catch (e) {
    // on évite de faire échouer la requête principale à cause des logs
    console.error("[audit] logAdminAction error:", e?.message || e);
  }
}
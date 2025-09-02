import db from "../config/db.js";
import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";
import { inboundCreatedTotal, emailSentTotal, emailFailedTotal } from "./metrics.js";

/* ----------------------------- helpers ----------------------------- */
const norm = (s) => (s ?? "").toString().trim();
const nowMySQL = () => new Date().toISOString().slice(0, 19).replace("T", " ");

/** Map statut UI -> DB */
function uiToDbStatus(ui) {
  if (!ui || ui === "all") return null;
  if (ui === "new") return "new";
  if (ui === "read") return "open";
  if (ui === "handled") return "closed";
  if (ui === "archived") return "archived";
  return null;
}
// helpers - à placer en haut du fichier, près de norm/nowMySQL
function sanitizeAttachments(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((a) => ({
    name: a?.name ?? a?.filename ?? null,
    mime: a?.mime ?? a?.contentType ?? null,
    size: Number(a?.size) || null,
    path: a?.path ?? null,
    url: a?.url ?? null,
    diskPath: a?.diskPath ?? null,
  }));
}

/** Map statut DB -> UI */
function dbToUiStatus(db) {
  if (db === "new") return "new";
  if (db === "waiting") return "new";   // <- pour “Nouveaux”
  if (db === "open") return "read";
  if (db === "closed") return "handled";
  if (db === "archived") return "archived";
  return "read";
}

/* Construit une adresse Reply-To avec +tag pour router les réponses au bon thread */
// function buildReplyToAddress(fromEmail, threadId) {
//   const s = (fromEmail || "").trim();
//   const at = s.lastIndexOf("@");
//   if (at === -1) return s;                     // au cas où
//   const local = s.slice(0, at).replace(/\+.*$/, ""); // strip d'un éventuel +tag existant
//   const domain = s.slice(at + 1);
//   return `${local}+hs-thread-${threadId}@${domain}`;
// }
/* Reply-To simple : pas de plus addressing (IONOS ne le délivre pas correctement) */
function buildReplyToAddress(fromEmail, _threadId) {
  return String(fromEmail || "").trim();
}

/* ===================================================================
   PUBLIC: créer un thread depuis le formulaire de contact
   =================================================================== */
export async function createInboundMessage({
  nom,
  email,
  sujet,
  message,
  langue = "fr",
  attachments = [],
  phone = null,
  company = null,
  meta = null,
}) {
  const user_name = norm(nom);
  const user_email = norm(email);
  const subject = norm(sujet) || "Nouveau message";
  const body = norm(message);

  if (!user_name || !user_email || !body) {
    throw new Error("nom, email et message sont requis.");
  }

  // Nettoyage minimal des pièces jointes (ne garder que les champs utiles)
  const cleanAttachments = Array.isArray(attachments)
    ? attachments.map((a) => ({
      name: a?.name ?? a?.filename ?? null,
      mime: a?.mime ?? a?.contentType ?? null,
      size: Number(a?.size) || null,
      path: a?.path ?? null,
      url: a?.url ?? null,
      diskPath: a?.diskPath ?? null,
    }))
    : [];

  // Meta (téléphone, société/objet, etc.)
  const metaObj = {
    phone: phone ?? null,
    company: company ?? null,
    ...(meta && typeof meta === "object" ? meta : {}),
  };

  const cnx = await db.getConnection();
  try {
    await cnx.beginTransaction();

    const [tRes] = await cnx.query(
      `INSERT INTO contact_threads
         (subject, user_email, user_name, status, priority, langue, last_incoming_at, created_at, updated_at)
       VALUES (?, ?, ?, 'new', 'normal', ?, NOW(), NOW(), NOW())`,
      [subject, user_email, user_name, langue]
    );
    const threadId = tRes.insertId;

    // ⚠️ on remplit aussi subject + attachments + meta dans contact_messages
    await cnx.query(
      `INSERT INTO contact_messages
         (thread_id, direction, sender_email, sender_name, subject, body_text, body_html, attachments, meta, created_at)
       VALUES (?, 'in', ?, ?, ?, ?, NULL, ?, ?, NOW())`,
      [
        threadId,
        user_email,
        user_name,
        subject,
        body,
        JSON.stringify(cleanAttachments || []),
        JSON.stringify(metaObj || null),
      ]
    );

    await cnx.commit();
    // NEW: métrique inbound créé
    try { inboundCreatedTotal.inc(); } catch { }

    return {
      ok: true,
      success: true,
      threadId: threadId,
      subject: subject,
      preview: body.slice(0, 200),
      createdAt: new Date().toISOString(),
      messageId: null,
    };
  } catch (e) {
    await cnx.rollback();
    throw e;
  } finally {
    cnx.release();
  }
}




/* ---- Advanced search parser (place this above listThreads) ---- */
function parseSearch(qRaw = "") {
  const q = String(qRaw || "").trim();
  if (!q) {
    return {
      terms: [],
      ops: {
        from: [], name: [], subject: [], label: [], id: [],
        before: null, after: null, hasAttachment: false,
      },
    };
  }

  const ops = {
    from: [], name: [], subject: [], label: [], id: [],
    before: null, after: null, hasAttachment: false,
  };
  const terms = [];

  const re = /(\w+):"([^"]+)"|(\w+):'([^']+)'|(\w+):(\S+)|"([^"]+)"|'([^']+)'|(\S+)/g;
  let m;
  while ((m = re.exec(q))) {
    const [, k1, v1, k2, v2, k3, v3, vq1, vq2, lone] = m;
    const key = (k1 || k2 || k3 || "").toLowerCase();
    const val = v1 || v2 || v3 || vq1 || vq2 || "";

    if (!key) { terms.push(lone); continue; }

    if (key === "from" || key === "email") ops.from.push(val);
    else if (key === "name") ops.name.push(val);
    else if (key === "subject") ops.subject.push(val);
    else if (key === "label" || key === "tag") ops.label.push(val);
    else if (key === "id") ops.id.push(val);
    else if (key === "before") ops.before = val;
    else if (key === "after") ops.after = val;
    else if (key === "has" && val.toLowerCase() === "attachment") ops.hasAttachment = true;
    else if (key === "has:attachment") ops.hasAttachment = true; // variante tolérée
    else terms.push(`${key}:${val}`);
  }

  return { terms, ops };
}

function dayStart(d) { return `${d} 00:00:00`; }
function dayEnd(d) { return `${d} 23:59:59`; }

export async function listThreads({ q, page = 1, pageSize = 20, status } = {}) {
  const p = Math.max(1, Number(page) || 1);
  const ps = Math.min(200, Math.max(1, Number(pageSize) || 20));
  const off = (p - 1) * ps;

  const where = [];
  const args = [];

  // --- status: accepte 'open,waiting' (CSV) en plus de la valeur unique ---
  if (status && typeof status === "string" && status.includes(",")) {
    const parts = status.split(",").map(s => s.trim()).filter(Boolean);
    if (parts.length) {
      where.push(`t.status IN (${parts.map(() => "?").join(",")})`);
      args.push(...parts);
    }
  } else {
    const dbStatus = uiToDbStatus(status);
    if (dbStatus) { where.push(`t.status = ?`); args.push(dbStatus); }
  }

  // --- parsing recherche avancée ---
  const { terms, ops } = parseSearch(q);

  // opérateurs structurés
  if (ops.from.length) {
    where.push(`(t.user_email LIKE ${ops.from.map(() => "?").join(" OR t.user_email LIKE ")})`);
    args.push(...ops.from.map(v => `%${v}%`));
  }
  if (ops.name.length) {
    where.push(`(t.user_name LIKE ${ops.name.map(() => "?").join(" OR t.user_name LIKE ")})`);
    args.push(...ops.name.map(v => `%${v}%`));
  }
  if (ops.subject.length) {
    where.push(`(t.subject LIKE ${ops.subject.map(() => "?").join(" OR t.subject LIKE ")})`);
    args.push(...ops.subject.map(v => `%${v}%`));
  }
  if (ops.id.length) {
    const ids = ops.id
      .map(v => Number(v))
      .filter(n => Number.isFinite(n));
    if (ids.length) {
      where.push(`t.id IN (${ids.map(() => "?").join(",")})`);
      args.push(...ids);
    }
  }
  if (ops.before) {
    where.push(`GREATEST(
      COALESCE(t.last_incoming_at, '1970-01-01 00:00:00'),
      COALESCE(t.last_outgoing_at, '1970-01-01 00:00:00'),
      t.updated_at
    ) <= ?`);
    args.push(dayEnd(ops.before));
  }
  if (ops.after) {
    where.push(`GREATEST(
      COALESCE(t.last_incoming_at, '1970-01-01 00:00:00'),
      COALESCE(t.last_outgoing_at, '1970-01-01 00:00:00'),
      t.updated_at
    ) >= ?`);
    args.push(dayStart(ops.after));
  }
  if (ops.hasAttachment) {
    // nécessite contact_messages.attachments JSON
    where.push(`EXISTS (
      SELECT 1 FROM contact_messages cm_att
      WHERE cm_att.thread_id = t.id
        AND JSON_LENGTH(cm_att.attachments) > 0
    )`);
  }
  if (ops.label.length) {
    where.push(`EXISTS (
      SELECT 1
        FROM contact_thread_labels ctl
        JOIN contact_labels cl ON cl.id = ctl.label_id
       WHERE ctl.thread_id = t.id
         AND ( ${ops.label.map(() => "cl.name LIKE ?").join(" OR ")} )
    )`);
    args.push(...ops.label.map(v => `%${v}%`));
  }

  // termes “plein texte” restants (subject / nom / email / corps)
  if (terms.length) {
    for (const tTerm of terms) {
      const like = `%${tTerm}%`;
      where.push(`(
        t.subject LIKE ?
        OR t.user_email LIKE ?
        OR t.user_name LIKE ?
        OR EXISTS (
          SELECT 1
            FROM contact_messages cmq
           WHERE cmq.thread_id = t.id
             AND (cmq.body_text LIKE ? OR cmq.body_html LIKE ?)
        )
      )`);
      args.push(like, like, like, like, like);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const orderExpr = `
    GREATEST(
      COALESCE(t.last_incoming_at, '1970-01-01 00:00:00'),
      COALESCE(t.last_outgoing_at, '1970-01-01 00:00:00'),
      t.updated_at
    ) DESC
  `;

  const [rows] = await db.query(
    `
    SELECT
      t.id,
      t.subject,
      t.user_name,
      t.user_email,
      t.status,
      t.priority,
      t.langue,
      t.created_at,
      t.updated_at,
      t.last_incoming_at,
      t.last_outgoing_at,
      im.body_text AS first_message,
      (SELECT COUNT(*) FROM contact_messages cm WHERE cm.thread_id = t.id) AS message_count,
      COALESCE((
        SELECT GROUP_CONCAT(cl.name ORDER BY cl.name SEPARATOR ',')
        FROM contact_thread_labels ctl
        JOIN contact_labels cl ON cl.id = ctl.label_id
        WHERE ctl.thread_id = t.id
      ), '') AS labels
    FROM contact_threads t
    LEFT JOIN (
      SELECT cm.thread_id, cm.body_text
      FROM contact_messages cm
      JOIN (
        SELECT thread_id, MIN(id) AS min_id
        FROM contact_messages
        WHERE direction = 'in'
        GROUP BY thread_id
      ) f ON f.thread_id = cm.thread_id AND f.min_id = cm.id
    ) im ON im.thread_id = t.id
    ${whereSql}
    ORDER BY ${orderExpr}
    LIMIT ? OFFSET ?`,
    [...args, ps, off]
  );

  const [[{ total } = { total: 0 }]] = await db.query(
    `SELECT COUNT(*) AS total FROM contact_threads t ${whereSql}`,
    args
  );

  const items = rows.map(r => ({
    id: r.id,
    sujet: r.subject || "(sans sujet)",
    nom: r.user_name || "",
    email: r.user_email || "",
    message: (r.first_message || "").slice(0, 140),
    status: dbToUiStatus(r.status),
    priority: r.priority,
    langue: r.langue,
    created_at: r.created_at,
    updated_at: r.updated_at,
    last_incoming_at: r.last_incoming_at,
    last_outgoing_at: r.last_outgoing_at,
    message_count: r.message_count || 0,
    labels: (r.labels || "").split(",").filter(Boolean),
  }));

  return { items, total, page: p, pageSize: ps };
}
/* ===================================================================
   DÉTAIL D’UN THREAD
   =================================================================== */
export async function getThread(threadId) {
  const id = Number(threadId);
  if (!Number.isFinite(id)) throw new Error("threadId invalide.");

  // Thread
  const [[t] = []] = await db.query(
    `SELECT id, subject, user_email, user_name, status, priority, langue, created_at, updated_at,
            last_incoming_at, last_outgoing_at
       FROM contact_threads
      WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!t) return null;

  // Tous les messages (on isolera l'origine ensuite)
  const [msgs] = await db.query(
    `SELECT id, direction, sender_email, sender_name, body_text, body_html, attachments, created_at
       FROM contact_messages
      WHERE thread_id = ?
      ORDER BY id ASC`,
    [id]
  );

  const safeParse = (v) => {
    if (v === null || v === undefined) return [];
    if (Array.isArray(v)) return v;                 // déjà un tableau (JSON natif)
    if (typeof v === "object") return v;            // déjà un objet (driver JSON → objet)
    try {
      return JSON.parse(String(v));                 // texte JSON → objet
    } catch {
      return [];
    }
  };

  // Premier message entrant = "inbox"
  const origin = msgs.find(m => m.direction === "in") || null;

  const inbox = {
    id: t.id,
    sujet: t.subject || "(sans sujet)",
    nom: origin?.sender_name ?? t.user_name ?? "",
    email: origin?.sender_email ?? t.user_email ?? "",
    message: origin?.body_text ?? "",
    body_html: origin?.body_html ?? null,
    created_at: origin?.created_at ?? t.created_at,
    status: dbToUiStatus(t.status),
    attachments: safeParse(origin?.attachments),
  };

  // OUT (avec statut d’envoi)
  const [outRows] = await db.query(
    `SELECT m.id, m.body_text, m.body_html, m.attachments, m.created_at,
            eo.status AS send_status, eo.last_error, eo.provider_message_id
       FROM contact_messages m
  LEFT JOIN email_outbox eo ON eo.message_id = m.id
      WHERE m.thread_id = ? AND m.direction = 'out'
      ORDER BY m.id ASC`,
    [id]
  );

  const outs = outRows.map(r => ({
    id: r.id,
    direction: "out",
    subject: t.subject || "",
    body_text: r.body_text || "",
    body_html: r.body_html || null,
    created_at: r.created_at,
    status: r.send_status || "sent",
    last_error: r.last_error || null,
    provider_message_id: r.provider_message_id || null,
    attachments: safeParse(r.attachments),
  }));

  // IN supplémentaires (tous sauf l’origine)
  const ins = msgs
    .filter(m => m.direction === "in" && (!origin || m.id !== origin.id))
    .map(m => ({
      id: m.id,
      direction: "in",
      subject: t.subject || "",
      body_text: m.body_text || "",
      body_html: m.body_html || null,
      created_at: m.created_at,
      status: "received",
      last_error: null,
      provider_message_id: null,
      attachments: safeParse(m.attachments),
    }));

  // Timeline (hors origin), triée chronologiquement
  const replies = [...outs, ...ins].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return { inbox, replies };
}

export { getThread as getThreadById };

/* ===================================================================
   ADMIN: statut / suppression / labels
   =================================================================== */
export async function setThreadStatus(threadId, uiStatus) {
  const id = Number(threadId);
  if (!Number.isFinite(id)) throw new Error("threadId invalide.");
  const dbStatus = uiToDbStatus(uiStatus) || "closed";
  const [res] = await db.query(
    `UPDATE contact_threads SET status = ?, updated_at = ? WHERE id = ?`,
    [dbStatus, nowMySQL(), id]
  );
  return res.affectedRows > 0;
}

export async function bulkSetStatus(ids = [], uiStatus) {
  if (!Array.isArray(ids) || !ids.length) return 0;
  const dbStatus = uiToDbStatus(uiStatus);
  if (!dbStatus) return 0;

  const placeholders = ids.map(() => "?").join(",");
  const [res] = await db.query(
    `UPDATE contact_threads SET status = ?, updated_at = ?
     WHERE id IN (${placeholders})`,
    [dbStatus, nowMySQL(), ...ids]
  );
  return res.affectedRows || 0;
}

export async function deleteThread(threadId) {
  const id = Number(threadId);
  if (!Number.isFinite(id)) throw new Error("threadId invalide.");

  const cnx = await db.getConnection();
  try {
    await cnx.beginTransaction();
    await cnx.query(`DELETE FROM contact_thread_labels WHERE thread_id = ?`, [id]);
    await cnx.query(`DELETE FROM contact_messages WHERE thread_id = ?`, [id]);
    const [res] = await cnx.query(`DELETE FROM contact_threads WHERE id = ?`, [id]);
    await cnx.commit();
    return res.affectedRows > 0;
  } catch (e) {
    await cnx.rollback();
    throw e;
  } finally {
    cnx.release();
  }
}

export async function bulkDeleteThreads(ids = []) {
  if (!Array.isArray(ids) || !ids.length) return 0;

  const cnx = await db.getConnection();
  try {
    await cnx.beginTransaction();

    const placeholders = ids.map(() => "?").join(",");

    await cnx.query(`DELETE FROM contact_thread_labels WHERE thread_id IN (${placeholders})`, ids);
    await cnx.query(`DELETE FROM contact_messages WHERE thread_id IN (${placeholders})`, ids);
    const [res] = await cnx.query(`DELETE FROM contact_threads WHERE id IN (${placeholders})`, ids);

    await cnx.commit();
    return res.affectedRows || 0;
  } catch (e) {
    await cnx.rollback();
    throw e;
  } finally {
    cnx.release();
  }
}

/* ===================================================================
   ADMIN: répondre (message OUT + envoi SMTP + outbox)
   =================================================================== */
export async function replyToThread(
  threadId,
  { subject, message, sender_name, sender_email, html = null, attachments = [] }
) {
  const id = Number(threadId);
  if (!Number.isFinite(id)) throw new Error("threadId invalide.");

  const subj = (subject ?? "").toString().trim() || "Réponse H&S Conseil";
  const text = (message ?? "").toString().trim();
  if (!text) throw new Error("Le corps du message est requis.");

  const fromEmail = (process.env.SMTP_FROM_EMAIL || process.env.EMAIL_USER || "").trim();
  const fromName = (process.env.SMTP_FROM_NAME || "H&S Conseil").trim();

  const adminName = (sender_name ?? "").toString().trim() || fromName;
  const adminEmail = (sender_email ?? "").toString().trim() || fromEmail;

  if (!fromEmail) {
    throw new Error("SMTP_FROM_EMAIL (ou EMAIL_USER) doit être défini dans .env pour envoyer des emails.");
  }

  const [[t] = []] = await db.query(
    `SELECT user_email, user_name, status FROM contact_threads WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!t) throw new Error("Thread introuvable.");
  const [[prevOut] = []] = await db.query(
    `SELECT provider_message_id
       FROM email_outbox
      WHERE thread_id = ? AND provider_message_id IS NOT NULL
      ORDER BY id DESC
      LIMIT 1`,
    [id]
  );

  const now = nowMySQL();

  const cnx = await db.getConnection();
  let messageId, outboxId;
  try {
    await cnx.beginTransaction();

    const [mRes] = await cnx.query(
      `INSERT INTO contact_messages
         (thread_id, direction, sender_email, sender_name, body_text, body_html, attachments, created_at)
       VALUES
         (?, 'out', ?, ?, ?, ?, ?, ?)`,
      [id, adminEmail, adminName, text, html ? String(html) : null, JSON.stringify(sanitizeAttachments(attachments)), now]
    );
    messageId = mRes.insertId;

    const [oRes] = await cnx.query(
      `INSERT INTO email_outbox
         (thread_id, message_id, to_email, to_name, from_email, subject, body_text, body_html, status, created_at, updated_at)
       VALUES
         (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
      [id, messageId, t.user_email, t.user_name || null, fromEmail, subj, text, html || null, now, now]
    );
    outboxId = oRes.insertId;

    await cnx.query(
      `UPDATE contact_threads
         SET last_outgoing_at = ?, updated_at = ?,
             status = CASE WHEN status = 'new' THEN 'open' ELSE status END
       WHERE id = ?`,
      [now, now, id]
    );

    await cnx.commit();
  } catch (e) {
    await cnx.rollback();
    cnx.release();
    throw e;
  } finally {
    cnx.release();
  }

  // === Pièces jointes pour Nodemailer ===
  // On privilégie un chemin disque absolu (diskPath).
  // Sinon, si on n'a qu'un /uploads/… (chemin web), on le convertit en chemin disque.
  // En dernier recours: on passe un href (moins fiable).
  const nmAttachments = (attachments || []).map(a => {
    const diskPath = a.diskPath && typeof a.diskPath === "string" ? a.diskPath : null;

    let fsPath = diskPath;
    if (!fsPath && a.path && typeof a.path === "string") {
      // a.path = "/uploads/xxx"
      const rel = a.path.replace(/^\/+/, "");     // "uploads/xxx"
      fsPath = path.resolve(process.cwd(), rel);  // <cwd>/uploads/xxx
    }

    const obj = {
      filename: a.name || a.filename || "attachment",
      contentType: a.mime || a.contentType || undefined,
    };

    if (fsPath && fs.existsSync(fsPath)) {
      obj.path = fsPath;         // ✅ vrai chemin disque
    } else if (a.url || a.path) {
      obj.href = a.url || a.path; // fallback (HTTP)
    }

    return obj;
  });

  // === Envoi SMTP ===
  let sent = false;
  let providerId = null;
  let lastError = null;
  // label "provider" pour les métriques (utile si vous changez d’ESP plus tard)
  const providerLabel =
    (process.env.SMTP_PROVIDER && String(process.env.SMTP_PROVIDER)) ||
    (process.env.SMTP_HOST && String(process.env.SMTP_HOST)) ||
    "smtp";

  try {
    const replyToAddress = buildReplyToAddress(fromEmail, id);

    // Prépare les entêtes pour aider le futur worker d’ingestion
    const extraHeaders = { "X-Thread-ID": String(id) };
    if (prevOut?.provider_message_id) {
      extraHeaders["In-Reply-To"] = prevOut.provider_message_id;
      extraHeaders["References"] = prevOut.provider_message_id;
    }
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: { name: fromName, address: fromEmail },
      to: t.user_email,
      subject: subj,
      text,
      html: html || undefined,
      // Reply-To taggé : user+hs-thread-<id>@gmail.com (Gmail acceptera et délivrera dans la même boîte)
      replyTo: { name: fromName, address: replyToAddress },
      headers: extraHeaders, // X-Thread-ID (+ In-Reply-To / References si dispo)
      attachments: nmAttachments.length ? nmAttachments : undefined,
    });

    sent = true;
    providerId = info?.messageId || null;
    // métrique: succès d’envoi
    try { emailSentTotal.labels(providerLabel).inc(); } catch { }
  } catch (err) {
    sent = false;
    lastError = err?.message || String(err);
    console.error("[replyToThread] SMTP error:", err);
  }
  // métrique: échec d’envoi
  try { emailFailedTotal.labels(providerLabel).inc(); } catch { }

  await db.query(
    `UPDATE email_outbox
       SET status = ?, provider_message_id = ?, last_error = ?, updated_at = NOW()
     WHERE id = ?`,
    [sent ? "sent" : "failed", providerId, lastError, outboxId]
  );

  return {
    message_id: messageId,
    outbox_id: outboxId,
    status: sent ? "sent" : "failed",
    provider_message_id: providerId,
    error: lastError,
  };
}

/* ===================================================================
   LABELS
   =================================================================== */
export async function listLabels() {
  const [rows] = await db.query(`SELECT id, name FROM contact_labels ORDER BY name ASC`);
  return rows;
}

export async function upsertLabel({ name }) {
  const n = norm(name);
  if (!n) throw new Error("name requis.");
  const [res] = await db.query(
    `INSERT INTO contact_labels (name) VALUES (?)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [n]
  );
  return res.insertId || true;
}

export async function removeLabel(id) {
  const lid = Number(id);
  if (!Number.isFinite(lid)) throw new Error("labelId invalide.");
  const cnx = await db.getConnection();
  try {
    await cnx.beginTransaction();
    await cnx.query(`DELETE FROM contact_thread_labels WHERE label_id = ?`, [lid]);
    const [res] = await cnx.query(`DELETE FROM contact_labels WHERE id = ?`, [lid]);
    await cnx.commit();
    return res.affectedRows > 0;
  } catch (e) {
    await cnx.rollback();
    throw e;
  } finally {
    cnx.release();
  }
}

export async function setThreadLabels(threadId, labelIds = []) {
  const id = Number(threadId);
  if (!Number.isFinite(id)) throw new Error("threadId invalide.");

  const cnx = await db.getConnection();
  try {
    await cnx.beginTransaction();
    await cnx.query(`DELETE FROM contact_thread_labels WHERE thread_id = ?`, [id]);
    if (Array.isArray(labelIds) && labelIds.length) {
      const values = labelIds.map((lid) => [id, Number(lid)]);
      await cnx.query(`INSERT INTO contact_thread_labels (thread_id, label_id) VALUES ?`, [values]);
    }
    await cnx.commit();
    return true;
  } catch (e) {
    await cnx.rollback();
    throw e;
  } finally {
    cnx.release();
  }
}
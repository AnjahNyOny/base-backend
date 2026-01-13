// import nodemailer from "nodemailer";
// import dotenv from "dotenv";
// dotenv.config();

// const transporter = nodemailer.createTransport({
//   host: "smtp.gmail.com", // Remplacez par votre hôte SMTP
//   port: 587, // Utilisez 465 pour SSL ou 587 pour TLS
//   secure: false, // false pour TLS, true pour SSL
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// /**
//  * Envoie un e-mail.
//  * @param {string} to - Adresse du destinataire.
//  * @param {string} subject - Sujet de l'e-mail.
//  * @param {string} text - Contenu texte brut.
//  * @param {string} html - Contenu HTML optionnel.
//  */
// export const sendEmail = async (to, subject, text, html = "") => {
//     try {
//       console.log("Tentative d'envoi d'un e-mail à :", to);
//       console.log("Sujet :", subject);
//       const info = await transporter.sendMail({
//         from: '"Anjah R." <trfalgardwaterlawtdl@gmail.com>',
//         to,
//         subject,
//         text,
//         html,
//       });
//       console.log("E-mail envoyé avec succès :", info.messageId);
//     } catch (error) {
//       console.error("Erreur lors de l'envoi de l'e-mail :", error);
//       throw error;
//     }
//   };

// // services/emailService.js
// import nodemailer from "nodemailer";
// import db from "../config/db.js";

// /* =========================
//    SMTP / TRANSPORT
//    ========================= */

// function readBool(v, def = false) {
//   if (v === undefined || v === null || v === "") return def;
//   const s = String(v).trim().toLowerCase();
//   return ["1", "true", "yes", "y"].includes(s);
// }

// function getSmtpConfig() {
//   const {
//     SMTP_HOST,
//     SMTP_PORT,
//     SMTP_SECURE,
//     SMTP_USER,
//     SMTP_PASS,
//     SMTP_FROM_EMAIL,
//     SMTP_FROM_NAME,
//   } = process.env;

//   if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) {
//     throw new Error(
//       "[emailService] Variables d'environnement SMTP manquantes. " +
//       "Requises: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL"
//     );
//   }
//   return {
//     host: SMTP_HOST,
//     port: Number(SMTP_PORT),
//     secure: readBool(SMTP_SECURE, false), // true pour 465
//     auth: {
//       user: SMTP_USER,
//       pass: SMTP_PASS,
//     },
//     defaults: {
//       from: {
//         name: SMTP_FROM_NAME || "Anjah R.",
//         address: SMTP_FROM_EMAIL,
//       },
//     },
//   };
// }

// let _transport = null;

// function getTransport() {
//   if (_transport) return _transport;
//   const cfg = getSmtpConfig();
//   _transport = nodemailer.createTransport({
//     host: cfg.host,
//     port: cfg.port,
//     secure: cfg.secure,
//     auth: cfg.auth,
//   });
//   return _transport;
// }

// /* =========================
//    HELPERS
//    ========================= */

// function normalizeString(s) {
//   return (s ?? "").toString().trim();
// }

// function nowIso() {
//   return new Date().toISOString().slice(0, 19).replace("T", " ");
// }

// /* =========================
//    INBOX (messages reçus via le site)
//    ========================= */

// /**
//  * Enregistre un message utilisateur (formulaire de contact).
//  * @param {{nom: string, email: string, sujet?: string, message: string}} payload
//  * @returns {Promise<number>} insertId
//  */
// export async function queueUserMessage(payload) {
//   const nom = normalizeString(payload.nom);
//   const email = normalizeString(payload.email);
//   const sujet = normalizeString(payload.sujet) || "Nouveau message du site";
//   const message = normalizeString(payload.message);

//   if (!nom || !email || !message) {
//     throw new Error("nom, email et message sont requis.");
//   }

//   const [res] = await db.query(
//     `INSERT INTO email_inbox (nom, email, sujet, message, status, created_at)
//      VALUES (?, ?, ?, ?, 'new', ?)`,
//     [nom, email, sujet, message, nowIso()]
//   );
//   return res.insertId;
// }

// /**
//  * Liste paginée de l’inbox (avec filtre quick-search).
//  */
// export async function listInbox({ q, page = 1, pageSize = 20, status } = {}) {
//   const p = Math.max(1, Number(page) || 1);
//   const ps = Math.min(200, Math.max(1, Number(pageSize) || 20));
//   const off = (p - 1) * ps;

//   const clauses = [];
//   const args = [];
//   if (q && q.trim()) {
//     clauses.push(`(nom LIKE ? OR email LIKE ? OR sujet LIKE ? OR message LIKE ?)`);
//     const like = `%${q.trim()}%`;
//     args.push(like, like, like, like);
//   }
//   if (status && status.trim()) {
//     clauses.push(`status = ?`);
//     args.push(status.trim());
//   }
//   const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

//   const [rows] = await db.query(
//     `SELECT * FROM email_inbox ${where}
//      ORDER BY id DESC
//      LIMIT ? OFFSET ?`,
//     [...args, ps, off]
//   );
//   const [[{ total } = { total: 0 }]] = await db.query(
//     `SELECT COUNT(*) as total FROM email_inbox ${where}`,
//     args
//   );
//   return { items: rows, total, page: p, pageSize: ps };
// }

// /**
//  * Détail d’un thread: inbox + outbox liés (par inbox_id).
//  */
// export async function getThread(inboxId) {
//   const id = Number(inboxId);
//   if (!Number.isFinite(id)) throw new Error("inboxId invalide.");

//   const [[inbox] = []] = await db.query(
//     `SELECT * FROM email_inbox WHERE id = ? LIMIT 1`,
//     [id]
//   );
//   if (!inbox) return { inbox: null, replies: [] };

//   const [replies] = await db.query(
//     `SELECT * FROM email_outbox WHERE inbox_id = ? ORDER BY id ASC`,
//     [id]
//   );
//   return { inbox, replies };
// }

// /**
//  * Marque un message inbox (ex: 'read', 'handled', 'archived', etc.)
//  */
// export async function markInboxStatus(inboxId, status) {
//   const id = Number(inboxId);
//   if (!Number.isFinite(id)) throw new Error("inboxId invalide.");
//   const s = normalizeString(status) || "read";
//   const [res] = await db.query(
//     `UPDATE email_inbox SET status = ?, updated_at = ? WHERE id = ?`,
//     [s, nowIso(), id]
//   );
//   return res.affectedRows > 0;
// }

// /* =========================
//    OUTBOX (réponses admin)
//    ========================= */

// /**
//  * Envoie un email et l’enregistre dans l’outbox.
//  * Si l’envoi échoue, l’entrée est créée en 'failed'.
//  */
// export async function sendAndPersistOutbox({
//   inbox_id = null,
//   to,
//   subject,
//   text,
//   html,
// }) {
//   const cfg = getSmtpConfig();
//   const from = cfg.defaults.from;

//   const connection = await db.getConnection();
//   try {
//     await connection.beginTransaction();

//     // 1) Créer une ligne outbox en 'queued'
//     const [res] = await connection.query(
//       `INSERT INTO email_outbox (inbox_id, to_email, subject, body_text, body_html, status, created_at)
//        VALUES (?, ?, ?, ?, ?, 'queued', ?)`,
//       [inbox_id, normalizeString(to), normalizeString(subject), normalizeString(text), html || null, nowIso()]
//     );
//     const outboxId = res.insertId;

//     // 2) Tentative d’envoi réel
//     let sendOk = false;
//     let providerId = null;
//     let errorMsg = null;

//     try {
//       const transporter = getTransport();
//       const info = await transporter.sendMail({
//         from,
//         to,
//         subject,
//         text,
//         html,
//       });
//       sendOk = true;
//       providerId = info?.messageId || null;
//     } catch (err) {
//       sendOk = false;
//       errorMsg = err?.message || String(err);
//     }

//     // 3) Mise à jour du statut
//     const finalStatus = sendOk ? "sent" : "failed";
//     await connection.query(
//       `UPDATE email_outbox
//        SET status = ?, provider_message_id = ?, last_error = ?, updated_at = ?
//        WHERE id = ?`,
//       [finalStatus, providerId, errorMsg, nowIso(), outboxId]
//     );

//     // 4) Optionnel: si lié à un inbox -> status "handled" si OK
//     if (sendOk && inbox_id) {
//       await connection.query(
//         `UPDATE email_inbox SET status = 'handled', updated_at = ? WHERE id = ?`,
//         [nowIso(), inbox_id]
//       );
//     }

//     await connection.commit();
//     return { id: outboxId, status: finalStatus, provider_message_id: providerId, error: errorMsg };
//   } catch (e) {
//     await connection.rollback();
//     throw e;
//   } finally {
//     connection.release();
//   }
// }

// /**
//  * Répond à un message de l’inbox (raccourci: récupère adr destinataire depuis l’inbox).
//  */
// export async function replyToInbox({ inboxId, subject, message, html }) {
//   const id = Number(inboxId);
//   if (!Number.isFinite(id)) throw new Error("inboxId invalide.");

//   const [[inbox] = []] = await db.query(
//     `SELECT email FROM email_inbox WHERE id = ? LIMIT 1`,
//     [id]
//   );
//   if (!inbox) throw new Error("Message d’origine introuvable.");

//   return sendAndPersistOutbox({
//     inbox_id: id,
//     to: inbox.email,
//     subject: normalizeString(subject) || "Réponse Anjah R.",
//     text: normalizeString(message),
//     html: html || null,
//   });
// }

// /**
//  * Liste paginée de l’outbox (avec recherche).
//  */
// export async function listOutbox({ q, page = 1, pageSize = 20, status } = {}) {
//   const p = Math.max(1, Number(page) || 1);
//   const ps = Math.min(200, Math.max(1, Number(pageSize) || 20));
//   const off = (p - 1) * ps;

//   const clauses = [];
//   const args = [];
//   if (q && q.trim()) {
//     clauses.push(`(to_email LIKE ? OR subject LIKE ? OR body_text LIKE ? OR body_html LIKE ?)`);
//     const like = `%${q.trim()}%`;
//     args.push(like, like, like, like);
//   }
//   if (status && status.trim()) {
//     clauses.push(`status = ?`);
//     args.push(status.trim());
//   }
//   const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

//   const [rows] = await db.query(
//     `SELECT * FROM email_outbox ${where}
//      ORDER BY id DESC
//      LIMIT ? OFFSET ?`,
//     [...args, ps, off]
//   );
//   const [[{ total } = { total: 0 }]] = await db.query(
//     `SELECT COUNT(*) as total FROM email_outbox ${where}`,
//     args
//   );
//   return { items: rows, total, page: p, pageSize: ps };
// }

// /**
//  * Met manuellement à jour le statut d’un envoi (utile si provider callback).
//  */
// export async function setOutboxStatus(outboxId, status, lastError = null) {
//   const id = Number(outboxId);
//   if (!Number.isFinite(id)) throw new Error("outboxId invalide.");
//   const s = normalizeString(status);
//   const [res] = await db.query(
//     `UPDATE email_outbox
//      SET status = ?, last_error = ?, updated_at = ?
//      WHERE id = ?`,
//     [s || "sent", lastError || null, nowIso(), id]
//   );
//   return res.affectedRows > 0;
// }

// /* =========================
//    UTILITAIRES ADMIN OPTIONNELS
//    ========================= */

// /**
//  * Supprime un thread complet (inbox + outbox liés).
//  * ⚠️ irréversible — utile si GDPR / demande utilisateur.
//  */
// export async function deleteThread(inboxId) {
//   const id = Number(inboxId);
//   if (!Number.isFinite(id)) throw new Error("inboxId invalide.");
//   const cnx = await db.getConnection();
//   try {
//     await cnx.beginTransaction();
//     await cnx.query(`DELETE FROM email_outbox WHERE inbox_id = ?`, [id]);
//     const [res] = await cnx.query(`DELETE FROM email_inbox WHERE id = ?`, [id]);
//     await cnx.commit();
//     return res.affectedRows > 0;
//   } catch (e) {
//     await cnx.rollback();
//     throw e;
//   } finally {
//     cnx.release();
//   }
// }

// /**
//  * Marque une sélection d’inbox comme 'archived'.
//  */
// export async function bulkArchiveInbox(ids = []) {
//   if (!Array.isArray(ids) || !ids.length) return 0;
//   const placeholders = ids.map(() => "?").join(",");
//   const [res] = await db.query(
//     `UPDATE email_inbox SET status = 'archived', updated_at = ?
//      WHERE id IN (${placeholders})`,
//     [nowIso(), ...ids]
//   );
//   return res.affectedRows || 0;
// }
// // --- Envoi simple d'email (sans persistance outbox) ---


// export async function sendMail({ to, subject, text, html, from, attachments = [] }) {
//   const cfg = getSmtpConfig();
//   const transporter = getTransport();

//   const fromObj = from || cfg.defaults?.from || {
//     name: "Anjah R.",
//     address: process.env.SMTP_FROM_EMAIL,
//   };

//   const nodemailerAtt = (attachments || []).map(a => ({
//     filename: a.name || a.filename || "file",
//     path: a.path || a.url,          // on privilégie le chemin disque
//     contentType: a.mime || a.contentType,
//   }));

//   const info = await transporter.sendMail({
//     from: fromObj,
//     to,
//     subject,
//     text,
//     html,
//     attachments: nodemailerAtt.length ? nodemailerAtt : undefined,
//   });

//   return info;
// }

// services/emailService.js
import nodemailer from "nodemailer";
import { htmlToText } from "html-to-text";
import db from "../config/db.js";

/* =========================
   CONSTANTES & CHARTE
   ========================= */
const BRAND = {
  name: "Anjah Rakotovao",
  color: "#0F3F7A",
  accent: "#3B82F6",
  bg: "#F3F4F6",
  logoUrl: "https://babacode.ca/img/logo/ar.svg",
  website: "https://babacode.ca",
  address: "Québec, Canada"
};

const normalizeString = (s) => (s ?? "").toString().trim();
const nowIso = () => new Date().toISOString().slice(0, 19).replace("T", " ");

/* =========================
   CONFIGURATION SMTP
   ========================= */
function getSmtpConfig() {
  const {
    SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS,
    SMTP_FROM_EMAIL, SMTP_FROM_NAME
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error("❌ Configuration SMTP incomplète.");
    throw new Error("SMTP config missing");
  }

  return {
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: ["true", "1", "yes"].includes(String(SMTP_SECURE).toLowerCase()),
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    defaults: {
      from: {
        name: SMTP_FROM_NAME || BRAND.name,
        address: SMTP_FROM_EMAIL
      }
    }
  };
}

let _transport = null;
function getTransport() {
  if (_transport) return _transport;
  const cfg = getSmtpConfig();
  _transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
  });
  return _transport;
}

/* =========================
   TEMPLATING
   ========================= */
function generateBrandedEmail(title, contentHtml, actionUrl = null, actionText = "Voir détails") {
  const buttonHtml = actionUrl
    ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
        <tr>
          <td align="center" bgcolor="${BRAND.accent}" style="border-radius: 6px;">
            <a href="${actionUrl}" style="background: ${BRAND.accent}; font-size: 16px; font-family: Helvetica, Arial, sans-serif; font-weight: bold; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; border: 1px solid ${BRAND.accent};">${actionText}</a>
          </td>
        </tr>
      </table>`
    : "";

  return `
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: ${BRAND.bg}; color: #333; }
      .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
      .header { background-color: #ffffff; padding: 20px; text-align: center; border-bottom: 3px solid ${BRAND.color}; }
      .content { padding: 30px 25px; line-height: 1.6; color: #374151; }
      .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
      h1 { color: ${BRAND.color}; font-size: 24px; margin-bottom: 20px; font-weight: 600; }
      p { margin-bottom: 15px; }
      a { color: ${BRAND.accent}; text-decoration: none; }
    </style>
  </head>
  <body>
    <div style="padding: 40px 0;">
      <div class="container">
        <div class="header">
          <img src="${BRAND.logoUrl}" alt="${BRAND.name}" style="max-height: 50px; width: auto; border: 0;">
        </div>
        <div class="content">
          <h1>${title}</h1>
          ${contentHtml}
          ${buttonHtml}
          <p style="margin-top: 30px; font-size: 14px; color: #6b7280; border-top: 1px solid #eee; padding-top: 20px;">
            Cordialement,<br>
            <strong>${BRAND.name}</strong>
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${BRAND.name}. Tous droits réservés.</p>
          <p>${BRAND.address} - <a href="${BRAND.website}">${BRAND.website}</a></p>
        </div>
      </div>
    </div>
  </body>
  </html>`;
}

/* =========================
   OUTBOX (CORRIGÉ POUR TA BDD)
   ========================= */

/**
 * Envoie un email et l'archive en base de données.
 * ADAPTÉ: Utilise 'thread_id' au lieu de 'inbox_id'.
 */
export async function sendAndPersistOutbox({
  thread_id = null,  // Remplacé inbox_id par thread_id
  message_id = null, // Ajouté pour lier au message contact
  to,
  subject,
  text,
  html,
  rawHtml = false
}) {
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const config = getSmtpConfig();
    const fromEmail = config.defaults.from.address; // Nécessaire pour ta table

    // 1. Préparation du contenu PRO
    const finalHtml = rawHtml ? html : generateBrandedEmail(subject, html);
    const finalText = text || htmlToText(finalHtml, { wordwrap: 130 });

    // 2. Insertion 'queued' -> ADAPTÉ À TON SCHÉMA
    // On ajoute 'from_email' et on utilise 'thread_id'
    const [ins] = await connection.query(
      `INSERT INTO email_outbox 
       (thread_id, message_id, to_email, from_email, subject, body_text, body_html, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?)`,
      [thread_id, message_id, normalizeString(to), fromEmail, subject, finalText, finalHtml, nowIso()]
    );
    const outboxId = ins.insertId;

    // 3. Envoi réel
    const transporter = getTransport();
    let status = "failed";
    let providerId = null;
    let errorMsg = null;

    try {
      const info = await transporter.sendMail({
        from: config.defaults.from,
        to,
        subject,
        text: finalText,
        html: finalHtml,
      });
      status = "sent";
      providerId = info.messageId;
    } catch (err) {
      errorMsg = err.message;
      console.error(`[EmailService] Echec envoi outbox #${outboxId}:`, err);
    }

    // 4. Mise à jour statut
    await connection.query(
      `UPDATE email_outbox 
       SET status = ?, provider_message_id = ?, last_error = ?, updated_at = ?
       WHERE id = ?`,
      [status, providerId, errorMsg, nowIso(), outboxId]
    );

    // 5. Mise à jour du statut du thread (si lié)
    if (status === "sent" && thread_id) {
      // Optionnel : mettre à jour le statut du thread ici si nécessaire
      // Mais c'est souvent déjà fait par le contrôleur
    }

    await connection.commit();
    return { id: outboxId, status, error: errorMsg };

  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

/**
 * Envoi simple (Notifications système)
 */
export async function sendSystemMail({ to, subject, html }) {
  const transporter = getTransport();
  const config = getSmtpConfig();

  const finalHtml = generateBrandedEmail(subject, html);
  const text = htmlToText(finalHtml);

  return transporter.sendMail({
    from: config.defaults.from,
    to,
    subject,
    text,
    html: finalHtml
  });
}

// Note: J'ai retiré les fonctions inbox/replyToInbox qui utilisaient l'ancienne logique inbox_id
// car ton contactService gère ça via les threads.
// // services/emailService.js
// import db from "../config/db.js";
// import { buildTransporter } from "../utils/email.js";

// const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || "no-reply@example.com";
// const FROM_NAME  = process.env.SMTP_FROM_NAME  || "H&S Conseil";

// /* Envoi immédiat via Nodemailer */
// export async function sendRawMail({ to, subject, text, html, fromEmail = FROM_EMAIL, fromName = FROM_NAME, headers = {} }) {
//   const transporter = buildTransporter();
//   const info = await transporter.sendMail({
//     from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
//     to,
//     subject,
//     text,
//     html,
//     headers,
//   });
//   return { messageId: info.messageId, response: info.response };
// }

// /* Ajouter en outbox (queued) */
// export async function enqueueMail({
//   thread_id = null,
//   message_id = null,
//   to_email,
//   to_name = null,
//   subject,
//   body_text = null,
//   body_html = null,
//   scheduled_at = null,
//   from_email = FROM_EMAIL,
// }) {
//   const [res] = await db.query(
//     `INSERT INTO email_outbox
//      (thread_id, message_id, to_email, to_name, from_email, subject, body_text, body_html, status, try_count, scheduled_at, created_at, updated_at)
//      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, ?, NOW(), NOW())`,
//     [thread_id, message_id, to_email, to_name, from_email, subject, body_text, body_html, scheduled_at]
//   );
//   return res.insertId;
// }

// /* Traiter un lot d’e-mails (worker/background) */
// export async function processOutboxBatch({ limit = 25 } = {}) {
//   const conn = await db.getConnection();
//   try {
//     await conn.beginTransaction();

//     // Verrouillage léger: passer queued -> sending pour un lot
//     const [upd] = await conn.query(
//       `UPDATE email_outbox
//        SET status='sending', updated_at=NOW()
//        WHERE status='queued' AND (scheduled_at IS NULL OR scheduled_at <= NOW())
//        ORDER BY id ASC
//        LIMIT ?`,
//       [limit]
//     );

//     if (!upd.affectedRows) {
//       await conn.commit();
//       return { processed: 0, sent: 0, failed: 0 };
//     }

//     const [rows] = await conn.query(
//       `SELECT * FROM email_outbox WHERE status='sending' ORDER BY id ASC LIMIT ?`,
//       [limit]
//     );
//     await conn.commit(); // libérer rapidement la transaction
//     let sent = 0, failed = 0;

//     for (const r of rows) {
//       try {
//         const { messageId, response } = await sendRawMail({
//           to: r.to_email,
//           subject: r.subject,
//           text: r.body_text || undefined,
//           html: r.body_html || undefined,
//           fromEmail: r.from_email || FROM_EMAIL,
//         });

//         await db.query(
//           `UPDATE email_outbox
//            SET status='sent', try_count=try_count+1, provider_message_id=?, last_error=NULL, updated_at=NOW()
//            WHERE id=?`,
//           [messageId || response || null, r.id]
//         );
//         sent += 1;
//       } catch (e) {
//         const msg = (e && (e.message || e.toString())) || "send error";
//         await db.query(
//           `UPDATE email_outbox
//            SET status='failed', try_count=try_count+1, last_error=?, updated_at=NOW()
//            WHERE id=?`,
//           [msg.slice(0, 2000), r.id]
//         );
//         failed += 1;
//       }
//     }

//     return { processed: rows.length, sent, failed };
//   } catch (e) {
//     try { await conn.rollback(); } catch {}
//     throw e;
//   } finally {
//     conn.release();
//   }
// }
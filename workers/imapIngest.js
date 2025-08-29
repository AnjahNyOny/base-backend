// // workers/imapIngest.js
// import 'dotenv/config';
// import { ImapFlow } from 'imapflow';
// import { simpleParser } from 'mailparser';
// import db from '../config/db.js';
// import fs from 'fs';
// import path from 'path';
// import crypto from 'crypto';
// import fetch from 'node-fetch'; // NEW: HTTP call vers l'API (si Node < 18)

// /* =========================
//    Constantes & helpers
//    ========================= */
// const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'mail');
// fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// const norm = (s) => (s ?? '').toString().trim();
// const nowMySQL = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

// const RECENT_DAYS = Number(process.env.IMAP_RECENT_DAYS || 7);
// const LOOP_SLEEP_MS = Number(process.env.IMAP_LOOP_SLEEP_MS || 30000);
// const SOCKET_TIMEOUT_MS = Number(process.env.IMAP_SOCKET_TIMEOUT_MS || 300000); // 5 min
// const PER_MSG_TIMEOUT_MS = Number(process.env.IMAP_PER_MSG_TIMEOUT_MS || 15000);
// const PER_MSG_TIMEOUT_MS_ALT = Number(process.env.IMAP_PER_MSG_TIMEOUT_MS_ALT || 45000);
// const MAX_RETRIES = Number(process.env.IMAP_MAX_RETRIES || 3);

// // Filtre Gmail (X-GM-RAW). Exemple: label:"Support/Inbox" is:unread newer_than:7d
// const GMAIL_RAW = process.env.IMAP_GMAIL_RAW;

// /* =========================
//    Notif webhook -> SSE serveur API
//    ========================= */
// // const NOTIFY_URL = process.env.NOTIFY_URL || 'http://localhost:5001/api/hooks/imap-ingest'; // NEW
// // const NOTIFY_SECRET = process.env.NOTIFY_SECRET || ''; // NEW
// // en haut de workers/imapIngest.js
// // workers/imapIngest.js
// const NOTIFY_URL =
//   process.env.NOTIFY_URL ||
//   process.env.INTERNAL_NOTIFY_URL || "http://localhost:5001/api/inbound/notify";

// const NOTIFY_SECRET =
//   process.env.INTERNAL_NOTIFY_SECRET ||
//   process.env.NOTIFY_SECRET || "";

// async function notify(event, data) { // NEW
//   if (!NOTIFY_URL || !NOTIFY_SECRET) return;
//   let lastErr;
//   for (let i = 1; i <= 2; i++) {
//     try {
//       const res = await fetch(NOTIFY_URL, {
//         method: 'POST',
//         headers: {
//           'content-type': 'application/json',
//           'x-internal-secret': NOTIFY_SECRET,
//         },
//         body: JSON.stringify({ event, data }),
//       });
//       if (!res.ok) throw new Error(`HTTP ${res.status}`);
//       return true;
//     } catch (e) {
//       lastErr = e;
//       if (i === 2) break;
//       await new Promise(r => setTimeout(r, 500));
//     }
//   }
//   console.warn('[imapIngest] notify failed:', lastErr?.message || lastErr);
//   return false;
// }

// /* =========================
//    Extraction du threadId
//    ========================= */

// // 1) depuis adresse du type ...+hs-thread-21@...
// function findThreadIdFromPlus(addresses = []) {
//   const re = /\+hs-thread-(\d+)\@/i;
//   for (const a of addresses) {
//     const addr = (a?.address || a || '').toString();
//     const m = addr.match(re);
//     if (m) return Number(m[1]);
//   }
//   return null;
// }

// // 2) depuis headers: X-Thread-ID ou In-Reply-To / References
// function findThreadIdFromHeaders(headers) {
//   const h = (k) => headers?.get?.(k) || headers?.[k];
//   const x = h('x-thread-id');
//   if (x) {
//     const n = Number(String(x).trim());
//     if (Number.isFinite(n)) return n;
//   }
//   const inrep = h('in-reply-to') || '';
//   const m = String(inrep).match(/hs-thread-(\d+)/i);
//   if (m) return Number(m[1]);
//   return null;
// }

// /* =========================
//    Persistance en BDD (+ idempotence)
//    ========================= */

// async function upsertInbound({
//   threadId,
//   fromName,
//   fromEmail,
//   subject,
//   text,
//   html,
//   attachments,
//   messageId,
//   gmailMsgId,
//   gmailThrId,
//   rawHash,
//   headersJson
// }) {
//   const cnx = await db.getConnection();
//   try {
//     const [rows] = await cnx.query(
//       `SELECT id FROM contact_messages
//        WHERE (message_id IS NOT NULL AND message_id = ?)
//           OR (gmail_msgid IS NOT NULL AND gmail_msgid = ?)
//           OR (raw_hash IS NOT NULL AND raw_hash = ?)
//        LIMIT 1`,
//       [messageId || null, gmailMsgId || null, rawHash || null]
//     );
//     if (rows.length) {
//       return { skipped: true, id: rows[0].id };
//     }

//     // Sauvegarde PJ -> disque
//     const saved = [];
//     for (const att of attachments || []) {
//       try {
//         const fname = att.filename || `file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
//         const disk = path.join(UPLOAD_DIR, fname);
//         const content = att.content;

//         if (Buffer.isBuffer(content)) {
//           fs.writeFileSync(disk, content);
//         } else if (content?.pipe) {
//           await new Promise((res, rej) => {
//             content.pipe(fs.createWriteStream(disk)).on('finish', res).on('error', rej);
//           });
//         } else {
//           continue;
//         }

//         saved.push({
//           name: fname,
//           mime: att.contentType || att.mimeType || null,
//           size: att.size || null,
//           path: `/uploads/mail/${fname}`,
//           diskPath: disk
//         });
//       } catch (err) {
//         console.error('[imapIngest] attachment save error:', err);
//       }
//     }

//     await cnx.beginTransaction();

//     const [ins] = await cnx.query(
//       `INSERT INTO contact_messages
//          (thread_id, direction, sender_email, sender_name, subject,
//           body_text, body_html, attachments,
//           message_id, gmail_msgid, gmail_thrid, raw_hash, headers_json,
//           created_at)
//        VALUES (?, 'in', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         threadId,
//         fromEmail || null,
//         fromName || null,
//         subject || null,
//         text || null,
//         html || null,
//         JSON.stringify(saved),
//         messageId || null,
//         gmailMsgId || null,
//         gmailThrId || null,
//         rawHash || null,
//         headersJson ? JSON.stringify(headersJson) : null,
//         nowMySQL()
//       ]
//     );

//     const now = nowMySQL();
//     await cnx.query(
//       `UPDATE contact_threads
//          SET last_incoming_at = ?, updated_at = ?,
//              status = CASE WHEN status = 'new' THEN 'open' ELSE status END
//        WHERE id = ?`,
//       [now, now, threadId]
//     );

//     await cnx.commit();
//     return { insertedId: ins.insertId, skipped: false };
//   } catch (e) {
//     await cnx.rollback();
//     if (String(e?.message || '').toLowerCase().includes('duplicate')) {
//       console.warn('[imapIngest] duplicate on insert => treated as idempotent');
//       return { skipped: true };
//     }
//     throw e;
//   } finally {
//     cnx.release();
//   }
// }

// /* =========================
//    Téléchargement RAW robuste (hors lock)
//    ========================= */

// async function collectStreamToBuffer(stream) {
//   const chunks = [];
//   await new Promise((res, rej) => {
//     stream.on('data', (c) => chunks.push(Buffer.from(c)));
//     stream.on('end', res);
//     stream.on('error', rej);
//   });
//   return Buffer.concat(chunks);
// }

// /**
//  * Essaie d'abord client.download(uid, {uid:true}),
//  * puis fallback sur fetchOne(uid,{uid:true, source:true}).
//  * Réessaie MAX_RETRIES fois avec backoff.
//  */
// async function safeDownloadRaw(client, uid) {
//   let lastErr;
//   for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
//     try {
//       const prom = client.download(uid, null, { uid: true });
//       const timeout = new Promise((_, rej) =>
//         setTimeout(() => rej(new Error(`download(uid=${uid}) timeout after ${PER_MSG_TIMEOUT_MS}ms`)), PER_MSG_TIMEOUT_MS)
//       );
//       const { content, source } = await Promise.race([prom, timeout]);
//       const stream = content || source;
//       if (!stream) throw new Error(`download(uid=${uid}) returned empty stream`);
//       return await collectStreamToBuffer(stream);
//     } catch (e) {
//       lastErr = e;
//       console.warn(`   ↪ download(uid=${uid}) failed (attempt ${attempt}/${MAX_RETRIES}): ${e.message}`);
//     }

//     try {
//       const prom = client.fetchOne(uid, { uid: true, source: true });
//       const timeout = new Promise((_, rej) =>
//         setTimeout(() => rej(new Error(`fetchOne(uid=${uid}, source) timeout after ${PER_MSG_TIMEOUT_MS_ALT}ms`)), PER_MSG_TIMEOUT_MS_ALT)
//       );
//       const msg = await Promise.race([prom, timeout]);

//       if (!msg) throw new Error('fetchOne returned null/undefined');
//       if (msg.source?.on) {
//         return await collectStreamToBuffer(msg.source);
//       } else if (Buffer.isBuffer(msg.source)) {
//         return msg.source;
//       } else {
//         throw new Error('fetchOne returned no usable source (neither stream nor buffer)');
//       }
//     } catch (e2) {
//       lastErr = e2;
//       console.warn(`   ↪ fetchOne(uid=${uid}, source) failed (attempt ${attempt}/${MAX_RETRIES}): ${e2.message}`);
//     }

//     await new Promise((r) => setTimeout(r, Math.min(1000 * attempt, 4000)));
//   }
//   throw lastErr || new Error(`Unable to fetch raw for uid=${uid}`);
// }

// /* =========================
//    Ingestion IMAP (runOnce)
//    ========================= */

// async function runOnce() {
//   const client = new ImapFlow({
//     host: process.env.IMAP_HOST || 'imap.gmail.com',
//     port: Number(process.env.IMAP_PORT || 993),
//     secure: true,
//     auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASS },
//     socketTimeout: SOCKET_TIMEOUT_MS
//   });

//   await client.connect();
//   try {
//     const since = new Date();
//     since.setDate(since.getDate() - RECENT_DAYS);

//     let targets = [];

//     const lock = await client.getMailboxLock('INBOX');
//     try {
//       let seqs;
//       if (GMAIL_RAW) {
//         seqs = await client.search({ gmailRaw: GMAIL_RAW });
//       } else {
//         seqs = await client.search({ seen: false, since });
//       }

//       if (!seqs || seqs.length === 0) {
//         console.log('ℹ️ Aucun message à ingérer.');
//         return;
//       }
//       console.log(`🔎 ${seqs.length} message(s) à ingérer…`);

//       for await (const msg of client.fetch(seqs, {
//         envelope: true,
//         bodyStructure: false,
//         internalDate: true,
//         flags: true,
//         uid: true,
//         headers: [
//           'from', 'to', 'cc', 'bcc', 'subject', 'date',
//           'message-id', 'in-reply-to', 'references', 'reply-to',
//           'delivered-to', 'x-original-to', 'x-received', 'x-thread-id'
//         ]
//       })) {
//         try {
//           const subject = msg.envelope?.subject || '';
//           console.log(`→ FETCH seq=${msg.seq} uid=${msg.uid} subject=${subject}`);

//           const headers = msg.headers;
//           let threadId = findThreadIdFromHeaders(headers);

//           const toAll = [];
//           const pushAddr = (list = []) => {
//             for (const a of list) {
//               const address =
//                 a?.address ||
//                 (a?.mailbox && a?.host ? `${a.mailbox}@${a.host}` : null);
//               if (address) toAll.push({ address });
//             }
//           };
//           pushAddr(msg.envelope?.to || []);
//           pushAddr(msg.envelope?.cc || []);
//           pushAddr(msg.envelope?.bcc || []);
//           if (!threadId) threadId = findThreadIdFromPlus(toAll);

//           if (!threadId) {
//             console.log(`(skip) pas de threadId pour seq=${msg.seq}`);
//             continue;
//           }

//           targets.push({
//             uid: msg.uid,
//             subject,
//             threadId,
//             headers
//           });
//         } catch (e) {
//           console.error(`❌ pre-check error seq=${msg.seq}:`, e);
//         }
//       }
//     } finally {
//       lock.release();
//       console.log('   ⤷ lock INBOX relâché (downloads hors lock)');
//     }

//     // 3) Télécharger + parser + BDD + notify
//     for (const t of targets) {
//       const { uid, subject, threadId, headers } = t;

//       try {
//         console.log(`   ⤷ récupération RAW (uid=${uid})…`);
//         const raw = await safeDownloadRaw(client, uid);

//         const rawHash = crypto.createHash('sha256').update(raw).digest('hex');

//         const mail = await simpleParser(raw);

//         const fromName = mail.from?.value?.[0]?.name || '';
//         const fromEmail = mail.from?.value?.[0]?.address || '';
//         const text = mail.text || '';
//         const html = mail.html || null;

//         const messageId = norm(mail.messageId);

//         const meta = await client.fetchOne(uid, {
//           uid: true,
//           source: false
//         });
//         const gmailMsgId = meta?.xGMMsgID ?? null;
//         const gmailThrId = meta?.xGMThreadID ?? null;

//         const headersJson = {
//           'message-id': messageId || undefined,
//           'in-reply-to': norm(mail.inReplyTo) || undefined,
//           'references': Array.isArray(mail.references) ? mail.references : mail.references ? [mail.references] : undefined,
//           ...Object.fromEntries(
//             (headers && headers.keys && headers.get)
//               ? Array.from(headers.keys()).map(k => [k, headers.get(k)])
//               : []
//           )
//         };

//         const res = await upsertInbound({
//           threadId,
//           fromName,
//           fromEmail,
//           subject,
//           text,
//           html,
//           attachments: mail.attachments || [],
//           messageId,
//           gmailMsgId,
//           gmailThrId,
//           rawHash,
//           headersJson
//         });

//         await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });

//         // NEW: webhook -> SSE
//         const payload = {
//           type: res.skipped ? 'dedupe' : 'insert',
//           threadId,
//           subject,
//           from: { name: fromName, email: fromEmail },
//           uid,
//           gmailMsgId,
//           gmailThrId,
//           at: Date.now(),
//           preview: (text || '').slice(0, 200),
//         };
//         await notify('message.ingested', payload);

//         if (res.skipped) {
//           console.log(`✅ Déjà ingéré (idempotent) -> thread ${threadId} (${fromEmail})`);
//         } else {
//           console.log(`✅ Ingest OK -> thread ${threadId} (${fromEmail})`);
//         }
//       } catch (e) {
//         console.error(`(skip) impossible d’ingérer uid=${uid}: ${e?.message || e}`);
//       }
//     }
//   } finally {
//     try {
//       await client.logout();
//     } catch (e) {
//       if (e?.code !== 'NoConnection') {
//         console.warn('[imapIngest] logout warning:', e?.message || e);
//       }
//     }
//   }
// }

// /* =========================
//    Boucle
//    ========================= */

// async function loop() {
//   while (true) {
//     try {
//       await runOnce();
//     } catch (e) {
//       console.error('[imapIngest] error:', e?.message || e);
//     }
//     await new Promise((r) => setTimeout(r, LOOP_SLEEP_MS));
//   }
// }

// if (process.env.NODE_ENV === 'production') {
//   loop();
// } else {
//   // En dev: un seul passage
//   runOnce()
//     .then(() => {
//       console.log('✅ Ingest pass terminé.');
//       process.exit(0);
//     })
//     .catch((e) => {
//       console.error('[imapIngest] fatal:', e);
//       process.exit(1);
//     });
// }

// workers/imapIngest.js
// workers/imapIngest.js
import 'dotenv/config';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import db from '../config/db.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import fetch from 'node-fetch'; // HTTP call vers l'API (Node < 18)

/* =========================
   Constantes & helpers
   ========================= */
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'mail');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const norm = (s) => (s ?? '').toString().trim();
const nowMySQL = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const RECENT_DAYS = Number(process.env.IMAP_RECENT_DAYS || 7);
const LOOP_SLEEP_MS = Number(process.env.IMAP_LOOP_SLEEP_MS || 30000);
const SOCKET_TIMEOUT_MS = Number(process.env.IMAP_SOCKET_TIMEOUT_MS || 300000); // 5 min
const PER_MSG_TIMEOUT_MS = Number(process.env.IMAP_PER_MSG_TIMEOUT_MS || 15000);
const PER_MSG_TIMEOUT_MS_ALT = Number(process.env.IMAP_PER_MSG_TIMEOUT_MS_ALT || 45000);
const MAX_RETRIES = Number(process.env.IMAP_MAX_RETRIES || 3);

// Filtre Gmail (X-GM-RAW). Exemple: label:"Support/Inbox" is:unread newer_than:7d
const GMAIL_RAW = process.env.IMAP_GMAIL_RAW;

/* =========================
   Notif webhook -> Socket.IO du serveur API
   ========================= */
const NOTIFY_URL =
  (process.env.NOTIFY_URL || process.env.INTERNAL_NOTIFY_URL || 'http://localhost:5001/inbound/notify').trim();

const NOTIFY_SECRET =
  (process.env.INTERNAL_NOTIFY_SECRET || process.env.NOTIFY_SECRET || '').trim();

// Logs de boot pour diagnostic
console.log('[imapIngest] boot', {
  INTERNAL_NOTIFY_URL: process.env.INTERNAL_NOTIFY_URL,
  NOTIFY_URL,
  SECRET_LEN: (NOTIFY_SECRET || '').length,
  NODE_ENV: process.env.NODE_ENV,
});

// Helper notify bavard (format event + data)
async function notify(event, data) {
  if (!NOTIFY_URL || !NOTIFY_SECRET) {
    console.warn('[imapIngest] notify skipped (missing NOTIFY_URL or NOTIFY_SECRET)');
    return false;
  }

  console.log('[imapIngest] notify →', {
    url: NOTIFY_URL,
    event,
    secret_len: (NOTIFY_SECRET || '').length,
  });

  let lastErr;
  for (let i = 1; i <= 2; i++) {
    try {
      const body = { event, data };
      const res = await fetch(NOTIFY_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-secret': NOTIFY_SECRET,
        },
        body: JSON.stringify(body),
      });

      const text = await res.text().catch(() => '');
      console.log(`[imapIngest] notify attempt ${i}: HTTP ${res.status} body=`, text);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (e) {
      lastErr = e;
      if (i < 2) await new Promise((r) => setTimeout(r, 500));
    }
  }
  console.warn('[imapIngest] notify failed:', lastErr?.message || lastErr);
  return false;
}

/* =========================
   Extraction du threadId
   ========================= */

// 1) depuis adresse du type ...+hs-thread-21@...
function findThreadIdFromPlus(addresses = []) {
  const re = /\+hs-thread-(\d+)\@/i;
  for (const a of addresses) {
    const addr = (a?.address || a || '').toString();
    const m = addr.match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

// 2) depuis headers: X-Thread-ID ou In-Reply-To / References
function findThreadIdFromHeaders(headers) {
  const h = (k) => headers?.get?.(k) || headers?.[k];
  const x = h('x-thread-id');
  if (x) {
    const n = Number(String(x).trim());
    if (Number.isFinite(n)) return n;
  }
  const inrep = h('in-reply-to') || '';
  const m = String(inrep).match(/hs-thread-(\d+)/i);
  if (m) return Number(m[1]);
  return null;
}

/* =========================
   Persistance en BDD (+ idempotence)
   ========================= */
async function upsertInbound({
  threadId,
  fromName,
  fromEmail,
  subject,
  text,
  html,
  attachments,
  messageId,
  gmailMsgId,
  gmailThrId,
  rawHash,
  headersJson
}) {
  const cnx = await db.getConnection();
  try {
    const [rows] = await cnx.query(
      `SELECT id FROM contact_messages
       WHERE (message_id IS NOT NULL AND message_id = ?)
          OR (gmail_msgid IS NOT NULL AND gmail_msgid = ?)
          OR (raw_hash IS NOT NULL AND raw_hash = ?)
       LIMIT 1`,
      [messageId || null, gmailMsgId || null, rawHash || null]
    );
    if (rows.length) {
      return { skipped: true, id: rows[0].id };
    }

    // Sauvegarde PJ -> disque
    const saved = [];
    for (const att of attachments || []) {
      try {
        const fname = att.filename || `file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const disk = path.join(UPLOAD_DIR, fname);
        const content = att.content;

        if (Buffer.isBuffer(content)) {
          fs.writeFileSync(disk, content);
        } else if (content?.pipe) {
          await new Promise((res, rej) => {
            content.pipe(fs.createWriteStream(disk)).on('finish', res).on('error', rej);
          });
        } else {
          continue;
        }

        saved.push({
          name: fname,
          mime: att.contentType || att.mimeType || null,
          size: att.size || null,
          path: `/uploads/mail/${fname}`,
          diskPath: disk
        });
      } catch (err) {
        console.error('[imapIngest] attachment save error:', err);
      }
    }

    await cnx.beginTransaction();

    const [ins] = await cnx.query(
      `INSERT INTO contact_messages
         (thread_id, direction, sender_email, sender_name, subject,
          body_text, body_html, attachments,
          message_id, gmail_msgid, gmail_thrid, raw_hash, headers_json,
          created_at)
       VALUES (?, 'in', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        threadId,
        fromEmail || null,
        fromName || null,
        subject || null,
        text || null,
        html || null,
        JSON.stringify(saved),
        messageId || null,
        gmailMsgId || null,
        gmailThrId || null,
        rawHash || null,
        headersJson ? JSON.stringify(headersJson) : null,
        nowMySQL()
      ]
    );

    const now = nowMySQL();
    await cnx.query(
      `UPDATE contact_threads
         SET last_incoming_at = ?, updated_at = ?,
             status = CASE WHEN status = 'new' THEN 'open' ELSE status END
       WHERE id = ?`,
      [now, now, threadId]
    );

    await cnx.commit();
    return { insertedId: ins.insertId, skipped: false };
  } catch (e) {
    await cnx.rollback();
    if (String(e?.message || '').toLowerCase().includes('duplicate')) {
      console.warn('[imapIngest] duplicate on insert => treated as idempotent');
      return { skipped: true };
    }
    throw e;
  } finally {
    cnx.release();
  }
}

/* =========================
   Téléchargement RAW robuste (hors lock)
   ========================= */
async function collectStreamToBuffer(stream) {
  const chunks = [];
  await new Promise((res, rej) => {
    stream.on('data', (c) => chunks.push(Buffer.from(c)));
    stream.on('end', res);
    stream.on('error', rej);
  });
  return Buffer.concat(chunks);
}

/**
 * Essaie d'abord client.download(uid, {uid:true}),
 * puis fallback sur fetchOne(uid,{uid:true, source:true}).
 * Réessaie MAX_RETRIES fois avec backoff.
 */
async function safeDownloadRaw(client, uid) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const prom = client.download(uid, null, { uid: true });
      const timeout = new Promise((_, rej) =>
        setTimeout(() => rej(new Error(`download(uid=${uid}) timeout after ${PER_MSG_TIMEOUT_MS}ms`)), PER_MSG_TIMEOUT_MS)
      );
      const { content, source } = await Promise.race([prom, timeout]);
      const stream = content || source;
      if (!stream) throw new Error(`download(uid=${uid}) returned empty stream`);
      return await collectStreamToBuffer(stream);
    } catch (e) {
      lastErr = e;
      console.warn(`   ↪ download(uid=${uid}) failed (attempt ${attempt}/${MAX_RETRIES}): ${e.message}`);
    }

    try {
      const prom = client.fetchOne(uid, { uid: true, source: true });
      const timeout = new Promise((_, rej) =>
        setTimeout(() => rej(new Error(`fetchOne(uid=${uid}, source) timeout after ${PER_MSG_TIMEOUT_MS_ALT}ms`)), PER_MSG_TIMEOUT_MS_ALT)
      );
      const msg = await Promise.race([prom, timeout]);

      if (!msg) throw new Error('fetchOne returned null/undefined');
      if (msg.source?.on) {
        return await collectStreamToBuffer(msg.source);
      } else if (Buffer.isBuffer(msg.source)) {
        return msg.source;
      } else {
        throw new Error('fetchOne returned no usable source (neither stream nor buffer)');
      }
    } catch (e2) {
      lastErr = e2;
      console.warn(`   ↪ fetchOne(uid=${uid}, source) failed (attempt ${attempt}/${MAX_RETRIES}): ${e2.message}`);
    }

    await new Promise((r) => setTimeout(r, Math.min(1000 * attempt, 4000)));
  }
  throw lastErr || new Error(`Unable to fetch raw for uid=${uid}`);
}

/* =========================
   Ingestion IMAP (runOnce)
   ========================= */
async function runOnce() {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASS },
    socketTimeout: SOCKET_TIMEOUT_MS
  });

  await client.connect();
  try {
    const since = new Date();
    since.setDate(since.getDate() - RECENT_DAYS);

    let targets = [];

    const lock = await client.getMailboxLock('INBOX');
    try {
      let seqs;
      if (GMAIL_RAW) {
        seqs = await client.search({ gmailRaw: GMAIL_RAW });
      } else {
        seqs = await client.search({ seen: false, since });
      }

      if (!seqs || seqs.length === 0) {
        console.log('ℹ️ Aucun message à ingérer.');

        // DEV ONLY : petit ping pour vérifier la chaîne
        if (process.env.NODE_ENV !== 'production') {
          await notify('message.ingested', {
            type: 'insert',
            source: 'imap-worker',
            threadId: 999,
            subject: 'Ping worker (dev)',
            from: { name: 'Worker Test', email: 'worker@test.local' },
            preview: 'Chaîne notify → backend → socket → front OK ✅',
            at: new Date().toISOString(),
          });
        }

        return;
      }

      console.log(`🔎 ${seqs.length} message(s) à ingérer…`);

      for await (const msg of client.fetch(seqs, {
        envelope: true,
        bodyStructure: false,
        internalDate: true,
        flags: true,
        uid: true,
        headers: [
          'from', 'to', 'cc', 'bcc', 'subject', 'date',
          'message-id', 'in-reply-to', 'references', 'reply-to',
          'delivered-to', 'x-original-to', 'x-received', 'x-thread-id'
        ]
      })) {
        try {
          const subject = msg.envelope?.subject || '';
          console.log(`→ FETCH seq=${msg.seq} uid=${msg.uid} subject=${subject}`);

          const headers = msg.headers;
          let threadId = findThreadIdFromHeaders(headers);

          const toAll = [];
          const pushAddr = (list = []) => {
            for (const a of list) {
              const address =
                a?.address ||
                (a?.mailbox && a?.host ? `${a.mailbox}@${a.host}` : null);
              if (address) toAll.push({ address });
            }
          };
          pushAddr(msg.envelope?.to || []);
          pushAddr(msg.envelope?.cc || []);
          pushAddr(msg.envelope?.bcc || []);
          if (!threadId) threadId = findThreadIdFromPlus(toAll);

          if (!threadId) {
            console.log(`(skip) pas de threadId pour seq=${msg.seq}`);
            continue;
          }

          targets.push({
            uid: msg.uid,
            subject,
            threadId,
            headers
          });
        } catch (e) {
          console.error(`❌ pre-check error seq=${msg.seq}:`, e);
        }
      }
    } finally {
      lock.release();
      console.log('   ⤷ lock INBOX relâché (downloads hors lock)');
    }

    // 3) Télécharger + parser + BDD + notify
    for (const t of targets) {
      const { uid, subject, threadId, headers } = t;

      try {
        console.log(`   ⤷ récupération RAW (uid=${uid})…`);
        const raw = await safeDownloadRaw(client, uid);

        const rawHash = crypto.createHash('sha256').update(raw).digest('hex');

        const mail = await simpleParser(raw);

        const fromName = mail.from?.value?.[0]?.name || '';
        const fromEmail = mail.from?.value?.[0]?.address || '';
        const text = mail.text || '';
        const html = mail.html || null;

        const messageId = norm(mail.messageId);

        const meta = await client.fetchOne(uid, { uid: true, source: false });
        const gmailMsgId = meta?.xGMMsgID ?? null;
        const gmailThrId = meta?.xGMThreadID ?? null;

        const headersJson = {
          'message-id': messageId || undefined,
          'in-reply-to': norm(mail.inReplyTo) || undefined,
          'references': Array.isArray(mail.references) ? mail.references : mail.references ? [mail.references] : undefined,
          ...Object.fromEntries(
            (headers && headers.keys && headers.get)
              ? Array.from(headers.keys()).map(k => [k, headers.get(k)])
              : []
          )
        };

        const res = await upsertInbound({
          threadId,
          fromName,
          fromEmail,
          subject,
          text,
          html,
          attachments: mail.attachments || [],
          messageId,
          gmailMsgId,
          gmailThrId,
          rawHash,
          headersJson
        });

        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });

        // Payload enrichi et cohérent avec le front
        const payload = {
          type: res.skipped ? 'dedupe' : 'insert',
          source: 'imap-worker',
          threadId,
          subject,
          from: { name: fromName, email: fromEmail },
          messageId,
          uid,
          gmailMsgId,
          gmailThrId,
          at: new Date().toISOString(),
          preview: (text || '').slice(0, 200),
        };
        console.log("[imapIngest] ABOUT TO NOTIFY payload =", JSON.stringify(payload));
        await notify('message.ingested', payload);

        if (res.skipped) {
          console.log(`✅ Déjà ingéré (idempotent) -> thread ${threadId} (${fromEmail})`);
        } else {
          console.log(`✅ Ingest OK -> thread ${threadId} (${fromEmail})`);
        }
      } catch (e) {
        console.error(`(skip) impossible d’ingérer uid=${uid}: ${e?.message || e}`);
      }
    }
  } finally {
    try {
      await client.logout();
    } catch (e) {
      if (e?.code !== 'NoConnection') {
        console.warn('[imapIngest] logout warning:', e?.message || e);
      }
    }
  }
}

/* =========================
   Boucle
   ========================= */
async function loop() {
  while (true) {
    try {
      await runOnce();
    } catch (e) {
      console.error('[imapIngest] error:', e?.message || e);
    }
    await new Promise((r) => setTimeout(r, LOOP_SLEEP_MS));
  }
}

if (process.env.NODE_ENV === 'production') {
  loop();
} else {
  // En dev: un seul passage (avec ping s’il n’y a rien à ingérer)
  runOnce()
    .then(() => {
      console.log('✅ Ingest pass terminé.');
      process.exit(0);
    })
    .catch((e) => {
      console.error('[imapIngest] fatal:', e);
      process.exit(1);
    });
}
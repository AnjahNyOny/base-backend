// scripts/inboundGmail.js
import 'dotenv/config.js';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import fs from 'fs';
import path from 'path';
import db from '../config/db.js'; // adapte le chemin à ton projet

/* ---------- utils ---------- */
function readBool(v, def=false){
  if (v === undefined || v === null || v === '') return def;
  const s = String(v).trim().toLowerCase();
  return ['1','true','yes','y'].includes(s);
}
function nowMySQL(){ return new Date().toISOString().slice(0,19).replace('T',' '); }
function norm(s){ return (s ?? '').toString().trim(); }

/* ---------- config ---------- */
const IMAP_HOST   = process.env.IMAP_HOST || 'imap.gmail.com';
const IMAP_PORT   = Number(process.env.IMAP_PORT || 993);
const IMAP_SECURE = readBool(process.env.IMAP_SECURE, true);
const IMAP_USER   = process.env.IMAP_USER;
const IMAP_PASS   = process.env.IMAP_PASS;
const IMAP_MAILBOX= process.env.IMAP_MAILBOX || 'INBOX';
const POLL_MS     = Number(process.env.IMAP_POLL_MS || 30000);

if (!IMAP_USER || !IMAP_PASS) {
  console.error('[inbound] IMAP_USER/IMAP_PASS manquants'); process.exit(1);
}

/* ---------- helpers: resolve thread id ---------- */
async function findThreadIdByHeaders({ xThreadId, replyToPlusId, refsMessageIds=[] }) {
  // 1) X-Thread-ID direct
  const direct = Number(xThreadId);
  if (Number.isFinite(direct) && direct > 0) return direct;

  // 2) Reply-To plus addressing
  const plusId = Number(replyToPlusId);
  if (Number.isFinite(plusId) && plusId > 0) return plusId;

  // 3) via In-Reply-To / References -> match email_outbox.provider_message_id
  if (refsMessageIds.length) {
    const placeholders = refsMessageIds.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT eo.thread_id
         FROM email_outbox eo
        WHERE eo.provider_message_id IN (${placeholders})
        ORDER BY eo.id DESC
        LIMIT 1`,
      refsMessageIds
    );
    if (rows.length) return rows[0].thread_id;
  }

  return null;
}

// extrait l’id de +hs-thread-<id> présent dans Reply-To/To/Delivered-To...
function extractPlusThreadId(addresses=[]) {
  for (const a of addresses || []) {
    // a.value: [{ address, name }]
    const arr = a.value || [];
    for (const one of arr) {
      const email = (one.address || '').toLowerCase();
      const m = email.match(/\+hs-thread-(\d+)\@/);
      if (m) return Number(m[1]);
    }
  }
  return null;
}

// récupère array de message-id depuis In-Reply-To / References
function collectRefIds(headers) {
  const vals = [];
  const inReply = headers.get('in-reply-to');
  const refs = headers.get('references');
  const pushIds = (s) => {
    if (!s) return;
    const ms = String(s).match(/<[^>]+>/g);
    if (ms) vals.push(...ms.map(v => v.replace(/[<>]/g,'')));
  };
  pushIds(inReply);
  pushIds(refs);
  return Array.from(new Set(vals));
}

/* ---------- persist inbound message ---------- */
async function persistInbound({ threadId, fromName, fromEmail, subject, text, html, messageId, attachmentsMeta }) {
  let tId = threadId;

  // si on n'a pas de thread, on essaie d’en créer un (fallback "nouveau thread")
  if (!tId) {
    const [res] = await db.query(
      `INSERT INTO contact_threads
         (subject, user_email, user_name, status, priority, langue, last_incoming_at, created_at, updated_at)
       VALUES (?, ?, ?, 'new', 'normal', 'fr', NOW(), NOW(), NOW())`,
      [subject || '(sans sujet)', norm(fromEmail), norm(fromName)]
    );
    tId = res.insertId;
  }

  const now = nowMySQL();
  const [mRes] = await db.query(
    `INSERT INTO contact_messages
       (thread_id, direction, sender_email, sender_name, body_text, body_html, attachments, provider_message_id, created_at)
     VALUES (?, 'in', ?, ?, ?, ?, ?, ?, ?)`,
    [tId, fromEmail || '', fromName || '', text || '', html || null, JSON.stringify(attachmentsMeta || []), messageId || null, now]
  );

  await db.query(
    `UPDATE contact_threads
        SET last_incoming_at = ?, updated_at = ?,
            status = CASE WHEN status IN ('closed','archived') THEN status ELSE 'open' END
      WHERE id = ?`,
    [now, now, tId]
  );

  return { thread_id: tId, message_id: mRes.insertId };
}

/* ---------- attachment save (optionnel disque) ---------- */
async function saveAttachments(attachments=[], baseDir='uploads/email') {
  // crée un dossier daté pour éviter les collisions
  const saved = [];
  for (const att of attachments) {
    // att: { filename, content, contentType, size, ... }
    if (!att.content) continue;
    const dir = path.resolve(process.cwd(), baseDir, String(Date.now()));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const safeName = (att.filename || 'file').replace(/[^\w.\-]+/g, '_');
    const filePath = path.join(dir, safeName);
    fs.writeFileSync(filePath, att.content);
    saved.push({
      name: att.filename || 'file',
      size: Buffer.byteLength(att.content),
      mime: att.contentType || null,
      diskPath: filePath,       // on fournit diskPath pour l’envoi ultérieur
      path: filePath.replace(process.cwd(), '').replace(/\\/g,'/'),
      url: null                 // pas d’URL publique par défaut
    });
  }
  return saved;
}

/* ---------- main fetch ---------- */
async function fetchOnce(client) {
  // lock la mailbox
  await client.mailboxOpen(IMAP_MAILBOX, { readOnly: false });

  // On cible les non-lus (UNSEEN). Tu peux élargir si besoin.
  const search = ['UNSEEN'];
  for await (let msg of client.fetch(search, { source: true, envelope: true, flags: true, headers: true })) {
    try {
      const parsed = await simpleParser(msg.source);

      // Déduplication par Message-ID si tu as fait la migration
      const messageId = norm(parsed.messageId);
      if (messageId) {
        const [[exists] = []] = await db.query(
          `SELECT id FROM contact_messages WHERE provider_message_id = ? LIMIT 1`,
          [messageId]
        );
        if (exists) {
          // déjà ingéré -> marque comme lu et continue
          await client.messageFlagsAdd(msg.uid, ['\\Seen']);
          continue;
        }
      }

      const headers = parsed.headers;
      // 1) X-Thread-ID
      const xThreadId = headers.get('x-thread-id');

      // 2) +hs-thread-<id> dans Reply-To / To / Delivered-To
      const replyToPlusId = extractPlusThreadId([parsed.replyTo, parsed.to, parsed.deliveredTo]);

      // 3) références (In-Reply-To / References)
      const refIds = collectRefIds(headers);

      const threadId = await findThreadIdByHeaders({
        xThreadId,
        replyToPlusId,
        refsMessageIds: refIds
      });

      const fromName  = parsed.from?.value?.[0]?.name || '';
      const fromEmail = parsed.from?.value?.[0]?.address || '';
      const subject   = parsed.subject || '(sans sujet)';
      const text      = parsed.text || '';
      const html      = parsed.html || null;

      // pièces jointes -> disque (optionnel)
      const attsMeta = await saveAttachments(parsed.attachments || []);

      await persistInbound({
        threadId,
        fromName,
        fromEmail,
        subject,
        text,
        html,
        messageId,
        attachmentsMeta: attsMeta
      });

      // Marquer comme lu
      await client.messageFlagsAdd(msg.uid, ['\\Seen']);
    } catch (err) {
      console.error('[inbound] parse/persist error:', err);
      // on laisse UNSEEN pour re-tentative ultérieure
    }
  }

  await client.mailboxClose();
}

/* ---------- runner ---------- */
async function run() {
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: IMAP_SECURE,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
    logger: false
  });

  client.on('error', (err) => console.error('[inbound] IMAP error:', err));

  try {
    await client.connect();

    // Stratégie simple polling (robuste partout, y compris Gmail) :
    while (true) {
      try {
        await fetchOnce(client);
      } catch (e) {
        console.error('[inbound] fetchOnce error:', e);
      }
      await new Promise(r => setTimeout(r, POLL_MS));
    }
  } catch (e) {
    console.error('[inbound] connect error:', e);
  } finally {
    // ne jamais really fermer dans une boucle infinie
  }
}

run();
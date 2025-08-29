// scripts/cleanup-uploads.mjs
import "dotenv/config";                 // charge .env pour la pool MySQL
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import db from "../config/db.js";       // ta pool MySQL existante

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =============================
   CLI parsing
   ============================= */
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    yes: false,                               // supprimer réellement (sinon dry-run)
    ttlDays: Number(process.env.CLEAN_TTL_DAYS || 30),
    uploadsDir: process.env.UPLOADS_DIR || path.resolve(__dirname, "../uploads"),
    qdf: false,                               // log détaillé
  };
  for (const a of args) {
    if (a === "--yes") opts.yes = true;
    else if (a === "--qdf") opts.qdf = true;
    else if (a.startsWith("--ttlDays=")) opts.ttlDays = Number(a.split("=")[1] || 30);
    else if (a.startsWith("--uploadsDir=")) opts.uploadsDir = a.split("=")[1];
  }
  return opts;
}

/* =============================
   Helpers
   ============================= */
function daysAgoToMs(days) { return days * 24 * 60 * 60 * 1000; }
function isOlderThan(stat, ms) { return Date.now() - stat.mtimeMs > ms; }

async function getAllUploadFiles(uploadsDir) {
  if (!fs.existsSync(uploadsDir)) return [];
  const names = await fsp.readdir(uploadsDir);
  const out = [];
  for (const name of names) {
    const full = path.join(uploadsDir, name);
    const st = await fsp.stat(full);
    if (st.isFile()) out.push({ name, full, stat: st });
  }
  return out;
}

function safeJSONParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

function basenamesFromAttachment(a) {
  // On tente plusieurs champs possibles pour retomber sur le nom de fichier
  const candidates = [
    a?.path, a?.url, a?.diskPath,
    a?.storedName, a?.stored_name, a?.filename, a?.name,
  ].filter(Boolean);
  const bases = new Set();
  for (const c of candidates) {
    const str = String(c);
    // si c'est déjà un nom (pas un chemin), path.basename le laissera tel quel
    bases.add(path.basename(str));
  }
  return Array.from(bases).filter(Boolean);
}

/**
 * Parcourt `contact_messages.attachments` (JSON) et agrège tous
 * les basenames référencés (path/url/diskPath/storedName/filename/name).
 */
// Récupère tous les basenames référencés dans la colonne JSON `attachments` de contact_messages
// diskNameSet = Set des noms (basenames) réellement présents dans /uploads
// Récupère tous les basenames référencés dans contact_messages.attachments (JSON ou texte bruité)
// diskNameSet = Set des noms présents physiquement dans /uploads
async function getReferencedBasenames() {
  const [rows] = await db.query(
    `SELECT attachments FROM contact_messages WHERE attachments IS NOT NULL AND attachments <> ''`
  );

  const set = new Set();

  for (const r of rows) {
    let arr = [];

    try {
      if (typeof r.attachments === "string") {
        arr = JSON.parse(r.attachments || "[]");
      } else if (Array.isArray(r.attachments)) {
        arr = r.attachments;
      } else if (typeof r.attachments === "object" && r.attachments !== null) {
        // si MySQL renvoie déjà un JSON → wrap dans tableau
        arr = [r.attachments];
      }
    } catch (e) {
      console.warn("bad JSON attachments:", r.attachments, e.message);
      arr = [];
    }

    if (!Array.isArray(arr)) continue;

    for (const a of arr) {
      const p = a?.path || a?.url || "";
      if (!p) continue;
      const base = path.basename(String(p));
      if (base) set.add(base);
    }
  }
  return set;
}

/* =============================
   Main
   ============================= */
async function main() {

  const { yes, ttlDays, uploadsDir, qdf } = parseArgs();
  const ttlMs = daysAgoToMs(ttlDays);

  console.log(`[cleanup-uploads] uploadsDir=${uploadsDir}`);
  console.log(`[cleanup-uploads] ttlDays=${ttlDays} (dry-run=${!yes})`);

  const allFiles = await getAllUploadFiles(uploadsDir);
  console.log(`[cleanup-uploads] total files on disk: ${allFiles.length}`);

  // NEW: set des basenames présents dans /uploads
  const diskNameSet = new Set(allFiles.map(f => f.name));

  const referenced = await getReferencedBasenames(diskNameSet);
  console.log(`[cleanup-uploads] referenced in DB: ${referenced.size}`);

  const orphans = [];
  for (const f of allFiles) {
    if (!referenced.has(f.name)) {
      orphans.push(f);
    }
  }
  console.log(`[cleanup-uploads] orphans: ${orphans.length}`);

  let deleted = 0;
  for (const f of orphans) {
    const oldEnough = isOlderThan(f.stat, ttlMs);
    if (qdf) {
      console.log(`- ${f.name}  ${oldEnough ? "[old]" : "[young]"}  mtime=${new Date(f.stat.mtimeMs).toISOString()}`);
    }
    if (!oldEnough) continue;

    if (yes) {
      try {
        await fsp.unlink(f.full);
        deleted++;
        console.log(`deleted: ${f.name}`);
      } catch (e) {
        console.error(`failed to delete ${f.name}:`, e.message);
      }
    } else {
      console.log(`[dry-run] would delete: ${f.name}`);
    }
  }

  console.log(`[cleanup-uploads] done. deleted=${deleted}${yes ? "" : " (dry-run)"}`);

  // Termine proprement la pool
  try { await db.end?.(); } catch { }
}

main().catch((e) => {

  console.error("[cleanup-uploads] error:", e);
  process.exit(1);
});
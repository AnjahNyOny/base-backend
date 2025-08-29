import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { defaultLimiter } from "../middlewares/rateLimit.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dossier d'upload (disque)
const UP_DIR = path.resolve(__dirname, "../uploads");
if (!fs.existsSync(UP_DIR)) fs.mkdirSync(UP_DIR, { recursive: true });

// Multer: stockage disque
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UP_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, "_");
    const unique = Date.now() + "_" + Math.random().toString(36).slice(2);
    cb(null, unique + "_" + safe);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Helper URL publique
function publicUrlFor(relPath) {
  const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const urlPath = `/uploads/${relPath}`;
  return base ? `${base}${urlPath}` : urlPath;
}

// POST /api/upload  (champ: "file")
router.post("/upload", defaultLimiter, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });

  const { filename, originalname, size, mimetype, path: diskPath } = req.file;
  const webPath = `/uploads/${filename}`;

  const payload = {
    name: originalname || filename, // 👈 nom “humain”
    storedName: filename,           // nom stocké sur disque
    size,
    mime: mimetype,
    path: webPath,
    url: publicUrlFor(filename),
    diskPath: diskPath,
  };

  res.json({ file: payload });
});

export default router;
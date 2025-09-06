// cms_backend/routes/upload-images.js
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dossier cible: /var/www/hs-conseil/backend/uploads/images
const UPLOADS_ROOT = process.env.UPLOADS_ROOT || path.resolve(__dirname, "../uploads");
const IMAGES_DIR = path.join(UPLOADS_ROOT, "images");

// s'assure que le dossier existe
fs.mkdirSync(IMAGES_DIR, { recursive: true });

// --- Utils sécurité: empêcher l'escape du dossier images (../ etc.)
function resolveInsideImagesDir(relOrAbsPath) {
  if (typeof relOrAbsPath !== "string" || !relOrAbsPath) {
    throw new Error("Chemin invalide");
  }
  // Accepte "/uploads/images/xxx" ou juste "xxx"
  const cleaned = relOrAbsPath.replace(/^https?:\/\/[^/]+/i, ""); // enlève un éventuel host
  const rel = cleaned.startsWith("/uploads/images/")
    ? cleaned.replace(/^\/uploads\/images\//, "")
    : cleaned.replace(/^\/+/, "");
  const full = path.resolve(IMAGES_DIR, rel);
  if (!full.startsWith(path.resolve(IMAGES_DIR))) {
    throw new Error("Chemin en dehors du répertoire autorisé");
  }
  return full;
}

// config multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, IMAGES_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base = path.basename(file.originalname || "", ext).replace(/\s+/g, "_").slice(0, 64);
    const stamp = Date.now();
    const rnd = Math.random().toString(36).slice(2, 8);
    cb(null, `${stamp}_${rnd}_${base}${ext}`);
  },
});

function imageFilter(_req, file, cb) {
  const ok = /^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.mimetype);
  if (!ok) return cb(new Error("Type de fichier non supporté"), false);
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo
});

/**
 * Enregistre l’image et renvoie:
 * {
 *   path: "/uploads/images/xxx.png",
 *   url:  "<PUBLIC_BASE_URL>/uploads/images/xxx.png",
 *   name, size, type
 * }
 */
export function mountUploadImagesRoutes(app) {
  const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "";

  // Upload d'une image
  app.post("/api/upload/image", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Aucun fichier" });
    const relPath = `/uploads/images/${req.file.filename}`;
    res.json({
      path: relPath,
      url: PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}${relPath}` : relPath,
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
    });
  });

  /**
   * Liste la bibliothèque:
   * GET /api/files/images?search=&page=1&pageSize=50
   */
  app.get("/api/files/images", async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 50));
    const q = String(req.query.search || "").toLowerCase();

    try {
      const entries = await fs.promises.readdir(IMAGES_DIR);
      const items = [];

      for (const name of entries) {
        const full = path.join(IMAGES_DIR, name);
        const stat = await fs.promises.stat(full);
        if (!stat.isFile()) continue;
        if (q && !name.toLowerCase().includes(q)) continue;
        items.push({
          name,
          size: stat.size,
          mtime: stat.mtimeMs,
          path: `/uploads/images/${name}`,
          url: PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}/uploads/images/${name}` : `/uploads/images/${name}`,
        });
      }

      // récents d’abord
      items.sort((a, b) => b.mtime - a.mtime);

      const total = items.length;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      res.json({
        page,
        pageSize,
        total,
        items: items.slice(start, end),
      });
    } catch (e) {
      res.status(500).json({ message: e?.message || "Erreur lecture bibliothèque" });
    }
  });

  /**
   * Suppression unitaire (compat)
   * DELETE /api/files/images?path=/uploads/images/xxx.png
   */
  app.delete("/api/files/images", async (req, res) => {
    try {
      const pathParam = String(req.query.path || "");
      if (!pathParam) return res.status(400).json({ message: "Paramètre 'path' requis" });
      const full = resolveInsideImagesDir(pathParam);
      await fs.promises.unlink(full);
      return res.json({ ok: true, path: pathParam });
    } catch (e) {
      const msg = e?.code === "ENOENT" ? "Fichier introuvable" : (e?.message || "delete_error");
      return res.status(400).json({ ok: false, message: msg });
    }
  });

  /**
   * Suppression en lot (bulk)
   * POST /api/files/images/bulk-delete
   * body: { paths: ["/uploads/images/a.png", "/uploads/images/b.jpg", ...] }
   */
  app.post("/api/files/images/bulk-delete", async (req, res) => {
    try {
      const paths = Array.isArray(req.body?.paths) ? req.body.paths : [];
      if (!paths.length) return res.status(400).json({ message: "paths[] requis" });

      const results = [];
      for (const p of paths) {
        try {
          const full = resolveInsideImagesDir(p);
          await fs.promises.unlink(full);
          results.push({ path: p, ok: true });
        } catch (e) {
          const msg = e?.code === "ENOENT" ? "Fichier introuvable" : (e?.message || "delete_error");
          results.push({ path: p, ok: false, error: msg });
        }
      }
      res.json({ ok: true, results });
    } catch (e) {
      res.status(400).json({ ok: false, message: e?.message || "bulk_delete_error" });
    }
  });
}

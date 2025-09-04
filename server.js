// server.js
import path from "path";
import express from "express";
import { fileURLToPath } from "url";
import cors from "cors";
import helmet from "helmet";
import routes from "./routes/index.js";
import { authenticate } from "./middlewares/authMiddleware.js";
import db from "./config/db.js";
import "dotenv/config";
import logger from "./services/logger.js";  
import http from "http";
import { initRealtime } from "./services/realtime.js"; // si tu veux garder socket.io

import {
  register as metricsRegistry,
  startHttpTimer,
  sseClientsGauge,
  dbPingDuration,
} from "./services/metrics.js";  

const app = express();
const server = http.createServer(app); 
// Pour récupérer la bonne IP client quand tu es derrière un reverse-proxy
app.set("trust proxy", 1);
const PORT = process.env.PORT ? Number(process.env.PORT) : 5001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================
   Middlewares globaux
   ========================= */

// Logger HTTP minimal
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const endTimer = startHttpTimer(req);
    logger.info("http", {
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      ms,
      ip: req.headers["x-forwarded-for"] || req.ip,
    });
    try { endTimer(res); } catch (_) {}
  });
  next();
});


// --- CORS global (remplace ton app.use(cors(...)) existant) ---
const ALLOWED_ORIGINS = (process.env.ADMIN_ORIGINS || [
  "http://10.0.0.47:8080",   // ton dev server
  "http://localhost:8080",   // variante locale
  "http://localhost:5173",   // si tu utilises vite à l’occasion
].join(","))
  .split(",")
  .map(s => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    // Autorise requêtes sans Origin (curl, healthchecks)
    if (!origin) return cb(null, true);
    const ok = ALLOWED_ORIGINS.includes(origin.replace(/\/+$/, ""));
    cb(null, ok);
  },
  credentials: true,
}));
app.options("*", cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    const ok = ALLOWED_ORIGINS.includes(origin.replace(/\/+$/, ""));
    cb(null, ok);
  },
  credentials: true,
}));

app.options("*", cors({ origin: true, credentials: true }));
// Headers de sécurité (autorise CORP pour /uploads)
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

/* =========================
   Fichiers statiques /uploads
   ========================= */
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
/* =========================
   Routes API
   ========================= */
app.use((req, _res, next) => {
  if (req.path === '/api/inbound/notify') {
    logger.debug('[server] hit /api/inbound/notify');
  }
  next();
});
app.use("/api", routes);

+/* =========================
+   Metrics (Prometheus)
+   ========================= */
app.get("/api/metrics", async (_req, res) => {
  try {
    res.set("Content-Type", metricsRegistry.contentType);
    const body = await metricsRegistry.metrics();
    res.status(200).end(body);
  } catch (e) {
    logger.error("[metrics] error", { error: e?.message || e });
    res.status(500).end("metrics_error");
  }
});

app.get("/api/admin", authenticate, (req, res) => {
  res.json({ message: `Bienvenue, ${req.user.username}` });
});


/* =========================
   Healthcheck
   ========================= */
app.get("/api/healthz", async (_req, res) => {
  const startedAt = process.uptime(); // en secondes
  const now = new Date().toISOString();
  try {
    // ping DB + observe durée
    const endDb = dbPingDuration.startTimer();
    await db.query("SELECT 1");
    endDb();
    return res.status(200).json({
      ok: true,
      now,
      uptimeSeconds: Math.round(startedAt),
      db: "ok",
      env: process.env.NODE_ENV || "development",
    });
  } catch (e) {
    logger.error("[healthz] DB error", { error: e?.message || String(e) });
    return res.status(503).json({
      ok: false,
      now,
      uptimeSeconds: Math.round(startedAt),
      db: "error",
      error: e?.message || "db unavailable",
    });
  }
});

app.get("/api/pageAccueil", async (req, res) => {
  const langue = req.query.langue || "fr";
  try {
    const result = await db.query(
      `
      SELECT p.id
      FROM page p
      INNER JOIN site s ON p.site_id = s.id
      WHERE s.langue_active = ?
      AND p.slug = 'accueil'
    `,
      [langue]
    );
    const page = result[0];
    if (page) {
      res.json({ id: page.id });
    } else {
      res.status(404).json({ message: "Page d'accueil introuvable" });
    }
  } catch (error) {
    logger.error("Erreur pageAccueil", { error: error?.message || error });
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get("/", (_req, res) => {
  res.send("Bienvenue sur l'API !");
});

/* =========================
   SSE (Server-Sent Events)
   ========================= */
const SSE_HEARTBEAT_MS = 25_000;
const sseClients = new Set();

function sseBroadcast(event, payload) {
  const frame = `event: ${event}\n` + `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) { try { res.write(frame); } catch {} }
}

app.get("/api/inbound/sse", (req, res) => {
  // Choisit dynamiquement l’origine exacte du client si elle est autorisée
  const reqOrigin = String(req.get("origin") || "").replace(/\/+$/, "");
  const allowOrigin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : (ALLOWED_ORIGINS[0] || "*");

  // ⚠️ Avec credentials, interdit d’envoyer "*"
  if (allowOrigin === "*") {
    // en dernier recours, refuse si aucune origine autorisée n’est définie
    return res.status(403).end("CORS origin not allowed");
  }

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  });

  res.flushHeaders?.();
  res.write("retry: 5000\n\n");

  const hb = setInterval(() => res.write(": hb\n\n"), SSE_HEARTBEAT_MS);
  sseClients.add(res);

  req.on("close", () => {
    clearInterval(hb);
    sseClients.delete(res);
    try { res.end(); } catch {}
  });
});


/* =========================
   Webhook interne (appelé par le worker IMAP)
   ========================= */
// .env : INTERNAL_NOTIFY_SECRET=ton-secret
const INTERNAL_NOTIFY_SECRET = (process.env.INTERNAL_NOTIFY_SECRET || "").trim();

app.post("/api/inbound/notify", (req, res) => {
  // compat avec les deux en-têtes
  const got =
    req.get("x-internal-secret") ||
    req.get("x-webhook-secret") || "";

  if (!INTERNAL_NOTIFY_SECRET || got !== INTERNAL_NOTIFY_SECRET) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const { event = "message.ingested", data = {} } = req.body || {};

  // diffuse SSE
  sseBroadcast(event, data);

  // optionnel: si tu veux aussi pousser via Socket.IO (si présent)
  try {
    server.emit?.("realtime:inbound", { event, data }); // hook léger si ton initRealtime l’écoute
  } catch (_) { }

  return res.json({ ok: true });
});

/* =========================
   Démarrage
   ========================= */
initRealtime(server); // 👈 garde si tu utilises Socket.IO en plus du SSE
logger.info('INTERNAL_NOTIFY_URL', { url: process.env.INTERNAL_NOTIFY_URL || null });
logger.info('INTERNAL_NOTIFY_SECRET len', { len: (INTERNAL_NOTIFY_SECRET || "").length });

// server.listen(PORT, () => {
//   console.log(`✅ Serveur en cours d'exécution : http://localhost:${PORT}`);
// });
// Guard rails process-wide
process.on("unhandledRejection", (err) => {
  logger.error("unhandledRejection", { error: err?.message || String(err) });
});
process.on("uncaughtException", (err) => {
  logger.error("uncaughtException", { error: err?.message || String(err) });
});

server.listen(PORT, () => {
  logger.info("✅ Serveur démarré", { url: `http://localhost:${PORT}`, env: process.env.NODE_ENV || "development" });
});
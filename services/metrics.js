// services/metrics.js
import client from "prom-client";

const register = new client.Registry();

// Préfixe optionnel pour éviter les collisions
const METRICS_PREFIX = process.env.METRICS_PREFIX || "cms_";

// Métriques par défaut (CPU, mem, event loop, GC, etc.)
client.collectDefaultMetrics({
  register,
  prefix: METRICS_PREFIX,
  // 10s par défaut ; tu peux changer via env PROM_CLIENT_COLLECT_DEFAULT_METRICS_INTERVAL
});

// Histogramme des requêtes HTTP
const httpRequestDuration = new client.Histogram({
  name: `${METRICS_PREFIX}http_request_duration_seconds`,
  help: "Durée des requêtes HTTP (en secondes)",
  labelNames: ["method", "route", "code"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10], // ajustables
});

// Gauge du nombre de clients SSE connectés
const sseClientsGauge = new client.Gauge({
  name: `${METRICS_PREFIX}sse_clients`,
  help: "Nombre de clients SSE connectés",
});

// Histogramme ping DB (ex: healthz)
const dbPingDuration = new client.Histogram({
  name: `${METRICS_PREFIX}db_ping_seconds`,
  help: "Durée du ping DB (en secondes)",
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
});

register.registerMetric(httpRequestDuration);
register.registerMetric(sseClientsGauge);
register.registerMetric(dbPingDuration);

function getRouteLabel(req) {
  // Essaye de récupérer le path “logique” si dispo
  // (Express ne l’a pas toujours dans le middleware global)
  return (
    req.route?.path ||
    req.originalUrl?.split("?")[0] ||
    req.path ||
    "unknown"
  );
}

function startHttpTimer(req) {
  const method = (req.method || "GET").toUpperCase();
  const route = getRouteLabel(req);
  const end = httpRequestDuration.startTimer({ method, route });
  return (res) => {
    const code = res.statusCode || 0;
    // Permet de fixer “route” au bon pattern si disponible plus tard
    const finalRoute = getRouteLabel(req);
    end({ code, route: finalRoute });
  };
}

// --- Helpers idempotents (utile avec nodemon) ---
function ensureCounter(name, help, labelNames = []) {
  const existing = register.getSingleMetric(name);
  if (existing) return existing;
  const c = new client.Counter({ name, help, labelNames });
  register.registerMetric(c);
  return c;
}

// --- Nouveaux compteurs applicatifs ---
export const inboundCreatedTotal = ensureCounter(
  "cms_inbound_created_total",
  "Number of inbound messages created"
);

export const emailSentTotal = ensureCounter(
  "cms_email_sent_total",
  "Number of emails successfully sent",
  ["provider"]
);

export const emailFailedTotal = ensureCounter(
  "cms_email_failed_total",
  "Number of emails failed to send",
  ["provider"]
);

export {
  register,
  httpRequestDuration,
  sseClientsGauge,
  dbPingDuration,
  startHttpTimer,
};
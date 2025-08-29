// middleware/rateLimit.js
import rateLimit from "express-rate-limit";

/**
 * Limite agressive pour l'endpoint public /contact/messages
 * (formulaire de contact). 5 req / 60s par IP.
 */
export const contactMessageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Trop de requêtes, veuillez réessayer dans une minute." },
});

/**
 * Optionnel : limite par défaut “douce” pour d’autres POST publics si besoin.
 */
export const defaultLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
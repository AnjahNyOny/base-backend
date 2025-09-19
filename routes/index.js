// routes/index.js
import express from "express";

// Core CMS
import pagesRoutes from "./pagesRoutes.js";
import contenuRoutes from "./contenuRoutes.js";
import globalContentRoutes from "./globalContentRoutes.js";
import footerRoutes from "./footerRoutes.js";
import imagesRoutes from "./imagesRoutes.js";
import buttonRoutes from "./buttonRoutes.js";

// Domain sections
import companyOverviewRoutes from "./companyOverviewRoutes.js";
import teamSectionRoutes from "./teamSectionRoutes.js";
import whyChooseUsRoutes from "./whyChooseUsRoutes.js";
import qualityCommitmentRoutes from "./qualityCommitmentRoutes.js";
import heroRoutes from "./heroRoutes.js";
import servicesRoutes from "./servicesRoutes.js";
import realisationRoutes from "./realisationRoutes.js";
import caseComponentRoutes from "./caseComponentRoutes.js";
import clientLogoComponentRoutes from "./clientLogoComponentRoutes.js";
import focusComponentRoutes from "./focusComponentRoutes.js";
import gallerieComponentRoutes from "./gallerieComponentRoutes.js";
import temoignageRoutes from "./temoignageRoutes.js";


// Auth / uploads / notify
import authRoutes from "./authRoutes.js";
import uploadRoutes from "./uploadRoutes.js";
import notifyRoutes from "./notifyRoutes.js";

// Inbox (admin) & Contact (client)
import contactRoutes from "./contactRoutes.js";               // ✅ /contact/threads, /contact/labels, …
import contactClientRoutes from "./contactClientRoutes.js";   // ✅ /contactClient-*, /contactClient

// Details
import serviceDetailRoutes from "./serviceDetailRoutes.js";

// Sitemap
import sitemapRoutes from "./sitemapRoutes.js";




// Legacy (à retirer) : emailRoutes.js SUPPRIMÉ

const router = express.Router();

/* ===== AUTH / CORE ===== */
router.use("/", authRoutes);
router.use("/", pagesRoutes);
router.use("/", contenuRoutes);
router.use("/GlobalContent", globalContentRoutes);
router.use("/", footerRoutes);

/* ===== DOMAIN ===== */
router.use("/", companyOverviewRoutes);
router.use("/", teamSectionRoutes);
router.use("/", whyChooseUsRoutes);
router.use("/", qualityCommitmentRoutes);
router.use("/", heroRoutes);
router.use("/", servicesRoutes);
router.use("/", realisationRoutes);
router.use("/", temoignageRoutes);

router.use("/", caseComponentRoutes);
router.use("/", clientLogoComponentRoutes);
router.use("/", focusComponentRoutes);
router.use("/", gallerieComponentRoutes);

/* ===== ASSETS / MISC ===== */
router.use("/", imagesRoutes);
router.use("/", buttonRoutes);
router.use("/", uploadRoutes);

/* ===== INBOX & CONTACT ===== */
router.use("/", contactRoutes);        // Admin Inbox
router.use("/", contactClientRoutes);  // Page Contact (contenu + envoi public)

/* === SITEMAP ===*/
// router.use("/", sitemapRoutes)

/* ===== NOTIFY / INBOUND (si utilisés) ===== */
import inboundRoutes from "./inbound.routes.js";
router.use("/", notifyRoutes);
router.use("/inbound", inboundRoutes);

/* ===== DETAILS ===== */
router.use("/", serviceDetailRoutes);

/* ===== Filets de sécurité (optionnel) ===== */
// Si jamais un ancien client appelle encore /emails/*, renvoie 410 Gone
router.all(/^\/emails\/.*/i, (_req, res) => {
  res.status(410).json({
    error: "Les endpoints /emails/* sont obsolètes. Utilisez /contact/* ou /contactClient*.",
  });
});

export default router;
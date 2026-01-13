// routes/sitemapRoutes.js
import express from "express";
// On importe UNIQUEMENT la fonction du contrôleur
import { generateSitemap } from "../controllers/sitemapController.js";

const router = express.Router();

/* ----------------------------------------
   Route: /sitemap.xml
-----------------------------------------*/

// On délègue tout le travail au contrôleur.
// C'est lui qui va faire les requêtes DB et générer le XML.
router.get("/sitemap.xml", generateSitemap);

export default router;
// backend/routes/footerRoutes.js
import express from "express";
import {
  getFooterContent,
  saveFooterMain,
  removeFooterMain,
  addFooterLink,
  editFooterLink,
  removeFooterLink,
  addFooterSocial,
  editFooterSocial,
  removeFooterSocial,
  addFooterContact,
  editFooterContact,
  removeFooterContact,
  saveFooterNote,
  removeFooterNote,
} from "../controllers/footerController.js";

const router = express.Router();

// Read
router.get("/footer-content", getFooterContent);

// Main (create/update upsert + delete)
router.post("/footer-main", saveFooterMain);
router.put("/footer-main", saveFooterMain); // accepte aussi body.main.id
router.delete("/footer-main/:id", removeFooterMain);

// Links
router.post("/footer-links", addFooterLink);
router.put("/footer-links/:id", editFooterLink);
router.delete("/footer-links/:id", removeFooterLink);

// Socials
router.post("/footer-socials", addFooterSocial);
router.put("/footer-socials/:id", editFooterSocial);
router.delete("/footer-socials/:id", removeFooterSocial);

// Contact
router.post("/footer-contacts", addFooterContact);
router.put("/footer-contacts/:id", editFooterContact);
router.delete("/footer-contacts/:id", removeFooterContact);

// Note (upsert + delete)
router.post("/footer-note", saveFooterNote);
router.put("/footer-note", saveFooterNote); // accepte body.note.id
router.delete("/footer-note/:id", removeFooterNote);

export default router;
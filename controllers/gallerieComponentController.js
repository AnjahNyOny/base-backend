// controllers/gallerieComponentController.js
import {
  createGallerieComponent,
  updateGallerieComponent,
  deleteGallerieComponent,
  getGallerieComponentByPage,
} from "../services/gallerieComponentService.js";

// GET /api/gallerie?page_id=123
export const fetchGallerieByPage = async (req, res) => {
  try {
    const page_id = Number(req.query.page_id);
    if (!Number.isFinite(page_id) || page_id <= 0) {
      return res.status(400).json({ message: "Paramètre 'page_id' requis et valide." });
    }
    const data = await getGallerieComponentByPage(page_id);
    res.json(data);
  } catch (error) {
    console.error("[Gallerie] GET error:", error?.message || error);
    res.status(500).json({ message: "Erreur lors de la récupération de la galerie." });
  }
};

// POST /api/gallerie  { titre, description, page_id }
export const handleCreateGallerieComponent = async (req, res) => {
  try {
    const newItem = await createGallerieComponent(req.body);
    res.status(201).json(newItem);
  } catch (error) {
    console.error("[Gallerie] Erreur création :", error?.message || error);
    res.status(500).json({ message: "Erreur lors de la création d’un élément de galerie." });
  }
};

// PUT /api/gallerie   { galleryTitle: {...}, galleryList: [{...}] }
// (Compat : accepte aussi { galerieTitle, galerieProjects })
export const handleUpdateGallerieComponent = async (req, res) => {
  try {
    // normalisation des payloads
    const body = req.body || {};
    const galleryTitle = body.galleryTitle ?? body.galerieTitle;
    const galleryList  = body.galleryList ?? body.galerieProjects;

    if (!galleryTitle || typeof galleryTitle !== "object") {
      return res.status(400).json({ message: "Le champ 'galleryTitle' est manquant ou invalide." });
    }
    if (!Array.isArray(galleryList)) {
      return res.status(400).json({ message: "Le champ 'galleryList' doit être un tableau." });
    }

    const updated = await updateGallerieComponent({ galleryTitle, galleryList });
    res.json(updated);
  } catch (error) {
    console.error("[Gallerie] Erreur modification :", error?.message || error);
    const status = error?.status || 500;
    res.status(status).json({ message: error?.message || "Erreur lors de la mise à jour." });
  }
};

// DELETE /api/gallerie/:id
export const handleDeleteGallerieComponent = async (req, res) => {
  try {
    const deleted = await deleteGallerieComponent(req.params.id);
    res.json(deleted);
  } catch (error) {
    console.error("[Gallerie] Erreur suppression :", error?.message || error);
    res.status(500).json({ message: "Erreur lors de la suppression de l’élément de galerie." });
  }
};
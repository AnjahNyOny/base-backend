// controllers/buttonController.js
import {
  getButtonsByContenuId,
  createButton,
  updateButton,
  deleteButton,
  upsertButtonsBulk,
} from "../services/buttonService.js";

// GET /api/buttons?contenu_id=123
export async function handleGetButtons(req, res) {
  try {
    const contenuId = Number(req.query.contenu_id);
    if (!Number.isFinite(contenuId) || contenuId <= 0) {
      return res.status(400).json({ message: "Paramètre 'contenu_id' requis et valide." });
    }
    const rows = await getButtonsByContenuId(contenuId);
    return res.status(200).json({ buttons: rows });
  } catch (e) {
    console.error("❌ [Buttons] GET error:", e);
    return res.status(500).json({ message: "Erreur lors de la récupération des boutons." });
  }
}

// POST /api/button
// body: { contenu_id, label, action? }
export async function handleCreateButton(req, res) {
  try {
    const created = await createButton(req.body);
    return res.status(201).json(created);
  } catch (e) {
    console.error("❌ [Buttons] CREATE error:", e);
    return res.status(500).json({ message: e.message || "Erreur lors de la création du bouton." });
  }
}

// PUT /api/button/:id
// body: { label, action? }
export async function handleUpdateButton(req, res) {
  try {
    const id = Number(req.params.id);
    const updated = await updateButton(id, req.body);
    return res.status(200).json(updated);
  } catch (e) {
    console.error("❌ [Buttons] UPDATE error:", e);
    return res.status(500).json({ message: e.message || "Erreur lors de la mise à jour du bouton." });
  }
}

// DELETE /api/button/:id
export async function handleDeleteButton(req, res) {
  try {
    const id = Number(req.params.id);
    await deleteButton(id);
    return res.status(200).json({ message: "Bouton supprimé." });
  } catch (e) {
    console.error("❌ [Buttons] DELETE error:", e);
    return res.status(500).json({ message: "Erreur lors de la suppression du bouton." });
  }
}

// PUT /api/buttons/bulk
// body: { contenu_id, buttons: [{id?, label, action?}, ...] }
export async function handleUpsertButtonsBulk(req, res) {
  try {
    const { contenu_id, buttons } = req.body || {};
    await upsertButtonsBulk(contenu_id, buttons || []);
    return res.status(200).json({ message: "Boutons enregistrés." });
  } catch (e) {
    console.error("❌ [Buttons] BULK error:", e);
    return res.status(500).json({ message: e.message || "Erreur lors de l'enregistrement des boutons." });
  }
}
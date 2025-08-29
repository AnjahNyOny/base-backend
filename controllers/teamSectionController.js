// controllers/teamSectionController.js
import {
  createTeamMember,
  updateTeamSection,
  deleteTeamMember,
  getTeamSectionByPage,
} from "../services/teamSectionService.js";

/**
 * GET /api/team-section?page_id=123
 * Retourne { teamTitle, teamMembers, boutons: [] } pour la page demandée.
 */
export const fetchTeamSectionByPage = async (req, res) => {
  try {
    const page_id = Number(req.query.page_id);
    if (!Number.isFinite(page_id) || page_id <= 0) {
      return res.status(400).json({ message: "Paramètre 'page_id' requis et valide." });
    }
    const data = await getTeamSectionByPage(page_id);
    return res.json(data);
  } catch (error) {
    console.error("[TeamSection] GET error:", error?.message || error);
    return res.status(500).json({ message: "Erreur lors de la récupération de l’équipe." });
  }
};

/**
 * POST /api/team-section
 * Body attendu: { titre, description, page_id }
 * Crée un nouveau membre (ligne dans 'contenu' de type 'team_section').
 */
export const handleCreateTeamMember = async (req, res) => {
  try {
    console.log("[CTRL team] POST /team-section payload:", req.body);
    const { titre, description, page_id } = req.body || {};
    if (!titre || !description || !page_id) {
      return res.status(400).json({
        message: "Les champs 'titre', 'description' et 'page_id' sont obligatoires.",
      });
    }

    const newData = await createTeamMember({ titre, description, page_id });
    console.log("[CTRL team] ✓ Member created:", newData);
    return res.status(201).json(newData);
  } catch (error) {
    console.error("❌ Erreur lors de la création du membre :", error);
    return res.status(500).json({ message: "Erreur lors de l'ajout du membre." });
  }
};

/**
 * PUT /api/team-section
 * Body attendu: { teamTitle: {...}, teamMembers: [{...}, ...] }
 * Met à jour le titre de section + chaque membre existant (bulk).
 */
export const handleUpdateTeamSection = async (req, res) => {
  try {
    console.log("[CTRL team] ENTER PUT /team-section ✅");
    console.log("[CTRL team] raw body:", JSON.stringify(req.body, null, 2));

    const { teamTitle, teamMembers } = req.body || {};

    if (!teamTitle || typeof teamTitle !== "object") {
      console.log("[CTRL team] BAD teamTitle:", teamTitle);
      return res.status(400).json({ message: "Le champ 'teamTitle' est manquant ou invalide." });
    }
    if (!Array.isArray(teamMembers)) {
      console.log("[CTRL team] BAD teamMembers:", teamMembers);
      return res.status(400).json({ message: "Le champ 'teamMembers' doit être un tableau." });
    }

    console.log("[CTRL team] teamTitle.id:", teamTitle.id);
    console.log("[CTRL team] teamMembers length:", teamMembers.length);
    console.log("[CTRL team] teamMembers ids:", teamMembers.map((m) => m?.id));

    const result = await updateTeamSection({ teamTitle, teamMembers });
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour de la section équipe :", error);
    return res.status(500).json({ message: "Erreur lors de la mise à jour." });
  }
};

/**
 * DELETE /api/team-section/:id
 * Supprime un membre + ses images liées.
 */
export const handleDeleteTeamMember = async (req, res) => {
  const { id } = req.params;
  try {
    console.log("[CTRL team] DELETE /team-section/:id =>", id);
    await deleteTeamMember(id);
    return res.status(200).json({ message: "Suppression réussie." });
  } catch (error) {
    console.error("❌ Erreur lors de la suppression du membre :", error);
    return res.status(500).json({ message: "Erreur lors de la suppression." });
  }
};
import contenuService from '../services/contenuService.js';
import db from '../config/db.js';


// Récupérer tous les contenus d'une page
export const getContenus = async (req, res) => {
  const { pageId } = req.params;
  try {
    const contenus = await contenuService.getContenu(pageId);
    res.status(200).json(contenus);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des contenus', error: error.message });
  }
};

// Créer un nouveau contenu pour une page
// export const createContenu = (req, res) => {
//   const { pageId } = req.params;
//   const { type, content } = req.body;
//   db.query(
//     'INSERT INTO contenu (type, description, page_id) VALUES (?, ?, ?)',
//     [type, content, pageId],
//     (err, results) => {
//       if (err) {
//         return res.status(500).json({ message: 'Erreur lors de la création du contenu', error: err });
//       }
//       res.status(201).json({ message: 'Contenu créé avec succès', contenuId: results.insertId });
//     }
//   );
// };

export const createService = async (req, res) => {
  try {
    console.log('[CONTROLLER] Début de la création du service avec les données :', req.body);

    // Récupérer les données du corps de la requête
    const { titre, description, page_id, image_url, alt, type } = req.body;

    // Validation des données
    if (!titre || !description || !page_id) {
      console.error("[CONTROLLER] Validation échouée : Champs manquants.");
      return res.status(400).json({
        message: "Les champs 'titre', 'description' et 'page_id' sont obligatoires.",
      });
    }

    console.log('[CONTROLLER] Validation réussie.');

    // Préparer les données pour le service
    const serviceData = {
      titre,
      description,
      page_id: parseInt(page_id, 10),
      image_url: image_url || null,
      alt: alt || null,
      type: type || 'service_list',
    };

    console.log('[CONTROLLER] Données préparées pour le service :', serviceData);

    // Appeler le service
    const newService = await contenuService.createService(serviceData);

    console.log('[CONTROLLER] Service créé avec succès :', newService);

    // Répondre avec succès
    res.status(201).json({
      message: 'Service créé avec succès',
      data: newService,
    });
  } catch (error) {
    console.error('[CONTROLLER] Erreur lors de la création du service :', error.message);
    res.status(500).json({
      message: "Erreur lors de la création du service.",
      error: error.message,
    });
  }
};



// export const updateServices = async (req, res) => {
//   const { serviceTitle, services } = req.body;

//   if (!serviceTitle || !Array.isArray(services)) {
//     return res.status(400).json({ message: "Les données 'serviceTitle' ou 'services' sont invalides." });
//   }

//   try {
//     // Mise à jour du titre principal
//     const updatedTitle = await contenuService.updateServiceTitle(serviceTitle.id, serviceTitle);

//     // Mise à jour des services individuels
//     const updatedServices = await contenuService.updateMultipleServices(services);

//     res.status(200).json({
//       message: "Services et titre principal mis à jour avec succès.",
//       data: { updatedTitle, updatedServices },
//     });
//   } catch (error) {
//     console.error("[ERROR] Erreur lors de la mise à jour :", error.message);
//     res.status(500).json({
//       message: "Erreur serveur lors de la mise à jour des services.",
//       error: error.message,
//     });
//   }
// };
// Mise à jour du titre d'une réalisation
export const updateRealisations = async (req, res) => {
  const { realisationTitle, realisationStats } = req.body; // Utiliser realisationStats ici

  if (!realisationTitle || !Array.isArray(realisationStats)) {
    console.error("[ERROR] Données invalides :", { realisationTitle, realisationStats });
    return res.status(400).json({
      message: "Les données 'realisationTitle' ou 'realisationStats' sont invalides.",
    });
  }

  try {
    // Mise à jour du titre principal
    const updatedTitle = await contenuService.updateRealisationTitle(realisationTitle.id, realisationTitle);

    // Mise à jour des réalisations individuelles
    const updatedStats = await contenuService.updateMultipleRealisations(realisationStats);

    res.status(200).json({
      message: "Réalisations mises à jour avec succès.",
      data: { updatedTitle, updatedStats },
    });
  } catch (error) {
    console.error("[ERROR] Erreur lors de la mise à jour :", error.message);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour des réalisations.",
      error: error.message,
    });
  }
};


export const updateHero = async (req, res) => {
  try {
    const result = await contenuService.updateHero(req.body);
    res.status(200).json(result);
  } catch (error) {
    console.error("[ERROR] Erreur lors de la mise à jour du Hero :", error.message);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour du Hero.",
      error: error.message,
    });
  }
};




// Suppression d'un service par ID
export const deleteService = async (req, res) => {
  const { id } = req.params; // ID du service à supprimer

  try {
    // Supprimer les boutons liés au service
    await db.query("DELETE FROM ContenuBouton WHERE contenu_id = ?", [id]);

    // Supprimer les images liées au service
    await db.query("DELETE FROM ContenuImage WHERE contenu_id = ?", [id]);

    // Supprimer le service lui-même
    const [result] = await db.query("DELETE FROM contenu WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Service non trouvé" });
    }

    res.status(200).json({ message: "Service supprimé avec succès" });
  } catch (error) {
    console.error("Erreur lors de la suppression du service :", error);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
};

export const updateTeamSection = async (req, res) => {
  const { teamTitle, teamMembers } = req.body;

  if (!teamTitle || !Array.isArray(teamMembers)) {
    return res.status(400).json({
      message: "Les données 'teamTitle' ou 'teamMembers' sont invalides.",
    });
  }

  try {
    const result = await contenuService.updateTeamSection({ teamTitle, teamMembers });
    res.status(200).json(result);
  } catch (error) {
    console.error("[ERROR] Erreur lors de la mise à jour de la Team :", error.message);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour de la Team.",
      error: error.message,
    });
  }
};

export const updateCompanyOverview = async (req, res) => {
  const { overviewTitle, companyOverviewSections } = req.body;

  if (!overviewTitle || !Array.isArray(companyOverviewSections)) {
    return res.status(400).json({
      message: "Les données 'overviewTitle' ou 'companyOverviewSections' sont invalides.",
    });
  }

  try {
    const result = await contenuService.updateCompanyOverview({
      overviewTitle,
      companyOverviewSections,
    });

    res.status(200).json({
      message: "Company Overview mis à jour avec succès.",
      data: result,
    });
  } catch (error) {
    console.error("[ERROR] Erreur lors de la mise à jour du Company Overview :", error.message);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour du Company Overview.",
      error: error.message,
    });
  }
};


export const updateContent = async (req, res) => {
  const { contentTitle, items, contentType } = req.body;

  if (!contentType || !contentTitle || !Array.isArray(items)) {
    return res.status(400).json({ message: "Les données 'contentType', 'contentTitle' ou 'items' sont invalides." });
  }

  try {
    // Mise à jour du titre principal
    const updatedTitle = await contentService.updateContentTitle(contentTitle.id, contentTitle, contentType);

    // Mise à jour des éléments individuels
    const updatedItems = await contentService.updateMultipleItems(items, contentType);

    res.status(200).json({
      message: `${contentType} mis à jour avec succès.`,
      data: { updatedTitle, updatedItems },
    });
  } catch (error) {
    console.error(`[ERROR] Erreur lors de la mise à jour de ${contentType} :`, error.message);
    res.status(500).json({
      message: `Erreur serveur lors de la mise à jour de ${contentType}.`,
      error: error.message,
    });
  }
};

export const updateWhyChooseUsSection = async (req, res) => {
  const { whyChooseUsTitle, whyChooseUsReasons } = req.body;

  if (!whyChooseUsTitle || !Array.isArray(whyChooseUsReasons)) {
    return res.status(400).json({
      message: "Les données 'whyChooseUsTitle' ou 'whyChooseUsReasons' sont invalides.",
    });
  }

  try {
    const result = await contenuService.updateWhyChooseUsSection({ whyChooseUsTitle, whyChooseUsReasons });
    res.status(200).json(result);
  } catch (error) {
    console.error("[ERROR] Erreur lors de la mise à jour de Why Choose Us :", error.message);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour de Why Choose Us.",
      error: error.message,
    });
  }
};

export const updateCaseStudies = async (req, res) => {
  const { caseStudiesTitle, caseStudies } = req.body;

  if (!caseStudiesTitle || !Array.isArray(caseStudies)) {
    return res.status(400).json({
      message: "Les données 'caseStudiesTitle' ou 'caseStudies' sont invalides.",
    });
  }

  try {
    const result = await contenuService.updateCaseStudies({ caseStudiesTitle, caseStudies });
    res.status(200).json(result);
  } catch (error) {
    console.error("[ERROR] Erreur lors de la mise à jour des Case Studies :", error.message);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour des Case Studies.",
      error: error.message,
    });
  }
};

export const updateClientLogos = async (req, res) => {
  const { partnerTitle, logoList } = req.body;

  if (!partnerTitle || !Array.isArray(logoList)) {
    return res.status(400).json({
      message: "Les données 'partnerTitle' ou 'logoList' sont invalides.",
    });
  }

  try {
    const result = await contenuService.updateClientLogos({ partnerTitle, logoList });
    res.status(200).json(result);
  } catch (error) {
    console.error("[ERROR] Erreur lors de la mise à jour des logos client :", error.message);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour des logos client.",
      error: error.message,
    });
  }
};

export const updateGalerieSection = async (req, res) => {
  const { galerieTitle, galerieProjects } = req.body;

  if (!galerieTitle || !Array.isArray(galerieProjects)) {
    return res.status(400).json({
      message: "Les données 'galerieTitle' ou 'galerieProjects' sont invalides.",
    });
  }

  try {
    const result = await contenuService.updateGalerieSection({
      galerieTitle,
      galerieProjects,
    });
    res.status(200).json(result);
  } catch (error) {
    console.error("[ERROR] Erreur lors de la mise à jour de la Galerie :", error.message);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour de la Galerie.",
      error: error.message,
    });
  }
};

export const updateFocusSection = async (req, res) => {
  const { focusTitle, focusList } = req.body;

  if (!focusTitle || !Array.isArray(focusList)) {
    return res.status(400).json({
      message: "Les données 'focusTitle' ou 'focusList' sont invalides.",
    });
  }

  try {
    const result = await contenuService.updateFocusSection({ focusTitle, focusList });
    res.status(200).json(result);
  } catch (error) {
    console.error("[ERROR] Erreur lors de la mise à jour de la section Focus :", error.message);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour de la section Focus.",
      error: error.message,
    });
  }
};

export const updateQualityCommitment = async (req, res) => {
  const { qualityCommitmentTitle } = req.body;

  if (!qualityCommitmentTitle || typeof qualityCommitmentTitle !== "object") {
    return res.status(400).json({
      message: "Les données 'qualityCommitmentTitle' sont invalides.",
    });
  }

  try {
    const result = await contenuService.updateQualityCommitment({ qualityCommitmentTitle });
    res.status(200).json(result);
  } catch (error) {
    console.error("[ERROR] Erreur lors de la mise à jour de Quality Commitment :", error.message);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour de Quality Commitment.",
      error: error.message,
    });
  }
};
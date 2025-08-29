import db from '../config/db.js';



const formatDateForMySQL = (isoDate) => {
  const date = new Date(isoDate);
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

const contenuService = {


  createService: async (serviceData) => {
    console.log('[SERVICE] Début de la création du service avec les données :', serviceData);

    const { titre, description, image_url, alt, type, page_id } = serviceData;

    // Validation supplémentaire côté service
    if (!titre || !description || !type || !page_id) {
      console.error("[SERVICE] Validation échouée : Champs obligatoires manquants.");
      throw new Error("Les champs 'titre', 'description', 'type' et 'page_id' sont obligatoires.");
    }

    try {
      // Préparer la date actuelle
      const currentDate = new Date();
      const formattedDate = formatDateForMySQL(currentDate);

      console.log('[SERVICE] Date formatée pour MySQL :', formattedDate);

      // Insertion dans la table `contenu`
      console.log('[SERVICE] Préparation de l’insertion dans la table contenu.');
      const query = `
          INSERT INTO contenu (titre, description, type, date_publication, page_id) 
          VALUES (?, ?, ?, ?, ?);
        `;
      const values = [titre, description, type, formattedDate, page_id];
      const [result] = await db.query(query, values);

      console.log('[SERVICE] Résultat de l’insertion dans contenu :', result);

      const serviceId = result.insertId;

      // Insertion dans la table `ContenuImage`, si nécessaire
      if (image_url || alt) {
        console.log('[SERVICE] Préparation de l’insertion dans la table ContenuImage.');
        const queryImage = `
            INSERT INTO ContenuImage (contenu_id, image_url, alt) 
            VALUES (?, ?, ?);
          `;
        const valuesImage = [serviceId, image_url || null, alt || null];
        const [resultImage] = await db.query(queryImage, valuesImage);

        console.log('[SERVICE] Résultat de l’insertion dans ContenuImage :', resultImage);
      }

      // Retourner les données du service nouvellement créé
      const response = {
        id: serviceId,
        titre,
        description,
        type,
        date_publication: currentDate,
        image_url,
        alt,
      };

      console.log('[SERVICE] Service créé avec succès :', response);

      return response;
    } catch (error) {
      console.error('[SERVICE] Erreur lors de la création du service :', error.message);
      throw error;
    }
  },

  getContenuDetails: async (type, langue) => {
    try {
      const query = `
        SELECT c.id AS contenu_id, c.titre, c.description, c.type, c.date_publication, c.page_id,
               cb.id AS bouton_id, cb.label, cb.action,
               ci.id AS image_id, ci.image_url, ci.alt
        FROM contenu c
        LEFT JOIN ContenuBouton cb ON c.id = cb.contenu_id
        LEFT JOIN ContenuImage ci ON c.id = ci.contenu_id
        LEFT JOIN page p ON c.page_id = p.id
        LEFT JOIN site s ON p.site_id = s.id
        WHERE c.type = ? AND s.langue_active = ?;
      `;

      const [rows] = await db.query(query, [type, langue]);

      if (rows.length === 0) {
        console.warn(`Aucun contenu trouvé pour le type ${type} et la langue ${langue}`);
        throw new Error(`Aucun contenu trouvé pour le type ${type} et la langue ${langue}`);
      }

      const singleContenu = {
        id: rows[0].contenu_id,
        titre: rows[0].titre,
        description: rows[0].description,
        type: rows[0].type,
        date_publication: rows[0].date_publication,
        page_id: rows[0].page_id,
      };

      const contenu = rows.map(row => ({
        id: row.contenu_id,
        titre: row.titre,
        description: row.description,
        type: row.type,
        date_publication: row.date_publication,
        page_id: row.page_id,
      }));

      const boutons = rows
        .filter(row => row.bouton_id)
        .map(row => ({
          id: row.bouton_id,
          label: row.label,
          action: row.action,
        }))
        .filter((bouton, index, self) =>
          index === self.findIndex(b => b.id === bouton.id)
        );

      const images = rows
        .filter(row => row.image_id)
        .map(row => ({
          id: row.image_id,
          contenu_id: row.contenu_id,
          image_url: row.image_url,
          alt: row.alt,
        }))
        .filter((image, index, self) =>
          index === self.findIndex(img => img.id === image.id)
        );

      return { singleContenu, contenu, boutons, images };
    } catch (error) {
      console.error('Erreur lors de la récupération des détails du contenu:', error.message);
      throw error;
    }
  },

  // updateServiceTitle: async (id, updatedData) => {
  //   try {
  //     console.log(`[INFO] Mise à jour du titre du service ID: ${id}`);

  //     // Vérifie et formate la date de publication
  //     let formattedDate = updatedData.date_publication;
  //     if (formattedDate) {
  //       const dateObject = new Date(formattedDate);
  //       if (!isNaN(dateObject)) {
  //         formattedDate = dateObject.toISOString().slice(0, 19).replace('T', ' '); // Format MySQL: YYYY-MM-DD HH:MM:SS
  //       } else {
  //         throw new Error(`Format de date invalide pour date_publication: ${updatedData.date_publication}`);
  //       }
  //     }

  //     const query = `
  //       UPDATE contenu
  //       SET titre = ?, description = ?, date_publication = ?
  //       WHERE id = ?;
  //     `;
  //     const values = [updatedData.titre, updatedData.description, formattedDate, id];

  //     const [result] = await db.query(query, values);

  //     if (result.affectedRows === 0) {
  //       console.warn(`[WARN] Aucun titre mis à jour pour ID: ${id}`);
  //       throw new Error(`Aucun titre trouvé pour l'ID ${id}`);
  //     }

  //     // console.log(`[INFO] Titre du service ID: ${id} mis à jour avec succès.`);
  //     return { id, ...updatedData };
  //   } catch (error) {
  //     console.error(`[ERROR] Erreur lors de la mise à jour du titre: ${error.message}`);
  //     throw error;
  //   }
  // },

  updateRealisationTitle: async (id, updatedData) => {
    try {
      console.log(`[INFO] Mise à jour du titre de réalisation ID: ${id}`);

      const query = `
        UPDATE contenu
        SET titre = ?, description = ?, date_publication = ?
        WHERE id = ?;
      `;
      const formattedDate = updatedData.date_publication
        ? formatDateForMySQL(updatedData.date_publication)
        : null;

      const values = [updatedData.titre, updatedData.description, formattedDate, id];
      const [result] = await db.query(query, values);

      if (result.affectedRows === 0) {
        console.warn(`[WARN] Aucun titre de réalisation mis à jour pour ID: ${id}`);
        throw new Error(`Aucune réalisation trouvée pour l'ID ${id}`);
      }

      return { id, ...updatedData };
    } catch (error) {
      console.error(`[ERROR] Erreur lors de la mise à jour du titre de réalisation: ${error.message}`);
      throw error;
    }
  },

  updateMultipleRealisations: async (realisations) => {
    try {
      const queries = realisations.map(async (realisation) => {
        const formattedDate = formatDateForMySQL(realisation.date_publication);

        const queryContenu = `
          UPDATE contenu
          SET titre = ?, description = ?, date_publication = ?
          WHERE id = ?;
        `;
        const valuesContenu = [
          realisation.titre,
          realisation.description,
          formattedDate,
          realisation.id,
        ];

        await db.query(queryContenu, valuesContenu);

        // Mettre à jour les informations de l'image si elles existent
        if (realisation.image_url || realisation.alt) {
          const queryImage = `
            UPDATE ContenuImage
            SET image_url = ?, alt = ?
            WHERE contenu_id = ?;
          `;
          const valuesImage = [
            realisation.image_url || null,
            realisation.alt || null,
            realisation.id,
          ];

          await db.query(queryImage, valuesImage);
        }
      });

      await Promise.all(queries);
      return realisations;
    } catch (error) {
      console.error("[ERROR] Erreur lors de la mise à jour des réalisations :", error.message);
      throw error;
    }
  },

  updateMultipleServices: async (services) => {
    try {
      const queries = services.map(async (service) => {
        const formattedDate = formatDateForMySQL(service.date_publication);

        const queryContenu = `
          UPDATE contenu
          SET titre = ?, description = ?, date_publication = ?
          WHERE id = ?;
        `;
        const valuesContenu = [
          service.titre,
          service.description,
          formattedDate,
          service.id,
        ];

        await db.query(queryContenu, valuesContenu);

        // Mettre à jour les informations de l'image si elles existent
        if (service.image_url || service.alt) {
          const queryImage = `
            UPDATE ContenuImage
            SET image_url = ?, alt = ?
            WHERE contenu_id = ?;
          `;
          const valuesImage = [
            service.image_url || null,
            service.alt || null,
            service.id,
          ];

          await db.query(queryImage, valuesImage);
        }
      });

      await Promise.all(queries);
      return services;
    } catch (error) {
      console.error("[ERROR] Erreur lors de la mise à jour des services :", error.message);
      throw error;
    }
  },

  updateCompanyOverview: async ({ overviewTitle, companyOverviewSections }) => {
    try {
      // Mise à jour du titre principal (overviewTitle)
      const formattedDate = formatDateForMySQL(overviewTitle.date_publication || new Date());

      const queryTitle = `
      UPDATE contenu
      SET titre = ?, description = ?, date_publication = ?
      WHERE id = ?;
    `;
      const valuesTitle = [
        overviewTitle.titre,
        overviewTitle.description || '',
        formattedDate,
        overviewTitle.id,
      ];

      await db.query(queryTitle, valuesTitle);

      // Mise à jour des sections de l’aperçu (companyOverviewSections)
      const updates = companyOverviewSections.map(async (section) => {
        const sectionDate = formatDateForMySQL(section.date_publication || new Date());

        const query = `
        UPDATE contenu
        SET titre = ?, description = ?, date_publication = ?
        WHERE id = ?;
      `;
        const values = [
          section.titre,
          section.description,
          sectionDate,
          section.id,
        ];

        await db.query(query, values);

        // Mettre à jour l'image associée si elle existe
        if (section.image_url || section.alt) {
          const queryImage = `
          UPDATE ContenuImage
          SET image_url = ?, alt = ?
          WHERE contenu_id = ?;
        `;
          const valuesImage = [
            section.image_url || null,
            section.alt || null,
            section.id,
          ];

          await db.query(queryImage, valuesImage);
        }
      });

      await Promise.all(updates);

      return {
        message: "Company Overview mis à jour avec succès.",
        overviewTitle,
        companyOverviewSections,
      };
    } catch (error) {
      console.error("[ERROR] Erreur lors de la mise à jour du Company Overview :", error.message);
      throw error;
    }
  },

  updateTeamSection: async ({ teamTitle, teamMembers }) => {
    try {
      const formattedDate = teamTitle.date_publication
        ? formatDateForMySQL(teamTitle.date_publication)
        : formatDateForMySQL(new Date());

      // Mettre à jour le titre de la section
      const queryTitle = `
      UPDATE contenu
      SET titre = ?, description = ?, date_publication = ?
      WHERE id = ?;
    `;
      const valuesTitle = [
        teamTitle.titre,
        teamTitle.description,
        formattedDate,
        teamTitle.id,
      ];
      await db.query(queryTitle, valuesTitle);

      // Mettre à jour les membres de l'équipe
      const updateMembers = teamMembers.map(async (member) => {
        const formattedMemberDate = member.date_publication
          ? formatDateForMySQL(member.date_publication)
          : formatDateForMySQL(new Date());

        const queryContenu = `
        UPDATE contenu
        SET titre = ?, description = ?, date_publication = ?
        WHERE id = ?;
      `;
        const valuesContenu = [
          member.titre,
          member.description,
          formattedMemberDate,
          member.id,
        ];
        await db.query(queryContenu, valuesContenu);

        if (member.image_url || member.alt) {
          const queryImage = `
          UPDATE ContenuImage
          SET image_url = ?, alt = ?
          WHERE contenu_id = ?;
        `;
          const valuesImage = [
            member.image_url || null,
            member.alt || null,
            member.id,
          ];
          await db.query(queryImage, valuesImage);
        }
      });

      await Promise.all(updateMembers);

      return {
        message: "Team mise à jour avec succès.",
        updatedTitle: teamTitle,
        updatedMembers: teamMembers,
      };
    } catch (error) {
      console.error("[ERROR] Erreur lors de la mise à jour de la Team :", error.message);
      throw error;
    }
  },

  updateHero: async (updatedData) => {
    const { heroContent, heroButtons, heroImage } = updatedData;

    if (!heroContent || !heroContent.id) {
      throw new Error("Les données 'heroContent' ou son 'id' sont manquantes ou invalides.");
    }

    if (!Array.isArray(heroButtons) || !heroButtons.every((btn) => btn.id)) {
      throw new Error("Les données 'heroButtons' sont manquantes ou contiennent des boutons sans 'id'.");
    }

    if (!heroImage || !heroImage.id) {
      throw new Error("Les données 'heroImage' ou son 'id' sont manquantes ou invalides.");
    }

    try {
      // Mise à jour du contenu principal
      const formattedDate = formatDateForMySQL(heroContent.date_publication);
      const queryContent = `
        UPDATE contenu
        SET titre = ?, description = ?, type = ?, date_publication = ?
        WHERE id = ?;
      `;
      const valuesContent = [
        heroContent.titre,
        heroContent.description,
        heroContent.type,
        formattedDate,
        heroContent.id,
      ];

      const [resultContent] = await db.query(queryContent, valuesContent);

      if (resultContent.affectedRows === 0) {
        throw new Error(`Aucun contenu Hero trouvé pour l'ID ${heroContent.id}.`);
      }

      // Mise à jour des boutons
      const queryButton = `
        UPDATE ContenuBouton
        SET label = ?, action = ?
        WHERE id = ?;
      `;

      for (const btn of heroButtons) {
        const valuesButton = [btn.label, btn.action, btn.id];
        await db.query(queryButton, valuesButton);
      }

      // Mise à jour de l'image
      const queryImage = `
        UPDATE ContenuImage
        SET image_url = ?, alt = ?
        WHERE id = ?;
      `;
      const valuesImage = [heroImage.image_url, heroImage.alt, heroImage.id];

      const [resultImage] = await db.query(queryImage, valuesImage);

      if (resultImage.affectedRows === 0) {
        throw new Error(`Aucune image Hero trouvée pour l'ID ${heroImage.id}.`);
      }

      return {
        message: "Hero mis à jour avec succès.",
      };
    } catch (error) {
      console.error("[ERROR] Erreur lors de la mise à jour du Hero :", error.message);
      throw new Error(error.message);
    }
  },

  updateWhyChooseUsSection: async ({ whyChooseUsTitle, whyChooseUsReasons }) => {
    try {
      const formattedDate = whyChooseUsTitle.date_publication
        ? formatDateForMySQL(whyChooseUsTitle.date_publication)
        : formatDateForMySQL(new Date());

      // Mettre à jour le titre de la section
      const queryTitle = `
      UPDATE contenu
      SET titre = ?, description = ?, date_publication = ?
      WHERE id = ?;
    `;
      const valuesTitle = [
        whyChooseUsTitle.titre,
        whyChooseUsTitle.description,
        formattedDate,
        whyChooseUsTitle.id,
      ];
      await db.query(queryTitle, valuesTitle);

      // Mettre à jour les raisons
      const updateReasons = whyChooseUsReasons.map(async (reason) => {
        const formattedReasonDate = reason.date_publication
          ? formatDateForMySQL(reason.date_publication)
          : formatDateForMySQL(new Date());

        const queryContenu = `
        UPDATE contenu
        SET titre = ?, description = ?, date_publication = ?
        WHERE id = ?;
      `;
        const valuesContenu = [
          reason.titre,
          reason.description,
          formattedReasonDate,
          reason.id,
        ];
        await db.query(queryContenu, valuesContenu);

        if (reason.image_url || reason.alt) {
          const queryImage = `
          UPDATE ContenuImage
          SET image_url = ?, alt = ?
          WHERE contenu_id = ?;
        `;
          const valuesImage = [
            reason.image_url || null,
            reason.alt || null,
            reason.id,
          ];
          await db.query(queryImage, valuesImage);
        }
      });

      await Promise.all(updateReasons);

      return {
        message: "Why Choose Us mis à jour avec succès.",
        updatedTitle: whyChooseUsTitle,
        updatedReasons: whyChooseUsReasons,
      };
    } catch (error) {
      console.error("[ERROR] Erreur lors de la mise à jour de Why Choose Us :", error.message);
      throw error;
    }
  },
  updateCaseStudies: async ({ caseStudiesTitle, caseStudies }) => {
    try {
      const formattedDate = caseStudiesTitle.date_publication
        ? formatDateForMySQL(caseStudiesTitle.date_publication)
        : formatDateForMySQL(new Date());

      const queryTitle = `
      UPDATE contenu
      SET titre = ?, description = ?, date_publication = ?
      WHERE id = ?;
    `;
      const valuesTitle = [
        caseStudiesTitle.titre,
        caseStudiesTitle.description,
        formattedDate,
        caseStudiesTitle.id,
      ];
      await db.query(queryTitle, valuesTitle);

      const updateItems = caseStudies.map(async (item) => {
        const formattedItemDate = item.date_publication
          ? formatDateForMySQL(item.date_publication)
          : formatDateForMySQL(new Date());

        const queryContenu = `
        UPDATE contenu
        SET titre = ?, description = ?, date_publication = ?
        WHERE id = ?;
      `;
        const valuesContenu = [
          item.titre,
          item.description,
          formattedItemDate,
          item.id,
        ];
        await db.query(queryContenu, valuesContenu);

        if (item.image_url || item.alt) {
          const queryImage = `
          UPDATE ContenuImage
          SET image_url = ?, alt = ?
          WHERE contenu_id = ?;
        `;
          const valuesImage = [
            item.image_url || null,
            item.alt || null,
            item.id,
          ];
          await db.query(queryImage, valuesImage);
        }
      });

      await Promise.all(updateItems);

      return {
        message: "Case Studies mis à jour avec succès.",
        updatedTitle: caseStudiesTitle,
        updatedItems: caseStudies,
      };
    } catch (error) {
      console.error("[ERROR] Erreur lors de la mise à jour des Case Studies :", error.message);
      throw error;
    }
  },

  updateClientLogos: async ({ partnerTitle, logoList }) => {
    try {
      const formattedDate = partnerTitle.date_publication
        ? formatDateForMySQL(partnerTitle.date_publication)
        : formatDateForMySQL(new Date());

      // Mettre à jour le titre de la section
      const queryTitle = `
      UPDATE contenu
      SET titre = ?, description = ?, date_publication = ?
      WHERE id = ?;
    `;
      const valuesTitle = [
        partnerTitle.titre,
        partnerTitle.description,
        formattedDate,
        partnerTitle.id,
      ];
      await db.query(queryTitle, valuesTitle);

      // Mettre à jour les logos partenaires
      const updateLogos = logoList.map(async (logo) => {
        const formattedLogoDate = logo.date_publication
          ? formatDateForMySQL(logo.date_publication)
          : formatDateForMySQL(new Date());

        const queryContenu = `
        UPDATE contenu
        SET titre = ?, description = ?, date_publication = ?
        WHERE id = ?;
      `;
        const valuesContenu = [
          logo.titre,
          logo.description,
          formattedLogoDate,
          logo.id,
        ];
        await db.query(queryContenu, valuesContenu);

        if (logo.image_url || logo.alt) {
          const queryImage = `
          UPDATE ContenuImage
          SET image_url = ?, alt = ?
          WHERE contenu_id = ?;
        `;
          const valuesImage = [
            logo.image_url || null,
            logo.alt || null,
            logo.id,
          ];
          await db.query(queryImage, valuesImage);
        }
      });

      await Promise.all(updateLogos);

      return {
        message: "Logos client mis à jour avec succès.",
        updatedTitle: partnerTitle,
        updatedLogos: logoList,
      };
    } catch (error) {
      console.error("[ERROR] Erreur lors de la mise à jour des logos client :", error.message);
      throw error;
    }
  },

  updateGalerieSection: async ({ galerieTitle, galerieProjects }) => {
    try {
      const formattedDate = galerieTitle.date_publication
        ? formatDateForMySQL(galerieTitle.date_publication)
        : formatDateForMySQL(new Date());

      const queryTitle = `
      UPDATE contenu
      SET titre = ?, description = ?, date_publication = ?
      WHERE id = ?;
    `;
      const valuesTitle = [
        galerieTitle.titre,
        galerieTitle.description,
        formattedDate,
        galerieTitle.id,
      ];
      await db.query(queryTitle, valuesTitle);

      const updateProjects = galerieProjects.map(async (project) => {
        const formattedProjectDate = project.date_publication
          ? formatDateForMySQL(project.date_publication)
          : formatDateForMySQL(new Date());

        const queryContenu = `
        UPDATE contenu
        SET titre = ?, description = ?, date_publication = ?
        WHERE id = ?;
      `;
        const valuesContenu = [
          project.titre,
          project.description,
          formattedProjectDate,
          project.id,
        ];
        await db.query(queryContenu, valuesContenu);

        if (project.image_url || project.alt) {
          const queryImage = `
          UPDATE ContenuImage
          SET image_url = ?, alt = ?
          WHERE contenu_id = ?;
        `;
          const valuesImage = [
            project.image_url || null,
            project.alt || null,
            project.id,
          ];
          await db.query(queryImage, valuesImage);
        }
      });

      await Promise.all(updateProjects);

      return {
        message: "Galerie mise à jour avec succès.",
        updatedTitle: galerieTitle,
        updatedProjects: galerieProjects,
      };
    } catch (error) {
      console.error("[ERROR] Erreur lors de la mise à jour de la galerie :", error.message);
      throw error;
    }
  },
  updateFocusSection: async ({ focusTitle, focusList }) => {
    try {
      const formattedDate = focusTitle.date_publication
        ? formatDateForMySQL(focusTitle.date_publication)
        : formatDateForMySQL(new Date());

      // Mise à jour du titre
      const queryTitle = `
      UPDATE contenu
      SET titre = ?, description = ?, date_publication = ?
      WHERE id = ?;
    `;
      const valuesTitle = [
        focusTitle.titre,
        focusTitle.description,
        formattedDate,
        focusTitle.id,
      ];
      await db.query(queryTitle, valuesTitle);

      // Mise à jour de la liste
      const updateItems = focusList.map(async (item) => {
        const formattedItemDate = item.date_publication
          ? formatDateForMySQL(item.date_publication)
          : formatDateForMySQL(new Date());

        const queryItem = `
        UPDATE contenu
        SET titre = ?, description = ?, date_publication = ?
        WHERE id = ?;
      `;
        const valuesItem = [
          item.titre,
          item.description,
          formattedItemDate,
          item.id,
        ];
        await db.query(queryItem, valuesItem);
      });

      await Promise.all(updateItems);

      return {
        message: "Section Focus mise à jour avec succès.",
        updatedTitle: focusTitle,
        updatedList: focusList,
      };
    } catch (error) {
      console.error("[ERROR] Erreur lors de la mise à jour de la section Focus :", error.message);
      throw error;
    }
  },
  updateQualityCommitment: async ({ qualityCommitmentTitle }) => {
    try {
      const formattedDate = qualityCommitmentTitle.date_publication
        ? formatDateForMySQL(qualityCommitmentTitle.date_publication)
        : formatDateForMySQL(new Date());

      const query = `
      UPDATE contenu
      SET titre = ?, description = ?, date_publication = ?
      WHERE id = ?;
    `;
      const values = [
        qualityCommitmentTitle.titre,
        qualityCommitmentTitle.description,
        formattedDate,
        qualityCommitmentTitle.id,
      ];

      await db.query(query, values);

      return {
        message: "Section Quality Commitment mise à jour avec succès.",
        updatedTitle: qualityCommitmentTitle,
      };
    } catch (error) {
      console.error("[ERROR] Erreur lors de la mise à jour de Quality Commitment :", error.message);
      throw error;
    }
  },

  // updateContentTitle: async (id, updatedData, contentType) => {
  //   try {
  //     console.log(`[INFO] Mise à jour du titre pour ${contentType}, ID: ${id}`);

  //     let formattedDate = updatedData.date_publication;
  //     if (formattedDate) {
  //       const dateObject = new Date(formattedDate);
  //       if (!isNaN(dateObject)) {
  //         formattedDate = dateObject.toISOString().slice(0, 19).replace('T', ' ');
  //       } else {
  //         throw new Error(`Format de date invalide pour date_publication: ${updatedData.date_publication}`);
  //       }
  //     }

  //     const query = `
  //       UPDATE contenu
  //       SET titre = ?, description = ?, date_publication = ?
  //       WHERE id = ? AND type = ?;
  //     `;
  //     const values = [updatedData.titre, updatedData.description, formattedDate, id, contentType];

  //     const [result] = await db.query(query, values);

  //     if (result.affectedRows === 0) {
  //       console.warn(`[WARN] Aucun contenu mis à jour pour ${contentType}, ID: ${id}`);
  //       throw new Error(`Aucun contenu trouvé pour l'ID ${id}`);
  //     }

  //     return { id, ...updatedData };
  //   } catch (error) {
  //     console.error(`[ERROR] Erreur lors de la mise à jour du titre: ${error.message}`);
  //     throw error;
  //   }
  // },

  // updateMultipleItems: async (items, contentType) => {
  //   try {
  //     const queries = items.map(async (item) => {
  //       const formattedDate = formatDateForMySQL(item.date_publication);

  //       const queryContenu = `
  //         UPDATE contenu
  //         SET titre = ?, description = ?, date_publication = ?
  //         WHERE id = ? AND type = ?;
  //       `;
  //       const valuesContenu = [
  //         item.titre,
  //         item.description,
  //         formattedDate,
  //         item.id,
  //         contentType,
  //       ];

  //       await db.query(queryContenu, valuesContenu);

  //       if (item.image_url || item.alt) {
  //         const queryImage = `
  //           UPDATE ContenuImage
  //           SET image_url = ?, alt = ?
  //           WHERE contenu_id = ?;
  //         `;
  //         const valuesImage = [
  //           item.image_url || null,
  //           item.alt || null,
  //           item.id,
  //         ];

  //         await db.query(queryImage, valuesImage);
  //       }
  //     });

  //     await Promise.all(queries);

  //     return items;
  //   } catch (error) {
  //     console.error(`[ERROR] Erreur lors de la mise à jour des items: ${error.message}`);
  //     throw error;
  //   }
  // },





};

export default contenuService;

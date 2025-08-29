import db from '../config/db.js';

export const ajouterTemoignage = async (req, res) => {
  const { nom, email, message } = req.body;

  // Vérification des données requises
  if (!nom || !email || !message) {
    return res.status(400).json({ error: "Nom, email et message sont requis." });
  }

  try {
    const sql = `
      INSERT INTO temoignages (nom, email, message)
      VALUES (?, ?, ?)
    `;
    const result = await db.query(sql, [nom, email, message]);

    res.status(201).json({
      message: "Témoignage soumis avec succès !",
      temoignage: {
        id: result.insertId,
        nom,
        email,
        message,
      },
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout du témoignage :", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const approuverTemoignage = async (req, res) => {
    const { id } = req.params;
  
    try {
      // Vérifie si le témoignage existe
      const [temoignage] = await db.query("SELECT * FROM temoignages WHERE id = ?", [id]);
      if (!temoignage) {
        return res.status(404).json({ error: "Témoignage non trouvé." });
      }
  
      // Approuve le témoignage
      await db.query("UPDATE temoignages SET est_approuve = true WHERE id = ?", [id]);
  
      res.status(200).json({ message: "Témoignage approuvé avec succès !" });
    } catch (error) {
      console.error("Erreur lors de l'approbation du témoignage :", error);
      res.status(500).json({ error: "Erreur serveur." });
    }
  };
export const desApprouverTemoignage = async (req, res) => {
    const { id } = req.params;
  
    try {
      // Vérifie si le témoignage existe
      const [temoignage] = await db.query("SELECT * FROM temoignages WHERE id = ?", [id]);
      if (!temoignage) {
        return res.status(404).json({ error: "Témoignage non trouvé." });
      }
  
      // Approuve le témoignage
      await db.query("UPDATE temoignages SET est_approuve = false WHERE id = ?", [id]);
  
      res.status(200).json({ message: "Témoignage desapprouvé avec succès !" });
    } catch (error) {
      console.error("Erreur lors de desapprobation du témoignage :", error);
      res.status(500).json({ error: "Erreur serveur." });
    }
  };

  export const afficherTemoignagesApprouves = async (req, res) => {
    try {
      const temoignages = await db.query("SELECT * FROM temoignages WHERE est_approuve = true ORDER BY date_creation DESC");
  
      res.status(200).json({ temoignages });
    } catch (error) {
      console.error("Erreur lors de la récupération des témoignages approuvé:", error);
      res.status(500).json({ error: "Erreur serveur." });
    }
  };
  export const afficherTemoignages = async (req, res) => {
    try {
      const temoignages = await db.query("SELECT * FROM temoignages ORDER BY date_creation DESC");
  
      res.status(200).json({ temoignages });
    } catch (error) {
      console.error("Erreur lors de la récupération des témoignages :", error);
      res.status(500).json({ error: "Erreur serveur." });
    }
  };
  
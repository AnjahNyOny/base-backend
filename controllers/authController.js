import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import db from "../config/db.js"; // Importez votre gestionnaire de base de données

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";


export const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log("Début de la fonction login");
    console.log("Requête reçue :", req.body);

    // Vérifie si l'utilisateur existe
    const [result] = await db.query("SELECT * FROM admins WHERE username = ?", [username]);
    console.log("Résultat de la requête SELECT :", result);

    // Si l'utilisateur n'existe pas
    if (result.length === 0) {
      console.log("Nom d'utilisateur non trouvé :", username);
      return res.status(404).json({ message: "Nom d'utilisateur ou mot de passe incorrect" });
    }

    const user = result[0];
    console.log("Utilisateur trouvé :", user);

    // Vérifie le mot de passe
    const passwordMatch = await bcrypt.compare(password, user.password);
    console.log("Résultat de la comparaison des mots de passe :", passwordMatch);

    if (!passwordMatch) {
      console.log("Mot de passe incorrect pour l'utilisateur :", username);
      return res.status(401).json({ message: "Nom d'utilisateur ou mot de passe incorrect" });
    }

    // Génère un token JWT
    console.log('[auth:login] JWT_SECRET head =', (process.env.JWT_SECRET || 'default').slice(0,8));
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: "16h", // Token valide pendant 16 heure
    });
    console.log("Token généré avec succès :", token);

    res.status(200).json({ message: "Connexion réussie", token });
  } catch (error) {
    console.error("Erreur lors de la connexion :", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Fonction pour gérer l'inscription
export const register = async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log("Début de la fonction register");
    console.log("Requête reçue :", req.body);

    // Vérifie si l'utilisateur existe
    const [result] = await db.query("SELECT * FROM admins WHERE username = ?", [username]);
    console.log("Résultat de la requête SELECT :", result);

    if (result.length > 0) { // Vérifie si un utilisateur existe déjà
      console.log("Nom d'utilisateur déjà utilisé :", username);
      return res.status(409).json({ message: "Nom d'utilisateur déjà utilisé" });
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Mot de passe haché :", hashedPassword);

    // Insérer le nouvel utilisateur dans la base de données
    const insertResult = await db.query(
      "INSERT INTO admins (username, password) VALUES (?, ?)",
      [username, hashedPassword]
    );
    console.log("Résultat de la requête INSERT :", insertResult);

    res.status(201).json({ message: "Utilisateur créé avec succès" });
  } catch (error) {
    console.error("Erreur lors de l'inscription :", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

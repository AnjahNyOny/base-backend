import jwt from "jsonwebtoken";


const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

export const authenticate = (req, res, next) => {
  // const token = req.headers.authorization?.split(" ")[1];
  console.log('[auth:mw] JWT_SECRET head =', (process.env.JWT_SECRET || 'default').slice(0,8));
  console.log("[auth] using JWT_SECRET =", (process.env.JWT_SECRET ? "env" : "default"));
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Accès refusé : Authorization Bearer manquant" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Ajoute les informations du token à l'objet req
    next();
  } catch (error) {
    console.warn("[auth] verify error:", error?.message);
    return res.status(403).json({ message: "Jeton invalide ou expiré" });
  }
};
import 'dotenv/config'; // charge .env en local si présent
import mysql from "mysql2/promise";

// Détection de l'environnement
const isProd = process.env.NODE_ENV === 'production';

// Variables avec fallback selon l'environnement
const DB_HOST       = process.env.DB_HOST       ?? "127.0.0.1";
const DB_PORT       = Number(process.env.DB_PORT ?? (isProd ? "3306" : "8889"));
const DB_USER       = process.env.DB_USER       ?? (isProd ? "hs_user" : "root");
const DB_PASSWORD   = process.env.DB_PASSWORD   ?? (isProd ? ""        : "root");
// ⚠️ DB_NAME "H&S" local → attention si utilisé dans une requête SQL, il faudra backticks : `H&S`
const DB_NAME       = process.env.DB_NAME       ?? (isProd ? "hs_conseil" : "H&S");
const DB_CONN_LIMIT = Number(process.env.DB_CONN_LIMIT ?? "10");

// Pool MySQL
const db = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: DB_CONN_LIMIT,
  queueLimit: 0,
  charset: "utf8mb4_unicode_ci", // conseillé pour accents/emoji
});
console.log("[DB] trying", {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  db:   process.env.DB_NAME,
  nodeEnv: process.env.NODE_ENV
});


export default db;

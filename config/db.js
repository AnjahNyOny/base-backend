import mysql from 'mysql2/promise';

// Configuration de la base de données
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'H&S',
    port: 8889, // Port par défaut de MAMP pour MySQL
});

export default db;

// cms_backend/config/db.js
// import mysql from "mysql2/promise";

// /**
//  * Utilise les variables d'environnement (injectées par start-api.sh qui source backend/shared/.env).
//  * En local, tu peux créer un .env et lancer `node -r dotenv/config ...` ou utiliser ton outil habituel,
//  * OU définir des valeurs par défaut ci-dessous pour le dev.
//  */
// const {
//   DB_HOST = "127.0.0.1",
//   DB_PORT = "3306",
//   DB_USER = "hs_user",
//   DB_PASSWORD = "",
//   DB_NAME = "hs_conseil",
//   DB_CONN_LIMIT = "10",
// } = process.env;

// const db = mysql.createPool({
//   host: DB_HOST,
//   port: Number(DB_PORT),
//   user: DB_USER,
//   password: DB_PASSWORD,
//   database: DB_NAME,
//   waitForConnections: true,
//   connectionLimit: Number(DB_CONN_LIMIT),
//   queueLimit: 0,
//   // charset conseillé pour accents/emoji
//   charset: "utf8mb4_unicode_ci",
// });

// export default db;

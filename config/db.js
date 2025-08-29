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
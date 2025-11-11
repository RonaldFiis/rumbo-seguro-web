const Database = require('better-sqlite3');
const db = new Database('rumbo_seguro.db'); // verbose quitado para menos ruido

db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombres TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        rol TEXT NOT NULL DEFAULT 'estudiante',
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS riesgo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        estudiante_id INTEGER UNIQUE,
        nivel TEXT NOT NULL,
        puntaje REAL NOT NULL,
        fecha_evaluacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (estudiante_id) REFERENCES usuarios(id)
    );
`);
console.log('💾 Base de datos conectada y tablas verificadas.');
module.exports = db;
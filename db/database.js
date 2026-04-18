const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './db/juridix.db';

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH, { verbose: process.env.NODE_ENV === 'development' ? null : null });
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function setup() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const database = getDb();
  database.exec(schema);
  console.log('✅ Base de données initialisée');

  // Thèmes par défaut pour les nouveaux utilisateurs (utilisé lors de l'inscription)
  console.log('✅ Schéma prêt');
}

module.exports = { getDb, setup };

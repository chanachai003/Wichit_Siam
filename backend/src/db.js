import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('./database.sqlite');

//เปิดใช้ Foreign Key (สำคัญมาก)
db.run("PRAGMA foreign_keys = ON");

db.serialize(() => {
  // =========================
  // USERS TABLE
  // =========================
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,

      role TEXT NOT NULL DEFAULT 'user',

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // =========================
  // PHOTOS TABLE
  // =========================
  db.run(`
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      title TEXT NOT NULL,
      description TEXT NOT NULL,

      province TEXT NOT NULL,
      region TEXT NOT NULL,

      date TEXT NOT NULL,
      activity TEXT NOT NULL,

      latitude REAL NOT NULL,
      longitude REAL NOT NULL,

      image_url TEXT NOT NULL,

      created_by INTEGER NOT NULL,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // =========================
  // INDEX (Performance)
  // =========================
  db.run(`CREATE INDEX IF NOT EXISTS idx_photos_province ON photos(province)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_photos_region ON photos(region)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_photos_created_by ON photos(created_by)`);

});

export default db;
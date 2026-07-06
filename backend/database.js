import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'database.sqlite');

let dbInstance = null;

export async function getDb() {
  if (dbInstance) return dbInstance;
  
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  
  // Enable foreign keys
  await dbInstance.run('PRAGMA foreign_keys = ON');
  
  // Initialize tables
  await initializeDatabase(dbInstance);
  
  return dbInstance;
}

async function initializeDatabase(db) {
  // Create schedules table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('work', 'home')),
      tags TEXT, -- JSON array of strings
      frequency TEXT NOT NULL CHECK(frequency IN ('weekly', 'monthly', 'yearly')),
      frequency_data TEXT, -- JSON structure representing schedule info e.g. {"days": [1, 5]} for Mon, Fri
      someday INTEGER DEFAULT 0 CHECK(someday IN (0, 1)),
      last_spawned_date TEXT, -- YYYY-MM-DD
      created_at TEXT NOT NULL
    )
  `);

  // Create tasks table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('work', 'home')),
      completed INTEGER DEFAULT 0 CHECK(completed IN (0, 1)),
      completed_at TEXT, -- ISO datetime
      created_at TEXT NOT NULL,
      someday INTEGER DEFAULT 0 CHECK(someday IN (0, 1)),
      schedule_id INTEGER,
      tags TEXT, -- JSON array of strings
      due_date TEXT,
      keep_active INTEGER DEFAULT 0 CHECK(keep_active IN (0, 1)),
      notes TEXT,
      sort_order INTEGER,
      starred INTEGER DEFAULT 0 CHECK(starred IN (0, 1)),
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE SET NULL
    )
  `);

  // Safe migrations for existing databases
  try {
    await db.exec('ALTER TABLE tasks ADD COLUMN due_date TEXT');
  } catch (e) {
    // Ignore error if column already exists
  }
  try {
    await db.exec('ALTER TABLE tasks ADD COLUMN keep_active INTEGER DEFAULT 0 CHECK(keep_active IN (0, 1))');
  } catch (e) {
    // Ignore error if column already exists
  }
  try {
    await db.exec('ALTER TABLE tasks ADD COLUMN notes TEXT');
  } catch (e) {
    // Ignore error if column already exists
  }
  try {
    await db.exec('ALTER TABLE tasks ADD COLUMN sort_order INTEGER');
  } catch (e) {
    // Ignore error if column already exists
  }
  try {
    await db.exec('ALTER TABLE tasks ADD COLUMN starred INTEGER DEFAULT 0 CHECK(starred IN (0, 1))');
  } catch (e) {
    // Ignore error if column already exists
  }
  try {
    await db.exec('ALTER TABLE tasks ADD COLUMN is_freshservice INTEGER DEFAULT 0 CHECK(is_freshservice IN (0, 1))');
  } catch (e) {
    // Ignore error if column already exists
  }
  try {
    await db.exec('ALTER TABLE tasks ADD COLUMN freshservice_ticket_id INTEGER');
  } catch (e) {
    // Ignore error if column already exists
  }
  try {
    await db.exec('ALTER TABLE tasks ADD COLUMN resolution_notes TEXT');
  } catch (e) {
    // Ignore error if column already exists
  }
  try {
    await db.exec('ALTER TABLE tasks ADD COLUMN requester TEXT');
  } catch (e) {
    // Ignore error if column already exists
  }

  // Populate sort_order with id for any existing tasks that don't have it set
  await db.exec('UPDATE tasks SET sort_order = id WHERE sort_order IS NULL');
}

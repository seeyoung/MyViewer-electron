import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

/**
 * Get the database file path
 */
function getDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'myviewer.db');
}

/**
 * Initialize the database and run migrations
 */
export function initializeDatabase(): Database.Database {
  if (db) {
    return db;
  }

  const dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);

  // Ensure directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Open database
  db = new Database(dbPath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Run migrations
  runMigrations(db);

  return db;
}

/**
 * Run database migrations
 */
function runMigrations(database: Database.Database): void {
  // Migration 001: Create bookmarks table
  const migration001 = `
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      archive_path TEXT NOT NULL,
      image_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(archive_path, image_path)
    );
    
    CREATE INDEX IF NOT EXISTS idx_bookmarks_archive_path ON bookmarks(archive_path);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at);
  `;
  database.exec(migration001);

  // Migration 002: Create sessions table
  const migration002 = `
    CREATE TABLE IF NOT EXISTS viewing_sessions (
      id TEXT PRIMARY KEY,
      archive_path TEXT NOT NULL UNIQUE,
      current_page_index INTEGER NOT NULL DEFAULT 0,
      reading_direction TEXT NOT NULL DEFAULT 'left-to-right',
      view_mode TEXT NOT NULL DEFAULT 'single-page',
      zoom_level REAL NOT NULL DEFAULT 1.0,
      fit_mode TEXT NOT NULL DEFAULT 'fit-width',
      rotation INTEGER NOT NULL DEFAULT 0,
      show_thumbnails INTEGER NOT NULL DEFAULT 1,
      show_folder_tree INTEGER NOT NULL DEFAULT 1,
      show_bookmarks INTEGER NOT NULL DEFAULT 0,
      active_folder_id TEXT,
      search_query TEXT,
      started_at INTEGER NOT NULL,
      last_activity_at INTEGER NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_sessions_archive_path ON viewing_sessions(archive_path);
    CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON viewing_sessions(last_activity_at);
    
    -- Trigger to update 'last_activity_at' timestamp
    CREATE TRIGGER IF NOT EXISTS update_viewing_sessions_last_activity
      AFTER UPDATE ON viewing_sessions
    BEGIN
      UPDATE viewing_sessions SET last_activity_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;
  `;
  database.exec(migration002);

  console.log('Database migrations completed');
}

/**
 * Get the database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    return initializeDatabase();
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

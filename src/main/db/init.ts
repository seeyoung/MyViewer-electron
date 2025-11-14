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
      source_type TEXT NOT NULL DEFAULT 'archive',
      source_id TEXT,
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

  ensureColumn(database, 'viewing_sessions', 'source_type', "TEXT NOT NULL DEFAULT 'archive'");
  ensureColumn(database, 'viewing_sessions', 'source_id', 'TEXT');

  // Migration 003: Create playlists tables
  const migration003 = `
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_playlists_updated_at ON playlists(updated_at DESC);

    CREATE TABLE IF NOT EXISTS playlist_entries (
      playlist_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      source_path TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK(source_type IN ('folder', 'archive')),
      label TEXT NOT NULL,
      thumbnail_path TEXT,
      PRIMARY KEY (playlist_id, position),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_playlist_entries_position ON playlist_entries(playlist_id, position);
  `;
  database.exec(migration003);

  // Migration 004: Create playlist_playback_state table
  const migration004 = `
    CREATE TABLE IF NOT EXISTS playlist_playback_state (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      active_playlist_id TEXT,
      current_entry_index INTEGER NOT NULL DEFAULT -1,
      is_playing BOOLEAN NOT NULL DEFAULT 0,
      auto_advance_to_next_entry BOOLEAN NOT NULL DEFAULT 1,
      loop_mode TEXT NOT NULL DEFAULT 'none' CHECK(loop_mode IN ('none', 'playlist', 'entry')),
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (active_playlist_id) REFERENCES playlists(id) ON DELETE SET NULL
    );

    INSERT OR IGNORE INTO playlist_playback_state (id, updated_at)
    VALUES (1, strftime('%s', 'now') * 1000);
  `;
  database.exec(migration004);

  console.log('Database migrations completed');
}

function ensureColumn(database: Database.Database, table: string, column: string, definition: string) {
  const columnInfo = database.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columnInfo.some((info: any) => info.name === column);

  if (!exists) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
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

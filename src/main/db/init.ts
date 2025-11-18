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

  runMigrationFile(database, '003_create_slideshows.sql');

  console.log('Database migrations completed');
}

function runMigrationFile(database: Database.Database, filename: string): void {
  const migrationsDir = path.join(__dirname, 'migrations');
  let filePath = path.join(migrationsDir, filename);

  if (!fs.existsSync(filePath)) {
    const fallback = path.join(app.getAppPath(), 'src', 'main', 'db', 'migrations', filename);
    if (fs.existsSync(fallback)) {
      filePath = fallback;
    } else {
      console.warn(`Migration file not found: ${filename}`);
      return;
    }
  }

  try {
    const sql = fs.readFileSync(filePath, 'utf-8');
    database.exec(sql);
  } catch (error) {
    console.error(`Failed to run migration ${filename}:`, error);
    throw error;
  }
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

import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { Image } from '@shared/types/Image';

interface CacheEntry {
  source_path: string;
  mtime: number;
  scan_data: string; // JSON serialized
  created_at: number;
  last_accessed_at: number;
}

const MAX_CACHE_SIZE = 100; // Maximum number of cache entries
const CACHE_VERSION = 1;

/**
 * Scan Cache Service
 * Caches folder/archive scan results to improve subsequent open performance
 */
export class ScanCacheService {
  private db: Database.Database;

  constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'scan-cache.db');

    // Ensure directory exists
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Create cache table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scan_cache (
        source_path TEXT PRIMARY KEY,
        mtime INTEGER NOT NULL,
        scan_data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL,
        cache_version INTEGER NOT NULL DEFAULT ${CACHE_VERSION}
      );

      CREATE INDEX IF NOT EXISTS idx_last_accessed
        ON scan_cache(last_accessed_at);
    `);
  }

  /**
   * Get cached scan result
   */
  getCachedScan(sourcePath: string, mtime: number): Image[] | null {
    const stmt = this.db.prepare(`
      SELECT scan_data, mtime, cache_version
      FROM scan_cache
      WHERE source_path = ?
    `);

    const row = stmt.get(sourcePath) as CacheEntry | undefined;

    if (!row) {
      return null;
    }

    // Check if cache is still valid (mtime matches)
    if (row.mtime !== mtime) {
      console.log(`Cache invalidated for ${sourcePath}: mtime mismatch`);
      this.deleteCachedScan(sourcePath);
      return null;
    }

    // Update last accessed time
    this.updateLastAccessed(sourcePath);

    try {
      const images = JSON.parse(row.scan_data) as Image[];
      console.log(`✅ Cache hit for ${sourcePath}: ${images.length} images`);
      return images;
    } catch (error) {
      console.error('Failed to parse cached scan data:', error);
      this.deleteCachedScan(sourcePath);
      return null;
    }
  }

  /**
   * Save scan result to cache
   */
  saveScan(sourcePath: string, mtime: number, images: Image[]): void {
    try {
      const scanData = JSON.stringify(images);
      const now = Date.now();

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO scan_cache
        (source_path, mtime, scan_data, created_at, last_accessed_at, cache_version)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(sourcePath, mtime, scanData, now, now, CACHE_VERSION);

      console.log(`💾 Cached scan for ${sourcePath}: ${images.length} images`);

      // Clean up old entries if cache is too large
      this.cleanupOldEntries();
    } catch (error) {
      console.error('Failed to save scan cache:', error);
    }
  }

  /**
   * Delete cached scan
   */
  deleteCachedScan(sourcePath: string): void {
    const stmt = this.db.prepare('DELETE FROM scan_cache WHERE source_path = ?');
    stmt.run(sourcePath);
  }

  /**
   * Update last accessed time
   */
  private updateLastAccessed(sourcePath: string): void {
    const stmt = this.db.prepare(`
      UPDATE scan_cache
      SET last_accessed_at = ?
      WHERE source_path = ?
    `);
    stmt.run(Date.now(), sourcePath);
  }

  /**
   * Clean up old cache entries using LRU strategy
   */
  private cleanupOldEntries(): void {
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM scan_cache');
    const { count } = countStmt.get() as { count: number };

    if (count > MAX_CACHE_SIZE) {
      const deleteCount = count - MAX_CACHE_SIZE;
      const deleteStmt = this.db.prepare(`
        DELETE FROM scan_cache
        WHERE source_path IN (
          SELECT source_path
          FROM scan_cache
          ORDER BY last_accessed_at ASC
          LIMIT ?
        )
      `);
      deleteStmt.run(deleteCount);
      console.log(`🧹 Cleaned up ${deleteCount} old cache entries`);
    }
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    this.db.exec('DELETE FROM scan_cache');
    console.log('🧹 Cleared all scan cache');
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalEntries: number; totalSize: number } {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as totalEntries,
        SUM(LENGTH(scan_data)) as totalSize
      FROM scan_cache
    `);
    return stmt.get() as { totalEntries: number; totalSize: number };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

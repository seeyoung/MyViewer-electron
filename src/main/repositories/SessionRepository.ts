import DatabaseConnection from '../db/connection';
import { ViewingSession, ViewMode, ReadingDirection, FitMode, Rotation } from '@shared/types/ViewingSession';
import { SourceType } from '@shared/types/Source';

/**
 * Session Repository
 * CRUD operations for viewing sessions in SQLite
 */
export class SessionRepository {
  private db = DatabaseConnection.getInstance().getDb();

  /**
   * Get session by archive path
   */
  getSessionBySourcePath(sourcePath: string): ViewingSession | null {
    const stmt = this.db.prepare(`
      SELECT * FROM viewing_sessions WHERE archive_path = ?
    `);

    const row = stmt.get(sourcePath) as any;

    if (!row) {
      return null;
    }

    return this.rowToSession(row);
  }

  /**
   * Get session by ID
   */
  getSessionById(id: string): ViewingSession | null {
    const stmt = this.db.prepare('SELECT * FROM viewing_sessions WHERE id = ?');
    const row = stmt.get(id);
    if (!row) {
      return null;
    }
    return this.rowToSession(row);
  }

  /**
   * Create new session
   */
  createSession(session: ViewingSession): ViewingSession {
    const stmt = this.db.prepare(`
      INSERT INTO viewing_sessions (
        id, archive_path, source_type, source_id,
        current_page_index, reading_direction, view_mode,
        zoom_level, fit_mode, rotation, show_thumbnails, show_folder_tree,
        show_bookmarks, active_folder_id, search_query, started_at, last_activity_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.sourcePath,
      session.sourceType,
      session.sourceId || null,
      session.currentPageIndex,
      session.readingDirection,
      session.viewMode,
      session.zoomLevel,
      session.fitMode,
      session.rotation,
      session.showThumbnails ? 1 : 0,
      session.showFolderTree ? 1 : 0,
      session.showBookmarks ? 1 : 0,
      session.activeFolderId || null,
      session.searchQuery || null,
      session.startedAt,
      session.lastActivityAt
    );

    return session;
  }

  /**
   * Update existing session
   */
  updateSession(session: ViewingSession): void {
    const stmt = this.db.prepare(`
      UPDATE viewing_sessions SET
        source_type = ?,
        source_id = ?,
        current_page_index = ?,
        reading_direction = ?,
        view_mode = ?,
        zoom_level = ?,
        fit_mode = ?,
        rotation = ?,
        show_thumbnails = ?,
        show_folder_tree = ?,
        show_bookmarks = ?,
        active_folder_id = ?,
        search_query = ?,
        last_activity_at = ?
      WHERE id = ?
    `);

    stmt.run(
      session.sourceType,
      session.sourceId || null,
      session.currentPageIndex,
      session.readingDirection,
      session.viewMode,
      session.zoomLevel,
      session.fitMode,
      session.rotation,
      session.showThumbnails ? 1 : 0,
      session.showFolderTree ? 1 : 0,
      session.showBookmarks ? 1 : 0,
      session.activeFolderId || null,
      session.searchQuery || null,
      session.lastActivityAt,
      session.id
    );
  }

  /**
   * Delete session
   */
  deleteSession(sessionId: string): void {
    const stmt = this.db.prepare('DELETE FROM viewing_sessions WHERE id = ?');
    stmt.run(sessionId);
  }

  /**
   * Delete old sessions (cleanup)
   */
  deleteOldSessions(maxAgeSeconds: number): number {
    const cutoffTime = Date.now() - maxAgeSeconds * 1000;
    const stmt = this.db.prepare('DELETE FROM viewing_sessions WHERE last_activity_at < ?');
    const result = stmt.run(cutoffTime);
    return result.changes;
  }

  /**
   * Convert database row to ViewingSession
   */
  private rowToSession(row: any): ViewingSession {
    return {
      id: row.id,
      sourceId: row.source_id || undefined,
      sourcePath: row.archive_path,
      sourceType: (row.source_type as SourceType) || SourceType.ARCHIVE,
      currentPageIndex: row.current_page_index,
      readingDirection: row.reading_direction as ReadingDirection,
      viewMode: row.view_mode as ViewMode,
      zoomLevel: row.zoom_level,
      fitMode: row.fit_mode as FitMode,
      rotation: row.rotation as Rotation,
      showThumbnails: row.show_thumbnails === 1,
      showFolderTree: row.show_folder_tree === 1,
      showBookmarks: row.show_bookmarks === 1,
      activeFolderId: row.active_folder_id || undefined,
      searchQuery: row.search_query || undefined,
      startedAt: row.started_at,
      lastActivityAt: row.last_activity_at,
    };
  }
}

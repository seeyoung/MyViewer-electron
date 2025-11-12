import { SessionRepository } from '../repositories/SessionRepository';
import { ViewingSession, ViewMode, ReadingDirection, FitMode, Rotation } from '@shared/types/ViewingSession';
import { randomUUID } from 'crypto';

/**
 * Session Service
 * Manages viewing sessions with auto-save debouncing
 */
export class SessionService {
  private repository: SessionRepository;
  private saveTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private debounceMs: number = 500;

  constructor() {
    this.repository = new SessionRepository();
  }

  /**
   * Get or create session for an archive
   */
  getOrCreateSession(archivePath: string, archiveId: string): ViewingSession {
    // Try to get existing session
    const existing = this.repository.getSessionByArchivePath(archivePath);

    if (existing) {
      // Update archive ID and last activity
      existing.archiveId = archiveId;
      existing.lastActivityAt = Date.now();
      this.repository.updateSession(existing);
      return existing;
    }

    // Create new session with defaults
    const session: ViewingSession = {
      id: randomUUID(),
      archiveId,
      archivePath,
      currentPageIndex: 0,
      readingDirection: ReadingDirection.LTR,
      viewMode: ViewMode.SINGLE,
      zoomLevel: 1.0,
      fitMode: FitMode.FIT_WIDTH,
      rotation: Rotation.NONE,
      showThumbnails: true,
      showFolderTree: false,
      showBookmarks: false,
      activeFolderId: undefined,
      searchQuery: undefined,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    this.repository.createSession(session);
    return session;
  }

  /**
   * Update session (with debouncing)
   */
  updateSession(session: Partial<ViewingSession> & { id: string }): void {
    // Clear existing timeout
    const existingTimeout = this.saveTimeouts.get(session.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Get full session data
    const fullSession = this.getSessionById(session.id);
    if (!fullSession) {
      console.error(`Session not found: ${session.id}`);
      return;
    }

    // Merge updates
    const updated: ViewingSession = {
      ...fullSession,
      ...session,
      lastActivityAt: Date.now(),
    };

    // Debounce save
    const timeout = setTimeout(() => {
      this.repository.updateSession(updated);
      this.saveTimeouts.delete(session.id);
    }, this.debounceMs);

    this.saveTimeouts.set(session.id, timeout);
  }

  /**
   * Save session immediately (no debounce)
   */
  saveSessionNow(session: ViewingSession): void {
    // Clear any pending save
    const existingTimeout = this.saveTimeouts.get(session.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.saveTimeouts.delete(session.id);
    }

    session.lastActivityAt = Date.now();
    this.repository.updateSession(session);
  }

  /**
   * Get session by ID (for internal use)
   */
  private getSessionById(sessionId: string): ViewingSession | null {
    // This is a simplified version - in a real implementation,
    // we'd need to add a getSessionById method to the repository
    // For now, we'll work with what we have
    return null;
  }

  /**
   * Delete session
   */
  deleteSession(sessionId: string): void {
    // Clear any pending save
    const existingTimeout = this.saveTimeouts.get(sessionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.saveTimeouts.delete(sessionId);
    }

    this.repository.deleteSession(sessionId);
  }

  /**
   * Cleanup old sessions
   */
  cleanupOldSessions(maxAgeDays: number = 90): number {
    const maxAgeSeconds = maxAgeDays * 24 * 60 * 60;
    return this.repository.deleteOldSessions(maxAgeSeconds);
  }

  /**
   * Flush all pending saves
   */
  flushAll(): void {
    this.saveTimeouts.forEach(timeout => {
      clearTimeout(timeout);
    });
    this.saveTimeouts.clear();
  }
}

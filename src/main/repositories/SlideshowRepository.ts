import DatabaseConnection from '../db/connection';
import { Slideshow, SlideshowEntry, SlideshowWithEntries } from '@shared/types/slideshow';

interface SlideshowEntryInsert extends Omit<SlideshowEntry, 'position'> {
  position?: number;
}

export class SlideshowRepository {
  private db = DatabaseConnection.getInstance().getDb();

  getAll(): Slideshow[] {
    const stmt = this.db.prepare(
      'SELECT id, name, description, allow_duplicates, created_at, updated_at FROM slideshows ORDER BY updated_at DESC'
    );
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapSlideshow(row));
  }

  getById(id: string): SlideshowWithEntries | null {
    const slideshowStmt = this.db.prepare(
      'SELECT id, name, description, allow_duplicates, created_at, updated_at FROM slideshows WHERE id = ?'
    );
    const slideshowRow = slideshowStmt.get(id);
    if (!slideshowRow) {
      return null;
    }

    const entriesStmt = this.db.prepare(
      `SELECT slideshow_id, position, source_path, source_type, label
         FROM slideshow_entries
         WHERE slideshow_id = ?
         ORDER BY position ASC`
    );
    const entryRows = entriesStmt.all(id) as any[];

    return {
      slideshow: this.mapSlideshow(slideshowRow),
      entries: entryRows.map(row => this.mapEntry(row)),
    };
  }

  create(slideshow: Slideshow): void {
    const stmt = this.db.prepare(
      `INSERT INTO slideshows (id, name, description, allow_duplicates, created_at, updated_at)
       VALUES (@id, @name, @description, @allowDuplicates, @createdAt, @updatedAt)`
    );
    stmt.run({
      id: slideshow.id,
      name: slideshow.name,
      description: slideshow.description ?? null,
      allowDuplicates: slideshow.allowDuplicates ? 1 : 0,
      createdAt: slideshow.createdAt,
      updatedAt: slideshow.updatedAt,
    });
  }

  update(id: string, payload: Partial<Omit<Slideshow, 'id'>>): Slideshow {
    const current = this.getById(id)?.slideshow;
    if (!current) {
      throw new Error('Slideshow not found');
    }

    const next: Slideshow = {
      ...current,
      ...payload,
      updatedAt: payload.updatedAt ?? Date.now(),
    };

    const stmt = this.db.prepare(
      `UPDATE slideshows SET
         name = @name,
         description = @description,
         allow_duplicates = @allowDuplicates,
         updated_at = @updatedAt
       WHERE id = @id`
    );
    stmt.run({
      id,
      name: next.name,
      description: next.description ?? null,
      allowDuplicates: next.allowDuplicates ? 1 : 0,
      updatedAt: next.updatedAt,
    });

    return next;
  }

  delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM slideshows WHERE id = ?');
    stmt.run(id);
  }

  findByName(name: string): Slideshow | null {
    const stmt = this.db.prepare(
      'SELECT id, name, description, allow_duplicates, created_at, updated_at FROM slideshows WHERE name = ? COLLATE NOCASE'
    );
    const row = stmt.get(name);
    return row ? this.mapSlideshow(row) : null;
  }

  addEntry(slideshowId: string, entry: SlideshowEntryInsert): SlideshowEntry {
    return this.db.transaction(() => {
      const position = this.resolvePosition(slideshowId, entry.position);
      this.shiftPositions(slideshowId, position);

      const stmt = this.db.prepare(
        `INSERT INTO slideshow_entries (slideshow_id, position, source_path, source_type, label)
         VALUES (@slideshowId, @position, @sourcePath, @sourceType, @label)`
      );
      stmt.run({
        slideshowId,
        position,
        sourcePath: entry.sourcePath,
        sourceType: entry.sourceType,
        label: entry.label,
      });

      return {
        slideshowId,
        position,
        sourcePath: entry.sourcePath,
        sourceType: entry.sourceType,
        label: entry.label,
      };
    })();
  }

  setEntries(slideshowId: string, entries: SlideshowEntry[]): void {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM slideshow_entries WHERE slideshow_id = ?').run(slideshowId);
      const stmt = this.db.prepare(
        `INSERT INTO slideshow_entries (slideshow_id, position, source_path, source_type, label)
         VALUES (@slideshowId, @position, @sourcePath, @sourceType, @label)`
      );
      entries.forEach(entry =>
        stmt.run({
          slideshowId,
          position: entry.position,
          sourcePath: entry.sourcePath,
          sourceType: entry.sourceType,
          label: entry.label,
        })
      );
    })();
  }

  private mapSlideshow(row: any): Slideshow {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      allowDuplicates: Boolean(row.allow_duplicates),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapEntry(row: any): SlideshowEntry {
    return {
      slideshowId: row.slideshow_id,
      position: row.position,
      sourcePath: row.source_path,
      sourceType: row.source_type,
      label: row.label,
    };
  }

  private resolvePosition(slideshowId: string, position?: number): number {
    if (typeof position === 'number' && position >= 0) {
      return position;
    }
    const row = this.db
      .prepare('SELECT IFNULL(MAX(position) + 1, 0) AS next_position FROM slideshow_entries WHERE slideshow_id = ?')
      .get(slideshowId) as { next_position: number };
    return row?.next_position ?? 0;
  }

  private shiftPositions(slideshowId: string, start: number): void {
    this.db
      .prepare('UPDATE slideshow_entries SET position = position + 1 WHERE slideshow_id = ? AND position >= ?')
      .run(slideshowId, start);
  }
}

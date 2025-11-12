import { getDatabase, initializeDatabase, closeDatabase } from './init';
import Database from 'better-sqlite3';

/**
 * Database connection manager (singleton pattern)
 */
class DatabaseConnection {
  private static instance: DatabaseConnection | null = null;
  private db: Database.Database | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  /**
   * Get the database instance
   */
  public getDb(): Database.Database {
    if (!this.db) {
      this.db = initializeDatabase();
    }
    return this.db;
  }

  /**
   * Close the database connection
   */
  public close(): void {
    closeDatabase();
    this.db = null;
  }

  /**
   * Begin a transaction
   */
  public beginTransaction(): void {
    this.getDb().exec('BEGIN TRANSACTION');
  }

  /**
   * Commit a transaction
   */
  public commit(): void {
    this.getDb().exec('COMMIT');
  }

  /**
   * Rollback a transaction
   */
  public rollback(): void {
    this.getDb().exec('ROLLBACK');
  }

  /**
   * Execute a function within a transaction
   */
  public transaction<T>(fn: () => T): T {
    const db = this.getDb();
    const transaction = db.transaction(fn);
    return transaction();
  }
}

export default DatabaseConnection;
export { getDatabase };

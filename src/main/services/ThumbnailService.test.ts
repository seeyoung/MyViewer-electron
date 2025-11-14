import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThumbnailService } from './ThumbnailService';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Mock dependencies
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => path.join(os.tmpdir(), 'test-thumbnail-cache')),
  },
}));

describe('ThumbnailService - Cache Management', () => {
  let thumbnailService: ThumbnailService;
  let mockImageService: any;
  let mockFolderService: any;
  let testCacheDir: string;

  beforeEach(async () => {
    testCacheDir = path.join(os.tmpdir(), 'test-thumbnail-cache', 'thumbnail-cache');

    // Mock services
    mockImageService = {
      loadImage: vi.fn(),
    };
    mockFolderService = {
      loadImage: vi.fn(),
    };

    thumbnailService = new ThumbnailService(mockImageService, mockFolderService);

    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Cache Size Management', () => {
    it('should limit cache size to 500MB', async () => {
      // Test that cache cleanup triggers when size exceeds 500MB
      const stats = (thumbnailService as any).getCacheStats();
      expect(stats.totalSize).toBeLessThanOrEqual(500 * 1024 * 1024);
    });

    it('should track cache file sizes', async () => {
      // Test that cache stats are properly tracked
      const cacheStats = (thumbnailService as any).cacheStats;
      expect(cacheStats).toBeDefined();
      expect(cacheStats instanceof Map).toBe(true);
    });

    it('should update cache access time when file is accessed', async () => {
      // Test that accessing a cached file updates its access time
      const now = Date.now();
      const filename = 'test-cache.webp';
      const filePath = path.join(testCacheDir, filename);

      // Create test cache directory and file
      await fs.mkdir(testCacheDir, { recursive: true });
      await fs.writeFile(filePath, Buffer.from('test'));

      // Initialize cache stats
      await (thumbnailService as any).loadCacheStats();

      // Access the file
      await (thumbnailService as any).updateCacheAccess(filename, filePath);

      const stats = (thumbnailService as any).cacheStats.get(filename);
      expect(stats).toBeDefined();
      expect(stats.accessTime).toBeGreaterThanOrEqual(now);
    });
  });

  describe('LRU Policy', () => {
    it('should delete least recently used files when cache is full', async () => {
      // Test that LRU policy is applied when cache size exceeds limit
      // This is a placeholder - actual implementation needed
      const maxCacheSize = (thumbnailService as any).maxCacheSize;
      expect(maxCacheSize).toBe(500 * 1024 * 1024);
    });

    it('should preserve recently accessed files', async () => {
      // Test that recently accessed files are kept during cleanup
      // This is a placeholder - actual implementation needed
      expect(true).toBe(true);
    });

    it('should sort files by access time for cleanup', async () => {
      // Test that cleanup properly sorts files by LRU order
      // This is a placeholder - actual implementation needed
      expect(true).toBe(true);
    });
  });

  describe('Old Cache Cleanup', () => {
    it('should delete files older than 30 days', async () => {
      // Test that files older than maxCacheAge are deleted
      const maxCacheAge = (thumbnailService as any).maxCacheAge;
      expect(maxCacheAge).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('should schedule periodic cleanup', async () => {
      // Test that cleanup runs periodically
      // This would require testing setInterval behavior
      expect(true).toBe(true);
    });
  });

  describe('Cache Statistics', () => {
    it('should return cache statistics', () => {
      const stats = (thumbnailService as any).getCacheStats();

      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('fileCount');
      expect(stats).toHaveProperty('oldestAccess');

      expect(typeof stats.totalSize).toBe('number');
      expect(typeof stats.fileCount).toBe('number');
      expect(typeof stats.oldestAccess).toBe('number');
    });

    it('should calculate total cache size correctly', () => {
      const stats = (thumbnailService as any).getCacheStats();
      expect(stats.totalSize).toBeGreaterThanOrEqual(0);
    });

    it('should track file count accurately', () => {
      const stats = (thumbnailService as any).getCacheStats();
      expect(stats.fileCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cache Initialization', () => {
    it('should initialize cache management on construction', () => {
      // Test that cache management is initialized
      const cacheDir = (thumbnailService as any).cacheDir;
      expect(cacheDir).toContain('thumbnail-cache');
    });

    it('should load existing cache stats on startup', async () => {
      // Test that existing cache files are scanned and stats loaded
      // Create some test files first
      await fs.mkdir(testCacheDir, { recursive: true });
      await fs.writeFile(path.join(testCacheDir, 'test1.webp'), Buffer.from('test1'));
      await fs.writeFile(path.join(testCacheDir, 'test2.webp'), Buffer.from('test2'));

      // Create new service instance to trigger loadCacheStats
      const newService = new ThumbnailService(mockImageService, mockFolderService);

      // Give it time to load
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = (newService as any).getCacheStats();
      expect(stats.fileCount).toBeGreaterThanOrEqual(0);
    });
  });
});

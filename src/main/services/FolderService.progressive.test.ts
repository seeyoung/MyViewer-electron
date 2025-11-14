import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FolderService } from './FolderService';
import { ScanStatus } from '@shared/types/Scan';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

describe('FolderService - Progressive Scan', () => {
  let folderService: FolderService;
  let testDir: string;

  beforeEach(async () => {
    folderService = new FolderService();
    testDir = path.join(tmpdir(), `myviewer-test-${randomUUID()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('openFolderProgressive', () => {
    it('should return initial response with scanToken for folders with images', async () => {
      // Arrange: Create test folder structure
      await createTestImages(testDir, 10);

      // Act: Open folder with progressive scan
      const result = await folderService.openFolderProgressive(testDir);

      // Assert
      expect(result).toBeDefined();
      expect(result.scanToken).toBeTruthy();
      expect(typeof result.scanToken).toBe('string');
      expect(result.source).toBeDefined();
      expect(result.source.path).toBe(testDir);
      expect(result.initialImages).toBeInstanceOf(Array);
      expect(result.rootFolder).toBeDefined();
    });

    it('should return isComplete=true for small folders (<100 images)', async () => {
      // Arrange: Create small folder with 50 images
      await createTestImages(testDir, 50);

      // Act
      const result = await folderService.openFolderProgressive(testDir);

      // Assert
      expect(result.isComplete).toBe(true);
      expect(result.initialImages.length).toBe(50);
    });

    it('should return isComplete=false for large folders (>=100 images)', async () => {
      // Arrange: Create large folder with 150 images
      await createTestImages(testDir, 150);

      // Act
      const result = await folderService.openFolderProgressive(testDir);

      // Assert
      expect(result.isComplete).toBe(false);
      expect(result.initialImages.length).toBeLessThanOrEqual(100);
      expect(result.estimatedTotal).toBeGreaterThanOrEqual(150);
    });

    it('should return initial images immediately without scanning subfolders', async () => {
      // Arrange: Create root with 50 images and subfolder with 100 images
      await createTestImages(testDir, 50);
      const subDir = path.join(testDir, 'subfolder');
      await fs.mkdir(subDir);
      await createTestImages(subDir, 100);

      // Act
      const startTime = Date.now();
      const result = await folderService.openFolderProgressive(testDir);
      const duration = Date.now() - startTime;

      // Assert: Should be fast (< 500ms) because it only scans root level
      expect(duration).toBeLessThan(500);
      expect(result.initialImages.length).toBe(50); // Only root level images
      expect(result.isComplete).toBe(false); // Subfolder not scanned yet
    });

    it('should provide unique scanToken for each call', async () => {
      // Arrange
      await createTestImages(testDir, 10);

      // Act
      const result1 = await folderService.openFolderProgressive(testDir);
      const result2 = await folderService.openFolderProgressive(testDir);

      // Assert
      expect(result1.scanToken).not.toBe(result2.scanToken);
    });
  });

  describe('Background Scanning', () => {
    it('should emit scan-progress events during background scan', async () => {
      // Arrange: Create folder with subfolders
      await createTestImages(testDir, 50);
      const subDir = path.join(testDir, 'subfolder');
      await fs.mkdir(subDir);
      await createTestImages(subDir, 100);

      const progressEvents: any[] = [];
      const progressCallback = vi.fn((event) => progressEvents.push(event));

      // Act
      const result = await folderService.openFolderProgressive(testDir);
      folderService.on('scan-progress', progressCallback);

      // Wait for background scan
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Assert
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].token).toBe(result.scanToken);
      expect(progressEvents[0].discovered).toBeGreaterThan(0);
      expect(progressEvents[0].processed).toBeGreaterThan(0);
    });

    it('should emit scan-complete event when scan finishes', async () => {
      // Arrange
      await createTestImages(testDir, 50);
      const subDir = path.join(testDir, 'subfolder');
      await fs.mkdir(subDir);
      await createTestImages(subDir, 80);

      let completeEvent: any = null;
      const completeCallback = vi.fn((event) => { completeEvent = event; });

      // Act
      const result = await folderService.openFolderProgressive(testDir);
      folderService.on('scan-complete', completeCallback);

      // Wait for background scan to complete
      await waitForScanComplete(folderService, result.scanToken, 3000);

      // Assert
      expect(completeCallback).toHaveBeenCalled();
      expect(completeEvent).toBeDefined();
      expect(completeEvent.token).toBe(result.scanToken);
      expect(completeEvent.totalImages).toBe(130); // 50 + 80
      expect(completeEvent.duration).toBeGreaterThan(0);
    });

    it('should use BFS strategy to scan folders (shallow first)', async () => {
      // Arrange: Create deep folder structure
      // root/ (10 images)
      //   ├── level1a/ (20 images)
      //   │   └── level2a/ (30 images)
      //   └── level1b/ (40 images)
      await createTestImages(testDir, 10);

      const level1a = path.join(testDir, 'level1a');
      await fs.mkdir(level1a);
      await createTestImages(level1a, 20);

      const level2a = path.join(level1a, 'level2a');
      await fs.mkdir(level2a);
      await createTestImages(level2a, 30);

      const level1b = path.join(testDir, 'level1b');
      await fs.mkdir(level1b);
      await createTestImages(level1b, 40);

      const progressEvents: any[] = [];
      folderService.on('scan-progress', (event) => progressEvents.push(event));

      // Act
      await folderService.openFolderProgressive(testDir);
      await waitForScanComplete(folderService, progressEvents[0]?.token, 3000);

      // Assert: level1a and level1b should be scanned before level2a
      const paths = progressEvents.map(e => e.currentPath);
      const level1aIndex = paths.findIndex(p => p.includes('level1a') && !p.includes('level2a'));
      const level1bIndex = paths.findIndex(p => p.includes('level1b'));
      const level2aIndex = paths.findIndex(p => p.includes('level2a'));

      expect(level1aIndex).toBeGreaterThan(-1);
      expect(level1bIndex).toBeGreaterThan(-1);
      expect(level2aIndex).toBeGreaterThan(-1);
      expect(level2aIndex).toBeGreaterThan(Math.max(level1aIndex, level1bIndex));
    });
  });

  describe('Scan Cancellation', () => {
    it('should cancel ongoing scan when requested', async () => {
      // Arrange: Create large folder
      await createTestImages(testDir, 50);
      for (let i = 0; i < 10; i++) {
        const subDir = path.join(testDir, `subfolder${i}`);
        await fs.mkdir(subDir);
        await createTestImages(subDir, 50);
      }

      // Act: Start scan and cancel immediately
      const result = await folderService.openFolderProgressive(testDir);
      const cancelled = await folderService.cancelScan(result.scanToken);

      // Wait a bit to ensure scan doesn't continue
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert
      expect(cancelled).toBe(true);
      expect(folderService.isScanActive(result.scanToken)).toBe(false);
    });

    it('should return false when cancelling non-existent scan', async () => {
      // Act
      const cancelled = await folderService.cancelScan('non-existent-token');

      // Assert
      expect(cancelled).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle permission errors gracefully', async () => {
      // Arrange: Create folder with no-access subfolder (skip on Windows)
      if (process.platform === 'win32') {
        return; // Skip this test on Windows
      }

      await createTestImages(testDir, 10);
      const restrictedDir = path.join(testDir, 'restricted');
      await fs.mkdir(restrictedDir);
      await createTestImages(restrictedDir, 10);
      await fs.chmod(restrictedDir, 0o000); // Remove all permissions

      // Act
      const result = await folderService.openFolderProgressive(testDir);

      // Cleanup permissions before assertions
      await fs.chmod(restrictedDir, 0o755);

      // Assert: Should still work with accessible images
      expect(result.initialImages.length).toBeGreaterThan(0);
    });

    it('should emit error event but continue scanning on partial failures', async () => {
      // This test verifies graceful degradation
      // Implementation depends on how errors are handled
    });
  });
});

// Helper functions

async function createTestImages(dir: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const filename = `image${String(i).padStart(3, '0')}.jpg`;
    const filepath = path.join(dir, filename);
    // Create empty file (actual image data not needed for tests)
    await fs.writeFile(filepath, Buffer.from('fake-image-data'));
  }
}

async function waitForScanComplete(
  service: FolderService,
  token: string,
  timeout: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Scan did not complete within timeout'));
    }, timeout);

    service.on('scan-complete', (event) => {
      if (event.token === token) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

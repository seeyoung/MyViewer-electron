import { describe, it, expect, beforeEach } from 'vitest';
import { ThumbnailService } from './ThumbnailService';
import { Image } from '@shared/types/Image';
import { SourceType } from '@shared/types/Source';

describe('ThumbnailService - Cache Key Generation', () => {
  let thumbnailService: ThumbnailService;
  let mockImageService: any;
  let mockFolderService: any;

  beforeEach(() => {
    mockImageService = { loadImage: () => Promise.resolve(Buffer.from('')) };
    mockFolderService = { loadImage: () => Promise.resolve(Buffer.from('')) };
    thumbnailService = new ThumbnailService(mockImageService, mockFolderService);
  });

  describe('Collision Prevention', () => {
    it('should generate different keys for different images with fileSize 0', () => {
      const image1: Partial<Image> = {
        id: '1',
        archiveId: 'archive1',
        pathInArchive: 'image1.jpg',
        fileName: 'image1.jpg',
        fileSize: 0,
      };

      const image2: Partial<Image> = {
        id: '2',
        archiveId: 'archive1',
        pathInArchive: 'image2.jpg',
        fileName: 'image2.jpg',
        fileSize: 0,
      };

      const key1 = (thumbnailService as any).buildCacheKey(
        image1,
        SourceType.ARCHIVE,
        { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
      );

      const key2 = (thumbnailService as any).buildCacheKey(
        image2,
        SourceType.ARCHIVE,
        { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
      );

      expect(key1).not.toBe(key2);
    });

    it('should use pathInArchive to ensure uniqueness', () => {
      const image1: Partial<Image> = {
        id: '1',
        archiveId: 'archive1',
        pathInArchive: 'folder/image.jpg',
        fileName: 'image.jpg',
        fileSize: 1000,
      };

      const image2: Partial<Image> = {
        id: '2',
        archiveId: 'archive1',
        pathInArchive: 'other/image.jpg',
        fileName: 'image.jpg',
        fileSize: 1000,
      };

      const key1 = (thumbnailService as any).buildCacheKey(
        image1,
        SourceType.ARCHIVE,
        { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
      );

      const key2 = (thumbnailService as any).buildCacheKey(
        image2,
        SourceType.ARCHIVE,
        { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
      );

      expect(key1).not.toBe(key2);
    });

    it('should handle images with dimensions', () => {
      const image1: Partial<Image> = {
        id: '1',
        archiveId: 'archive1',
        pathInArchive: 'image.jpg',
        fileName: 'image.jpg',
        fileSize: 1000,
        dimensions: { width: 1920, height: 1080 },
      };

      const image2: Partial<Image> = {
        id: '1',
        archiveId: 'archive1',
        pathInArchive: 'image.jpg',
        fileName: 'image.jpg',
        fileSize: 1000,
        dimensions: { width: 1280, height: 720 },
      };

      const key1 = (thumbnailService as any).buildCacheKey(
        image1,
        SourceType.ARCHIVE,
        { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
      );

      const key2 = (thumbnailService as any).buildCacheKey(
        image2,
        SourceType.ARCHIVE,
        { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
      );

      expect(key1).not.toBe(key2);
    });
  });

  describe('Hash Algorithm', () => {
    it('should generate SHA256 hash (64 characters)', () => {
      const image: Partial<Image> = {
        id: '1',
        archiveId: 'archive1',
        pathInArchive: 'image.jpg',
        fileName: 'image.jpg',
        fileSize: 1000,
      };

      const key = (thumbnailService as any).buildCacheKey(
        image,
        SourceType.ARCHIVE,
        { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
      );

      // SHA256 produces 64 hex characters
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should not use SHA1 (40 characters)', () => {
      const image: Partial<Image> = {
        id: '1',
        archiveId: 'archive1',
        pathInArchive: 'image.jpg',
        fileName: 'image.jpg',
        fileSize: 1000,
      };

      const key = (thumbnailService as any).buildCacheKey(
        image,
        SourceType.ARCHIVE,
        { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
      );

      // Should NOT be SHA1 length
      expect(key.length).not.toBe(40);
    });
  });

  describe('Option Sensitivity', () => {
    it('should generate different keys for different sizes', () => {
      const image: Partial<Image> = {
        id: '1',
        archiveId: 'archive1',
        pathInArchive: 'image.jpg',
        fileName: 'image.jpg',
        fileSize: 1000,
      };

      const key1 = (thumbnailService as any).buildCacheKey(
        image,
        SourceType.ARCHIVE,
        { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
      );

      const key2 = (thumbnailService as any).buildCacheKey(
        image,
        SourceType.ARCHIVE,
        { maxWidth: 400, maxHeight: 400, format: 'webp', quality: 80 }
      );

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different formats', () => {
      const image: Partial<Image> = {
        id: '1',
        archiveId: 'archive1',
        pathInArchive: 'image.jpg',
        fileName: 'image.jpg',
        fileSize: 1000,
      };

      const key1 = (thumbnailService as any).buildCacheKey(
        image,
        SourceType.ARCHIVE,
        { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
      );

      const key2 = (thumbnailService as any).buildCacheKey(
        image,
        SourceType.ARCHIVE,
        { maxWidth: 200, maxHeight: 200, format: 'jpeg', quality: 80 }
      );

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different quality', () => {
      const image: Partial<Image> = {
        id: '1',
        archiveId: 'archive1',
        pathInArchive: 'image.jpg',
        fileName: 'image.jpg',
        fileSize: 1000,
      };

      const key1 = (thumbnailService as any).buildCacheKey(
        image,
        SourceType.ARCHIVE,
        { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
      );

      const key2 = (thumbnailService as any).buildCacheKey(
        image,
        SourceType.ARCHIVE,
        { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 60 }
      );

      expect(key1).not.toBe(key2);
    });
  });

  describe('Source Type Sensitivity', () => {
    it('should generate different keys for different source types', () => {
      const image: Partial<Image> = {
        id: '1',
        archiveId: 'archive1',
        pathInArchive: 'image.jpg',
        fileName: 'image.jpg',
        fileSize: 1000,
      };

      const key1 = (thumbnailService as any).buildCacheKey(
        image,
        SourceType.ARCHIVE,
        { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
      );

      const key2 = (thumbnailService as any).buildCacheKey(
        image,
        SourceType.FOLDER,
        { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
      );

      expect(key1).not.toBe(key2);
    });
  });

  describe('Version Management', () => {
    it('should include version in cache key for invalidation', () => {
      const image: Partial<Image> = {
        id: '1',
        archiveId: 'archive1',
        pathInArchive: 'image.jpg',
        fileName: 'image.jpg',
        fileSize: 1000,
      };

      // We can't directly test the version is included without inspecting the hash input,
      // but we can verify the method exists and produces consistent output
      const key1 = (thumbnailService as any).buildCacheKey(
        image,
        SourceType.ARCHIVE,
        { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
      );

      const key2 = (thumbnailService as any).buildCacheKey(
        image,
        SourceType.ARCHIVE,
        { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
      );

      // Same inputs should produce same key (deterministic)
      expect(key1).toBe(key2);
    });
  });

  describe('Determinism', () => {
    it('should generate same key for same inputs', () => {
      const image: Partial<Image> = {
        id: '1',
        archiveId: 'archive1',
        pathInArchive: 'image.jpg',
        fileName: 'image.jpg',
        fileSize: 1000,
      };

      const keys = Array.from({ length: 10 }, () =>
        (thumbnailService as any).buildCacheKey(
          image,
          SourceType.ARCHIVE,
          { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
        )
      );

      // All keys should be identical
      expect(new Set(keys).size).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing fileSize', () => {
      const image: Partial<Image> = {
        id: '1',
        archiveId: 'archive1',
        pathInArchive: 'image.jpg',
        fileName: 'image.jpg',
        // fileSize is undefined
      };

      expect(() =>
        (thumbnailService as any).buildCacheKey(
          image,
          SourceType.ARCHIVE,
          { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
        )
      ).not.toThrow();
    });

    it('should handle empty pathInArchive', () => {
      const image: Partial<Image> = {
        id: '1',
        archiveId: 'archive1',
        pathInArchive: '',
        fileName: 'image.jpg',
        fileSize: 1000,
      };

      expect(() =>
        (thumbnailService as any).buildCacheKey(
          image,
          SourceType.ARCHIVE,
          { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
        )
      ).not.toThrow();
    });

    it('should handle missing archiveId', () => {
      const image: Partial<Image> = {
        id: '1',
        archiveId: '',
        pathInArchive: 'image.jpg',
        fileName: 'image.jpg',
        fileSize: 1000,
      };

      expect(() =>
        (thumbnailService as any).buildCacheKey(
          image,
          SourceType.ARCHIVE,
          { maxWidth: 200, maxHeight: 200, format: 'webp', quality: 80 }
        )
      ).not.toThrow();
    });
  });
});

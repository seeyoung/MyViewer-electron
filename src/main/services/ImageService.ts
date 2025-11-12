import { ArchiveService } from './ArchiveService';
import { Image } from '@shared/types/Image';

/**
 * LRU Cache for full-resolution images
 */
class LRUCache<K, V> {
  private maxSize: number;
  private cache: Map<K, V>;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Delete if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add to end
    this.cache.set(key, value);

    // Evict oldest if over capacity
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Image Service
 * Handles loading images from archives with LRU caching
 */
export class ImageService {
  private archiveService: ArchiveService;
  private imageCache: LRUCache<string, Buffer>;
  private maxCachedImages: number = 10;

  constructor(archiveService: ArchiveService) {
    this.archiveService = archiveService;
    this.imageCache = new LRUCache(this.maxCachedImages);
  }

  /**
   * Generate cache key for an image
   */
  private getCacheKey(archiveId: string, imageId: string): string {
    return `${archiveId}:${imageId}`;
  }

  /**
   * Load image from archive
   */
  async loadImage(archiveId: string, image: Image): Promise<Buffer> {
    const cacheKey = this.getCacheKey(archiveId, image.id);

    // Check cache first
    const cached = this.imageCache.get(cacheKey);
    if (cached) {
      console.log(`Image cache hit: ${image.fileName}`);
      return cached;
    }

    // Extract from archive
    console.log(`Loading image from archive: ${image.fileName}`);
    const buffer = await this.archiveService.extractImage(archiveId, image.pathInArchive);

    // Store in cache
    this.imageCache.set(cacheKey, buffer);

    return buffer;
  }

  /**
   * Load image and return as base64
   */
  async loadImageAsBase64(archiveId: string, image: Image): Promise<string> {
    const buffer = await this.loadImage(archiveId, image);
    return buffer.toString('base64');
  }

  /**
   * Preload images into cache (for prefetching)
   */
  async preloadImages(archiveId: string, images: Image[]): Promise<void> {
    const promises = images.map(async image => {
      try {
        await this.loadImage(archiveId, image);
      } catch (error) {
        console.error(`Failed to preload image ${image.fileName}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Clear image cache
   */
  clearCache(): void {
    this.imageCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.imageCache.size(),
      maxSize: this.maxCachedImages,
    };
  }
}

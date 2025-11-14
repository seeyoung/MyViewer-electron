import { app } from 'electron';
import path from 'path';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { Image } from '@shared/types/Image';
import { SourceType } from '@shared/types/Source';
import { ImageService } from './ImageService';
import { FolderService } from './FolderService';

interface ThumbnailOptions {
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'webp';
  quality?: number;
}

export interface ThumbnailResponse {
  dataUrl: string;
  width: number;
  height: number;
  format: 'jpeg' | 'webp';
}

type ResolvedOptions = Required<ThumbnailOptions>;

export class ThumbnailService {
  private readonly cacheDir: string;
  private readonly inflight: Map<string, Promise<ThumbnailResponse>> = new Map();
  private readonly defaultOptions: ResolvedOptions = {
    maxWidth: 220,
    maxHeight: 165,
    format: 'webp',
    quality: 65,
  };

  // Cache management properties
  private readonly maxCacheSize: number = 500 * 1024 * 1024; // 500MB
  private readonly maxCacheAge: number = 30 * 24 * 60 * 60 * 1000; // 30 days
  private cacheStats: Map<string, { size: number; accessTime: number }> = new Map();

  constructor(
    private readonly imageService: ImageService,
    private readonly folderService: FolderService
  ) {
    this.cacheDir = path.join(app.getPath('userData'), 'thumbnail-cache');
    this.initializeCacheManagement();
  }

  private async initializeCacheManagement(): Promise<void> {
    // Load cache stats on startup
    await this.loadCacheStats();

    // Clean up old cache
    await this.cleanupOldCache();

    // Schedule periodic cleanup (every hour)
    setInterval(() => this.cleanupOldCache(), 60 * 60 * 1000);
  }

  private async loadCacheStats(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);

        this.cacheStats.set(file, {
          size: stats.size,
          accessTime: stats.atimeMs,
        });
      }
    } catch (error) {
      // Ignore if cache directory doesn't exist
      if ((error as any).code !== 'ENOENT') {
        console.error('Failed to load cache stats:', error);
      }
    }
  }

  private async cleanupOldCache(): Promise<void> {
    const now = Date.now();
    let totalSize = 0;
    const entries: Array<{ file: string; size: number; accessTime: number }> = [];

    // Collect cache statistics
    for (const [file, stats] of this.cacheStats.entries()) {
      totalSize += stats.size;
      entries.push({ file, ...stats });
    }

    // Sort by LRU (oldest access time first)
    entries.sort((a, b) => a.accessTime - b.accessTime);

    // 1. Delete files older than maxCacheAge (30 days)
    for (const entry of entries) {
      if (now - entry.accessTime > this.maxCacheAge) {
        await this.deleteCacheFile(entry.file);
        totalSize -= entry.size;
      }
    }

    // 2. Delete LRU files if size limit exceeded
    if (totalSize > this.maxCacheSize) {
      for (const entry of entries) {
        if (totalSize <= this.maxCacheSize * 0.8) {
          break; // Reduce to 80%
        }

        await this.deleteCacheFile(entry.file);
        totalSize -= entry.size;
      }
    }
  }

  private async deleteCacheFile(filename: string): Promise<void> {
    try {
      const filePath = path.join(this.cacheDir, filename);
      await fs.unlink(filePath);
      this.cacheStats.delete(filename);
    } catch (error) {
      console.error(`Failed to delete cache file ${filename}:`, error);
    }
  }

  private async updateCacheAccess(filename: string, filePath: string): Promise<void> {
    const stats = this.cacheStats.get(filename);
    if (stats) {
      stats.accessTime = Date.now();

      // Update file system access time
      try {
        const now = new Date();
        await fs.utimes(filePath, now, now);
      } catch (error) {
        console.error('Failed to update file access time:', error);
      }
    }
  }

  // Cache statistics query method (for debugging/monitoring)
  getCacheStats(): { totalSize: number; fileCount: number; oldestAccess: number } {
    let totalSize = 0;
    let oldestAccess = Date.now();

    for (const stats of this.cacheStats.values()) {
      totalSize += stats.size;
      if (stats.accessTime < oldestAccess) {
        oldestAccess = stats.accessTime;
      }
    }

    return {
      totalSize,
      fileCount: this.cacheStats.size,
      oldestAccess,
    };
  }

  async getThumbnail(params: {
    archiveId: string;
    image: Image;
    sourceType: SourceType;
    options?: ThumbnailOptions;
  }): Promise<ThumbnailResponse> {
    const options = { ...this.defaultOptions, ...params.options } as ResolvedOptions;
    const cacheKey = this.buildCacheKey(params.image, params.sourceType, options);

    if (this.inflight.has(cacheKey)) {
      return this.inflight.get(cacheKey)!;
    }

    const promise = this.ensureThumbnail(cacheKey, options, params).finally(() => {
      this.inflight.delete(cacheKey);
    });

    this.inflight.set(cacheKey, promise);
    return promise;
  }

  private async ensureThumbnail(
    cacheKey: string,
    options: ResolvedOptions,
    params: { archiveId: string; image: Image; sourceType: SourceType }
  ): Promise<ThumbnailResponse> {
    await fs.mkdir(this.cacheDir, { recursive: true });
    const cachePath = this.getCachePath(cacheKey, options.format);
    const cacheFilename = path.basename(cachePath);

    if (await this.fileExists(cachePath)) {
      // Update cache access time
      await this.updateCacheAccess(cacheFilename, cachePath);
      return this.buildPayloadFromCache(cachePath);
    }

    const sourceBuffer = await this.loadSourceBuffer(params.sourceType, params.archiveId, params.image);

    const { data, info } = await sharp(sourceBuffer)
      .rotate()
      .resize({
        width: options.maxWidth,
        height: options.maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toFormat(options.format, { quality: options.quality })
      .toBuffer({ resolveWithObject: true });

    await fs.writeFile(cachePath, data);

    // Add new cache file statistics
    this.cacheStats.set(cacheFilename, {
      size: data.length,
      accessTime: Date.now(),
    });

    return {
      dataUrl: this.bufferToDataUrl(data, options.format),
      width: info.width ?? options.maxWidth,
      height: info.height ?? options.maxHeight,
      format: options.format,
    };
  }

  private async buildPayloadFromCache(cachePath: string): Promise<ThumbnailResponse> {
    const [metadata, buffer] = await Promise.all([
      sharp(cachePath).metadata(),
      fs.readFile(cachePath),
    ]);

    const ext = path.extname(cachePath).replace('.', '') as 'jpeg' | 'webp';

    return {
      dataUrl: this.bufferToDataUrl(buffer, ext === 'jpeg' || ext === 'webp' ? ext : 'webp'),
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
      format: ext === 'jpeg' || ext === 'webp' ? ext : 'webp',
    };
  }

  private bufferToDataUrl(buffer: Buffer, format: 'jpeg' | 'webp'): string {
    return `data:image/${format};base64,${buffer.toString('base64')}`;
  }

  private getCachePath(cacheKey: string, format: 'jpeg' | 'webp'): string {
    return path.join(this.cacheDir, `${cacheKey}.${format}`);
  }

  private buildCacheKey(image: Image, sourceType: SourceType, options: ResolvedOptions): string {
    const hash = createHash('sha1');
    const size = typeof image.fileSize === 'number'
      ? image.fileSize
      : (typeof (image as any).size === 'number' ? (image as any).size : 0);

    hash.update(sourceType);
    hash.update(image.archiveId || '');
    hash.update(image.id || '');
    hash.update(String(size));
    hash.update(`${options.maxWidth}x${options.maxHeight}`);
    hash.update(options.format);
    return hash.digest('hex');
  }

  private async fileExists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  private async loadSourceBuffer(sourceType: SourceType, archiveId: string, image: Image): Promise<Buffer> {
    if (sourceType === SourceType.FOLDER) {
      return this.folderService.loadImage(archiveId, image.pathInArchive);
    }

    return this.imageService.loadImage(archiveId, image);
  }
}

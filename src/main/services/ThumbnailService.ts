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

  constructor(
    private readonly imageService: ImageService,
    private readonly folderService: FolderService
  ) {
    this.cacheDir = path.join(app.getPath('userData'), 'thumbnail-cache');
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

    if (await this.fileExists(cachePath)) {
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

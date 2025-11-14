import { Archive, ArchiveFormat } from '@shared/types/Archive';
import { Image, ImageFormat } from '@shared/types/Image';
import { FolderNode } from '@shared/types/FolderNode';
import { ArchiveReader } from './archive/ArchiveReader';
import { ZipReader } from './archive/ZipReader';
import { RarReader } from './archive/RarReader';
import { RarReaderJS } from './archive/RarReaderJS';
import { detectFormatFromExtension, isSupportedImageFormat } from '@lib/image-utils';
import { sanitizePath, getParentPath, splitPath } from '@lib/file-utils';
import { naturalSortBy } from '@lib/natural-sort';
import { EventEmitter } from 'events';
import {
  FolderOpenInitialResponse,
  ScanProgressEvent,
  ScanCompleteEvent,
} from '@shared/types/Scan';
import { SourceDescriptor, SourceType } from '@shared/types/Source';
import { ScanCacheService } from './ScanCacheService';
// CommonJS와 호환되도록 uuid 대신 crypto 사용
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const INITIAL_SCAN_LIMIT = 100;
const CHUNK_SIZE = 100;
const CHUNK_DELAY_MS = 10;

/**
 * Archive Service
 * Manages archive operations: open, close, list entries, extract
 */
export class ArchiveService extends EventEmitter {
  private openArchives: Map<string, { archive: Archive; reader: ArchiveReader }> = new Map();
  private activeScans = new Map<string, AbortController>();
  private scanCache: ScanCacheService;

  constructor(scanCache?: ScanCacheService) {
    super();
    this.scanCache = scanCache || new ScanCacheService();
  }

  /**
   * Detect archive format from file extension
   */
  private detectArchiveFormat(filePath: string): ArchiveFormat | null {
    const ext = path.extname(filePath).toLowerCase().slice(1);

    switch (ext) {
      case 'zip':
        return ArchiveFormat.ZIP;
      case 'cbz':
        return ArchiveFormat.CBZ;
      case 'rar':
        return ArchiveFormat.RAR;
      case 'cbr':
        return ArchiveFormat.CBR;
      case '7z':
        return ArchiveFormat.SEVEN_ZIP;
      case 'tar':
        return ArchiveFormat.TAR;
      default:
        return null;
    }
  }

  /**
   * Get appropriate reader for archive format
   */
  private getReader(format: ArchiveFormat): ArchiveReader {
    switch (format) {
      case ArchiveFormat.ZIP:
      case ArchiveFormat.CBZ:
        return new ZipReader();
      case ArchiveFormat.RAR:
      case ArchiveFormat.CBR:
        return new RarReaderJS(); // Use correct JavaScript implementation (no system dependencies)
      case ArchiveFormat.SEVEN_ZIP:
      case ArchiveFormat.TAR:
        throw new Error('Format not yet implemented');
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Build folder tree from image list
   */
  private buildFolderTree(images: Image[], archiveId: string): FolderNode {
    const root: FolderNode = {
      id: randomUUID(),
      archiveId,
      path: '/',
      name: '',
      parentId: undefined,
      childFolders: [],
      images: [],
      totalImageCount: images.length,
      directImageCount: 0,
      isExpanded: true,
    };

    const folderMap = new Map<string, FolderNode>();
    folderMap.set('/', root);

    // Group images by folder
    console.log('📂 Processing images for folder tree:', images.length);
    
    for (const image of images) {
      const folderPath = getParentPath(image.pathInArchive) || '/';
      const normalizedPath = folderPath === '' ? '/' : folderPath;
      
      console.log('🖼️  Processing image:', {
        pathInArchive: image.pathInArchive,
        folderPath,
        normalizedPath,
        fileName: image.fileName
      });

      console.log('🗂️  folderMap.has(' + normalizedPath + '):', folderMap.has(normalizedPath));
      console.log('🗂️  folderMap keys:', Array.from(folderMap.keys()));

      if (!folderMap.has(normalizedPath)) {
        console.log('📁 Creating folder hierarchy for:', normalizedPath);
        // Create folder hierarchy
        const segments = splitPath(normalizedPath);
        console.log('📂 Path segments:', segments);
        let currentPath = '/';

        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];
          const parentPath = currentPath;
          currentPath = currentPath === '/' ? `/${segment}` : `${currentPath}/${segment}`;

          if (!folderMap.has(currentPath)) {
            console.log('🆕 Creating folder:', currentPath, 'segment:', segment);
            const folder: FolderNode = {
              id: randomUUID(),
              archiveId,
              path: currentPath,
              name: segment,
              parentId: folderMap.get(parentPath)?.id,
              childFolders: [],
              images: [],
              totalImageCount: 0,
              directImageCount: 0,
              isExpanded: false,
            };

            folderMap.set(currentPath, folder);
            console.log('✅ Folder created and added to map:', currentPath);

            // Add to parent's children
            const parent = folderMap.get(parentPath);
            if (parent) {
              parent.childFolders.push(folder);
              console.log('✅ Added to parent folder:', parentPath);
            }
          } else {
            console.log('📁 Folder already exists:', currentPath);
          }
        }
      }

      // Add image to folder - fix path consistency
      const lookupPath = normalizedPath === '/' ? '/' : `/${normalizedPath}`;
      console.log('🔍 Looking up folder with path:', lookupPath);
      
      const folder = folderMap.get(lookupPath);
      if (folder) {
        folder.images.push(image);
        folder.directImageCount++;
        console.log('✅ Image added to folder:', lookupPath, 'count:', folder.directImageCount);
      } else {
        console.log('❌ Folder not found for path:', lookupPath);
        console.log('❌ Available paths:', Array.from(folderMap.keys()));
      }
    }

    // Calculate total image counts
    const calculateTotalCount = (node: FolderNode): number => {
      let total = node.directImageCount;
      for (const child of node.childFolders) {
        total += calculateTotalCount(child);
      }
      node.totalImageCount = total;
      return total;
    };

    calculateTotalCount(root);

    // Sort folders and images
    const sortNode = (node: FolderNode): void => {
      node.childFolders = naturalSortBy(node.childFolders, 'name');
      node.images = naturalSortBy(node.images, 'fileName');
      node.childFolders.forEach(sortNode);
    };

    sortNode(root);

    return root;
  }

  /**
   * Open an archive file
   */
  async openArchive(filePath: string, password?: string): Promise<Archive> {
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Archive file not found: ${filePath}`);
    }

    // Detect format
    const format = this.detectArchiveFormat(filePath);
    if (!format) {
      throw new Error('Unsupported archive format');
    }

    // Get reader
    console.log('🔧 Getting reader for format:', format);
    const reader = this.getReader(format);
    console.log('✅ Reader obtained:', reader.constructor.name);

    // Open archive
    console.log('🔓 Opening archive...');
    try {
      await reader.open(filePath, password);
      console.log('✅ Archive opened successfully');
    } catch (error) {
      console.log('❌ Failed to open archive:', error);
      throw new Error(`Failed to open archive: ${error}`);
    }

    // Check if password protected
    const isPasswordProtected = await reader.isPasswordProtected();

    // List entries
    console.log('📋 Listing archive entries...');
    const entries = await reader.listEntries();
    console.log('📁 Total entries found:', entries.length);
    
    entries.forEach((entry, i) => {
      console.log(`${i+1}. ${entry.path} (${entry.isDirectory ? 'DIR' : 'FILE'})`);
    });

    // Filter for images
    console.log('🔍 Filtering for image files...');
    const imageEntries = entries.filter(
      entry => !entry.isDirectory && isSupportedImageFormat(entry.path)
    );
    console.log('🖼️  Image entries found:', imageEntries.length);
    
    imageEntries.forEach((entry, i) => {
      console.log(`  ${i+1}. ${entry.path} - ${isSupportedImageFormat(entry.path) ? 'SUPPORTED' : 'NOT SUPPORTED'}`);
    });

    // Create Image entities
    const images: Image[] = imageEntries.map((entry, index) => {
      const sanitizedPath = sanitizePath(entry.path);

      return {
        id: randomUUID(),
        archiveId: '', // Will be set after archive is created
        pathInArchive: sanitizedPath,
        fileName: path.basename(sanitizedPath),
        folderPath: getParentPath(sanitizedPath) || '/',
        format: detectFormatFromExtension(entry.path),
        fileSize: entry.compressedSize,
        dimensions: undefined,
        globalIndex: index,
        folderIndex: 0, // Will be recalculated after grouping
        isLoaded: false,
        isCorrupted: false,
      };
    });

    // Sort images naturally
    const sortedImages = naturalSortBy(images, 'pathInArchive');

    // Update global indices
    sortedImages.forEach((img, idx) => {
      img.globalIndex = idx;
    });

    // Create Archive entity
    const archiveId = randomUUID();
    const fileName = path.basename(filePath);

    // Update image archive IDs
    sortedImages.forEach(img => {
      img.archiveId = archiveId;
    });

    // Build folder tree
    const rootFolder = this.buildFolderTree(sortedImages, archiveId);

    const archive: Archive = {
      id: archiveId,
      filePath,
      fileName,
      format,
      fileSize: fs.statSync(filePath).size,
      isPasswordProtected,
      totalImageCount: sortedImages.length,
      totalFileCount: entries.length,
      rootFolder,
      isOpen: true,
      openedAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    // Store in cache
    this.openArchives.set(archiveId, { archive, reader });

    return archive;
  }

  /**
   * Close an archive
   */
  async closeArchive(archiveId: string): Promise<void> {
    const cached = this.openArchives.get(archiveId);
    if (!cached) {
      return;
    }

    await cached.reader.close();
    this.openArchives.delete(archiveId);
  }

  /**
   * Extract an image from archive
   */
  async extractImage(archiveId: string, imagePath: string): Promise<Buffer> {
    const cached = this.openArchives.get(archiveId);
    if (!cached) {
      throw new Error('Archive not open');
    }

    cached.archive.lastAccessedAt = Date.now();

    return await cached.reader.extractEntry(imagePath);
  }

  /**
   * Get archive by ID
   */
  getArchive(archiveId: string): Archive | undefined {
    return this.openArchives.get(archiveId)?.archive;
  }

  /**
   * Open archive with progressive scanning
   * Returns initial images immediately and processes rest in background
   */
  async openArchiveProgressive(filePath: string, password?: string): Promise<FolderOpenInitialResponse> {
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Archive file not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    const mtime = Math.floor(stats.mtimeMs);
    const scanToken = randomUUID();
    const archiveId = randomUUID();
    const fileName = path.basename(filePath);

    // Try to get cached scan result
    const cachedImages = this.scanCache.getCachedScan(filePath, mtime);

    let allImages: Image[];
    let isFromCache = false;
    let format: ArchiveFormat;
    let isPasswordProtected = false;
    let totalFileCount = 0;
    let reader: ArchiveReader;

    if (cachedImages && cachedImages.length > 0) {
      // Cache hit - still need to open archive for extraction
      format = this.detectArchiveFormat(filePath)!;
      reader = this.getReader(format);

      try {
        await reader.open(filePath, password);
        isPasswordProtected = await reader.isPasswordProtected();
        const entries = await reader.listEntries();
        totalFileCount = entries.length;
      } catch (error) {
        throw new Error(`Failed to open archive: ${error}`);
      }

      allImages = cachedImages.map(img => ({ ...img, archiveId }));
      isFromCache = true;
      console.log(`✅ Using cached scan for ${filePath}: ${allImages.length} images`);
    } else {
      // Cache miss - perform full scan
      console.log(`❌ Cache miss for ${filePath}, performing full scan`);

      // Detect format
      format = this.detectArchiveFormat(filePath)!;
      if (!format) {
        throw new Error('Unsupported archive format');
      }

      // Get reader
      reader = this.getReader(format);

      // Open archive
      try {
        await reader.open(filePath, password);
      } catch (error) {
        throw new Error(`Failed to open archive: ${error}`);
      }

      isPasswordProtected = await reader.isPasswordProtected();
      const entries = await reader.listEntries();
      totalFileCount = entries.length;

      // Filter for images
      const imageEntries = entries.filter(
        entry => !entry.isDirectory && isSupportedImageFormat(entry.path)
      );

      // Process all images
      allImages = imageEntries.map((entry, index) => {
        const sanitizedPath = sanitizePath(entry.path);
        return {
          id: randomUUID(),
          archiveId,
          pathInArchive: sanitizedPath,
          fileName: path.basename(sanitizedPath),
          folderPath: getParentPath(sanitizedPath) || '/',
          format: detectFormatFromExtension(entry.path),
          fileSize: entry.compressedSize,
          dimensions: undefined,
          globalIndex: index,
          folderIndex: 0,
          isLoaded: false,
          isCorrupted: false,
        };
      });

      allImages = naturalSortBy(allImages, 'pathInArchive');
      allImages.forEach((img, idx) => {
        img.globalIndex = idx;
      });

      // Save to cache asynchronously
      setImmediate(() => {
        this.scanCache.saveScan(filePath, mtime, allImages);
      });
    }

    const initialImages = allImages.slice(0, INITIAL_SCAN_LIMIT);
    const rootFolder = this.buildFolderTree(initialImages, archiveId);

    const source: SourceDescriptor = {
      id: archiveId,
      type: SourceType.ARCHIVE,
      path: filePath,
      label: fileName,
    };

    // Create archive object
    const archive: Archive = {
      id: archiveId,
      filePath,
      fileName,
      format,
      fileSize: stats.size,
      isPasswordProtected,
      totalImageCount: allImages.length,
      totalFileCount,
      rootFolder,
      isOpen: true,
      openedAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    // Store in cache
    this.openArchives.set(archiveId, { archive, reader });

    const isComplete = isFromCache || allImages.length <= INITIAL_SCAN_LIMIT;

    if (!isComplete) {
      // Start background processing for remaining images
      this.emitRemainingImagesProgressively(allImages, scanToken, archiveId);
    }

    return {
      source,
      initialImages,
      rootFolder,
      scanToken,
      estimatedTotal: isFromCache ? allImages.length : allImages.length,
      isComplete,
    };
  }

  /**
   * Emit remaining images progressively (when using cache)
   */
  private async emitRemainingImagesProgressively(
    allImages: Image[],
    token: string,
    archiveId: string
  ): Promise<void> {
    const controller = new AbortController();
    this.activeScans.set(token, controller);

    const startTime = Date.now();
    const remainingImages = allImages.slice(INITIAL_SCAN_LIMIT);

    try {
      for (let i = 0; i < remainingImages.length; i += CHUNK_SIZE) {
        if (controller.signal.aborted) break;

        const chunk = remainingImages.slice(i, i + CHUNK_SIZE);

        // Emit progress
        if (!controller.signal.aborted) {
          const progressEvent: ScanProgressEvent = {
            token,
            discovered: allImages.length,
            processed: INITIAL_SCAN_LIMIT + i + chunk.length,
            currentPath: chunk[chunk.length - 1]?.pathInArchive || '',
            imageChunk: chunk,
          };
          this.emit('scan-progress', progressEvent);
        }

        // Throttle
        await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS));
      }

      // Emit complete
      if (!controller.signal.aborted) {
        const completeEvent: ScanCompleteEvent = {
          token,
          totalImages: allImages.length,
          totalFolders: 1,
          duration: Date.now() - startTime,
        };
        this.emit('scan-complete', completeEvent);
      }
    } finally {
      this.activeScans.delete(token);
    }
  }

  /**
   * Process remaining archive entries in background
   */
  private async startBackgroundArchiveScan(
    allEntries: any[],
    token: string,
    archiveId: string
  ): Promise<void> {
    const controller = new AbortController();
    this.activeScans.set(token, controller);

    const startTime = Date.now();
    const remainingEntries = allEntries.slice(INITIAL_SCAN_LIMIT);
    let processed = INITIAL_SCAN_LIMIT;

    try {
      for (let i = 0; i < remainingEntries.length; i += CHUNK_SIZE) {
        if (controller.signal.aborted) break;

        const chunk = remainingEntries.slice(i, i + CHUNK_SIZE);
        const chunkImages: Image[] = chunk.map((entry, idx) => {
          const sanitizedPath = sanitizePath(entry.path);
          return {
            id: randomUUID(),
            archiveId,
            pathInArchive: sanitizedPath,
            fileName: path.basename(sanitizedPath),
            folderPath: getParentPath(sanitizedPath) || '/',
            format: detectFormatFromExtension(entry.path),
            fileSize: entry.compressedSize,
            dimensions: undefined,
            globalIndex: processed + idx,
            folderIndex: 0,
            isLoaded: false,
            isCorrupted: false,
          };
        });

        processed += chunk.length;

        // Emit progress
        if (!controller.signal.aborted) {
          const progressEvent: ScanProgressEvent = {
            token,
            discovered: allEntries.length,
            processed,
            currentPath: chunk[chunk.length - 1]?.path || '',
            imageChunk: chunkImages,
          };
          this.emit('scan-progress', progressEvent);
        }

        // Throttle
        await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS));
      }

      // Emit complete
      if (!controller.signal.aborted) {
        const completeEvent: ScanCompleteEvent = {
          token,
          totalImages: allEntries.length,
          totalFolders: 1, // Archive has one root
          duration: Date.now() - startTime,
        };
        this.emit('scan-complete', completeEvent);
      }
    } finally {
      this.activeScans.delete(token);
    }
  }

  /**
   * Cancel an active scan
   */
  async cancelScan(token: string): Promise<boolean> {
    const controller = this.activeScans.get(token);
    if (!controller) {
      return false;
    }

    controller.abort();
    this.activeScans.delete(token);
    return true;
  }

  /**
   * Check if scan is active
   */
  isScanActive(token: string): boolean {
    return this.activeScans.has(token);
  }
}

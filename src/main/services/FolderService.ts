import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { Image, ImageFormat } from '@shared/types/Image';
import { FolderNode } from '@shared/types/FolderNode';
import { SourceDescriptor, SourceType } from '@shared/types/Source';
import {
  FolderOpenInitialResponse,
  ScanProgressEvent,
  ScanCompleteEvent,
} from '@shared/types/Scan';
import { detectFormatFromExtension, isSupportedImageFormat } from '@lib/image-utils';
import { getParentPath, sanitizePath, splitPath } from '@lib/file-utils';
import { naturalSortBy } from '@lib/natural-sort';

export interface FolderOpenResult {
  source: SourceDescriptor;
  rootFolder: FolderNode;
  images: Image[];
}

const INITIAL_SCAN_LIMIT = 100;
const CHUNK_SIZE = 100;
const CHUNK_DELAY_MS = 10;

export class FolderService extends EventEmitter {
  private openFolders = new Map<string, { source: SourceDescriptor; rootFolder: FolderNode; basePath: string }>();
  private activeScans = new Map<string, AbortController>();

  constructor() {
    super();
  }

  async openFolder(folderPath: string): Promise<FolderOpenResult> {
    const stats = await fs.stat(folderPath);
    if (!stats.isDirectory()) {
      throw new Error('Selected path is not a directory');
    }

    const images = await this.scanFolder(folderPath);
    const sourceId = randomUUID();

    // Assign archiveId (sourceId) to each image for compatibility
    images.forEach(img => {
      img.archiveId = sourceId;
    });

    const rootFolder = this.buildFolderTree(images, sourceId);

    const source: SourceDescriptor = {
      id: sourceId,
      type: SourceType.FOLDER,
      path: folderPath,
      label: path.basename(folderPath),
    };

    this.openFolders.set(sourceId, {
      source,
      rootFolder,
      basePath: folderPath,
    });

    return {
      source,
      rootFolder,
      images,
    };
  }

  getOpenFolder(sourceId: string) {
    return this.openFolders.get(sourceId);
  }

  async loadImage(sourceId: string, relativePath: string): Promise<Buffer> {
    const folder = this.openFolders.get(sourceId);
    if (!folder) {
      throw new Error('Folder source not found');
    }

    const normalizedRelative = path.normalize(relativePath);
    const absolutePath = path.join(folder.basePath, normalizedRelative);
    const resolvedBase = path.resolve(folder.basePath);
    const resolvedTarget = path.resolve(absolutePath);

    if (!resolvedTarget.startsWith(resolvedBase)) {
      throw new Error('Invalid path');
    }

    return fs.readFile(resolvedTarget);
  }

  private async scanFolder(folderPath: string): Promise<Image[]> {
    const entries: Image[] = [];
    await this.walk(folderPath, entries, folderPath);
    const sorted = naturalSortBy(entries, 'pathInArchive');

    sorted.forEach((img, index) => {
      img.globalIndex = index;
    });

    return sorted;
  }

  private async walk(root: string, images: Image[], current: string): Promise<void> {
    const dirEntries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of dirEntries) {
      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(root, fullPath);
      if (entry.isDirectory()) {
        await this.walk(root, images, fullPath);
        continue;
      }

      if (!isSupportedImageFormat(entry.name)) {
        continue;
      }

      const sanitized = sanitizePath(relativePath);
      const fileStats = await fs.stat(fullPath);

      images.push({
        id: randomUUID(),
        archiveId: '',
        pathInArchive: sanitized,
        fileName: path.basename(sanitized),
        folderPath: getParentPath(sanitized) || '/',
        format: detectFormatFromExtension(entry.name) || ImageFormat.UNKNOWN,
        fileSize: fileStats.size,
        dimensions: undefined,
        globalIndex: 0,
        folderIndex: 0,
        isLoaded: false,
        isCorrupted: false,
      });
    }
  }

  private buildFolderTree(images: Image[], sourceId: string): FolderNode {
    const root: FolderNode = {
      id: randomUUID(),
      archiveId: sourceId,
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

    for (const image of images) {
      const folderPath = getParentPath(image.pathInArchive) || '/';
      const normalizedPath = folderPath === '' ? '/' : folderPath;

      if (!folderMap.has(normalizedPath)) {
        const segments = splitPath(normalizedPath);
        let currentPath = '/';

        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];
          const parentPath = currentPath;
          currentPath = currentPath === '/' ? `/${segment}` : `${currentPath}/${segment}`;

          if (!folderMap.has(currentPath)) {
            const folder: FolderNode = {
              id: randomUUID(),
              archiveId: sourceId,
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
            const parent = folderMap.get(parentPath);
            if (parent) {
              parent.childFolders.push(folder);
            }
          }
        }
      }

      const lookupPath = normalizedPath === '/' ? '/' : `/${normalizedPath}`;
      const folder = folderMap.get(lookupPath) || folderMap.get(normalizedPath);
      if (folder) {
        folder.images.push(image);
        folder.directImageCount++;
      }
    }

    const calculateTotalCount = (node: FolderNode): number => {
      let total = node.directImageCount;
      for (const child of node.childFolders) {
        total += calculateTotalCount(child);
      }
      node.totalImageCount = total;
      return total;
    };

    calculateTotalCount(root);

    const sortNode = (node: FolderNode): void => {
      node.childFolders = naturalSortBy(node.childFolders, 'name');
      node.images = naturalSortBy(node.images, 'fileName');
      node.childFolders.forEach(sortNode);
    };

    sortNode(root);

    return root;
  }

  /**
   * Open folder with progressive scanning
   * Returns initial images immediately and scans rest in background
   */
  async openFolderProgressive(folderPath: string): Promise<FolderOpenInitialResponse> {
    const stats = await fs.stat(folderPath);
    if (!stats.isDirectory()) {
      throw new Error('Selected path is not a directory');
    }

    const scanToken = randomUUID();
    const sourceId = randomUUID();

    // Scan only root level initially
    const initialImages = await this.scanSingleLevel(folderPath, folderPath);

    // Assign archiveId
    initialImages.forEach(img => {
      img.archiveId = sourceId;
    });

    const rootFolder = this.buildFolderTree(initialImages, sourceId);

    const source: SourceDescriptor = {
      id: sourceId,
      type: SourceType.FOLDER,
      path: folderPath,
      label: path.basename(folderPath),
    };

    this.openFolders.set(sourceId, {
      source,
      rootFolder,
      basePath: folderPath,
    });

    // Determine if complete
    const isSmall = initialImages.length < INITIAL_SCAN_LIMIT;
    const isComplete = isSmall && !(await this.hasSubdirectories(folderPath));

    if (!isComplete) {
      // Start background scan
      this.startBackgroundScan(folderPath, scanToken, sourceId).catch(err => {
        console.error('Background scan error:', err);
        this.emit('scan-error', { token: scanToken, error: err.message });
      });
    }

    return {
      source,
      initialImages: initialImages.slice(0, INITIAL_SCAN_LIMIT),
      rootFolder,
      scanToken,
      estimatedTotal: isComplete ? initialImages.length : undefined,
      isComplete,
    };
  }

  /**
   * Scan only a single level (non-recursive)
   */
  private async scanSingleLevel(root: string, current: string): Promise<Image[]> {
    const images: Image[] = [];
    const dirEntries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of dirEntries) {
      if (entry.isDirectory()) {
        continue; // Skip directories in single level scan
      }

      if (!isSupportedImageFormat(entry.name)) {
        continue;
      }

      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(root, fullPath);
      const sanitized = sanitizePath(relativePath);
      const fileStats = await fs.stat(fullPath);

      images.push({
        id: randomUUID(),
        archiveId: '',
        pathInArchive: sanitized,
        fileName: path.basename(sanitized),
        folderPath: getParentPath(sanitized) || '/',
        format: detectFormatFromExtension(entry.name) || ImageFormat.UNKNOWN,
        fileSize: fileStats.size,
        dimensions: undefined,
        globalIndex: 0,
        folderIndex: 0,
        isLoaded: false,
        isCorrupted: false,
      });
    }

    return naturalSortBy(images, 'fileName');
  }

  /**
   * Check if directory has subdirectories
   */
  private async hasSubdirectories(dirPath: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries.some(entry => entry.isDirectory());
    } catch {
      return false;
    }
  }

  /**
   * Start background scanning with BFS strategy
   */
  private async startBackgroundScan(
    folderPath: string,
    token: string,
    sourceId: string
  ): Promise<void> {
    const controller = new AbortController();
    this.activeScans.set(token, controller);

    const startTime = Date.now();
    let discovered = 0;
    let processed = 0;
    const allImages: Image[] = [];

    // BFS queue: [path, depth]
    const queue: Array<[string, number]> = [[folderPath, 0]];
    const visited = new Set<string>([folderPath]);

    try {
      while (queue.length > 0 && !controller.signal.aborted) {
        const batch: Array<[string, number]> = [];

        // Process chunk
        for (let i = 0; i < CHUNK_SIZE && queue.length > 0; i++) {
          batch.push(queue.shift()!);
        }

        for (const [currentPath, depth] of batch) {
          if (controller.signal.aborted) break;

          try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });

            for (const entry of entries) {
              if (controller.signal.aborted) break;

              const fullPath = path.join(currentPath, entry.name);

              if (entry.isDirectory()) {
                // Add to queue if not visited (BFS)
                if (!visited.has(fullPath)) {
                  visited.add(fullPath);
                  queue.push([fullPath, depth + 1]);
                }
              } else if (isSupportedImageFormat(entry.name)) {
                const relativePath = path.relative(folderPath, fullPath);
                const sanitized = sanitizePath(relativePath);
                const fileStats = await fs.stat(fullPath);

                const image: Image = {
                  id: randomUUID(),
                  archiveId: sourceId,
                  pathInArchive: sanitized,
                  fileName: path.basename(sanitized),
                  folderPath: getParentPath(sanitized) || '/',
                  format: detectFormatFromExtension(entry.name) || ImageFormat.UNKNOWN,
                  fileSize: fileStats.size,
                  dimensions: undefined,
                  globalIndex: discovered,
                  folderIndex: 0,
                  isLoaded: false,
                  isCorrupted: false,
                };

                allImages.push(image);
                discovered++;
              }
            }

            processed++;
          } catch (err: any) {
            // Graceful degradation: skip inaccessible folders
            if (err.code === 'EACCES' || err.code === 'EPERM') {
              console.warn(`Skipping inaccessible folder: ${currentPath}`);
              continue;
            }
            throw err;
          }
        }

        // Emit progress
        if (!controller.signal.aborted && discovered > 0) {
          const progressEvent: ScanProgressEvent = {
            token,
            discovered,
            processed,
            currentPath: batch[batch.length - 1]?.[0] || folderPath,
            imageChunk: allImages.splice(0, allImages.length),
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
          totalImages: discovered,
          totalFolders: visited.size,
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

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
// CommonJS와 호환되도록 uuid 대신 crypto 사용
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Archive Service
 * Manages archive operations: open, close, list entries, extract
 */
export class ArchiveService {
  private openArchives: Map<string, { archive: Archive; reader: ArchiveReader }> = new Map();

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
}

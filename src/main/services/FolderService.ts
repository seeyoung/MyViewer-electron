import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { Image, ImageFormat } from '@shared/types/Image';
import { FolderNode } from '@shared/types/FolderNode';
import { SourceDescriptor, SourceType } from '@shared/types/Source';
import { detectFormatFromExtension, isSupportedImageFormat } from '@lib/image-utils';
import { getParentPath, sanitizePath, splitPath } from '@lib/file-utils';
import { naturalSortBy } from '@lib/natural-sort';
import { FolderTreeBuilder } from './FolderTreeBuilder';

export interface FolderOpenResult {
  source: SourceDescriptor;
  rootFolder: FolderNode;
  images: Image[];
}

export class FolderService {
  private openFolders = new Map<string, { source: SourceDescriptor; rootFolder: FolderNode; basePath: string }>();

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

    const rootFolder = FolderTreeBuilder.build(images, sourceId);

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
}

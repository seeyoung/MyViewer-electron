import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { Image, ImageFormat } from '@shared/types/Image';
import { FolderNode } from '@shared/types/FolderNode';
import { SourceDescriptor, SourceType } from '@shared/types/Source';
import { detectFormatFromExtension, isSupportedImageFormat } from '@lib/image-utils';
import { getParentPath, sanitizePath, splitPath } from '@lib/file-utils';
import { naturalSortBy } from '@lib/natural-sort';

export interface FolderOpenResult {
  source: SourceDescriptor;
  rootFolder: FolderNode;
  images: Image[];
}

export class FolderService {
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

    return {
      source,
      rootFolder,
      images,
    };
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
}

import { ipcMain, IpcMainInvokeEvent } from 'electron';

/**
 * IPC Handler Registry
 * Centralized registration of all IPC handlers
 */

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> | unknown;

class IpcHandlerRegistry {
  private handlers: Map<string, IpcHandler> = new Map();

  /**
   * Register an IPC handler
   */
  public register(channel: string, handler: IpcHandler): void {
    if (this.handlers.has(channel)) {
      console.warn(`IPC handler for channel "${channel}" is already registered. Overwriting...`);
    }

    this.handlers.set(channel, handler);
    ipcMain.handle(channel, handler);
  }

  /**
   * Unregister an IPC handler
   */
  public unregister(channel: string): void {
    if (this.handlers.has(channel)) {
      ipcMain.removeHandler(channel);
      this.handlers.delete(channel);
    }
  }

  /**
   * Unregister all IPC handlers
   */
  public unregisterAll(): void {
    this.handlers.forEach((_, channel) => {
      ipcMain.removeHandler(channel);
    });
    this.handlers.clear();
  }

  /**
   * Get list of registered channels
   */
  public getRegisteredChannels(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// Singleton instance
const registry = new IpcHandlerRegistry();

export default registry;

// Import services
import { ArchiveService } from '../services/ArchiveService';
import { ImageService } from '../services/ImageService';
import { SessionService } from '../services/SessionService';
import { withErrorHandling, IpcErrorCode, createIpcError } from './error-handler';
import * as channels from '@shared/constants/ipc-channels';

// Service instances
const archiveService = new ArchiveService();
const imageService = new ImageService(archiveService);
const sessionService = new SessionService();

/**
 * Initialize all IPC handlers
 * This will be called from main process on app ready
 */
export function initializeIpcHandlers(): void {
  // Archive handlers
  registry.register(
    channels.ARCHIVE_OPEN,
    withErrorHandling(async (event, data: any) => {
      const { filePath, password } = data;
      const archive = await archiveService.openArchive(filePath, password);

      // Get or create session
      const session = sessionService.getOrCreateSession(filePath, archive.id);

      // Get all images from folder tree
      const images = getAllImagesFromFolder(archive.rootFolder);

      // Create completely serializable objects
      const serializableArchive = {
        id: archive.id,
        filePath: archive.filePath,
        fileName: archive.fileName,
        format: archive.format,
        fileSize: archive.fileSize,
        isPasswordProtected: archive.isPasswordProtected,
        totalImageCount: archive.totalImageCount,
        totalFileCount: archive.totalFileCount,
        isOpen: archive.isOpen,
        openedAt: archive.openedAt,
        lastAccessedAt: archive.lastAccessedAt,
      };

      // Ensure images are completely serializable
      const serializableImages = images.map(img => ({
        id: img.id,
        archiveId: img.archiveId,
        pathInArchive: img.pathInArchive,
        fileName: img.fileName,
        format: img.format,
        size: img.size,
        width: img.width,
        height: img.height,
        lastModified: img.lastModified,
      }));

      // Ensure session is serializable
      const serializableSession = {
        id: session.id,
        archivePath: session.archivePath,
        currentPageIndex: session.currentPageIndex,
        readingDirection: session.readingDirection,
        viewMode: session.viewMode,
        zoomLevel: session.zoomLevel,
        fitMode: session.fitMode,
        rotation: session.rotation,
        showThumbnails: session.showThumbnails,
        showFolderTree: session.showFolderTree,
        showBookmarks: session.showBookmarks,
        activeFolderId: session.activeFolderId,
        searchQuery: session.searchQuery,
        startedAt: session.startedAt,
        lastActivityAt: session.lastActivityAt,
      };

      // Use JSON.parse/stringify to ensure completely clean objects
      const result = {
        archive: serializableArchive,
        session: serializableSession,
        images: serializableImages,
      };

      // Deep clone to remove any hidden references
      const cleanResult = JSON.parse(JSON.stringify(result));
      
      console.log('🧹 Cleaned result:', {
        archiveId: cleanResult.archive.id,
        imageCount: cleanResult.images.length,
        sessionId: cleanResult.session.id
      });

      return cleanResult;
    })
  );

  registry.register(
    channels.ARCHIVE_CLOSE,
    withErrorHandling(async (event, data: any) => {
      const { archiveId } = data;
      await archiveService.closeArchive(archiveId);
      return { success: true };
    })
  );

  registry.register(
    channels.ARCHIVE_LIST_IMAGES,
    withErrorHandling(async (event, data: any) => {
      const { archiveId } = data;
      const archive = archiveService.getArchive(archiveId);
      if (!archive) {
        throw createIpcError(IpcErrorCode.ARCHIVE_NOT_FOUND, 'Archive not found');
      }

      const images = getAllImagesFromFolder(archive.rootFolder);
      return { images };
    })
  );

  // Image handlers
  registry.register(
    channels.IMAGE_LOAD,
    withErrorHandling(async (event, data: any) => {
      const { archiveId, imagePath, encoding } = data;
      const archive = archiveService.getArchive(archiveId);
      if (!archive) {
        throw createIpcError(IpcErrorCode.ARCHIVE_NOT_FOUND, 'Archive not found');
      }

      // Find image by path
      const images = getAllImagesFromFolder(archive.rootFolder);
      const image = images.find(img => img.pathInArchive === imagePath);

      if (!image) {
        throw createIpcError(IpcErrorCode.IMAGE_NOT_FOUND, 'Image not found');
      }

      if (encoding === 'base64') {
        const base64 = await imageService.loadImageAsBase64(archiveId, image);
        return { data: base64, format: image.format };
      } else {
        const buffer = await imageService.loadImage(archiveId, image);
        return { data: buffer, format: image.format };
      }
    })
  );

  // Session handlers
  registry.register(
    channels.SESSION_GET,
    withErrorHandling(async (event, data: any) => {
      const { archivePath, archiveId } = data;
      const session = sessionService.getOrCreateSession(archivePath, archiveId);
      return { session };
    })
  );

  registry.register(
    channels.SESSION_UPDATE,
    withErrorHandling(async (event, sessionData: any) => {
      sessionService.updateSession(sessionData as any);
      return { success: true };
    })
  );

  console.log('IPC handlers initialized');
}

/**
 * Helper: Get all images from folder tree recursively
 */
function getAllImagesFromFolder(folder: any): any[] {
  console.log('🔍 getAllImagesFromFolder called:', {
    folderPath: folder.path || 'root',
    directImages: folder.images?.length || 0,
    childFolders: folder.childFolders?.length || 0
  });

  const images = [...(folder.images || [])];
  console.log('📸 Direct images found:', images.length);

  for (const childFolder of (folder.childFolders || [])) {
    const childImages = getAllImagesFromFolder(childFolder);
    console.log('📁 Child folder images:', childImages.length);
    images.push(...childImages);
  }

  console.log('📊 Total images returned:', images.length);
  return images;
}

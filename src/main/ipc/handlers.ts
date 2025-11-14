import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';

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
import { FolderService } from '../services/FolderService';
import { RecentSourcesService } from '../services/RecentSourcesService';
import { ThumbnailService } from '../services/ThumbnailService';
import { PlaylistService } from '../services/PlaylistService';
import { PlaylistRepository } from '../repositories/PlaylistRepository';
import { withErrorHandling, IpcErrorCode, createIpcError } from './error-handler';
import * as channels from '@shared/constants/ipc-channels';
import { SourceDescriptor, SourceType } from '@shared/types/Source';
import { Image } from '@shared/types/Image';
import { detectFormatFromExtension } from '@lib/image-utils';
import fs from 'fs/promises';

// Service instances
const archiveService = new ArchiveService();
const imageService = new ImageService(archiveService);
const sessionService = new SessionService();
const folderService = new FolderService();
const recentSourcesService = new RecentSourcesService();
const thumbnailService = new ThumbnailService(imageService, folderService);
const playlistRepository = new PlaylistRepository();
const playlistService = new PlaylistService(playlistRepository, archiveService, folderService);

/**
 * Initialize all IPC handlers
 * This will be called from main process on app ready
 */
export function initializeIpcHandlers(mainWindow: BrowserWindow): void {
  // Set up event forwarding from FolderService to renderer
  folderService.on('scan-progress', (event) => {
    mainWindow.webContents.send(channels.FOLDER_SCAN_PROGRESS, event);
  });

  folderService.on('scan-complete', (event) => {
    mainWindow.webContents.send(channels.FOLDER_SCAN_COMPLETE, event);
  });

  // Set up event forwarding from ArchiveService to renderer
  archiveService.on('scan-progress', (event) => {
    mainWindow.webContents.send(channels.ARCHIVE_SCAN_PROGRESS, event);
  });

  archiveService.on('scan-complete', (event) => {
    mainWindow.webContents.send(channels.ARCHIVE_SCAN_COMPLETE, event);
  });
  // Archive handlers
  registry.register(
    channels.ARCHIVE_OPEN,
    withErrorHandling(async (event, data: any) => {
      const { filePath, password } = data;
      const result = await archiveService.openArchiveProgressive(filePath, password);

      // Get or create session
      const session = sessionService.getOrCreateSession(
        filePath,
        SourceType.ARCHIVE,
        result.source.id
      );

      const serializableSession = {
        id: session.id,
        sourcePath: session.sourcePath,
        sourceType: session.sourceType,
        sourceId: session.sourceId,
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

      const response = {
        source: result.source,
        session: serializableSession,
        initialImages: result.initialImages,
        rootFolder: result.rootFolder,
        scanToken: result.scanToken,
        estimatedTotal: result.estimatedTotal,
        isComplete: result.isComplete,
      };

      return JSON.parse(JSON.stringify(response));
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
      const { archiveId, imagePath, encoding, sourceType } = data;

      if (sourceType === SourceType.FOLDER) {
        const folder = folderService.getOpenFolder(archiveId);
        if (!folder) {
          throw createIpcError(IpcErrorCode.ARCHIVE_NOT_FOUND, 'Folder source not found');
        }

        const buffer = await folderService.loadImage(archiveId, imagePath);
        const format = detectFormatFromExtension(imagePath);

        if (encoding === 'base64') {
          return { data: buffer.toString('base64'), format };
        }
        return { data: buffer, format };
      }

      const archive = archiveService.getArchive(archiveId);
      if (!archive) {
        throw createIpcError(IpcErrorCode.ARCHIVE_NOT_FOUND, 'Archive not found');
      }

      const images = getAllImagesFromFolder(archive.rootFolder);
      const image = images.find(img => img.pathInArchive === imagePath);

      if (!image) {
        throw createIpcError(IpcErrorCode.IMAGE_NOT_FOUND, 'Image not found');
      }

      if (encoding === 'base64') {
        const base64 = await imageService.loadImageAsBase64(archiveId, image);
        return { data: base64, format: image.format };
      }
      const buffer = await imageService.loadImage(archiveId, image);
      return { data: buffer, format: image.format };
    })
  );

  registry.register(
    channels.IMAGE_GET_THUMBNAIL,
    withErrorHandling(async (event, data: any) => {
      const { archiveId, image, sourceType, maxWidth, maxHeight, format, quality } = data || {};

      if (!archiveId || !image) {
        throw createIpcError(IpcErrorCode.INVALID_ARGUMENT, 'archiveId and image are required');
      }

      const sanitizedFormat = format === 'jpeg' || format === 'webp' ? format : undefined;

      const thumbnail = await thumbnailService.getThumbnail({
        archiveId,
        image: image as Image,
        sourceType: (sourceType as SourceType) ?? SourceType.ARCHIVE,
        options: {
          maxWidth,
          maxHeight,
          format: sanitizedFormat,
          quality,
        },
      });

      return thumbnail;
    })
  );

  // Session handlers
  registry.register(
    channels.SESSION_GET,
    withErrorHandling(async (event, data: any) => {
      const { sourcePath, sourceType, sourceId } = data;
      const session = sessionService.getOrCreateSession(
        sourcePath,
        (sourceType as SourceType) || SourceType.ARCHIVE,
        sourceId
      );
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

  registry.register(
    channels.FS_STAT,
    withErrorHandling(async (event, data: any) => {
      const { path: targetPath } = data;
      const stats = await fs.stat(targetPath);
      return {
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        size: stats.size,
      };
    })
  );

  registry.register(
    channels.RECENT_SOURCES_GET,
    withErrorHandling(async () => {
      return { sources: recentSourcesService.getAll() };
    })
  );

  registry.register(
    channels.RECENT_SOURCES_ADD,
    withErrorHandling(async (event, data: any) => {
      recentSourcesService.add(data as SourceDescriptor);
      return { success: true };
    })
  );

  registry.register(
    channels.RECENT_SOURCES_CLEAR,
    withErrorHandling(async () => {
      recentSourcesService.clear();
      return { success: true };
    })
  );

  registry.register(
    channels.RECENT_SOURCES_REMOVE,
    withErrorHandling(async (event, data: any) => {
      recentSourcesService.remove(data as SourceDescriptor);
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
  registry.register(
    channels.FOLDER_OPEN,
    withErrorHandling(async (event, data: any) => {
      const { folderPath } = data;
      const result = await folderService.openFolderProgressive(folderPath);

      const session = sessionService.getOrCreateSession(
        folderPath,
        SourceType.FOLDER,
        result.source.id
      );

      const serializableSession = {
        id: session.id,
        sourcePath: session.sourcePath,
        sourceType: session.sourceType,
        sourceId: session.sourceId,
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

      const response = {
        source: result.source,
        session: serializableSession,
        initialImages: result.initialImages,
        rootFolder: result.rootFolder,
        scanToken: result.scanToken,
        estimatedTotal: result.estimatedTotal,
        isComplete: result.isComplete,
      };

      return JSON.parse(JSON.stringify(response));
    })
  );

  registry.register(
    channels.FOLDER_SCAN_CANCEL,
    withErrorHandling(async (event, data: any) => {
      const { scanToken } = data;
      const cancelled = await folderService.cancelScan(scanToken);
      return { success: cancelled };
    })
  );

  registry.register(
    channels.ARCHIVE_SCAN_CANCEL,
    withErrorHandling(async (event, data: any) => {
      const { scanToken } = data;
      const cancelled = await archiveService.cancelScan(scanToken);
      return { success: cancelled };
    })
  );

  // Playlist handlers
  registry.register(
    channels.PLAYLIST_CREATE,
    withErrorHandling(async (event, data: any) => {
      const { name, description } = data;
      const playlist = playlistService.createPlaylist(name, description);
      return playlist;
    })
  );

  registry.register(
    channels.PLAYLIST_UPDATE,
    withErrorHandling(async (event, data: any) => {
      const { id, name, description } = data;
      const updated = playlistService.updatePlaylist(id, { name, description });
      return updated;
    })
  );

  registry.register(
    channels.PLAYLIST_DELETE,
    withErrorHandling(async (event, data: any) => {
      const { id } = data;
      playlistService.deletePlaylist(id);
      return { success: true };
    })
  );

  registry.register(
    channels.PLAYLIST_GET_ALL,
    withErrorHandling(async () => {
      const playlists = playlistService.getAllPlaylists();
      return playlists;
    })
  );

  registry.register(
    channels.PLAYLIST_GET_BY_ID,
    withErrorHandling(async (event, data: any) => {
      const { id } = data;
      const result = playlistService.getPlaylistWithEntries(id);
      return result;
    })
  );

  // Playlist entry handlers
  registry.register(
    channels.PLAYLIST_ADD_ENTRY,
    withErrorHandling(async (event, data: any) => {
      const { playlistId, sourcePath, position, customLabel, allowDuplicate } = data;
      const entry = await playlistService.addSourceToPlaylist(
        playlistId,
        sourcePath,
        position,
        customLabel,
        allowDuplicate
      );
      return entry;
    })
  );

  registry.register(
    channels.PLAYLIST_ADD_ENTRIES_BATCH,
    withErrorHandling(async (event, data: any) => {
      const { playlistId, sourcePaths, insertPosition, allowDuplicates } = data;
      const entries = await playlistService.addMultipleSources(
        playlistId,
        sourcePaths,
        insertPosition,
        allowDuplicates
      );
      return entries;
    })
  );

  registry.register(
    channels.PLAYLIST_REMOVE_ENTRY,
    withErrorHandling(async (event, data: any) => {
      const { playlistId, position } = data;
      playlistService.removeEntry(playlistId, position);
      return { success: true };
    })
  );

  registry.register(
    channels.PLAYLIST_REORDER_ENTRIES,
    withErrorHandling(async (event, data: any) => {
      const { playlistId, fromPosition, toPosition } = data;
      const reordered = playlistService.reorderEntries(
        playlistId,
        fromPosition,
        toPosition
      );
      return reordered;
    })
  );

  registry.register(
    channels.PLAYLIST_UPDATE_ENTRY,
    withErrorHandling(async (event, data: any) => {
      const { playlistId, position, updates } = data;
      const updated = playlistService.updateEntry(playlistId, position, updates);
      return updated;
    })
  );

  registry.register(
    channels.PLAYLIST_CLEANUP_INVALID,
    withErrorHandling(async (event, data: any) => {
      const { playlistId } = data;
      const removedCount = await playlistService.cleanupInvalidEntries(playlistId);
      return { removedCount };
    })
  );

  // Playlist playback state handlers
  registry.register(
    channels.PLAYLIST_GET_PLAYBACK_STATE,
    withErrorHandling(async () => {
      const state = playlistRepository.getPlaybackState();
      return state;
    })
  );

  registry.register(
    channels.PLAYLIST_UPDATE_PLAYBACK_STATE,
    withErrorHandling(async (event, data: any) => {
      const state = playlistRepository.updatePlaybackState(data);
      return state;
    })
  );

import { IpcHandlerRegistry } from './IpcHandlerRegistry';
import registry from './IpcHandlerRegistry';

// Import services
import { ArchiveService } from '../services/ArchiveService';
import { ImageService } from '../services/ImageService';
import { SessionService } from '../services/SessionService';
import { FolderService } from '../services/FolderService';
import { RecentSourcesService } from '../services/RecentSourcesService';
import { ThumbnailService } from '../services/ThumbnailService';
import { SlideshowRepository } from '../repositories/SlideshowRepository';
import { SlideshowService } from '../services/SlideshowService';

// Import handlers
import { registerSlideshowHandlers } from './slideshowHandlers';
import { registerArchiveHandlers } from './handlers/archiveHandlers';
import { registerImageHandlers } from './handlers/imageHandlers';
import { registerSessionHandlers } from './handlers/sessionHandlers';
import { registerFolderHandlers } from './handlers/folderHandlers';
import { registerCommonHandlers } from './handlers/commonHandlers';

// Service instances
const archiveService = new ArchiveService();
const imageService = new ImageService(archiveService);
const sessionService = new SessionService();
const folderService = new FolderService();
const recentSourcesService = new RecentSourcesService();
const thumbnailService = new ThumbnailService(imageService, folderService);
const slideshowRepository = new SlideshowRepository();
const slideshowService = new SlideshowService({ repository: slideshowRepository });

/**
 * Initialize all IPC handlers
 * This will be called from main process on app ready
 */
export function initializeIpcHandlers(): void {
  // Register all handlers
  registerSlideshowHandlers({ registry, slideshowService });

  registerArchiveHandlers({
    registry,
    archiveService,
    sessionService,
  });

  registerImageHandlers({
    registry,
    archiveService,
    imageService,
    folderService,
    thumbnailService,
  });

  registerSessionHandlers({
    registry,
    sessionService,
  });

  registerFolderHandlers({
    registry,
    folderService,
    sessionService,
  });

  registerCommonHandlers({
    registry,
    recentSourcesService,
  });
}

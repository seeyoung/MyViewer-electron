import { IpcHandlerRegistry } from '../IpcHandlerRegistry';
import { ArchiveService } from '../../services/ArchiveService';
import { SessionService } from '../../services/SessionService';
import { withErrorHandling, IpcErrorCode, createIpcError } from '../error-handler';
import * as channels from '@shared/constants/ipc-channels';
import { SourceType } from '@shared/types/Source';
import { ensureSerializable } from '@shared/utils/serialization';
import { getAllImagesFromFolder } from '../../utils/folder-utils';

interface ArchiveHandlersDependencies {
    registry: IpcHandlerRegistry;
    archiveService: ArchiveService;
    sessionService: SessionService;
}

export function registerArchiveHandlers({
    registry,
    archiveService,
    sessionService,
}: ArchiveHandlersDependencies): void {
    registry.register(
        channels.ARCHIVE_OPEN,
        withErrorHandling(async (event, data: any) => {
            const { filePath, password } = data;
            const archive = await archiveService.openArchive(filePath, password);

            // Get or create session
            const session = sessionService.getOrCreateSession(filePath, SourceType.ARCHIVE, archive.id);

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
            const serializableImages = images.map((img) => ({
                id: img.id,
                archiveId: img.archiveId,
                pathInArchive: img.pathInArchive,
                fileName: img.fileName,
                format: img.format,
                size: img.fileSize,
                width: img.dimensions?.width,
                height: img.dimensions?.height,
                // lastModified is not in Image type
            }));

            // Ensure session is serializable
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

            const result = {
                archive: serializableArchive,
                session: serializableSession,
                images: serializableImages,
            };

            // Use helper to ensure completely clean objects
            return ensureSerializable(result);
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
}

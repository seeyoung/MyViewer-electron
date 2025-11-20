import { IpcHandlerRegistry } from '../IpcHandlerRegistry';
import { FolderService } from '../../services/FolderService';
import { SessionService } from '../../services/SessionService';
import { withErrorHandling } from '../error-handler';
import * as channels from '@shared/constants/ipc-channels';
import { SourceType } from '@shared/types/Source';
import { ensureSerializable } from '@shared/utils/serialization';

interface FolderHandlersDependencies {
    registry: IpcHandlerRegistry;
    folderService: FolderService;
    sessionService: SessionService;
}

export function registerFolderHandlers({
    registry,
    folderService,
    sessionService,
}: FolderHandlersDependencies): void {
    registry.register(
        channels.FOLDER_OPEN,
        withErrorHandling(async (event, data: any) => {
            const { folderPath } = data;
            const result = await folderService.openFolder(folderPath);

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
                images: result.images,
                rootFolder: result.rootFolder,
            };

            return ensureSerializable(response);
        })
    );
}

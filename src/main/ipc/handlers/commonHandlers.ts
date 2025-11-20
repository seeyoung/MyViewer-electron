import { IpcHandlerRegistry } from '../IpcHandlerRegistry';
import { RecentSourcesService } from '../../services/RecentSourcesService';
import { withErrorHandling } from '../error-handler';
import * as channels from '@shared/constants/ipc-channels';
import { SourceDescriptor } from '@shared/types/Source';
import fs from 'fs/promises';

interface CommonHandlersDependencies {
    registry: IpcHandlerRegistry;
    recentSourcesService: RecentSourcesService;
}

export function registerCommonHandlers({
    registry,
    recentSourcesService,
}: CommonHandlersDependencies): void {
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
            await recentSourcesService.add(data as SourceDescriptor);
            return { success: true };
        })
    );

    registry.register(
        channels.RECENT_SOURCES_CLEAR,
        withErrorHandling(async () => {
            await recentSourcesService.clear();
            return { success: true };
        })
    );

    registry.register(
        channels.RECENT_SOURCES_REMOVE,
        withErrorHandling(async (event, data: any) => {
            await recentSourcesService.remove(data as SourceDescriptor);
            return { success: true };
        })
    );
}

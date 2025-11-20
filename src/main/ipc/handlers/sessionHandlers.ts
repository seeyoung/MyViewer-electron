import { IpcHandlerRegistry } from '../IpcHandlerRegistry';
import { SessionService } from '../../services/SessionService';
import { withErrorHandling } from '../error-handler';
import * as channels from '@shared/constants/ipc-channels';
import { SourceType } from '@shared/types/Source';

interface SessionHandlersDependencies {
    registry: IpcHandlerRegistry;
    sessionService: SessionService;
}

export function registerSessionHandlers({
    registry,
    sessionService,
}: SessionHandlersDependencies): void {
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
}

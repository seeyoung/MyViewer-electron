import * as channels from '@shared/constants/ipc-channels';
import { withErrorHandling } from './error-handler';
import { SlideshowService } from '@main/services/SlideshowService';
import { IpcMainInvokeEvent } from 'electron';

interface Registry {
  register: (channel: string, handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<unknown> | unknown) => void;
}

interface SlideshowHandlerDeps {
  registry: Registry;
  slideshowService: SlideshowService;
}

export function registerSlideshowHandlers({ registry, slideshowService }: SlideshowHandlerDeps): void {
  registry.register(
    channels.SLIDESHOW_LIST,
    withErrorHandling(async () => slideshowService.listSlideshows())
  );

  registry.register(
    channels.SLIDESHOW_GET,
    withErrorHandling(async (_event, payload: any) => slideshowService.getSlideshow(payload.id))
  );

  registry.register(
    channels.SLIDESHOW_CREATE,
    withErrorHandling(async (_event, payload: any) =>
      slideshowService.createSlideshow(payload.name, payload.description)
    )
  );

  registry.register(
    channels.SLIDESHOW_UPDATE,
    withErrorHandling(async (_event, payload: any) =>
      slideshowService.updateSlideshow(payload.id, {
        name: payload.name,
        description: payload.description,
        allowDuplicates: payload.allowDuplicates,
      })
    )
  );

  registry.register(
    channels.SLIDESHOW_DELETE,
    withErrorHandling(async (_event, payload: any) => slideshowService.deleteSlideshow(payload.id))
  );

  registry.register(
    channels.SLIDESHOW_SET_ENTRIES,
    withErrorHandling(async (_event, payload: any) =>
      slideshowService.setEntries(payload.slideshowId, payload.entries)
    )
  );

  registry.register(
    channels.SLIDESHOW_ADD_ENTRY,
    withErrorHandling(async (_event, payload: any) =>
      slideshowService.addEntry(payload.slideshowId, payload.entry, payload.position)
    )
  );
}

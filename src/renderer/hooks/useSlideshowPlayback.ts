import { useCallback, useEffect } from 'react';
import { useViewerStore } from '@renderer/store/viewerStore';
import { useArchive } from './useArchive';

export function useSlideshowPlayback() {
  const slideshowQueueEntries = useViewerStore(state => state.slideshowQueueEntries);
  const activeSlideshowEntryId = useViewerStore(state => state.activeSlideshowEntryId);
  const currentSlidePath = useViewerStore(state => state.currentSlidePath);
  const setCurrentSlidePath = useViewerStore(state => state.setCurrentSlidePath);
  const slideshowRoot = useViewerStore(state => state.slideshowRoot);
  const advanceSlideshowQueue = useViewerStore(state => state.advanceSlideshowQueue);
  const { openFolder } = useArchive();

  useEffect(() => {
    if (!currentSlidePath) {
      return;
    }
    if (slideshowRoot && currentSlidePath === slideshowRoot.path) {
      return;
    }
    void openFolder(currentSlidePath, { userOpen: false });
  }, [currentSlidePath, openFolder, slideshowRoot]);

  const advance = useCallback(() => {
    if (slideshowQueueEntries.length === 0) {
      return;
    }
    const currentIndex = activeSlideshowEntryId
      ? slideshowQueueEntries.findIndex((entry) => entry.id === activeSlideshowEntryId)
      : 0;
    if (currentIndex >= slideshowQueueEntries.length - 1) {
      return;
    }
    advanceSlideshowQueue();
  }, [activeSlideshowEntryId, advanceSlideshowQueue, slideshowQueueEntries]);

  return { advance };
}

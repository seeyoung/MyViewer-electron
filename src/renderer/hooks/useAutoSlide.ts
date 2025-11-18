import { useEffect } from 'react';
import { useViewerStore } from '../store/viewerStore';
import { useImageNavigation } from './useImageNavigation';

export function useAutoSlide() {
  const autoSlideEnabled = useViewerStore(state => state.autoSlideEnabled);
  const autoSlideInterval = useViewerStore(state => state.autoSlideInterval);
  const setAutoSlideEnabled = useViewerStore(state => state.setAutoSlideEnabled);
  const imagesLength = useViewerStore(state => state.images.length);
  const currentPageIndex = useViewerStore(state => state.currentPageIndex);
  const slideshowQueueEntries = useViewerStore(state => state.slideshowQueueEntries);
  const activeSlideshowEntryId = useViewerStore(state => state.activeSlideshowEntryId);
  const advanceSlideshowQueue = useViewerStore(state => state.advanceSlideshowQueue);
  const { goToNext } = useImageNavigation();

  useEffect(() => {
    if (!autoSlideEnabled) {
      return;
    }

    if (imagesLength <= 1) {
      setAutoSlideEnabled(false);
      return;
    }

    const id = setInterval(() => {
      if (currentPageIndex >= imagesLength - 1) {
        const currentIndex = activeSlideshowEntryId
          ? slideshowQueueEntries.findIndex((entry) => entry.id === activeSlideshowEntryId)
          : -1;
        const hasNextEntry = currentIndex >= 0 && currentIndex < slideshowQueueEntries.length - 1;
        if (hasNextEntry) {
          advanceSlideshowQueue();
        } else {
          setAutoSlideEnabled(false);
        }
      } else {
        goToNext();
      }
    }, autoSlideInterval);

    return () => {
      clearInterval(id);
    };
  }, [
    activeSlideshowEntryId,
    advanceSlideshowQueue,
    autoSlideEnabled,
    autoSlideInterval,
    currentPageIndex,
    goToNext,
    imagesLength,
    setAutoSlideEnabled,
    slideshowQueueEntries,
  ]);
}

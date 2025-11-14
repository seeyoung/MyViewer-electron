import { useEffect } from 'react';
import { useViewerStore } from '../store/viewerStore';
import { useImageNavigation } from './useImageNavigation';

export function useAutoSlide() {
  const autoSlideEnabled = useViewerStore(state => state.autoSlideEnabled);
  const autoSlideInterval = useViewerStore(state => state.autoSlideInterval);
  const setAutoSlideEnabled = useViewerStore(state => state.setAutoSlideEnabled);
  const imagesLength = useViewerStore(state => state.images.length);
  const currentPageIndex = useViewerStore(state => state.currentPageIndex);
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
        setAutoSlideEnabled(false);
      } else {
        goToNext();
      }
    }, autoSlideInterval);

    return () => {
      clearInterval(id);
    };
  }, [autoSlideEnabled, autoSlideInterval, currentPageIndex, imagesLength, goToNext, setAutoSlideEnabled]);
}

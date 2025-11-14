import { useCallback, useEffect } from 'react';
import { useViewerStore } from '../store/viewerStore';
import ipcClient from '../services/ipc';
import * as channels from '@shared/constants/ipc-channels';

export function useImageNavigation() {
  const currentPageIndex = useViewerStore(state => state.currentPageIndex);
  const images = useViewerStore(state => state.images);
  const currentSource = useViewerStore(state => state.currentSource);
  const currentSession = useViewerStore(state => state.currentSession);
  const navigateToPage = useViewerStore(state => state.navigateToPage);
  const setFolderPosition = useViewerStore(state => state.setFolderPosition);

  const currentImage = images[currentPageIndex];
  const totalPages = images.length;
  const hasNext = currentPageIndex < totalPages - 1;
  const hasPrevious = currentPageIndex > 0;

  const goToNext = useCallback(() => {
    if (hasNext) {
      navigateToPage(currentPageIndex + 1);
    }
  }, [currentPageIndex, hasNext, navigateToPage]);

  const goToPrevious = useCallback(() => {
    if (hasPrevious) {
      navigateToPage(currentPageIndex - 1);
    }
  }, [currentPageIndex, hasPrevious, navigateToPage]);

  const goToFirst = useCallback(() => {
    navigateToPage(0);
  }, [navigateToPage]);

  const goToLast = useCallback(() => {
    if (totalPages > 0) {
      navigateToPage(totalPages - 1);
    }
  }, [totalPages, navigateToPage]);

  const goToPage = useCallback(
    (pageNumber: number) => {
      navigateToPage(pageNumber - 1); // Convert 1-based to 0-based
    },
    [navigateToPage]
  );

  // Auto-save session on page navigation (debounced via SessionService)
  useEffect(() => {
    if (!currentSource || !currentSession) return;

    const saveSession = async () => {
      try {
        await ipcClient.invoke(channels.SESSION_UPDATE, {
          id: currentSession.id,
          sourcePath: currentSession.sourcePath,
          sourceType: currentSession.sourceType,
          sourceId: currentSession.sourceId,
          currentPageIndex,
        });
      } catch (error) {
        console.error('Failed to save session:', error);
      }
    };

    if (currentImage) {
      setFolderPosition(currentImage.folderPath || '/', currentPageIndex);
    }

    saveSession();
  }, [currentPageIndex, currentSource, currentSession, currentImage, setFolderPosition]);

  return {
    currentImage,
    currentPageIndex,
    currentPage: currentPageIndex + 1, // 1-based for display
    totalPages,
    hasNext,
    hasPrevious,
    goToNext,
    goToPrevious,
    goToFirst,
    goToLast,
    goToPage,
  };
}

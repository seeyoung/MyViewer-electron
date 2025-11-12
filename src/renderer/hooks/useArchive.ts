import { useState, useCallback } from 'react';
import { useViewerStore } from '../store/viewerStore';
import ipcClient from '../services/ipc';
import * as channels from '@shared/constants/ipc-channels';

export function useArchive() {
  const [isOpening, setIsOpening] = useState(false);
  const setArchive = useViewerStore(state => state.setArchive);
  const setImages = useViewerStore(state => state.setImages);
  const setError = useViewerStore(state => state.setError);
  const navigateToPage = useViewerStore(state => state.navigateToPage);

  const openArchive = useCallback(async (filePath: string, password?: string) => {
    setIsOpening(true);
    setError(null);

    try {
      // Open archive via IPC
      const result = await ipcClient.invoke<any>(channels.ARCHIVE_OPEN, {
        filePath,
        password,
      });

      const { archive, session, images } = result;

      console.log('📦 Archive opened successfully:', {
        archiveId: archive.id,
        fileName: archive.fileName,
        imageCount: images.length,
        firstImage: images[0] ? {
          id: images[0].id,
          pathInArchive: images[0].pathInArchive,
          archiveId: images[0].archiveId
        } : null
      });

      // Update store
      setArchive(archive);
      setImages(images);

      // Navigate to last viewed page (auto-resume)
      if (session && session.currentPageIndex !== undefined) {
        navigateToPage(session.currentPageIndex);
      }

      return archive;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to open archive';
      setError(errorMessage);
      throw error;
    } finally {
      setIsOpening(false);
    }
  }, [setArchive, setImages, setError, navigateToPage]);

  const closeArchive = useCallback(async (archiveId: string) => {
    try {
      await ipcClient.invoke(channels.ARCHIVE_CLOSE, { archiveId });
      useViewerStore.getState().reset();
    } catch (error) {
      console.error('Failed to close archive:', error);
    }
  }, []);

  return {
    openArchive,
    closeArchive,
    isOpening,
  };
}

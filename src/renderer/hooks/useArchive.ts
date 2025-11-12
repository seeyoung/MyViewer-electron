import { useState, useCallback } from 'react';
import { useViewerStore } from '../store/viewerStore';
import ipcClient from '../services/ipc';
import * as channels from '@shared/constants/ipc-channels';
import { SourceType } from '@shared/types/Source';

export function useArchive() {
  const [isOpening, setIsOpening] = useState(false);
  const setSource = useViewerStore(state => state.setSource);
  const setImages = useViewerStore(state => state.setImages);
  const setError = useViewerStore(state => state.setError);
  const navigateToPage = useViewerStore(state => state.navigateToPage);
  const setSession = useViewerStore(state => state.setSession);

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
      setSource({
        id: archive.id,
        type: SourceType.ARCHIVE,
        path: archive.filePath,
        label: archive.fileName,
      });
      setImages(images);
      setSession(session);

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
  }, [setSource, setImages, setError, navigateToPage, setSession]);

  const openFolder = useCallback(async (folderPath: string) => {
    setIsOpening(true);
    setError(null);

    try {
      const result = await ipcClient.invoke<any>(channels.FOLDER_OPEN, {
        folderPath,
      });

      const { source, session, images } = result;

      setSource(source);
      setImages(images);
      setSession(session);

      if (session && session.currentPageIndex !== undefined) {
        navigateToPage(session.currentPageIndex);
      }

      return source;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to open folder';
      setError(errorMessage);
      throw error;
    } finally {
      setIsOpening(false);
    }
  }, [setSource, setImages, setError, navigateToPage, setSession]);

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
    openFolder,
    closeArchive,
    isOpening,
  };
}

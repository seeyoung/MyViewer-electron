import { useState, useCallback } from 'react';
import { useViewerStore } from '../store/viewerStore';
import ipcClient from '../services/ipc';
import * as channels from '@shared/constants/ipc-channels';
import { SourceType } from '@shared/types/Source';
import { useSlideshowManager } from './useSlideshowManager';

interface ArchiveOpenOptions {
  password?: string;
  userOpen?: boolean;
}

interface FolderOpenOptions {
  userOpen?: boolean;
}

export function useArchive() {
  const [isOpening, setIsOpening] = useState(false);
  const navigateToPage = useViewerStore(state => state.navigateToPage);
  const setSession = useViewerStore(state => state.setSession);
  const addRecentSource = useViewerStore(state => state.addRecentSource);
  const loadFolderPositions = useViewerStore(state => state.loadFolderPositions);
  const setSource = useViewerStore(state => state.setSource);
  const setImages = useViewerStore(state => state.setImages);
  const setError = useViewerStore(state => state.setError);

  const setSlideshowRoot = useViewerStore(state => state.setSlideshowRoot);
  const { startSlideshowFromRoot } = useSlideshowManager();

  const openArchive = useCallback(async (filePath: string, options?: ArchiveOpenOptions) => {
    const { password, userOpen = true } = options ?? {};
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
      loadFolderPositions();
      setImages(images);
      setSession(session);

      const descriptor = {
        id: archive.id,
        type: SourceType.ARCHIVE,
        path: archive.filePath,
        label: archive.fileName,
      } as const;

      if (userOpen) {
        addRecentSource(descriptor);
        ipcClient.invoke(channels.RECENT_SOURCES_ADD, descriptor).catch((error) => {
          console.error('Failed to persist recent source', error);
        });
      }

      if (userOpen) {
        startSlideshowFromRoot(descriptor, undefined, false);
      } else {
        setSlideshowRoot(descriptor);
      }

      // Navigate to last viewed page (auto-resume)
      if (userOpen && session && session.currentPageIndex !== undefined) {
        navigateToPage(session.currentPageIndex);
      } else {
        navigateToPage(0);
      }

      return archive;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to open archive';
      setError(errorMessage);
      throw error;
    } finally {
      setIsOpening(false);
    }
  }, [addRecentSource, loadFolderPositions, navigateToPage, setError, setImages, setSession, setSource, setSlideshowRoot, startSlideshowFromRoot]);

  const openFolder = useCallback(async (folderPath: string, options?: FolderOpenOptions) => {
    const { userOpen = true } = options ?? {};
    setIsOpening(true);
    setError(null);

    try {
      const result = await ipcClient.invoke<any>(channels.FOLDER_OPEN, {
        folderPath,
      });

      const { source, session, images } = result;

      setSource(source);
      loadFolderPositions();
      setImages(images);
      setSession(session);

      if (userOpen) {
        addRecentSource(source);
        ipcClient.invoke(channels.RECENT_SOURCES_ADD, source).catch((error) => {
          console.error('Failed to persist recent source', error);
        });
      }

      if (userOpen) {
        startSlideshowFromRoot(source, undefined, false);
      } else {
        setSlideshowRoot(source);
      }

      if (userOpen && session && session.currentPageIndex !== undefined) {
        navigateToPage(session.currentPageIndex);
      } else {
        navigateToPage(0);
      }

      return source;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to open folder';
      setError(errorMessage);
      throw error;
    } finally {
      setIsOpening(false);
    }
  }, [addRecentSource, loadFolderPositions, navigateToPage, setError, setImages, setSession, setSource, setSlideshowRoot, startSlideshowFromRoot]);

  const closeArchive = useCallback(async (archiveId: string) => {
    try {
      await ipcClient.invoke(channels.ARCHIVE_CLOSE, { archiveId });
      useViewerStore.getState().setSource(null as any);
      useViewerStore.getState().setImages([]);
      useViewerStore.getState().setSession(null);
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

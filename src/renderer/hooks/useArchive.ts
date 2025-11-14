import { useState, useCallback, useEffect } from 'react';
import { useViewerStore } from '../store/viewerStore';
import ipcClient from '../services/ipc';
import * as channels from '@shared/constants/ipc-channels';
import { SourceType } from '@shared/types/Source';
import { ScanStatus } from '@shared/types/Scan';

export function useArchive() {
  const [isOpening, setIsOpening] = useState(false);
  const setSource = useViewerStore(state => state.setSource);
  const setImages = useViewerStore(state => state.setImages);
  const setError = useViewerStore(state => state.setError);
  const navigateToPage = useViewerStore(state => state.navigateToPage);
  const setSession = useViewerStore(state => state.setSession);
  const addRecentSource = useViewerStore(state => state.addRecentSource);
  const loadFolderPositions = useViewerStore(state => state.loadFolderPositions);
  const clearFolderPositions = useViewerStore(state => state.clearFolderPositions);
  const setScanStatus = useViewerStore(state => state.setScanStatus);
  const setScanToken = useViewerStore(state => state.setScanToken);
  const setScanProgress = useViewerStore(state => state.setScanProgress);
  const setEstimatedTotal = useViewerStore(state => state.setEstimatedTotal);
  const addImageChunk = useViewerStore(state => state.addImageChunk);

  // Set up scan event listeners
  useEffect(() => {
    // Folder scan listeners
    const unsubscribeFolderProgress = ipcClient.onFolderScanProgress((event) => {
      setScanStatus(ScanStatus.SCANNING);
      setScanProgress({
        discovered: event.discovered,
        processed: event.processed,
        currentPath: event.currentPath,
        percentage: 0, // Will be calculated if estimatedTotal is available
      });

      // Add new images as they're discovered
      if (event.imageChunk && event.imageChunk.length > 0) {
        addImageChunk(event.imageChunk);
      }
    });

    const unsubscribeFolderComplete = ipcClient.onFolderScanComplete((event) => {
      setScanStatus(ScanStatus.COMPLETED);
      setScanProgress(null);
      console.log(`✅ Folder scan completed: ${event.totalImages} images in ${event.duration}ms`);
    });

    // Archive scan listeners
    const unsubscribeArchiveProgress = ipcClient.onArchiveScanProgress((event) => {
      setScanStatus(ScanStatus.SCANNING);
      setScanProgress({
        discovered: event.discovered,
        processed: event.processed,
        currentPath: event.currentPath,
        percentage: Math.round((event.processed / event.discovered) * 100),
      });

      // Add new images as they're discovered
      if (event.imageChunk && event.imageChunk.length > 0) {
        addImageChunk(event.imageChunk);
      }
    });

    const unsubscribeArchiveComplete = ipcClient.onArchiveScanComplete((event) => {
      setScanStatus(ScanStatus.COMPLETED);
      setScanProgress(null);
      console.log(`✅ Archive scan completed: ${event.totalImages} images in ${event.duration}ms`);
    });

    return () => {
      unsubscribeFolderProgress();
      unsubscribeFolderComplete();
      unsubscribeArchiveProgress();
      unsubscribeArchiveComplete();
    };
  }, [setScanStatus, setScanProgress, addImageChunk]);

  const openArchive = useCallback(async (filePath: string, password?: string) => {
    setIsOpening(true);
    setError(null);

    try {
      // Open archive via IPC
      const result = await ipcClient.invoke<any>(channels.ARCHIVE_OPEN, {
        filePath,
        password,
      });

      const { source, session, initialImages, scanToken, estimatedTotal, isComplete } = result;

      // Update store
      setSource(source);
      loadFolderPositions(source.path);
      setImages(initialImages);
      setSession(session);
      addRecentSource(source);
      ipcClient.invoke(channels.RECENT_SOURCES_ADD, source).catch((error) => {
        console.error('Failed to persist recent source', error);
      });

      // Set scan state
      setScanToken(scanToken);
      setEstimatedTotal(estimatedTotal);
      setScanStatus(isComplete ? ScanStatus.COMPLETED : ScanStatus.SCANNING);

      // Navigate to last viewed page (auto-resume)
      if (session && session.currentPageIndex !== undefined) {
        navigateToPage(session.currentPageIndex);
      }

      console.log('📦 Archive opened:', {
        path: filePath,
        initialImages: initialImages.length,
        isComplete,
        scanToken,
      });

      return source;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to open archive';
      setError(errorMessage);
      setScanStatus(ScanStatus.FAILED);
      throw error;
    } finally {
      setIsOpening(false);
    }
  }, [
    setSource,
    setImages,
    setError,
    navigateToPage,
    setSession,
    addRecentSource,
    loadFolderPositions,
    setScanToken,
    setEstimatedTotal,
    setScanStatus,
  ]);

  const openFolder = useCallback(async (folderPath: string) => {
    setIsOpening(true);
    setError(null);

    try {
      const result = await ipcClient.invoke<any>(channels.FOLDER_OPEN, {
        folderPath,
      });

      const { source, session, initialImages, scanToken, estimatedTotal, isComplete } = result;

      setSource(source);
      loadFolderPositions(source.path);
      setImages(initialImages);
      setSession(session);
      addRecentSource(source);
      ipcClient.invoke(channels.RECENT_SOURCES_ADD, source).catch((error) => {
        console.error('Failed to persist recent source', error);
      });

      // Set scan state
      setScanToken(scanToken);
      setEstimatedTotal(estimatedTotal);
      setScanStatus(isComplete ? ScanStatus.COMPLETED : ScanStatus.SCANNING);

      if (session && session.currentPageIndex !== undefined) {
        navigateToPage(session.currentPageIndex);
      }

      console.log('📁 Folder opened:', {
        path: folderPath,
        initialImages: initialImages.length,
        isComplete,
        scanToken,
      });

      return source;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to open folder';
      setError(errorMessage);
      setScanStatus(ScanStatus.FAILED);
      throw error;
    } finally {
      setIsOpening(false);
    }
  }, [
    setSource,
    setImages,
    setError,
    navigateToPage,
    setSession,
    addRecentSource,
    loadFolderPositions,
    setScanToken,
    setEstimatedTotal,
    setScanStatus,
  ]);

  const closeArchive = useCallback(async (archiveId: string) => {
    try {
      await ipcClient.invoke(channels.ARCHIVE_CLOSE, { archiveId });
      clearFolderPositions();
      useViewerStore.getState().reset();
    } catch (error) {
      console.error('Failed to close archive:', error);
    }
  }, [clearFolderPositions]);

  const cancelScan = useCallback(async (scanToken: string) => {
    try {
      const result = await ipcClient.cancelScan(scanToken);
      if (result.success) {
        setScanStatus(ScanStatus.CANCELLED);
        setScanProgress(null);
        console.log('🛑 Scan cancelled:', scanToken);
      }
      return result.success;
    } catch (error) {
      console.error('Failed to cancel scan:', error);
      return false;
    }
  }, [setScanStatus, setScanProgress]);

  return {
    openArchive,
    openFolder,
    closeArchive,
    cancelScan,
    isOpening,
  };
}

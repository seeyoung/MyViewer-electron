import React, { useEffect, useState } from 'react';
import ErrorBoundary from './components/shared/ErrorBoundary';
import NavigationBar from './components/viewer/NavigationBar';
import ImageViewer from './components/viewer/ImageViewer';
import LoadingIndicator from './components/shared/LoadingIndicator';
import { useViewerStore } from './store/viewerStore';
import { useArchive } from './hooks/useArchive';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function App() {
  console.log('🚀 App component is rendering!');

  const currentSource = useViewerStore(state => state.currentSource);
  const isLoading = useViewerStore(state => state.isLoading);
  const error = useViewerStore(state => state.error);
  const isFullscreen = useViewerStore(state => state.isFullscreen);
  const setFullscreen = useViewerStore(state => state.setFullscreen);
  const { openArchive, openFolder, isOpening } = useArchive();
  const [viewerSize, setViewerSize] = useState({ width: 800, height: 600 });

  // Enable keyboard shortcuts
  console.log('⌨️ About to enable keyboard shortcuts...');
  useKeyboardShortcuts();

  // Listen for file-opened event from main process
  useEffect(() => {
    const removeArchiveListener = window.electronAPI.on('file-opened', async (...args: unknown[]) => {
      const [filePath] = args;
      if (typeof filePath !== 'string') {
        console.error('Invalid file path received from main process');
        return;
      }
      try {
        await openArchive(filePath);
      } catch (error) {
        console.error('Failed to open archive:', error);
      }
    });

    const removeFolderListener = window.electronAPI.on('folder-opened', async (...args: unknown[]) => {
      const [folderPath] = args;
      if (typeof folderPath !== 'string') {
        console.error('Invalid folder path received from main process');
        return;
      }
      try {
        await openFolder(folderPath);
      } catch (error) {
        console.error('Failed to open folder:', error);
      }
    });

    return () => {
      removeArchiveListener();
      removeFolderListener();
    };
  }, [openArchive, openFolder]);

  useEffect(() => {
    const removeListener = window.electronAPI.on('window-fullscreen-changed', (fullscreenState: unknown) => {
      setFullscreen(Boolean(fullscreenState));
    });

    return () => {
      removeListener();
    };
  }, [setFullscreen]);

  // Handle drag and drop
  useEffect(() => {
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const filePath = files[0].path;
        try {
          await openArchive(filePath);
        } catch (error) {
          console.error('Failed to open dropped file:', error);
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener('drop', handleDrop);
    document.addEventListener('dragover', handleDragOver);

    return () => {
      document.removeEventListener('drop', handleDrop);
      document.removeEventListener('dragover', handleDragOver);
    };
  }, [openArchive]);

  // Update viewer size on window resize
  useEffect(() => {
    const updateSize = () => {
      const header = document.querySelector('.app-header');
      const nav = document.querySelector('.navigation-bar');
      const headerHeight = isFullscreen ? 0 : (header?.clientHeight || 0);
      const navHeight = isFullscreen ? 0 : (nav?.clientHeight || 0);
      const availableHeight = isFullscreen ? window.innerHeight : (window.innerHeight - headerHeight - navHeight);

      setViewerSize({
        width: window.innerWidth,
        height: availableHeight,
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
    };
  }, [currentSource, isFullscreen]);

  return (
    <ErrorBoundary>
      <div className={`app ${isFullscreen ? 'fullscreen' : ''}`}>
        <header className={`app-header ${isFullscreen ? 'hidden' : ''}`}>
          <h1>MyViewer</h1>
          <p className="subtitle">Archive Image Viewer</p>
        </header>

        {currentSource && <NavigationBar className={isFullscreen ? 'floating' : ''} />}

        <main className={`app-main ${isFullscreen ? 'fullscreen' : ''}`}>
          {isOpening || isLoading ? (
            <LoadingIndicator message="Loading archive..." />
          ) : error ? (
            <div className="error-message">
              <h2>Error</h2>
              <p>{error}</p>
            </div>
          ) : currentSource ? (
            <ImageViewer width={viewerSize.width} height={viewerSize.height} />
          ) : (
            <div className="welcome-message">
              <h2>Welcome to MyViewer</h2>
              <p>Open an archive file or image folder to get started</p>
              <div className="supported-formats">
                <p>Supported formats:</p>
                <ul>
                  <li>ZIP, CBZ (Comic Book ZIP)</li>
                  <li>RAR, CBR (Comic Book RAR)</li>
                  <li>7Z, TAR</li>
                </ul>
                <p className="hint">
                  Use File → Open Archive (Cmd+O), File → Open Folder (Cmd+Shift+O), or drag & drop
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;

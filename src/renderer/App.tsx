import React, { useEffect, useRef, useState } from 'react';
import ErrorBoundary from './components/shared/ErrorBoundary';
import NavigationBar from './components/viewer/NavigationBar';
import ImageViewer from './components/viewer/ImageViewer';
import LoadingIndicator from './components/shared/LoadingIndicator';
import { useViewerStore } from './store/viewerStore';
import { useArchive } from './hooks/useArchive';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function App() {
  console.log('🚀 App component is rendering!');

  const currentArchive = useViewerStore(state => state.currentArchive);
  const isLoading = useViewerStore(state => state.isLoading);
  const error = useViewerStore(state => state.error);
  const isFullscreen = useViewerStore(state => state.isFullscreen);
  const isImageFullscreen = useViewerStore(state => state.isImageFullscreen);
  const setFullscreen = useViewerStore(state => state.setFullscreen);
  const { openArchive, isOpening } = useArchive();
  const [viewerSize, setViewerSize] = useState({ width: 800, height: 600 });
  const imageFullscreenForcedRef = useRef(false);

  // Enable keyboard shortcuts
  console.log('⌨️ About to enable keyboard shortcuts...');
  useKeyboardShortcuts();

  // Listen for file-opened event from main process
  useEffect(() => {
    const removeListener = window.electronAPI.on('file-opened', async (filePath: any) => {
      try {
        await openArchive(filePath);
      } catch (error) {
        console.error('Failed to open archive:', error);
      }
    });

    return () => {
      removeListener();
    };
  }, [openArchive]);

  useEffect(() => {
    const removeListener = window.electronAPI.on('window-fullscreen-changed', (_event, fullscreenState: unknown) => {
      setFullscreen(Boolean(fullscreenState));
    });

    return () => {
      removeListener();
    };
  }, [setFullscreen]);

  // Ensure 이미지 전체화면 triggers window fullscreen and releases it afterward
  useEffect(() => {
    if (isImageFullscreen) {
      if (!isFullscreen) {
        window.electronAPI.send('window-set-fullscreen', true);
        imageFullscreenForcedRef.current = true;
      }
      return;
    }

    if (imageFullscreenForcedRef.current && isFullscreen) {
      window.electronAPI.send('window-set-fullscreen', false);
    }
    imageFullscreenForcedRef.current = false;
  }, [isImageFullscreen, isFullscreen]);

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
      const headerHeight = (isFullscreen || isImageFullscreen) ? 0 : (header?.clientHeight || 0);
      const navHeight = (isFullscreen || isImageFullscreen) ? 0 : (nav?.clientHeight || 0);
      const availableHeight = (isFullscreen || isImageFullscreen) ? window.innerHeight : (window.innerHeight - headerHeight - navHeight);

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
  }, [currentArchive, isFullscreen, isImageFullscreen]);

  return (
    <ErrorBoundary>
      <div className={`app ${isFullscreen ? 'fullscreen' : ''} ${isImageFullscreen ? 'image-fullscreen' : ''}`}>
        <header className={`app-header ${(isFullscreen || isImageFullscreen) ? 'hidden' : ''}`}>
          <h1>MyViewer</h1>
          <p className="subtitle">Archive Image Viewer</p>
        </header>

        {currentArchive && <NavigationBar className={isFullscreen ? 'hidden' : isImageFullscreen ? 'floating' : ''} />}

        <main className={`app-main ${(isFullscreen || isImageFullscreen) ? 'fullscreen' : ''}`}>
          {isOpening || isLoading ? (
            <LoadingIndicator message="Loading archive..." />
          ) : error ? (
            <div className="error-message">
              <h2>Error</h2>
              <p>{error}</p>
            </div>
          ) : currentArchive ? (
            <ImageViewer width={viewerSize.width} height={viewerSize.height} />
          ) : (
            <div className="welcome-message">
              <h2>Welcome to MyViewer</h2>
              <p>Open an archive file to get started</p>
              <div className="supported-formats">
                <p>Supported formats:</p>
                <ul>
                  <li>ZIP, CBZ (Comic Book ZIP)</li>
                  <li>RAR, CBR (Comic Book RAR)</li>
                  <li>7Z, TAR</li>
                </ul>
                <p className="hint">
                  Use File → Open Archive (Cmd+O) or drag & drop a file
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

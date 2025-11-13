import React, { useEffect, useState } from 'react';
import ErrorBoundary from './components/shared/ErrorBoundary';
import NavigationBar from './components/viewer/NavigationBar';
import ImageViewer from './components/viewer/ImageViewer';
import FolderSidebar from './components/viewer/FolderSidebar';
import LoadingIndicator from './components/shared/LoadingIndicator';
import { useViewerStore } from './store/viewerStore';
import { useArchive } from './hooks/useArchive';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { SourceDescriptor, SourceType } from '@shared/types/Source';
import * as channels from '@shared/constants/ipc-channels';

function App() {
  console.log('🚀 App component is rendering!');

  const currentSource = useViewerStore(state => state.currentSource);
  const isLoading = useViewerStore(state => state.isLoading);
  const error = useViewerStore(state => state.error);
  const isFullscreen = useViewerStore(state => state.isFullscreen);
  const setFullscreen = useViewerStore(state => state.setFullscreen);
  const showFolderTree = useViewerStore(state => state.showFolderTree);
  const recentSources = useViewerStore(state => state.recentSources);
  const setRecentSources = useViewerStore(state => state.setRecentSources);
  const { openArchive, openFolder, isOpening } = useArchive();
  const sidebarWidth = useViewerStore(state => state.sidebarWidth);
  const setSidebarWidth = useViewerStore(state => state.setSidebarWidth);
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
    const loadRecent = async () => {
      try {
        const result: any = await window.electronAPI.invoke(channels.RECENT_SOURCES_GET);
        if (result?.sources) {
          setRecentSources(result.sources as SourceDescriptor[]);
        }
      } catch (error) {
        console.error('Failed to load recent sources', error);
      }
    };

    loadRecent();
  }, [setRecentSources]);

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
          const statInfo = await window.electronAPI.invoke(channels.FS_STAT, { path: filePath });
          const isDirectory = (statInfo as any)?.isDirectory;
          if (isDirectory) {
            await openFolder(filePath);
          } else {
            await openArchive(filePath);
          }
        } catch (error) {
          console.error('Failed to open dropped item:', error);
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
          <div className="header-title">
            <div>
              <h1>MyViewer</h1>
              <p className="subtitle">Archive Image Viewer</p>
            </div>
            {recentSources.length > 0 && (
              <div className="recent-links">
                <span className="recent-label">Recent:</span>
                <div className="recent-link-list">
                  {recentSources.slice(0, 5).map((source) => (
                    <button
                      key={`${source.type}-${source.path}`}
                      className="recent-chip"
                      onClick={async () => {
                        if (source.type === SourceType.FOLDER) {
                          await openFolder(source.path);
                        } else {
                          await openArchive(source.path);
                        }
                      }}
                      title={source.path}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        window.electronAPI.invoke(channels.RECENT_SOURCES_REMOVE, source);
                        setRecentSources(recentSources.filter((item) => !(item.path === source.path && item.type === source.type)));
                      }}
                    >
                      {source.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        {currentSource && <NavigationBar className={isFullscreen ? 'floating' : ''} />}

        <main className={`app-main ${isFullscreen ? 'fullscreen' : ''}`}>
          <div className="viewer-layout">
            {showFolderTree && currentSource && (
              <>
                <FolderSidebar />
                <div
                  className="sidebar-resizer"
                  onMouseDown={(event) => {
                    const startX = event.clientX;
                    const startWidth = sidebarWidth;

                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const delta = moveEvent.clientX - startX;
                      setSidebarWidth(startWidth + delta);
                    };

                    const handleMouseUp = () => {
                      window.removeEventListener('mousemove', handleMouseMove);
                      window.removeEventListener('mouseup', handleMouseUp);
                    };

                    window.addEventListener('mousemove', handleMouseMove);
                    window.addEventListener('mouseup', handleMouseUp);
                  }}
                />
              </>
            )}
            <div className="viewer-content">
          {isOpening || isLoading ? (
            <LoadingIndicator message="Loading source..." />
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
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;

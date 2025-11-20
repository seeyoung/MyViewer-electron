import React, { useEffect, useState, useRef, useCallback } from 'react';
import ErrorBoundary from './components/shared/ErrorBoundary';
import NavigationBar from './components/viewer/NavigationBar';
import ImageViewer from './components/viewer/ImageViewer';
import FolderSidebar from './components/viewer/FolderSidebar';
import BottomThumbnails from './components/viewer/BottomThumbnails';
import LoadingIndicator from './components/shared/LoadingIndicator';
import { useViewerStore } from './store/viewerStore';
import { useArchive } from './hooks/useArchive';
import { useSlideshowPlayback } from './hooks/useSlideshowPlayback';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAutoSlide } from './hooks/useAutoSlide';
import { SourceDescriptor, SourceType } from '@shared/types/Source';
import * as channels from '@shared/constants/ipc-channels';
import SlideshowManagerPanel from './components/slideshow/SlideshowManagerPanel';
import { RECENT_SOURCE_MIME } from '@shared/constants/drag';

function App() {


  const currentSource = useViewerStore(state => state.currentSource);
  const isLoading = useViewerStore(state => state.isLoading);
  const error = useViewerStore(state => state.error);
  const isFullscreen = useViewerStore(state => state.isFullscreen);
  const setFullscreen = useViewerStore(state => state.setFullscreen);
  const showFolderTree = useViewerStore(state => state.showFolderTree);
  const recentSources = useViewerStore(state => state.recentSources);
  const setRecentSources = useViewerStore(state => state.setRecentSources);
  const removeRecentSource = useViewerStore(state => state.removeRecentSource);

  const { openArchive, openFolder, isOpening } = useArchive();
  useSlideshowPlayback();
  const sidebarWidth = useViewerStore(state => state.sidebarWidth);
  const setSidebarWidth = useViewerStore(state => state.setSidebarWidth);
  const thumbnailPosition = useViewerStore(state => state.thumbnailPosition);
  const setThumbnailPosition = useViewerStore(state => state.setThumbnailPosition);
  const sidebarTab = useViewerStore(state => state.sidebarTab);
  const setSidebarTab = useViewerStore(state => state.setSidebarTab);
  const showSlideshowManager = useViewerStore(state => state.showSlideshowManager);

  // State for floating toolbar visibility
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);
  const toolbarTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for resizing calculation
  const headerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Enable keyboard shortcuts

  useKeyboardShortcuts();
  useAutoSlide();

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
    if (thumbnailPosition === 'bottom' && sidebarTab !== 'folders') {
      setSidebarTab('folders');
    }
  }, [thumbnailPosition, sidebarTab, setSidebarTab]);

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

  // Handle mouse move for floating toolbar
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isFullscreen) return;

    const mouseY = e.clientY;
    const threshold = 50; // Show toolbar when mouse is within 50px of top

    if (mouseY < threshold) {
      setIsToolbarVisible(true);

      // Clear existing timeout
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current);
      }

      // Set timeout to hide toolbar after 2 seconds if mouse stays there (optional, but good UX)
      // Actually, usually we keep it visible as long as mouse is there.
      // But if mouse leaves the area, we hide it.
      // Let's just set a timeout to hide it if no movement happens for a while?
      // Or better: hide it when mouse leaves the threshold.

      // The original logic had a timeout to hide it after 2000ms even if mouse is there?
      // "Set timeout to hide toolbar after mouse leaves top area" - wait, the original logic set timeout inside the if block.
      // Let's replicate a simple behavior: show if < threshold, hide if > threshold with delay.

      // We'll use a timeout to auto-hide after some time if user is idle, or rely on mouse leave.
      // Let's keep it simple:
      // If in threshold, show.
      // If out of threshold, hide after delay.
    } else {
      // Mouse moved away from top area
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current);
      }
      toolbarTimeoutRef.current = setTimeout(() => {
        setIsToolbarVisible(false);
      }, 500);
    }
  }, [isFullscreen]);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current);
      }
    };
  }, []);

  return (
    <ErrorBoundary>
      <div
        className={`app ${isFullscreen ? 'fullscreen' : ''}`}
        onMouseMove={handleMouseMove}
      >
        <header
          ref={headerRef}
          className={`app-header ${isFullscreen ? 'hidden' : ''}`}
        >
          <div className="header-title">
            <div>
              <h1>MyViewer</h1>
              <p className="subtitle">Archive Image Viewer</p>
            </div>
            <div className="recent-links">
              {recentSources.length > 0 && (
                <>
                  <span className="recent-label">Recent:</span>
                  <div className="recent-link-list">
                    {recentSources.slice(0, 5).map((source) => (
                      <button
                        key={`${source.type}-${source.path}`}
                        className="recent-chip"
                        draggable
                        onDragStart={(event) => {
                          try {
                            event.dataTransfer?.setData(RECENT_SOURCE_MIME, JSON.stringify(source));
                            if (event.dataTransfer) {
                              event.dataTransfer.effectAllowed = 'copy';
                            }
                          } catch (error) {
                            console.error('Failed to attach drag data', error);
                          }
                        }}
                        onClick={async () => {
                          try {
                            if (source.type === SourceType.FOLDER) {
                              await openFolder(source.path);
                            } else {
                              await openArchive(source.path);
                            }
                          } catch (error) {
                            console.warn('Failed to open recent source:', error);
                          }
                        }}
                        title={source.path}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          window.electronAPI.invoke(channels.RECENT_SOURCES_REMOVE, source);
                          setRecentSources(
                            recentSources.filter((item) => !(item.path === source.path && item.type === source.type))
                          );
                        }}
                      >
                        {source.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="thumbnail-position">
                <label>
                  <input
                    type="radio"
                    name="thumbnail-position"
                    value="sidebar"
                    checked={thumbnailPosition === 'sidebar'}
                    onChange={() => setThumbnailPosition('sidebar')}
                  />
                  Sidebar
                </label>
                <label>
                  <input
                    type="radio"
                    name="thumbnail-position"
                    value="bottom"
                    checked={thumbnailPosition === 'bottom'}
                    onChange={() => setThumbnailPosition('bottom')}
                  />
                  Bottom
                </label>
              </div>
            </div>
          </div>
        </header>

        {currentSource && (
          <div ref={navRef} style={{ width: '100%', position: isFullscreen ? 'fixed' : 'relative', zIndex: 100, top: 0 }}>
            <NavigationBar className={`${isFullscreen ? 'floating' : ''} ${isToolbarVisible ? 'visible' : ''}`} />
          </div>
        )}

        <main className={`app-main ${isFullscreen ? 'fullscreen' : ''}`}>
          <div className={`viewer-layout ${showSlideshowManager ? 'with-slideshow' : ''}`}>
            <div className="viewer-main">
              <div className="viewer-body">
                {showFolderTree && currentSource && (
                  <div className="sidebar-wrapper">
                    <FolderSidebar />
                    <div
                      className="sidebar-resizer"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        const startX = event.clientX;
                        const startWidth = sidebarWidth;

                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const delta = moveEvent.clientX - startX;
                          setSidebarWidth(startWidth + delta);
                        };

                        const handleMouseUp = () => {
                          window.removeEventListener('mousemove', handleMouseMove);
                          window.removeEventListener('mouseup', handleMouseUp);
                          document.body.style.userSelect = '';
                        };

                        document.body.style.userSelect = 'none';
                        window.addEventListener('mousemove', handleMouseMove);
                        window.addEventListener('mouseup', handleMouseUp);
                      }}
                    />
                  </div>
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
                    <ImageViewer />
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
              {thumbnailPosition === 'bottom' && currentSource && (
                <BottomThumbnails />
              )}
            </div>
            {showSlideshowManager && (
              <aside className="slideshow-side-panel">
                <SlideshowManagerPanel />
              </aside>
            )}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;


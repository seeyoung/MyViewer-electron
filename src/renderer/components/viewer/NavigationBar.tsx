import React from 'react';
import { useViewerStore } from '../../store/viewerStore';
import { useImageNavigation } from '../../hooks/useImageNavigation';
import { FitMode } from '@shared/types/ViewingSession';
import { SourceType } from '@shared/types/Source';

interface NavigationBarProps {
  className?: string;
}

const NavigationBar: React.FC<NavigationBarProps> = ({ className }) => {
  const currentPageIndex = useViewerStore(state => state.currentPageIndex);
  const images = useViewerStore(state => state.images);
  const currentSource = useViewerStore(state => state.currentSource);
  const zoomLevel = useViewerStore(state => state.zoomLevel);
  const setZoomLevel = useViewerStore(state => state.setZoomLevel);
  const fitMode = useViewerStore(state => state.fitMode);
  const setFitMode = useViewerStore(state => state.setFitMode);
  const isFullscreen = useViewerStore(state => state.isFullscreen);
  const showFolderTree = useViewerStore(state => state.showFolderTree);
  const toggleFolderTree = useViewerStore(state => state.toggleFolderTree);
  const autoSlideEnabled = useViewerStore(state => state.autoSlideEnabled);
  const autoSlideInterval = useViewerStore(state => state.autoSlideInterval);
  const setAutoSlideEnabled = useViewerStore(state => state.setAutoSlideEnabled);
  const setAutoSlideInterval = useViewerStore(state => state.setAutoSlideInterval);
  const autoSlideOverlay = useViewerStore(state => state.autoSlideIntervalOverlay);
  const showAutoSlideOverlay = useViewerStore(state => state.showAutoSlideOverlay);

  const totalPages = images.length;
  const currentPage = currentPageIndex + 1; // Display 1-based index

  const { goToNext, goToPrevious } = useImageNavigation();

  const handlePrevious = () => {
    goToPrevious();
  };

  const handleNext = () => {
    goToNext();
  };

  const handleZoomIn = () => {
    setZoomLevel(zoomLevel * 1.2);
  };

  const handleZoomOut = () => {
    setZoomLevel(zoomLevel / 1.2);
  };

  const handleResetZoom = () => {
    setZoomLevel(1.0);
    setFitMode(FitMode.CUSTOM);
  };

  const handleActualSize = () => {
    setFitMode(FitMode.ACTUAL_SIZE);
  };

  const handleFitWidth = () => {
    setFitMode(FitMode.FIT_WIDTH);
  };

  const handleFitHeight = () => {
    setFitMode(FitMode.FIT_HEIGHT);
  };

  const handleToggleAppFullscreen = () => {
    window.electronAPI.send('window-toggle-fullscreen');
  };

  const handleToggleAutoSlide = () => {
    setAutoSlideEnabled(!autoSlideEnabled);
  };

  const handleAutoSlideIntervalChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Number(event.target.value);
    setAutoSlideInterval(value);
    showAutoSlideOverlay(value);
  };

  if (!currentSource) {
    return null;
  }

  const navigationClasses = ['navigation-bar', className].filter(Boolean).join(' ');

  return (
    <div className={navigationClasses}>
      {autoSlideOverlay.visible && (
        <div className="autoslide-overlay">
          Auto Slide: {(autoSlideOverlay.value / 1000).toFixed(0)}s
        </div>
      )}
      <div className="navigation-info">
        <span className="source-badge">{currentSource.type === SourceType.FOLDER ? 'Folder' : 'Archive'}</span>
        <span className="archive-name">{currentSource.label}</span>
        {totalPages > 0 && (
          <span className="page-counter">
            {currentPage} / {totalPages}
          </span>
        )}
      </div>

      <div className="navigation-controls">
        <button
          onClick={handlePrevious}
          disabled={currentPageIndex === 0}
          className="nav-button"
        >
          ← Previous
        </button>

        <button
          onClick={handleNext}
          disabled={currentPageIndex >= totalPages - 1}
          className="nav-button"
        >
          Next →
        </button>

        <div className="zoom-controls">
          <button
            onClick={handleZoomOut}
            className="zoom-button"
            title="Zoom Out (Ctrl + -)"
          >
            −
          </button>
          
          <span className="zoom-level">
            {fitMode !== FitMode.CUSTOM ? 'Auto' : Math.round(zoomLevel * 100) + '%'}
          </span>
          
          <button
            onClick={handleZoomIn}
            className="zoom-button"
            title="Zoom In (Ctrl + +)"
          >
            +
          </button>
          
          <button
            onClick={handleResetZoom}
            className="zoom-button reset"
            title="Reset Zoom (Ctrl + 0)"
          >
            1:1
          </button>
        </div>

        <div className="fit-controls">
          <button
            onClick={handleActualSize}
            className={`fit-button ${fitMode === FitMode.ACTUAL_SIZE ? 'active' : ''}`}
            title="Actual Size"
          >
            🔍
          </button>
          
          <button
            onClick={handleFitWidth}
            className={`fit-button ${fitMode === FitMode.FIT_WIDTH ? 'active' : ''}`}
            title="Fit Width"
          >
            ↔
          </button>
          
          <button
            onClick={handleFitHeight}
            className={`fit-button ${fitMode === FitMode.FIT_HEIGHT ? 'active' : ''}`}
            title="Fit Height"
          >
            ↕
          </button>
        </div>

        <div className="fullscreen-controls">
          <div className="autoslide-controls">
            <button
              onClick={handleToggleAutoSlide}
              className={`panel-button ${autoSlideEnabled ? 'active' : ''}`}
              title="Toggle auto slide"
            >
              {autoSlideEnabled ? 'Stop Auto Slide' : 'Start Auto Slide'}
            </button>
            <select
              value={autoSlideInterval}
              onChange={handleAutoSlideIntervalChange}
            >
              {[2000, 3000, 5000, 8000, 10000].map(value => (
                <option key={value} value={value}>
                  {value / 1000}s
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={toggleFolderTree}
            className={`panel-button ${showFolderTree ? 'active' : ''}`}
            title="Toggle Folder Sidebar"
          >
            {showFolderTree ? 'Hide Folders' : 'Show Folders'}
          </button>

          <button
            onClick={handleToggleAppFullscreen}
            className={`fullscreen-button ${isFullscreen ? 'active' : ''}`}
            title="Toggle Fullscreen (Enter / F11)"
          >
            {isFullscreen ? 'Exit Fullscreen' : 'Image Fullscreen'}
          </button>
        </div>
      </div>

      <style>{`
        .navigation-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background-color: #2d2d2d;
          border-bottom: 1px solid #3d3d3d;
          position: relative;
        }

        .navigation-info {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .source-badge {
          padding: 0.15rem 0.4rem;
          background-color: #444;
          border-radius: 4px;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #ddd;
        }

        .archive-name {
          font-weight: 600;
          color: #fff;
        }

        .page-counter {
          color: #999;
          font-size: 0.875rem;
        }

        .navigation-controls {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .nav-button {
          padding: 0.5rem 1rem;
          background-color: #3d3d3d;
          color: #fff;
          border: 1px solid #4d4d4d;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1.3125rem;
          transition: background-color 0.2s;
        }

        .nav-button:hover:not(:disabled) {
          background-color: #4d4d4d;
        }

        .nav-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .zoom-controls {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0 0.5rem;
          border-left: 1px solid #4d4d4d;
        }

        .zoom-button {
          padding: 0.25rem 0.5rem;
          background-color: #3d3d3d;
          color: #fff;
          border: 1px solid #4d4d4d;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1.3125rem;
          min-width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s;
        }

        .zoom-button:hover {
          background-color: #4d4d4d;
        }

        .zoom-button.reset {
          font-size: 1.125rem;
          min-width: 32px;
        }

        .zoom-level {
          color: #ccc;
          font-size: 0.75rem;
          min-width: 40px;
          text-align: center;
          padding: 0 0.25rem;
        }

        .fit-controls {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0 0.5rem;
          border-left: 1px solid #4d4d4d;
        }

        .fit-button {
          padding: 0.25rem 0.5rem;
          background-color: #3d3d3d;
          color: #fff;
          border: 1px solid #4d4d4d;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1.3125rem;
          min-width: 32px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .fit-button:hover {
          background-color: #4d4d4d;
        }

        .fit-button.active {
          background-color: #007acc;
          border-color: #007acc;
          box-shadow: 0 0 0 1px rgba(0, 122, 204, 0.3);
        }

        .fullscreen-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-left: 0.5rem;
          border-left: 1px solid #4d4d4d;
        }

        .autoslide-controls {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .autoslide-controls select {
          background: #1f1f1f;
          color: #ddd;
          border: 1px solid #555;
          border-radius: 4px;
          padding: 0.2rem 0.4rem;
        }

        .autoslide-overlay {
          position: absolute;
          top: -1.75rem;
          right: 1rem;
          background: rgba(0, 0, 0, 0.8);
          color: #fff;
          padding: 0.2rem 0.6rem;
          border-radius: 4px;
          font-size: 0.75rem;
          box-shadow: 0 0 6px rgba(0,0,0,0.4);
        }

        .fullscreen-button {
          padding: 0.4rem 0.75rem;
          background-color: #3d3d3d;
          color: #fff;
          border: 1px solid #4d4d4d;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1.2rem;
          min-width: 120px;
          transition: background-color 0.2s, border-color 0.2s;
        }

        .fullscreen-button:hover {
          background-color: #4d4d4d;
        }

        .fullscreen-button.active {
          background-color: #007acc;
          border-color: #007acc;
        }

        .panel-button {
          padding: 0.4rem 0.75rem;
          background-color: #3d3d3d;
          color: #fff;
          border: 1px solid #4d4d4d;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1.2rem;
          min-width: 120px;
          transition: background-color 0.2s, border-color 0.2s;
        }

        .panel-button.active {
          background-color: #555;
        }
      `}</style>
    </div>
  );
};

export default NavigationBar;

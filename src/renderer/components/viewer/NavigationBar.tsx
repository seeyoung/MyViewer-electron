import React from 'react';
import { useViewerStore } from '../../store/viewerStore';
import { useImageNavigation } from '../../hooks/useImageNavigation';
import { FitMode } from '@shared/types/ViewingSession';

interface NavigationBarProps {
  className?: string;
}

const NavigationBar: React.FC<NavigationBarProps> = ({ className }) => {
  const currentPageIndex = useViewerStore(state => state.currentPageIndex);
  const images = useViewerStore(state => state.images);
  const currentArchive = useViewerStore(state => state.currentArchive);
  const zoomLevel = useViewerStore(state => state.zoomLevel);
  const setZoomLevel = useViewerStore(state => state.setZoomLevel);
  const fitMode = useViewerStore(state => state.fitMode);
  const setFitMode = useViewerStore(state => state.setFitMode);
  const isFullscreen = useViewerStore(state => state.isFullscreen);
  const isImageFullscreen = useViewerStore(state => state.isImageFullscreen);
  const setImageFullscreen = useViewerStore(state => state.setImageFullscreen);

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

  const handleToggleImageFullscreen = () => {
    setImageFullscreen(!isImageFullscreen);
  };

  if (!currentArchive) {
    return null;
  }

  const navigationClasses = ['navigation-bar', className].filter(Boolean).join(' ');

  return (
    <div className={navigationClasses}>
      <div className="navigation-info">
        <span className="archive-name">{currentArchive.fileName}</span>
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
          <button
            onClick={handleToggleAppFullscreen}
            className={`fullscreen-button ${isFullscreen ? 'active' : ''}`}
            title="Toggle App Fullscreen (F11)"
          >
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>

          <button
            onClick={handleToggleImageFullscreen}
            className={`fullscreen-button ${isImageFullscreen ? 'active' : ''}`}
            title="Toggle Image Fullscreen (Enter)"
          >
            {isImageFullscreen ? 'Exit Image View' : 'Image Fullscreen'}
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
        }

        .navigation-info {
          display: flex;
          gap: 1rem;
          align-items: center;
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
          font-size: 0.875rem;
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
          font-size: 0.875rem;
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
          font-size: 0.75rem;
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
          font-size: 0.875rem;
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

        .fullscreen-button {
          padding: 0.4rem 0.75rem;
          background-color: #3d3d3d;
          color: #fff;
          border: 1px solid #4d4d4d;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
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
      `}</style>
    </div>
  );
};

export default NavigationBar;

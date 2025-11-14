import React from 'react';
import { useViewerStore } from '../../store/viewerStore';

const PlaylistControls: React.FC = () => {
  const isPlaylistMode = useViewerStore(state => state.isPlaylistMode);
  const autoAdvanceToNextEntry = useViewerStore(state => state.autoAdvanceToNextEntry);
  const playlistLoopMode = useViewerStore(state => state.playlistLoopMode);
  const togglePlaylistMode = useViewerStore(state => state.togglePlaylistMode);
  const toggleAutoAdvance = useViewerStore(state => state.toggleAutoAdvance);
  const setPlaylistLoopMode = useViewerStore(state => state.setPlaylistLoopMode);
  const goToNextEntry = useViewerStore(state => state.goToNextEntry);
  const goToPrevEntry = useViewerStore(state => state.goToPrevEntry);
  const playlistEntries = useViewerStore(state => state.playlistEntries);
  const currentEntryIndex = useViewerStore(state => state.currentEntryIndex);

  const handlePrevEntry = async () => {
    await goToPrevEntry();
  };

  const handleNextEntry = async () => {
    await goToNextEntry();
  };

  const hasEntries = playlistEntries.length > 0;
  const hasPrev = currentEntryIndex > 0 || (playlistLoopMode === 'playlist' && hasEntries);
  const hasNext = currentEntryIndex < playlistEntries.length - 1 || (playlistLoopMode === 'playlist' && hasEntries);

  return (
    <div className="playlist-controls">
      <div className="control-section">
        <label className="control-label">Playback Mode</label>
        <button
          className={`control-button ${isPlaylistMode ? 'active' : ''}`}
          onClick={togglePlaylistMode}
          title={isPlaylistMode ? 'Disable playlist mode' : 'Enable playlist mode'}
        >
          {isPlaylistMode ? '⏸ Pause' : '▶ Play'}
        </button>
      </div>

      <div className="control-section">
        <label className="control-label">Auto-Advance</label>
        <button
          className={`control-button ${autoAdvanceToNextEntry ? 'active' : ''}`}
          onClick={toggleAutoAdvance}
          title={autoAdvanceToNextEntry ? 'Disable auto-advance' : 'Enable auto-advance'}
        >
          {autoAdvanceToNextEntry ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="control-section">
        <label className="control-label">Loop Mode</label>
        <select
          value={playlistLoopMode}
          onChange={(e) => setPlaylistLoopMode(e.target.value as 'none' | 'playlist' | 'entry')}
          className="loop-select"
        >
          <option value="none">No Loop</option>
          <option value="playlist">Loop Playlist</option>
          <option value="entry">Loop Entry</option>
        </select>
      </div>

      <div className="control-section navigation">
        <button
          className="nav-button"
          onClick={handlePrevEntry}
          disabled={!hasPrev || !hasEntries}
          title="Previous entry"
        >
          ⏮ Previous
        </button>
        <span className="entry-counter">
          {hasEntries ? `${currentEntryIndex + 1} / ${playlistEntries.length}` : '0 / 0'}
        </span>
        <button
          className="nav-button"
          onClick={handleNextEntry}
          disabled={!hasNext || !hasEntries}
          title="Next entry"
        >
          Next ⏭
        </button>
      </div>

      <style>{`
        .playlist-controls {
          padding: 1rem;
          border-bottom: 1px solid #3d3d3d;
          background-color: #252525;
        }

        .control-section {
          margin-bottom: 1rem;
        }

        .control-section:last-child {
          margin-bottom: 0;
        }

        .control-label {
          display: block;
          font-size: 0.75rem;
          color: #888888;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .control-button {
          width: 100%;
          padding: 0.5rem;
          background-color: #1d1d1d;
          border: 1px solid #3d3d3d;
          border-radius: 4px;
          color: #ffffff;
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s;
        }

        .control-button:hover:not(:disabled) {
          background-color: #3d3d3d;
        }

        .control-button.active {
          background-color: #4a9eff;
          border-color: #4a9eff;
          color: #ffffff;
        }

        .control-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loop-select {
          width: 100%;
          padding: 0.5rem;
          background-color: #1d1d1d;
          border: 1px solid #3d3d3d;
          border-radius: 4px;
          color: #ffffff;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .loop-select:hover {
          background-color: #3d3d3d;
        }

        .control-section.navigation {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .nav-button {
          flex: 1;
          padding: 0.5rem;
          background-color: #1d1d1d;
          border: 1px solid #3d3d3d;
          border-radius: 4px;
          color: #ffffff;
          cursor: pointer;
          font-size: 0.75rem;
        }

        .nav-button:hover:not(:disabled) {
          background-color: #3d3d3d;
        }

        .nav-button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .entry-counter {
          font-size: 0.75rem;
          color: #888888;
          white-space: nowrap;
          min-width: 60px;
          text-align: center;
        }
      `}</style>
    </div>
  );
};

export default PlaylistControls;

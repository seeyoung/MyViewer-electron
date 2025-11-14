import React, { useState, useEffect } from 'react';
import { useViewerStore } from '../../store/viewerStore';
import { Playlist } from '@shared/types/playlist';
import PlaylistControls from './PlaylistControls';
import PlaylistEntry from './PlaylistEntry';
import * as channels from '@shared/constants/ipc-channels';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface PlaylistPanelProps {
  className?: string;
}

const PlaylistPanel: React.FC<PlaylistPanelProps> = ({ className }) => {
  const showPlaylistPanel = useViewerStore(state => state.showPlaylistPanel);
  const togglePlaylistPanel = useViewerStore(state => state.togglePlaylistPanel);
  const playlists = useViewerStore(state => state.playlists);
  const activePlaylist = useViewerStore(state => state.activePlaylist);
  const playlistEntries = useViewerStore(state => state.playlistEntries);
  const currentEntryIndex = useViewerStore(state => state.currentEntryIndex);
  const isPlaylistMode = useViewerStore(state => state.isPlaylistMode);
  const autoAdvanceToNextEntry = useViewerStore(state => state.autoAdvanceToNextEntry);
  const playlistLoopMode = useViewerStore(state => state.playlistLoopMode);
  const setPlaylists = useViewerStore(state => state.setPlaylists);
  const setActivePlaylist = useViewerStore(state => state.setActivePlaylist);
  const setPlaylistEntries = useViewerStore(state => state.setPlaylistEntries);
  const setCurrentEntryIndex = useViewerStore(state => state.setCurrentEntryIndex);
  const togglePlaylistMode = useViewerStore(state => state.togglePlaylistMode);
  const toggleAutoAdvance = useViewerStore(state => state.toggleAutoAdvance);
  const setPlaylistLoopMode = useViewerStore(state => state.setPlaylistLoopMode);
  const goToEntryByIndex = useViewerStore(state => state.goToEntryByIndex);

  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [entryValidityMap, setEntryValidityMap] = useState<Map<number, boolean>>(new Map());

  // @dnd-kit sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load playlists on mount and restore state
  useEffect(() => {
    loadPlaylists();
    restorePlaybackState();
  }, []);

  // Restore full playback state from DB after playlists are loaded
  const restorePlaybackState = async () => {
    try {
      const state = await window.electronAPI.invoke(channels.PLAYLIST_GET_PLAYBACK_STATE);
      if (!state) return;

      // Restore active playlist
      if (state.activePlaylistId && playlists.length > 0) {
        const playlist = playlists.find(p => p.id === state.activePlaylistId);
        if (playlist) {
          setActivePlaylist(playlist);
        }
      }

      // Restore current entry index
      if (state.currentEntryIndex !== undefined && state.currentEntryIndex >= 0) {
        setCurrentEntryIndex(state.currentEntryIndex);
      }

      // Restore playlist mode
      if (state.isPlaying !== undefined && state.isPlaying !== isPlaylistMode) {
        togglePlaylistMode();
      }

      // Restore auto-advance setting
      if (state.autoAdvanceToNextEntry !== undefined && state.autoAdvanceToNextEntry !== autoAdvanceToNextEntry) {
        toggleAutoAdvance();
      }

      // Restore loop mode
      if (state.loopMode) {
        setPlaylistLoopMode(state.loopMode);
      }
    } catch (error) {
      console.error('Failed to restore playback state:', error);
    }
  };

  // Re-restore when playlists are loaded
  useEffect(() => {
    if (playlists.length > 0 && !activePlaylist) {
      restorePlaybackState();
    }
  }, [playlists.length]);

  // Load entries when active playlist changes
  useEffect(() => {
    if (activePlaylist) {
      loadPlaylistEntries(activePlaylist.id);
      // Save active playlist ID to DB
      savePlaybackState();
    } else {
      setPlaylistEntries([]);
      // Clear saved playlist ID
      savePlaybackState();
    }
  }, [activePlaylist?.id]);

  // Save playback state whenever it changes
  useEffect(() => {
    if (playlists.length > 0) {
      savePlaybackState();
    }
  }, [currentEntryIndex, isPlaylistMode, autoAdvanceToNextEntry, playlistLoopMode]);

  const savePlaybackState = async () => {
    try {
      await window.electronAPI.invoke(channels.PLAYLIST_UPDATE_PLAYBACK_STATE, {
        activePlaylistId: activePlaylist?.id || null,
        currentEntryIndex: currentEntryIndex,
        isPlaying: isPlaylistMode,
        autoAdvanceToNextEntry: autoAdvanceToNextEntry,
        loopMode: playlistLoopMode,
      });
    } catch (error) {
      console.error('Failed to save playback state:', error);
    }
  };

  const loadPlaylists = async () => {
    try {
      const result = await window.electronAPI.invoke(channels.PLAYLIST_GET_ALL);
      setPlaylists(result || []);
    } catch (error) {
      console.error('Failed to load playlists:', error);
    }
  };

  const loadPlaylistEntries = async (playlistId: string) => {
    try {
      const result = await window.electronAPI.invoke(channels.PLAYLIST_GET_BY_ID, { id: playlistId });
      if (result?.entries) {
        setPlaylistEntries(result.entries);

        // Validate all entries
        const validityMap = new Map<number, boolean>();
        const validationPromises = result.entries.map(async (entry: any) => {
          try {
            const validationResult = await window.electronAPI.invoke(channels.PLAYLIST_VALIDATE_ENTRY, { entry });
            validityMap.set(entry.position, validationResult.isValid);
          } catch (error) {
            console.warn(`Failed to validate entry at position ${entry.position}:`, error);
            validityMap.set(entry.position, false);
          }
        });

        await Promise.all(validationPromises);
        setEntryValidityMap(validityMap);
      }
    } catch (error) {
      console.error('Failed to load playlist entries:', error);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;

    try {
      const result = await window.electronAPI.invoke(channels.PLAYLIST_CREATE, {
        name: newPlaylistName.trim(),
        description: '',
      });

      await loadPlaylists();
      setActivePlaylist(result);
      setNewPlaylistName('');
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create playlist:', error);
      alert('Failed to create playlist: ' + (error as Error).message);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!activePlaylist) return;

    const confirmed = confirm(`Delete playlist "${activePlaylist.name}"?`);
    if (!confirmed) return;

    try {
      await window.electronAPI.invoke(channels.PLAYLIST_DELETE, { id: activePlaylist.id });
      setActivePlaylist(null);
      await loadPlaylists();
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      alert('Failed to delete playlist: ' + (error as Error).message);
    }
  };

  const handleStartEdit = () => {
    if (!activePlaylist) return;
    setEditingName(activePlaylist.name);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!activePlaylist || !editingName.trim()) return;

    try {
      await window.electronAPI.invoke(channels.PLAYLIST_UPDATE, {
        id: activePlaylist.id,
        name: editingName.trim(),
      });
      await loadPlaylists();
      // Update active playlist reference
      const updated = playlists.find(p => p.id === activePlaylist.id);
      if (updated) {
        setActivePlaylist(updated);
      }
      setIsEditing(false);
      setEditingName('');
    } catch (error) {
      console.error('Failed to update playlist:', error);
      alert('Failed to update playlist: ' + (error as Error).message);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingName('');
  };

  const handlePlaylistSelect = (playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    setActivePlaylist(playlist || null);
  };

  const handleCleanupInvalidEntries = async () => {
    if (!activePlaylist) return;

    const confirmed = confirm(
      'This will remove all entries that point to non-existent or inaccessible files/folders. Continue?'
    );
    if (!confirmed) return;

    try {
      const result = await window.electronAPI.invoke(channels.PLAYLIST_CLEANUP_INVALID, {
        playlistId: activePlaylist.id,
      });

      const removedCount = result.removedCount || 0;
      if (removedCount > 0) {
        alert(`Removed ${removedCount} invalid ${removedCount === 1 ? 'entry' : 'entries'}`);
        await loadPlaylistEntries(activePlaylist.id);
      } else {
        alert('No invalid entries found');
      }
    } catch (error) {
      console.error('Failed to cleanup invalid entries:', error);
      alert('Failed to cleanup invalid entries: ' + (error as Error).message);
    }
  };

  const handleClearAllEntries = async () => {
    if (!activePlaylist || playlistEntries.length === 0) return;

    const confirmed = confirm(
      `Remove all ${playlistEntries.length} ${playlistEntries.length === 1 ? 'entry' : 'entries'} from "${activePlaylist.name}"?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      // Remove all entries starting from the end to avoid position shifting issues
      for (let i = playlistEntries.length - 1; i >= 0; i--) {
        await window.electronAPI.invoke(channels.PLAYLIST_REMOVE_ENTRY, {
          playlistId: activePlaylist.id,
          position: i,
        });
      }
      await loadPlaylistEntries(activePlaylist.id);
      alert('All entries have been removed.');
    } catch (error) {
      console.error('Failed to clear all entries:', error);
      alert('Failed to clear all entries: ' + (error as Error).message);
    }
  };

  const handleRemoveEntry = async (position: number) => {
    if (!activePlaylist) return;

    // Find the entry to get its label for confirmation
    const entry = playlistEntries.find(e => e.position === position);
    if (!entry) return;

    const confirmed = confirm(
      `Remove "${entry.label}" from playlist?\n\nPath: ${entry.source_path}`
    );
    if (!confirmed) return;

    try {
      await window.electronAPI.invoke(channels.PLAYLIST_REMOVE_ENTRY, {
        playlistId: activePlaylist.id,
        position,
      });
      await loadPlaylistEntries(activePlaylist.id);
    } catch (error) {
      console.error('Failed to remove entry:', error);
      alert('Failed to remove entry: ' + (error as Error).message);
    }
  };

  const handleUpdateEntryLabel = async (position: number, newLabel: string) => {
    if (!activePlaylist) return;

    try {
      await window.electronAPI.invoke(channels.PLAYLIST_UPDATE_ENTRY, {
        playlistId: activePlaylist.id,
        position,
        updates: { label: newLabel },
      });
      await loadPlaylistEntries(activePlaylist.id);
    } catch (error) {
      console.error('Failed to update entry label:', error);
      alert('Failed to update entry label: ' + (error as Error).message);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!activePlaylist) {
      alert('Please select or create a playlist first');
      return;
    }

    let paths: string[] = [];

    // Check for internal drag (source path from recent sources or folder sidebar)
    const sourcePath = e.dataTransfer.getData('application/x-source-path');
    if (sourcePath) {
      paths = [sourcePath];
    } else {
      // External file drop
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      paths = Array.from(files).map(f => f.path);
    }

    if (paths.length === 0) return;

    try {
      // First try without allowing duplicates
      const result = await window.electronAPI.invoke(channels.PLAYLIST_ADD_ENTRIES_BATCH, {
        playlistId: activePlaylist.id,
        sourcePaths: paths,
        allowDuplicates: false,
      });

      await loadPlaylistEntries(activePlaylist.id);

      // Show summary if any paths were skipped
      const { skipped } = result;

      // If there are duplicates, ask user if they want to add anyway
      if (skipped.duplicate.length > 0) {
        const duplicateCount = skipped.duplicate.length;
        const confirmed = confirm(
          `${duplicateCount} ${duplicateCount === 1 ? 'path already exists' : 'paths already exist'} in this playlist.\n\nAdd ${duplicateCount === 1 ? 'it' : 'them'} anyway?`
        );

        if (confirmed) {
          // Retry with allowDuplicates=true for only the duplicate paths
          const retryResult = await window.electronAPI.invoke(channels.PLAYLIST_ADD_ENTRIES_BATCH, {
            playlistId: activePlaylist.id,
            sourcePaths: skipped.duplicate,
            allowDuplicates: true,
          });
          await loadPlaylistEntries(activePlaylist.id);
          alert(`Added ${retryResult.entries.length} duplicate ${retryResult.entries.length === 1 ? 'entry' : 'entries'}.`);
        }
      }

      // Show summary for initially added and invalid
      const messages: string[] = [];

      if (result.entries.length > 0) {
        messages.push(`Added ${result.entries.length} ${result.entries.length === 1 ? 'entry' : 'entries'}`);
      }

      if (skipped.invalid.length > 0) {
        messages.push(`${skipped.invalid.length} invalid ${skipped.invalid.length === 1 ? 'path was' : 'paths were'} skipped`);
      }

      if (messages.length > 0 && result.entries.length > 0) {
        alert(messages.join('.\n'));
      }
    } catch (error) {
      console.error('Failed to add entries:', error);
      alert('Failed to add entries: ' + (error as Error).message);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleEntryClick = (position: number) => {
    goToEntryByIndex(position);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !activePlaylist) return;

    const oldIndex = playlistEntries.findIndex(e => e.position === Number(active.id));
    const newIndex = playlistEntries.findIndex(e => e.position === Number(over.id));

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    try {
      await window.electronAPI.invoke(channels.PLAYLIST_REORDER_ENTRIES, {
        playlistId: activePlaylist.id,
        fromPosition: oldIndex,
        toPosition: newIndex,
      });
      await loadPlaylistEntries(activePlaylist.id);
    } catch (error) {
      console.error('Failed to reorder entries:', error);
      alert('Failed to reorder entries: ' + (error as Error).message);
    }
  };

  const panelClasses = ['playlist-panel', className, showPlaylistPanel ? 'open' : ''].filter(Boolean).join(' ');

  return (
    <>
      {showPlaylistPanel && <div className="playlist-backdrop" onClick={togglePlaylistPanel} />}
      <div className={panelClasses}>
        <div className="playlist-header">
          <h2>Playlists</h2>
          <button
            className="close-button"
            onClick={togglePlaylistPanel}
            title="Close playlist panel"
          >
            ✕
          </button>
        </div>

        <div className="playlist-selector">
          <select
            value={activePlaylist?.id || ''}
            onChange={(e) => handlePlaylistSelect(e.target.value)}
            disabled={isCreating}
          >
            <option value="">Select a playlist...</option>
            {playlists.map(playlist => (
              <option key={playlist.id} value={playlist.id}>
                {playlist.name}
              </option>
            ))}
          </select>

          <div className="playlist-actions">
            <button
              className="action-button create"
              onClick={() => setIsCreating(!isCreating)}
              title="Create new playlist"
              disabled={isEditing}
            >
              {isCreating ? 'Cancel' : '+ New'}
            </button>
            {activePlaylist && (
              <>
                <button
                  className="action-button edit"
                  onClick={isEditing ? handleCancelEdit : handleStartEdit}
                  title={isEditing ? "Cancel editing" : "Edit playlist name"}
                  disabled={isCreating}
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
                <button
                  className="action-button delete"
                  onClick={handleDeletePlaylist}
                  title="Delete current playlist"
                  disabled={isCreating || isEditing}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {isCreating && (
          <div className="playlist-create-form">
            <input
              type="text"
              placeholder="Playlist name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreatePlaylist();
                if (e.key === 'Escape') setIsCreating(false);
              }}
              autoFocus
            />
            <button onClick={handleCreatePlaylist} disabled={!newPlaylistName.trim()}>
              Create
            </button>
          </div>
        )}

        {isEditing && activePlaylist && (
          <div className="playlist-edit-form">
            <input
              type="text"
              placeholder="Playlist name"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              autoFocus
            />
            <button onClick={handleSaveEdit} disabled={!editingName.trim()}>
              Save
            </button>
          </div>
        )}

        {activePlaylist && (
          <PlaylistControls
            onCleanupInvalid={handleCleanupInvalidEntries}
            onClearAll={handleClearAllEntries}
          />
        )}

        <div
          className={`playlist-drop-zone ${isDragOver ? 'drag-over' : ''} ${!activePlaylist ? 'disabled' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {!activePlaylist ? (
            <p>Select or create a playlist to add entries</p>
          ) : playlistEntries.length === 0 ? (
            <p>Drop files or folders here to add to playlist</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={playlistEntries.map(e => e.position)}
                strategy={verticalListSortingStrategy}
              >
                <div className="playlist-entry-list">
                  {playlistEntries.map((entry, index) => (
                    <PlaylistEntry
                      key={entry.position}
                      entry={entry}
                      isActive={index === currentEntryIndex}
                      isValid={entryValidityMap.get(entry.position) ?? true}
                      onClick={() => handleEntryClick(entry.position)}
                      onRemove={() => handleRemoveEntry(entry.position)}
                      onUpdateLabel={handleUpdateEntryLabel}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <style>{`
          .playlist-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 99;
          }

          .playlist-panel {
            position: fixed;
            top: 0;
            right: 0;
            width: 320px;
            height: 100vh;
            background-color: #2d2d2d;
            border-left: 1px solid #3d3d3d;
            z-index: 100;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .playlist-panel.open {
            transform: translateX(0);
          }

          .playlist-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            border-bottom: 1px solid #3d3d3d;
          }

          .playlist-header h2 {
            margin: 0;
            font-size: 1.25rem;
            color: #ffffff;
          }

          .close-button {
            background: none;
            border: none;
            color: #cccccc;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .close-button:hover {
            color: #ffffff;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
          }

          .playlist-selector {
            padding: 1rem;
            border-bottom: 1px solid #3d3d3d;
          }

          .playlist-selector select {
            width: 100%;
            padding: 0.5rem;
            background-color: #1d1d1d;
            border: 1px solid #3d3d3d;
            border-radius: 4px;
            color: #ffffff;
            font-size: 0.875rem;
            margin-bottom: 0.5rem;
          }

          .playlist-actions {
            display: flex;
            gap: 0.5rem;
          }

          .action-button {
            flex: 1;
            padding: 0.5rem;
            border: 1px solid #3d3d3d;
            border-radius: 4px;
            background-color: #1d1d1d;
            color: #ffffff;
            cursor: pointer;
            font-size: 0.875rem;
          }

          .action-button:hover {
            background-color: #3d3d3d;
          }

          .action-button.create {
            border-color: #4a9eff;
            color: #4a9eff;
          }

          .action-button.create:hover {
            background-color: #4a9eff;
            color: #ffffff;
          }

          .action-button.delete {
            border-color: #ff4a4a;
            color: #ff4a4a;
          }

          .action-button.delete:hover {
            background-color: #ff4a4a;
            color: #ffffff;
          }

          .playlist-create-form {
            display: flex;
            gap: 0.5rem;
            padding: 0 1rem 1rem;
            border-bottom: 1px solid #3d3d3d;
          }

          .playlist-create-form input {
            flex: 1;
            padding: 0.5rem;
            background-color: #1d1d1d;
            border: 1px solid #3d3d3d;
            border-radius: 4px;
            color: #ffffff;
            font-size: 0.875rem;
          }

          .playlist-create-form button {
            padding: 0.5rem 1rem;
            background-color: #4a9eff;
            border: none;
            border-radius: 4px;
            color: #ffffff;
            cursor: pointer;
            font-size: 0.875rem;
          }

          .playlist-create-form button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .playlist-drop-zone {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
            position: relative;
          }

          .playlist-drop-zone.drag-over {
            background-color: rgba(74, 158, 255, 0.1);
            border: 2px dashed #4a9eff;
          }

          .playlist-drop-zone.disabled {
            opacity: 0.5;
            pointer-events: none;
          }

          .playlist-drop-zone p {
            text-align: center;
            color: #888888;
            margin-top: 2rem;
          }

          .playlist-entry-list {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
        `}</style>
      </div>
    </>
  );
};

export default PlaylistPanel;

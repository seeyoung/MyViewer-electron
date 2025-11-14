import React, { useState } from 'react';
import { PlaylistEntry as PlaylistEntryType } from '@shared/types/playlist';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PlaylistEntryProps {
  entry: PlaylistEntryType;
  isActive: boolean;
  isValid?: boolean;
  onClick: () => void;
  onRemove: () => void;
  onUpdateLabel?: (position: number, newLabel: string) => void;
}

const PlaylistEntry: React.FC<PlaylistEntryProps> = ({
  entry,
  isActive,
  isValid = true,
  onClick,
  onRemove,
  onUpdateLabel,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingLabel, setEditingLabel] = useState('');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.position, disabled: isEditing });

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  const handleLabelDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdateLabel) {
      setEditingLabel(entry.label);
      setIsEditing(true);
    }
  };

  const handleSaveLabel = () => {
    if (editingLabel.trim() && onUpdateLabel) {
      onUpdateLabel(entry.position, editingLabel.trim());
    }
    setIsEditing(false);
    setEditingLabel('');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingLabel('');
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const entryClasses = [
    'playlist-entry',
    isActive ? 'active' : '',
    isDragging ? 'dragging' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={entryClasses}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <div className="entry-thumbnail">
        {entry.thumbnail_path ? (
          <img src={entry.thumbnail_path} alt={entry.label} />
        ) : (
          <div className="thumbnail-placeholder">
            {entry.source_type === 'folder' ? '📁' : '📦'}
          </div>
        )}
      </div>

      <div className="entry-info">
        {isEditing ? (
          <input
            className="entry-label-edit"
            type="text"
            value={editingLabel}
            onChange={(e) => setEditingLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                handleSaveLabel();
              }
              if (e.key === 'Escape') {
                e.stopPropagation();
                handleCancelEdit();
              }
            }}
            onBlur={handleSaveLabel}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <div className="entry-label" title={entry.source_path} onDoubleClick={handleLabelDoubleClick}>
            {entry.label}
            {!isValid && (
              <span className="warning-badge" title="Path not found or inaccessible">
                ⚠️
              </span>
            )}
          </div>
        )}
        <div className="entry-meta">
          <span className={`source-badge ${entry.source_type}`}>
            {entry.source_type === 'folder' ? 'Folder' : 'Archive'}
          </span>
          <span className="entry-position">#{entry.position + 1}</span>
        </div>
      </div>

      <button
        className="remove-button"
        onClick={handleRemoveClick}
        title="Remove from playlist"
      >
        ✕
      </button>

      <style>{`
        .playlist-entry {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background-color: #1d1d1d;
          border: 1px solid #3d3d3d;
          border-radius: 4px;
          cursor: grab;
          transition: all 0.2s;
        }

        .playlist-entry:hover {
          background-color: #2d2d2d;
          border-color: #4d4d4d;
        }

        .playlist-entry.active {
          background-color: #3d3d3d;
          border-color: #4a9eff;
          box-shadow: 0 0 0 1px #4a9eff;
        }

        .playlist-entry.dragging {
          opacity: 0.5;
          cursor: grabbing;
        }

        .playlist-entry.drag-over {
          border-top: 2px solid #4a9eff;
          margin-top: -2px;
        }

        .entry-thumbnail {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
          border-radius: 4px;
          overflow: hidden;
          background-color: #0d0d0d;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .entry-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .thumbnail-placeholder {
          font-size: 1.5rem;
          opacity: 0.5;
        }

        .entry-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .entry-label {
          color: #ffffff;
          font-size: 0.875rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .warning-badge {
          flex-shrink: 0;
          font-size: 0.875rem;
          opacity: 0.9;
          cursor: help;
        }

        .entry-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
        }

        .source-badge {
          padding: 0.125rem 0.5rem;
          border-radius: 3px;
          font-size: 0.625rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .source-badge.folder {
          background-color: rgba(74, 158, 255, 0.2);
          color: #4a9eff;
        }

        .source-badge.archive {
          background-color: rgba(255, 158, 74, 0.2);
          color: #ff9e4a;
        }

        .entry-position {
          color: #888888;
        }

        .remove-button {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          background: none;
          border: none;
          color: #888888;
          cursor: pointer;
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .remove-button:hover {
          background-color: rgba(255, 74, 74, 0.2);
          color: #ff4a4a;
        }
      `}</style>
    </div>
  );
};

export default PlaylistEntry;

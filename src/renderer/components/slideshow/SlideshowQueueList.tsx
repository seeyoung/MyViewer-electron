import React from 'react';
import { SlideshowQueueItem } from '@shared/types/slideshow';
import { RECENT_SOURCE_MIME } from '@shared/constants/drag';

interface SlideshowQueueListProps {
    entries: SlideshowQueueItem[];
    onRemove: (id: string) => void;
    onPlay: (id: string) => void;
    onMove: (id: string, index: number) => void;
    onDropExternal: (event: React.DragEvent<HTMLElement>, index: number) => void;
}

export const SlideshowQueueList: React.FC<SlideshowQueueListProps> = ({
    entries,
    onRemove,
    onPlay,
    onMove,
    onDropExternal,
}) => {
    const [draggingEntryId, setDraggingEntryId] = React.useState<string | null>(null);
    const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

    const handleEntryDragStart = (entryId: string) => (event: React.DragEvent<HTMLLIElement>) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-slideshow-entry', entryId);
        setDraggingEntryId(entryId);
    };

    const handleEntryDragOver = (index: number) => (event: React.DragEvent<HTMLLIElement>) => {
        if (
            event.dataTransfer.types.includes(RECENT_SOURCE_MIME) ||
            event.dataTransfer.files.length > 0 ||
            draggingEntryId
        ) {
            event.preventDefault();
            setDragOverIndex(index);
        }
    };

    const handleEntryDrop = (index: number) => (event: React.DragEvent<HTMLLIElement>) => {
        event.preventDefault();
        const internalId = event.dataTransfer.getData('application/x-slideshow-entry');

        if (internalId) {
            onMove(internalId, index);
        } else if (
            event.dataTransfer.files.length > 0 ||
            event.dataTransfer.types.includes(RECENT_SOURCE_MIME)
        ) {
            onDropExternal(event, index);
        }

        setDraggingEntryId(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggingEntryId(null);
        setDragOverIndex(null);
    };

    return (
        <ul className="slideshow-queue-list">
            {entries.length === 0 && (
                <li
                    className="empty drop-target"
                    onDragOver={handleEntryDragOver(0)}
                    onDrop={handleEntryDrop(0)}
                >
                    Queue is empty. Drop items here to start.
                </li>
            )}
            {entries.map((entry, index) => (
                <li
                    key={entry.id}
                    draggable
                    onDragStart={handleEntryDragStart(entry.id)}
                    onDragOver={handleEntryDragOver(index)}
                    onDrop={handleEntryDrop(index)}
                    onDragEnd={handleDragEnd}
                    className={dragOverIndex === index ? 'drag-over' : ''}
                >
                    <div>
                        <span className="entry-index">{index + 1}.</span>
                        <span className="entry-label">{entry.label}</span>
                        <span className="entry-type">{entry.sourceType}</span>
                    </div>
                    <div className="entry-actions">
                        <button onClick={() => onPlay(entry.id)}>Play</button>
                        <button
                            className="icon-button"
                            title="Remove"
                            onClick={() => onRemove(entry.id)}
                        >
                            ✕
                        </button>
                    </div>
                </li>
            ))}
            {entries.length > 0 && (
                <li
                    className={`drop-target bottom-drop-target ${dragOverIndex === entries.length ? 'drag-over' : ''
                        }`}
                    onDragOver={handleEntryDragOver(entries.length)}
                    onDrop={handleEntryDrop(entries.length)}
                    onDragLeave={handleDragEnd}
                >
                    Drop here to append to queue
                </li>
            )}
            <style>{`
        .slideshow-queue-list {
          list-style: none;
          padding: 0;
          margin: 0 0 0.75rem 0;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }
        .slideshow-queue-list li {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.35rem 0.5rem;
          border-radius: 4px;
          background: rgba(255,255,255,0.03);
        }
        .slideshow-queue-list li .entry-label {
          font-weight: 600;
          margin-right: 0.5rem;
        }
        .slideshow-queue-list li .entry-type {
          font-size: 0.85rem;
          color: #aaa;
        }
        .slideshow-queue-list li.drag-over {
          border: 1px dashed rgba(0, 122, 204, 0.8);
          background: rgba(0, 122, 204, 0.15);
        }
        .slideshow-queue-list li button {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
          padding: 0.2rem 0.5rem;
        }
        .slideshow-queue-list li.empty {
          justify-content: center;
          color: #aaa;
        }
        .slideshow-queue-list li.bottom-drop-target {
          min-height: 48px;
          justify-content: center;
          font-style: italic;
          color: #bbb;
          border: 1px dashed rgba(255,255,255,0.1);
        }
        .entry-actions {
          display: flex;
          gap: 0.25rem;
        }
        .entry-actions button {
          min-width: 48px;
        }
        .entry-actions .icon-button {
          min-width: 32px;
          font-size: 1rem;
          line-height: 1;
        }
      `}</style>
        </ul>
    );
};

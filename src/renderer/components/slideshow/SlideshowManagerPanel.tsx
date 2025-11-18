import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SLIDESHOW_NAME, useViewerStore } from '@renderer/store/viewerStore';
import ipcClient from '@renderer/services/ipc';
import * as channels from '@shared/constants/ipc-channels';
import { SourceDescriptor, SourceType } from '@shared/types/Source';
import { Slideshow, SlideshowEntry, SlideshowQueueItemInput } from '@shared/types/slideshow';
import { RECENT_SOURCE_MIME } from '@shared/constants/drag';
import { useArchive } from '@renderer/hooks/useArchive';

interface SlideshowWithEntriesResult {
  slideshow: Slideshow;
  entries: SlideshowEntry[];
}

type StatusState = { type: 'success' | 'error'; message: string } | null;

const toQueueItemInput = (descriptor: SourceDescriptor): SlideshowQueueItemInput => ({
  sourcePath: descriptor.path,
  sourceType: descriptor.type === SourceType.FOLDER ? 'folder' : 'archive',
  label: descriptor.label,
});

const pathLabel = (filePath: string) => {
  const segments = filePath.replace(/\\/g, '/').split('/');
  return segments.filter(Boolean).pop() || filePath;
};

const SlideshowManagerPanel: React.FC = () => {
  const queueEntries = useViewerStore(state => state.slideshowQueueEntries);
  const addQueueEntry = useViewerStore(state => state.addSlideshowQueueEntry);
  const removeQueueEntry = useViewerStore(state => state.removeSlideshowQueueEntry);
  const moveQueueEntry = useViewerStore(state => state.moveSlideshowQueueEntry);
  const queueName = useViewerStore(state => state.slideshowQueueName);
  const setQueueName = useViewerStore(state => state.setSlideshowQueueName);
  const setSlideshowQueueFromSources = useViewerStore(state => state.setSlideshowQueueFromSources);
  const activeSlideshowId = useViewerStore(state => state.activeSlideshowId);
  const setActiveSlideshowId = useViewerStore(state => state.setActiveSlideshowId);
  const setActiveSlideshowEntryId = useViewerStore(state => state.setActiveSlideshowEntryId);
  const setCurrentSlidePath = useViewerStore(state => state.setCurrentSlidePath);
  const slideshowQueueLoading = useViewerStore(state => state.slideshowQueueLoading);
  const setSlideshowQueueLoading = useViewerStore(state => state.setSlideshowQueueLoading);
  const [savedSlideshows, setSavedSlideshows] = useState<Slideshow[]>([]);
  const [selectedSlideshowId, setSelectedSlideshowId] = useState<string>('');
  const [status, setStatus] = useState<StatusState>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const { openArchive, openFolder } = useArchive();
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const refreshSavedSlideshows = useCallback(async () => {
    try {
      const lists = await ipcClient.listSlideshows() as Slideshow[];
      setSavedSlideshows(lists);
      return lists;
    } catch (error) {
      console.error('Failed to load saved slideshows', error);
      return [];
    }
  }, []);

  useEffect(() => {
    void refreshSavedSlideshows();
  }, [refreshSavedSlideshows]);

  const addEntries = useCallback((entries: SlideshowQueueItemInput[], position?: number) => {
    let added = 0;
    entries.forEach((entry, index) => {
      addQueueEntry(entry, position !== undefined ? position + index : undefined);
      added += 1;
    });
    if (added > 0) {
      setStatus({ type: 'success', message: `${added} item${added > 1 ? 's' : ''} added to queue.` });
    }
  }, [addQueueEntry]);

  const processDropEvent = useCallback(async (event: React.DragEvent<HTMLElement>, insertIndex?: number) => {
    event.preventDefault();
    event.stopPropagation();

    const payload = event.dataTransfer?.getData(RECENT_SOURCE_MIME);
    const additions: SlideshowQueueItemInput[] = [];

    if (payload) {
      try {
        const descriptor = JSON.parse(payload) as SourceDescriptor;
        additions.push(toQueueItemInput(descriptor));
      } catch (error) {
        console.warn('Invalid slideshow drag payload', error);
      }
    }

    const files = Array.from(event.dataTransfer?.files ?? []);
    for (const file of files) {
      if (!file.path) continue;
      try {
        const statInfo = await window.electronAPI.invoke(channels.FS_STAT, { path: file.path });
        const isDirectory = (statInfo as any)?.isDirectory;
        additions.push({
          sourcePath: file.path,
          sourceType: isDirectory ? 'folder' : 'archive',
          label: pathLabel(file.path),
        });
      } catch (error) {
        console.error('Failed to inspect dropped file', error);
        setStatus({ type: 'error', message: 'Failed to inspect dropped item.' });
      }
    }

    if (additions.length > 0) {
      addEntries(additions, insertIndex);
    }
  }, [addEntries]);

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    setIsDragActive(false);
    await processDropEvent(event);
  }, [processDropEvent]);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragActive) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
  };

  const persistQueue = useCallback(async () => {
    if (slideshowQueueLoading) {
      return;
    }
    const trimmedName = queueName.trim() || DEFAULT_SLIDESHOW_NAME;
    if (!queueEntries.length && !activeSlideshowId) {
      return;
    }

    let slideshowId = activeSlideshowId;
    try {
      const currentLists = savedSlideshows.length ? savedSlideshows : await refreshSavedSlideshows();
      if (!slideshowId) {
        const existing = currentLists.find((list) => list.name === trimmedName);
        if (existing) {
          slideshowId = existing.id;
        } else {
          const created = await ipcClient.createSlideshow(trimmedName) as Slideshow;
          slideshowId = created.id;
        }
        setActiveSlideshowId(slideshowId);
      } else {
        const current = currentLists.find((list) => list.id === slideshowId);
        if (current && current.name !== trimmedName) {
          await ipcClient.updateSlideshow(slideshowId, { name: trimmedName, allowDuplicates: true });
        }
      }

      if (!slideshowId) {
        return;
      }

      const payload = queueEntries.map((entry, index) => ({
        slideshowId,
        position: index,
        sourcePath: entry.sourcePath,
        sourceType: entry.sourceType,
        label: entry.label,
      }));
      await ipcClient.setSlideshowEntries(slideshowId, payload);
      await refreshSavedSlideshows();
    } catch (error) {
      console.error('Failed to persist slideshow queue', error);
    }
  }, [
    activeSlideshowId,
    queueEntries,
    queueName,
    refreshSavedSlideshows,
    savedSlideshows,
    setActiveSlideshowId,
    slideshowQueueLoading,
  ]);

  const handleLoad = useCallback(async (slideshowId?: string) => {
    const targetId = slideshowId ?? selectedSlideshowId;
    if (!targetId) {
      return;
    }
    setSlideshowQueueLoading(true);
    try {
      const result = await ipcClient.getSlideshow(targetId) as SlideshowWithEntriesResult | null;
      if (!result) {
        setStatus({ type: 'error', message: 'Selected slideshow could not be loaded.' });
        return;
      }
      setSlideshowQueueFromSources(
        result.entries.map((entry) => ({
          sourcePath: entry.sourcePath,
          sourceType: entry.sourceType,
          label: entry.label,
        })),
        { name: result.slideshow.name, activeSlideshowId: result.slideshow.id, autoStart: true }
      );
      setQueueName(result.slideshow.name);
      setActiveSlideshowId(result.slideshow.id);
      setStatus({ type: 'success', message: `Loaded "${result.slideshow.name}" and started playback.` });
    } catch (error: any) {
      setStatus({ type: 'error', message: error?.message || 'Failed to load slideshow.' });
    } finally {
      setSlideshowQueueLoading(false);
    }
  }, [selectedSlideshowId, setActiveSlideshowId, setQueueName, setSlideshowQueueFromSources, setSlideshowQueueLoading]);

  const handleStartAt = useCallback(
    (entryId: string) => {
      const entry = queueEntries.find((item) => item.id === entryId);
      if (!entry) {
        return;
      }
      setActiveSlideshowEntryId(entryId);
      setCurrentSlidePath(entry.sourcePath);
    },
    [queueEntries, setActiveSlideshowEntryId, setCurrentSlidePath]
  );

  const handleEntryDragStart = (entryId: string) => (event: React.DragEvent<HTMLLIElement>) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-slideshow-entry', entryId);
    setDraggingEntryId(entryId);
  };

  const handleEntryDragOver = (index: number) => (event: React.DragEvent<HTMLLIElement>) => {
    if (event.dataTransfer.types.includes(RECENT_SOURCE_MIME) || event.dataTransfer.files.length > 0 || draggingEntryId) {
      event.preventDefault();
      setDragOverIndex(index);
    }
  };

  const handleEntryDrop = (index: number) => async (event: React.DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    const internalId = event.dataTransfer.getData('application/x-slideshow-entry');
    if (internalId) {
      moveQueueEntry(internalId, index);
    } else if (event.dataTransfer.files.length > 0 || event.dataTransfer.types.includes(RECENT_SOURCE_MIME)) {
      await processDropEvent(event as unknown as React.DragEvent<HTMLElement>, index);
    }
    setDraggingEntryId(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggingEntryId(null);
    setDragOverIndex(null);
  };

  useEffect(() => {
    if (slideshowQueueLoading) {
      return;
    }
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }
    autoSaveTimeout.current = setTimeout(() => {
      void persistQueue();
    }, 400);

    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, [persistQueue, queueEntries, queueName, activeSlideshowId, slideshowQueueLoading]);

  return (
    <>
      {slideshowQueueLoading && (
        <div className="slideshow-loading-modal">
          <div className="modal-content">
            <p>Loading slideshow…</p>
          </div>
        </div>
      )}
      <section className="slideshow-queue-panel">
        <div className="panel-row">
          <h3>Slideshow Queue</h3>
          <div className="saved-selector">
            <select
              value={selectedSlideshowId}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedSlideshowId(value);
                if (value) {
                  void handleLoad(value);
                }
              }}
            >
              <option value="">Load saved list…</option>
              {savedSlideshows.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </div>
        </div>

      <ul className="slideshow-queue-list">
        {queueEntries.length === 0 && (
          <li
            className="empty drop-target"
            onDragOver={handleEntryDragOver(0)}
            onDrop={handleEntryDrop(0)}
          >
            Queue is empty. Drop items here to start.
          </li>
        )}
        {queueEntries.map((entry, index) => (
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
              <button onClick={() => handleStartAt(entry.id)}>
                Play
              </button>
              <button className="icon-button" title="Remove" onClick={() => removeQueueEntry(entry.id)}>✕</button>
            </div>
          </li>
        ))}
      </ul>

      {status && <p className={`status ${status.type}`}>{status.message}</p>}

      <style>{`
        .slideshow-loading-modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .slideshow-loading-modal .modal-content {
          background: rgba(20, 20, 20, 0.95);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 8px;
          padding: 1.5rem 2rem;
          color: #fff;
          font-size: 1.1rem;
        }
        .slideshow-queue-panel {
          margin-top: 1rem;
          padding: 0.75rem;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          background: rgba(10,10,10,0.6);
        }
        .panel-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }
        .saved-selector {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        .saved-selector select {
          background: #1c1c1c;
          color: #fff;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 4px;
          padding: 0.25rem 0.5rem;
        }
        .slideshow-queue-list {
          list-style: none;
          padding: 0;
          margin: 0 0 0.75rem 0;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          max-height: 200px;
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
        .entry-actions button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .status {
          margin-top: 0.5rem;
          font-size: 0.9rem;
        }
        .status.success {
          color: #7ad47a;
        }
        .status.error {
          color: #ff9a9a;
        }
      `}</style>
    </section>
    </>
  );
};

export default SlideshowManagerPanel;

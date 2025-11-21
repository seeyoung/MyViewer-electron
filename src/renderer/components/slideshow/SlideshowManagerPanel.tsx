import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SLIDESHOW_NAME, useViewerStore } from '@renderer/store/viewerStore';
import ipcClient from '@renderer/services/ipc';
import * as channels from '@shared/constants/ipc-channels';
import { SourceDescriptor, SourceType } from '@shared/types/Source';
import { Slideshow, SlideshowEntry, SlideshowQueueItemInput } from '@shared/types/slideshow';
import { RECENT_SOURCE_MIME } from '@shared/constants/drag';
import { SlideshowQueueList } from './SlideshowQueueList';
import { SlideshowControls } from './SlideshowControls';

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
  // Remove local state, rely on activeSlideshowId from store
  // const [selectedSlideshowId, setSelectedSlideshowId] = useState<string>('');
  const [status, setStatus] = useState<StatusState>(null);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(queueName);

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

  const handleLoad = useCallback(async (slideshowId: string) => {
    if (!slideshowId) {
      return;
    }
    setSlideshowQueueLoading(true);
    try {
      const result = await ipcClient.getSlideshow(slideshowId) as SlideshowWithEntriesResult | null;
      if (!result) {
        setStatus({ type: 'error', message: 'Selected slideshow could not be loaded.' });
        return;
      }

      setActiveSlideshowId(result.slideshow.id);
      setQueueName(result.slideshow.name);
      setSlideshowQueueFromSources(
        result.entries.map(entry => ({
          sourcePath: entry.sourcePath,
          sourceType: entry.sourceType,
          label: entry.label,
        })),
        { name: result.slideshow.name, activeSlideshowId: result.slideshow.id, autoStart: true }
      );
      setStatus({ type: 'success', message: 'Slideshow loaded successfully.' });
    } catch (error: any) {
      console.error('Failed to load slideshow:', error);
      setStatus({ type: 'error', message: error?.message || 'Failed to load slideshow.' });
    } finally {
      setSlideshowQueueLoading(false);
    }
  }, [setActiveSlideshowId, setQueueName, setSlideshowQueueFromSources, setSlideshowQueueLoading]);

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

  const beginRename = () => {
    setRenameValue(queueName);
    setIsRenaming(true);
  };

  const confirmRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      setQueueName(trimmed);
      setIsRenaming(false);
    }
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setRenameValue(queueName);
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
        <SlideshowControls
          savedSlideshows={savedSlideshows}
          selectedSlideshowId={activeSlideshowId || ''}
          onSelectSlideshow={(id) => {
            if (id) void handleLoad(id);
          }}
          onBeginRename={beginRename}
          isRenaming={isRenaming}
          renameValue={renameValue}
          onRenameChange={setRenameValue}
          onConfirmRename={confirmRename}
          onCancelRename={cancelRename}
        />

        {status && <p className={`status ${status.type}`}>{status.message}</p>}

        <SlideshowQueueList
          entries={queueEntries}
          onRemove={removeQueueEntry}
          onPlay={handleStartAt}
          onMove={moveQueueEntry}
          onDropExternal={processDropEvent}
        />

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
            display: flex;
            flex-direction: column;
            height: 100%;
            min-height: 0;
          }
          .status {
            margin: 0 0 0.5rem 0;
            padding: 0.4rem 0.6rem;
            border-radius: 4px;
            background: rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.15);
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

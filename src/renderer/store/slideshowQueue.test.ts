import { beforeEach, describe, expect, it } from 'vitest';
import { useViewerStore } from './viewerStore';
import { SourceType } from '@shared/types/Source';

const buildEntry = (overrides?: Partial<{ path: string; label: string; type: SourceType }>) => ({
  sourcePath: overrides?.path ?? '/Volumes/pictures/set-1',
  label: overrides?.label ?? 'Set 1',
  sourceType: overrides?.type ?? SourceType.FOLDER,
});

describe('ViewerStore slideshow queue', () => {
  beforeEach(() => {
    useViewerStore.setState({
      slideshowQueueEntries: [],
      currentSlidePath: null,
      autoSlideEnabled: false,
      slideshowQueueName: 'Default',
      activeSlideshowId: null,
      activeSlideshowEntryId: null,
    });
  });

  it('initializes with Default queue name', () => {
    expect(useViewerStore.getState().slideshowQueueName).toBe('Default');
  });

  it('allows duplicate entries and preserves insertion order', () => {
    const { addSlideshowQueueEntry } = useViewerStore.getState();
    const first = addSlideshowQueueEntry(buildEntry());
    const second = addSlideshowQueueEntry(buildEntry({ label: 'Set 1 (again)' }));

    const state = useViewerStore.getState();
    expect(state.slideshowQueueEntries).toHaveLength(2);
    expect(state.slideshowQueueEntries[0].id).toBe(first.id);
    expect(state.slideshowQueueEntries[1].id).toBe(second.id);
  });

  it('removing the active entry jumps to the next queued entry', () => {
    const { addSlideshowQueueEntry, removeSlideshowQueueEntry, setCurrentSlidePath } = useViewerStore.getState();
    const first = addSlideshowQueueEntry(buildEntry());
    const second = addSlideshowQueueEntry(buildEntry({ path: '/Volumes/pictures/set-2', label: 'Set 2' }));
    setCurrentSlidePath(first.sourcePath);
    useViewerStore.setState({ activeSlideshowEntryId: first.id });

    removeSlideshowQueueEntry(first.id);

    const state = useViewerStore.getState();
    expect(state.currentSlidePath).toBe(second.sourcePath);
    expect(state.activeSlideshowEntryId).toBe(second.id);
    expect(state.slideshowQueueEntries[0].id).toBe(second.id);
  });

  it('removing the final entry stops the slideshow autoplay', () => {
    const { addSlideshowQueueEntry, removeSlideshowQueueEntry, setCurrentSlidePath, setAutoSlideEnabled } = useViewerStore.getState();
    const first = addSlideshowQueueEntry(buildEntry());
    setCurrentSlidePath(first.sourcePath);
    useViewerStore.setState({ activeSlideshowEntryId: first.id });
    setAutoSlideEnabled(true);

    removeSlideshowQueueEntry(first.id);

    const state = useViewerStore.getState();
    expect(state.currentSlidePath).toBeNull();
    expect(state.autoSlideEnabled).toBe(false);
    expect(state.slideshowQueueEntries).toHaveLength(0);
  });

  it('advances to the next entry and trims the queue head', () => {
    const { addSlideshowQueueEntry, advanceSlideshowQueue, setCurrentSlidePath } = useViewerStore.getState();
    const first = addSlideshowQueueEntry(buildEntry());
    const second = addSlideshowQueueEntry(buildEntry({ path: '/extra/source', label: 'Extra' }));
    setCurrentSlidePath(first.sourcePath);
    useViewerStore.setState({ activeSlideshowEntryId: first.id });

    advanceSlideshowQueue();

    const state = useViewerStore.getState();
    expect(state.currentSlidePath).toBe(second.sourcePath);
    expect(state.activeSlideshowEntryId).toBe(second.id);
    expect(state.slideshowQueueEntries).toHaveLength(2);
  });

  it('reorders entries and keeps active pointer when moving items', () => {
    const { addSlideshowQueueEntry, moveSlideshowQueueEntry } = useViewerStore.getState();
    const first = addSlideshowQueueEntry(buildEntry({ label: 'A' }));
    const second = addSlideshowQueueEntry(buildEntry({ path: '/set-b', label: 'B' }));
    const third = addSlideshowQueueEntry(buildEntry({ path: '/set-c', label: 'C' }));

    useViewerStore.setState({ activeSlideshowEntryId: second.id, currentSlidePath: second.sourcePath });
    moveSlideshowQueueEntry(second.id, 0);

    const state = useViewerStore.getState();
    expect(state.slideshowQueueEntries.map((entry) => entry.id)).toEqual([second.id, first.id, third.id]);
    expect(state.activeSlideshowEntryId).toBe(second.id);
    expect(state.currentSlidePath).toBe(second.sourcePath);
  });

  it('can load queue without auto-start when metadata opts out', () => {
    const { setSlideshowQueueFromSources } = useViewerStore.getState();
    useViewerStore.setState({ currentSlidePath: null });

    setSlideshowQueueFromSources(
      [
        { sourcePath: '/folder-a', sourceType: SourceType.FOLDER, label: 'Folder A' },
        { sourcePath: '/folder-b', sourceType: SourceType.FOLDER, label: 'Folder B' },
      ],
      { name: 'No Auto', autoStart: false }
    );

    const state = useViewerStore.getState();
    expect(state.currentSlidePath).toBeNull();
    expect(state.activeSlideshowEntryId).not.toBeNull();
    expect(state.slideshowQueueName).toBe('No Auto');
  });
});

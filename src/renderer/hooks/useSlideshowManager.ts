import { useCallback } from 'react';
import { DEFAULT_SLIDESHOW_NAME, useViewerStore } from '@renderer/store/viewerStore';
import { SourceDescriptor, SourceType } from '@shared/types/Source';
import { SlideshowQueueItemInput } from '@shared/types/slideshow';

export function useSlideshowManager() {
  const setSlideshowRoot = useViewerStore(state => state.setSlideshowRoot);
  const setSlideshowQueueFromSources = useViewerStore(state => state.setSlideshowQueueFromSources);
  const setCurrentSlidePath = useViewerStore(state => state.setCurrentSlidePath);

  const toQueueEntry = (source: SourceDescriptor): SlideshowQueueItemInput => ({
    sourcePath: source.path,
    sourceType: source.type === SourceType.FOLDER ? 'folder' : 'archive',
    label: source.label,
  });

  const startSlideshowFromRoot = useCallback((root: SourceDescriptor, queue?: SlideshowQueueItemInput[]) => {
    const initialQueue = queue && queue.length ? queue : [toQueueEntry(root)];
    setSlideshowRoot(root);
    setSlideshowQueueFromSources(initialQueue, {
      activeIndex: 0,
      name: DEFAULT_SLIDESHOW_NAME,
      activeSlideshowId: null,
      autoStart: true,
    });
    setCurrentSlidePath(root.path);
  }, [setCurrentSlidePath, setSlideshowQueueFromSources, setSlideshowRoot]);

  return {
    startSlideshowFromRoot,
  };
}

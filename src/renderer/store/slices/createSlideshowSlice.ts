import { StateCreator } from 'zustand';
import { SourceDescriptor } from '@shared/types/Source';
import { SlideshowQueueItem, SlideshowQueueItemInput } from '@shared/types/slideshow';
import { ViewerState } from '../viewerStore';
import { DEFAULT_SLIDESHOW_NAME } from '../viewerStore';

export interface SlideshowSlice {
    slideshowRoot: SourceDescriptor | null;
    currentSlidePath: string | null;
    slideshowQueueEntries: SlideshowQueueItem[];
    activeSlideshowEntryId: string | null;
    slideshowQueueName: string;
    activeSlideshowId: string | null;
    slideshowQueueLoading: boolean;
    autoSlideEnabled: boolean;
    autoSlideInterval: number;
    autoSlideIntervalOverlay: { visible: boolean; value: number };

    setSlideshowRoot: (root: SourceDescriptor | null) => void;
    setCurrentSlidePath: (path: string | null) => void;
    addSlideshowQueueEntry: (entry: SlideshowQueueItemInput, position?: number) => SlideshowQueueItem;
    removeSlideshowQueueEntry: (entryId: string) => void;
    clearSlideshowQueue: () => void;
    setSlideshowQueueFromSources: (
        entries: SlideshowQueueItemInput[],
        metadata?: { name?: string; activeSlideshowId?: string | null; activeIndex?: number; autoStart?: boolean }
    ) => void;
    setSlideshowQueueName: (name: string) => void;
    setActiveSlideshowEntryId: (entryId: string | null) => void;
    advanceSlideshowQueue: () => void;
    setActiveSlideshowId: (id: string | null) => void;
    setSlideshowQueueLoading: (loading: boolean) => void;
    moveSlideshowQueueEntry: (entryId: string, targetIndex: number) => void;
    setAutoSlideEnabled: (enabled: boolean) => void;
    toggleAutoSlide: () => void;
    setAutoSlideInterval: (interval: number) => void;
    setAutoSlideIntervalOverlay: (overlay: { visible: boolean; value: number }) => void;
}

export const createSlideshowSlice: StateCreator<ViewerState, [], [], SlideshowSlice> = (set, get) => ({
    slideshowRoot: null,
    currentSlidePath: null,
    slideshowQueueEntries: [],
    activeSlideshowEntryId: null,
    slideshowQueueName: DEFAULT_SLIDESHOW_NAME,
    activeSlideshowId: null,
    slideshowQueueLoading: false,
    autoSlideEnabled: false,
    autoSlideInterval: 5000,
    autoSlideIntervalOverlay: { visible: false, value: 5000 },

    setSlideshowRoot: (root) => set({ slideshowRoot: root }),
    setCurrentSlidePath: (path) => set({ currentSlidePath: path }),

    addSlideshowQueueEntry: (entry, position) => {
        const newItem: SlideshowQueueItem = {
            id: crypto.randomUUID(),
            ...entry,
            duration: 5000,
        };
        set((state) => {
            const newQueue = [...state.slideshowQueueEntries];
            if (position !== undefined && position >= 0 && position <= newQueue.length) {
                newQueue.splice(position, 0, newItem);
            } else {
                newQueue.push(newItem);
            }
            return { slideshowQueueEntries: newQueue };
        });
        return newItem;
    },

    removeSlideshowQueueEntry: (entryId) => set((state) => ({
        slideshowQueueEntries: state.slideshowQueueEntries.filter(item => item.id !== entryId)
    })),

    clearSlideshowQueue: () => set({
        slideshowQueueEntries: [],
        activeSlideshowEntryId: null,
        activeSlideshowId: null,
        slideshowQueueName: DEFAULT_SLIDESHOW_NAME
    }),

    setSlideshowQueueFromSources: (entries, metadata) => {
        const newItems: SlideshowQueueItem[] = entries.map(entry => ({
            id: crypto.randomUUID(),
            ...entry,
            duration: 5000,
        }));

        set({
            slideshowQueueEntries: newItems,
            slideshowQueueName: metadata?.name || DEFAULT_SLIDESHOW_NAME,
            activeSlideshowId: metadata?.activeSlideshowId || null,
        });

        if (metadata?.autoStart && newItems.length > 0) {
            const startIndex = metadata.activeIndex || 0;
            const startItem = newItems[startIndex];
            if (startItem) {
                set({
                    activeSlideshowEntryId: startItem.id,
                    currentSlidePath: startItem.sourcePath,
                    autoSlideEnabled: true
                });
            }
        }
    },

    setSlideshowQueueName: (name) => set({ slideshowQueueName: name }),

    setActiveSlideshowEntryId: (entryId) => set({ activeSlideshowEntryId: entryId }),

    advanceSlideshowQueue: () => {
        const state = get();
        const currentIndex = state.slideshowQueueEntries.findIndex(item => item.id === state.activeSlideshowEntryId);
        if (currentIndex !== -1 && currentIndex < state.slideshowQueueEntries.length - 1) {
            const nextItem = state.slideshowQueueEntries[currentIndex + 1];
            set({
                activeSlideshowEntryId: nextItem.id,
                currentSlidePath: nextItem.sourcePath
            });
        } else {
            // End of slideshow
            set({ autoSlideEnabled: false });
        }
    },

    setActiveSlideshowId: (id) => set({ activeSlideshowId: id }),

    setSlideshowQueueLoading: (loading) => set({ slideshowQueueLoading: loading }),

    moveSlideshowQueueEntry: (entryId, targetIndex) => set((state) => {
        const sourceIndex = state.slideshowQueueEntries.findIndex(item => item.id === entryId);
        if (sourceIndex === -1) return {};

        const newQueue = [...state.slideshowQueueEntries];
        const [movedItem] = newQueue.splice(sourceIndex, 1);
        newQueue.splice(targetIndex, 0, movedItem);

        return { slideshowQueueEntries: newQueue };
    }),


    setAutoSlideEnabled: (enabled) => set({ autoSlideEnabled: enabled }),
    toggleAutoSlide: () => set((state) => ({ autoSlideEnabled: !state.autoSlideEnabled })),
    setAutoSlideInterval: (interval) => set({ autoSlideInterval: interval }),
    setAutoSlideIntervalOverlay: (overlay) => set({ autoSlideIntervalOverlay: overlay }),
});

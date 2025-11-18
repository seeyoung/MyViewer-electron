import { create } from 'zustand';
import { Image } from '@shared/types/Image';
import { Bookmark } from '@shared/types/Bookmark';
import { SourceDescriptor } from '@shared/types/Source';
import { ViewingSession } from '@shared/types/ViewingSession';
import {
  ViewMode,
  ReadingDirection,
  FitMode,
  Rotation,
} from '@shared/types/ViewingSession';
import { SlideshowQueueItem, SlideshowQueueItemInput, SlideshowSourceType } from '@shared/types/slideshow';

export const DEFAULT_SLIDESHOW_NAME = 'Default';

interface ViewerState {
  // Source state
  currentSource: SourceDescriptor | null;
  currentSession: ViewingSession | null;
  images: Image[];
  recentSources: SourceDescriptor[];

  // Slideshow context
  slideshowRoot: SourceDescriptor | null;
  currentSlidePath: string | null;
  slideshowQueueEntries: SlideshowQueueItem[];
  activeSlideshowEntryId: string | null;
  slideshowQueueName: string;
  activeSlideshowId: string | null;
  slideshowQueueLoading: boolean;

  // Navigation state
  currentPageIndex: number;
  readingDirection: ReadingDirection;

  // View settings
  viewMode: ViewMode;
  zoomLevel: number;
  fitMode: FitMode;
  rotation: Rotation;

  // Fullscreen state
  isFullscreen: boolean;

  // UI visibility
  showThumbnails: boolean;
  showFolderTree: boolean;
  sidebarTab: 'folders' | 'thumbnails';
  sidebarWidth: number;
  thumbnailPosition: 'sidebar' | 'bottom';
  showBookmarks: boolean;
  showSlideshowManager: boolean;
  autoSlideEnabled: boolean;
  autoSlideInterval: number;
  autoSlideIntervalOverlay: { visible: boolean; value: number };
  folderPositions: Record<string, number>;
  folderPositionsKey: string | null;

  // Filter/search
  activeFolderId: string | null;
  searchQuery: string;

  // Bookmarks
  bookmarks: Bookmark[];

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  setSource: (source: SourceDescriptor) => void;
  setSession: (session: ViewingSession | null) => void;
  setImages: (images: Image[]) => void;
  navigateToPage: (index: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setZoomLevel: (level: number) => void;
  setFitMode: (mode: FitMode) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setShowFolderTree: (visible: boolean) => void;
  toggleFolderTree: () => void;
  setActiveFolderId: (folderId: string | null) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setRecentSources: (sources: SourceDescriptor[]) => void;
  addRecentSource: (source: SourceDescriptor) => void;
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
  setSidebarTab: (tab: 'folders' | 'thumbnails') => void;
  setSidebarWidth: (width: number) => void;
  setThumbnailPosition: (position: 'sidebar' | 'bottom') => void;
  toggleSlideshowManager: () => void;
  setAutoSlideEnabled: (enabled: boolean) => void;
  setAutoSlideInterval: (interval: number) => void;
  showAutoSlideOverlay: (value: number) => void;
  loadFolderPositions: (sourcePath: string) => void;
  setFolderPosition: (folderId: string, index: number) => void;
  getFolderPosition: (folderId: string) => number | undefined;
  clearFolderPositions: () => void;
  reset: () => void;
}

const normalizeFolder = (folderPath?: string | null) => {
  if (!folderPath) return '/';
  return folderPath.startsWith('/') ? folderPath : `/${folderPath}`;
};

const generateQueueItemId = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `slideshow-entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const clampPosition = (position: number, length: number) => {
  if (typeof position !== 'number' || Number.isNaN(position)) {
    return length;
  }
  return Math.max(0, Math.min(position, length));
};

const materializeQueueItems = (entries: SlideshowQueueItemInput[]): SlideshowQueueItem[] =>
  entries.map((entry) => ({
    ...entry,
    id: generateQueueItemId(),
  }));

export const useViewerStore = create<ViewerState>((set, get) => ({
  // Initial state
  currentSource: null,
  currentSession: null,
  images: [],
  recentSources: [],
  slideshowRoot: null,
  currentSlidePath: null,
  slideshowQueueEntries: [],
  activeSlideshowEntryId: null,
  slideshowQueueName: DEFAULT_SLIDESHOW_NAME,
  activeSlideshowId: null,
  slideshowQueueLoading: false,

  currentPageIndex: 0,
  readingDirection: ReadingDirection.LTR,

  viewMode: ViewMode.SINGLE,
  zoomLevel: 1.0,
  fitMode: FitMode.FIT_HEIGHT,
  rotation: Rotation.NONE,

  isFullscreen: false,

  showThumbnails: true,
  showFolderTree: false,
  sidebarTab: 'folders',
  sidebarWidth: 240,
  thumbnailPosition: 'sidebar',
  showBookmarks: false,
  showSlideshowManager: false,
  autoSlideEnabled: false,
  autoSlideInterval: 5000,
  autoSlideIntervalOverlay: { visible: false, value: 5000 },
  folderPositions: {},
  folderPositionsKey: null,

  activeFolderId: null,
  searchQuery: '',

  bookmarks: [],

  isLoading: false,
  error: null,

  // Actions
  setSource: (source) => set({ currentSource: source }),

  setSession: (session) => set({ currentSession: session || null }),

  setImages: (images) => set({ images, activeFolderId: images.length ? normalizeFolder(images[0].folderPath) : null }),

  navigateToPage: (index) =>
    set((state) => {
      const nextIndex = Math.max(0, Math.min(index, state.images.length - 1));
      const nextImage = state.images[nextIndex];
      return {
        currentPageIndex: nextIndex,
        activeFolderId: nextImage ? normalizeFolder(nextImage.folderPath) : state.activeFolderId,
      };
    }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setZoomLevel: (level) => set({ zoomLevel: Math.max(0.1, Math.min(10, level)), fitMode: FitMode.CUSTOM }),
  
  setFitMode: (mode) => set({ fitMode: mode }),

  setFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),

  setShowFolderTree: (visible) => set({ showFolderTree: visible }),

  toggleFolderTree: () => set((state) => ({ showFolderTree: !state.showFolderTree })),

  setActiveFolderId: (folderId) => set({ activeFolderId: folderId }),

  setError: (error) => set({ error }),

  setLoading: (loading) => set({ isLoading: loading }),

  setRecentSources: (sources) => set({ recentSources: sources }),

  addRecentSource: (source) =>
    set((state) => {
      const existing = state.recentSources.filter(
        (item) => !(item.path === source.path && item.type === source.type)
      );
      return {
        recentSources: [source, ...existing].slice(0, 10),
      };
    }),

  setSlideshowRoot: (root) => set({ slideshowRoot: root }),

  setCurrentSlidePath: (path) => set({ currentSlidePath: path }),

  addSlideshowQueueEntry: (entry, position) => {
    const queueEntry: SlideshowQueueItem = {
      ...entry,
      id: generateQueueItemId(),
    };
    set((state) => {
      const insertAt = clampPosition(position ?? state.slideshowQueueEntries.length, state.slideshowQueueEntries.length);
      const entries = [...state.slideshowQueueEntries];
      entries.splice(insertAt, 0, queueEntry);
      const partial: Partial<ViewerState> = {
        slideshowQueueEntries: entries,
      };
      if (!state.activeSlideshowEntryId) {
        partial.activeSlideshowEntryId = queueEntry.id;
        partial.currentSlidePath = queueEntry.sourcePath;
      }
      return partial;
    });
    return queueEntry;
  },

  removeSlideshowQueueEntry: (entryId) =>
    set((state) => {
      const index = state.slideshowQueueEntries.findIndex((entry) => entry.id === entryId);
      if (index === -1) {
        return {};
      }
      const entries = state.slideshowQueueEntries.filter((entry) => entry.id !== entryId);
      const removingActive = state.activeSlideshowEntryId === entryId;
      const partial: Partial<ViewerState> = {
        slideshowQueueEntries: entries,
      };

      if (removingActive) {
        if (entries.length === 0) {
          partial.currentSlidePath = null;
          partial.activeSlideshowEntryId = null;
          partial.autoSlideEnabled = false;
        } else {
          const nextIndex = Math.min(index, entries.length - 1);
          partial.activeSlideshowEntryId = entries[nextIndex].id;
          partial.currentSlidePath = entries[nextIndex].sourcePath;
        }
      }

      if (entries.length === 0) {
        partial.slideshowQueueName = DEFAULT_SLIDESHOW_NAME;
        partial.activeSlideshowId = null;
      }

      return partial;
    }),

  clearSlideshowQueue: () =>
    set(() => ({
      slideshowQueueEntries: [],
      activeSlideshowEntryId: null,
      currentSlidePath: null,
      autoSlideEnabled: false,
      slideshowQueueName: DEFAULT_SLIDESHOW_NAME,
      activeSlideshowId: null,
      slideshowQueueLoading: false,
    })),

  setSlideshowQueueFromSources: (entries, metadata) =>
    set((state) => {
      const queueEntries = materializeQueueItems(entries);
      const activeIndex = metadata?.activeIndex ?? 0;
      const activeEntry = queueEntries[activeIndex] ?? queueEntries[0];
      const shouldAutoStart = metadata?.autoStart ?? true;
      const resolvedName =
        metadata?.name ??
        (state.activeSlideshowId ? state.slideshowQueueName : DEFAULT_SLIDESHOW_NAME);
      const hasExplicitId = metadata ? Object.prototype.hasOwnProperty.call(metadata, 'activeSlideshowId') : false;
      const resolvedActiveId = hasExplicitId
        ? metadata!.activeSlideshowId ?? null
        : state.activeSlideshowId ?? null;
      return {
        slideshowQueueEntries: queueEntries,
        activeSlideshowEntryId: activeEntry ? activeEntry.id : null,
        currentSlidePath: shouldAutoStart ? (activeEntry ? activeEntry.sourcePath : null) : state.currentSlidePath,
        slideshowQueueName: resolvedName,
        activeSlideshowId: resolvedActiveId,
      };
    }),

  setSlideshowQueueName: (name) => set({ slideshowQueueName: name }),

  setActiveSlideshowEntryId: (entryId) => set({ activeSlideshowEntryId: entryId }),

  setActiveSlideshowId: (id) => set({ activeSlideshowId: id }),
  setSlideshowQueueLoading: (loading) => set({ slideshowQueueLoading: loading }),

  advanceSlideshowQueue: () =>
    set((state) => {
      if (state.slideshowQueueEntries.length === 0) {
        return {};
      }
      const currentIndex = state.activeSlideshowEntryId
        ? state.slideshowQueueEntries.findIndex((entry) => entry.id === state.activeSlideshowEntryId)
        : 0;
      const nextEntry = state.slideshowQueueEntries[currentIndex + 1];
      if (!nextEntry) {
        return {
          currentSlidePath: null,
          activeSlideshowEntryId: null,
          autoSlideEnabled: false,
        };
      }
      return {
        currentSlidePath: nextEntry.sourcePath,
        activeSlideshowEntryId: nextEntry.id,
      };
    }),

  moveSlideshowQueueEntry: (entryId, targetIndex) =>
    set((state) => {
      const currentIndex = state.slideshowQueueEntries.findIndex((entry) => entry.id === entryId);
      if (currentIndex === -1) {
        return {};
      }
      const normalizedTarget = clampPosition(targetIndex, state.slideshowQueueEntries.length - 1);
      if (currentIndex === normalizedTarget) {
        return {};
      }
      const entries = [...state.slideshowQueueEntries];
      const [entry] = entries.splice(currentIndex, 1);
      entries.splice(normalizedTarget, 0, entry);
      const partial: Partial<ViewerState> = {
        slideshowQueueEntries: entries,
      };
      if (state.activeSlideshowEntryId === entryId) {
        partial.activeSlideshowEntryId = entry.id;
        partial.currentSlidePath = entry.sourcePath;
      }
      return partial;
    }),

  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  setSidebarWidth: (width) => set({ sidebarWidth: Math.min(500, Math.max(180, width)) }),

  setThumbnailPosition: (position) => set({ thumbnailPosition: position }),

  toggleSlideshowManager: () => set((state) => ({ showSlideshowManager: !state.showSlideshowManager })),

  setAutoSlideEnabled: (enabled) => set({ autoSlideEnabled: enabled }),

  setAutoSlideInterval: (interval) => set({ autoSlideInterval: Math.max(1000, interval) }),

  showAutoSlideOverlay: (value) => {
    set({ autoSlideIntervalOverlay: { visible: true, value } });
    setTimeout(() => {
      set((state) => ({ autoSlideIntervalOverlay: { ...state.autoSlideIntervalOverlay, visible: false } }));
    }, 1000);
  },

  loadFolderPositions: (sourcePath) => {
    const key = `folder-positions:${sourcePath}`;
    let data: Record<string, number> = {};
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        data = JSON.parse(raw);
      }
    } catch (error) {
      console.error('Failed to load folder positions', error);
    }
    set({ folderPositions: data, folderPositionsKey: key });
  },

  setFolderPosition: (folderId, index) =>
    set((state) => {
      const normalized = normalizeFolder(folderId);
      const updated = { ...state.folderPositions, [normalized]: Math.max(0, index) };
      if (state.folderPositionsKey) {
        try {
          localStorage.setItem(state.folderPositionsKey, JSON.stringify(updated));
        } catch (error) {
          console.error('Failed to persist folder positions', error);
        }
      }
      return { folderPositions: updated };
    }),

  getFolderPosition: (folderId) => {
    const normalized = normalizeFolder(folderId);
    return get().folderPositions[normalized];
  },

  clearFolderPositions: () =>
    set((state) => {
      if (state.folderPositionsKey) {
        try {
          localStorage.removeItem(state.folderPositionsKey);
        } catch (error) {
          console.error('Failed to clear folder positions', error);
        }
      }
      return { folderPositions: {}, folderPositionsKey: null };
    }),

  reset: () =>
    set((state) => {
      if (state.folderPositionsKey) {
        try {
          localStorage.removeItem(state.folderPositionsKey);
        } catch (error) {
          console.error('Failed to clear folder positions', error);
        }
      }
      return {
      currentSource: null,
      currentSession: null,
      images: [],
      currentPageIndex: 0,
      readingDirection: ReadingDirection.LTR,
      viewMode: ViewMode.SINGLE,
      zoomLevel: 1.0,
      fitMode: FitMode.FIT_HEIGHT,
      rotation: Rotation.NONE,
      isFullscreen: false,
      showThumbnails: true,
      showFolderTree: false,
      sidebarTab: 'folders',
      showBookmarks: false,
      showSlideshowManager: false,
      thumbnailPosition: 'sidebar',
      autoSlideEnabled: false,
      autoSlideInterval: 5000,
      autoSlideIntervalOverlay: { visible: false, value: 5000 },
      folderPositions: {},
      folderPositionsKey: null,
      slideshowRoot: null,
      currentSlidePath: null,
      slideshowQueueEntries: [],
      activeSlideshowEntryId: null,
      slideshowQueueName: '',
      activeSlideshowId: null,
      activeFolderId: null,
      searchQuery: '',
      bookmarks: [],
      isLoading: false,
      error: null,
      recentSources: [],
      };
    }),
}));

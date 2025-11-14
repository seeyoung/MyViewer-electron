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

interface ViewerState {
  // Source state
  currentSource: SourceDescriptor | null;
  currentSession: ViewingSession | null;
  images: Image[];
  recentSources: SourceDescriptor[];

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
  setSidebarTab: (tab: 'folders' | 'thumbnails') => void;
  setSidebarWidth: (width: number) => void;
  setThumbnailPosition: (position: 'sidebar' | 'bottom') => void;
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

export const useViewerStore = create<ViewerState>((set, get) => ({
  // Initial state
  currentSource: null,
  currentSession: null,
  images: [],
  recentSources: [],

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

  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  setSidebarWidth: (width) => set({ sidebarWidth: Math.min(500, Math.max(180, width)) }),

  setThumbnailPosition: (position) => set({ thumbnailPosition: position }),

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
      thumbnailPosition: 'sidebar',
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
      recentSources: [],
      };
    }),
}));

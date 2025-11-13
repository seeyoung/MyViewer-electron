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
  showBookmarks: boolean;

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
  reset: () => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
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
  showBookmarks: false,

  activeFolderId: null,
  searchQuery: '',

  bookmarks: [],

  isLoading: false,
  error: null,

  // Actions
  setSource: (source) => set({ currentSource: source }),

  setSession: (session) => set({ currentSession: session || null }),

  setImages: (images) => set({ images }),

  navigateToPage: (index) =>
    set((state) => ({
      currentPageIndex: Math.max(0, Math.min(index, state.images.length - 1)),
    })),

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

  reset: () =>
    set({
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
      activeFolderId: null,
      searchQuery: '',
      bookmarks: [],
      isLoading: false,
      error: null,
      recentSources: [],
    }),
}));

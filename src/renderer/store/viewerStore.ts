import { create } from 'zustand';
import { Archive } from '@shared/types/Archive';
import { Image } from '@shared/types/Image';
import { Bookmark } from '@shared/types/Bookmark';
import {
  ViewMode,
  ReadingDirection,
  FitMode,
  Rotation,
} from '@shared/types/ViewingSession';

interface ViewerState {
  // Archive state
  currentArchive: Archive | null;
  images: Image[];

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
  setArchive: (archive: Archive) => void;
  setImages: (images: Image[]) => void;
  navigateToPage: (index: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setZoomLevel: (level: number) => void;
  setFitMode: (mode: FitMode) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  // Initial state
  currentArchive: null,
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
  showBookmarks: false,

  activeFolderId: null,
  searchQuery: '',

  bookmarks: [],

  isLoading: false,
  error: null,

  // Actions
  setArchive: (archive) => set({ currentArchive: archive }),

  setImages: (images) => set({ images }),

  navigateToPage: (index) =>
    set((state) => ({
      currentPageIndex: Math.max(0, Math.min(index, state.images.length - 1)),
    })),

  setViewMode: (mode) => set({ viewMode: mode }),

  setZoomLevel: (level) => set({ zoomLevel: Math.max(0.1, Math.min(10, level)), fitMode: FitMode.CUSTOM }),
  
  setFitMode: (mode) => set({ fitMode: mode }),

  setFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),

  setError: (error) => set({ error }),

  setLoading: (loading) => set({ isLoading: loading }),

  reset: () =>
    set({
      currentArchive: null,
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
      showBookmarks: false,
      activeFolderId: null,
      searchQuery: '',
      bookmarks: [],
      isLoading: false,
      error: null,
    }),
}));

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
import { ScanStatus, ScanProgress } from '@shared/types/Scan';
import { Playlist, PlaylistEntry } from '@shared/types/playlist';

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

  // Scan state
  scanStatus: ScanStatus;
  scanToken: string | null;
  scanProgress: ScanProgress | null;
  estimatedTotal: number | undefined;

  // Playlist state
  playlists: Playlist[];
  activePlaylist: Playlist | null;
  playlistEntries: PlaylistEntry[];
  currentEntryIndex: number;
  isPlaylistMode: boolean;
  autoAdvanceToNextEntry: boolean;
  playlistLoopMode: 'none' | 'playlist' | 'entry';
  showPlaylistPanel: boolean;

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
  setScanStatus: (status: ScanStatus) => void;
  setScanToken: (token: string | null) => void;
  setScanProgress: (progress: ScanProgress | null) => void;
  setEstimatedTotal: (total: number | undefined) => void;
  addImageChunk: (images: Image[]) => void;
  reset: () => void;

  // Playlist actions
  setPlaylists: (playlists: Playlist[]) => void;
  setActivePlaylist: (playlist: Playlist | null) => void;
  setPlaylistEntries: (entries: PlaylistEntry[]) => void;
  setCurrentEntryIndex: (index: number) => void;
  togglePlaylistMode: () => void;
  toggleAutoAdvance: () => void;
  setPlaylistLoopMode: (mode: 'none' | 'playlist' | 'entry') => void;
  togglePlaylistPanel: () => void;
  goToNextEntry: () => Promise<void>;
  goToPrevEntry: () => Promise<void>;
  goToEntryByIndex: (index: number) => Promise<void>;
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

  scanStatus: ScanStatus.IDLE,
  scanToken: null,
  scanProgress: null,
  estimatedTotal: undefined,

  // Playlist initial state
  playlists: [],
  activePlaylist: null,
  playlistEntries: [],
  currentEntryIndex: -1,
  isPlaylistMode: false,
  autoAdvanceToNextEntry: true,
  playlistLoopMode: 'none',
  showPlaylistPanel: false,

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

  setScanStatus: (status) => set({ scanStatus: status }),

  setScanToken: (token) => set({ scanToken: token }),

  setScanProgress: (progress) => set({ scanProgress: progress }),

  setEstimatedTotal: (total) => set({ estimatedTotal: total }),

  addImageChunk: (newImages) =>
    set((state) => {
      // Merge new images with existing ones
      const existingIds = new Set(state.images.map(img => img.id));
      const uniqueNewImages = newImages.filter(img => !existingIds.has(img.id));
      return { images: [...state.images, ...uniqueNewImages] };
    }),

  // Playlist actions
  setPlaylists: (playlists) => set({ playlists }),

  setActivePlaylist: (playlist) =>
    set({
      activePlaylist: playlist,
      playlistEntries: [],
      currentEntryIndex: -1,
    }),

  setPlaylistEntries: (entries) => set({ playlistEntries: entries }),

  setCurrentEntryIndex: (index) => set({ currentEntryIndex: index }),

  togglePlaylistMode: () =>
    set((state) => ({ isPlaylistMode: !state.isPlaylistMode })),

  toggleAutoAdvance: () =>
    set((state) => ({ autoAdvanceToNextEntry: !state.autoAdvanceToNextEntry })),

  setPlaylistLoopMode: (mode) => set({ playlistLoopMode: mode }),

  togglePlaylistPanel: () =>
    set((state) => ({ showPlaylistPanel: !state.showPlaylistPanel })),

  goToNextEntry: async () => {
    const state = get();
    const { playlistEntries, currentEntryIndex, playlistLoopMode } = state;

    if (playlistEntries.length === 0) {
      return;
    }

    let nextIndex = currentEntryIndex + 1;

    // Handle loop mode
    if (nextIndex >= playlistEntries.length) {
      if (playlistLoopMode === 'playlist') {
        nextIndex = 0; // Loop to first entry
      } else {
        return; // Stop at last entry
      }
    }

    const nextEntry = playlistEntries[nextIndex];
    if (!nextEntry) {
      return;
    }

    // Update entry index
    set({ currentEntryIndex: nextIndex });

    // Open the next source
    const ipcClient = await import('../services/ipc');
    const { useArchive } = await import('../hooks/useArchive');

    try {
      // Determine if it's a folder or archive and open appropriately
      if (nextEntry.source_type === 'folder') {
        // Open folder - will be handled by useArchive hook
        console.log('Opening folder:', nextEntry.source_path);
      } else {
        // Open archive
        console.log('Opening archive:', nextEntry.source_path);
      }
    } catch (error) {
      console.error('Failed to open next playlist entry:', error);
      set({ error: `Failed to open: ${nextEntry.label}` });
    }
  },

  goToPrevEntry: async () => {
    const state = get();
    const { playlistEntries, currentEntryIndex, playlistLoopMode } = state;

    if (playlistEntries.length === 0) {
      return;
    }

    let prevIndex = currentEntryIndex - 1;

    // Handle loop mode
    if (prevIndex < 0) {
      if (playlistLoopMode === 'playlist') {
        prevIndex = playlistEntries.length - 1; // Loop to last entry
      } else {
        return; // Stop at first entry
      }
    }

    const prevEntry = playlistEntries[prevIndex];
    if (!prevEntry) {
      return;
    }

    // Update entry index
    set({ currentEntryIndex: prevIndex });

    // Open the previous source
    try {
      if (prevEntry.source_type === 'folder') {
        console.log('Opening folder:', prevEntry.source_path);
      } else {
        console.log('Opening archive:', prevEntry.source_path);
      }
    } catch (error) {
      console.error('Failed to open previous playlist entry:', error);
      set({ error: `Failed to open: ${prevEntry.label}` });
    }
  },

  goToEntryByIndex: async (index) => {
    const state = get();
    const { playlistEntries } = state;

    if (index < 0 || index >= playlistEntries.length) {
      console.warn('Invalid playlist entry index:', index);
      return;
    }

    const entry = playlistEntries[index];
    if (!entry) {
      return;
    }

    // Update entry index
    set({ currentEntryIndex: index });

    // Open the source
    try {
      if (entry.source_type === 'folder') {
        console.log('Opening folder:', entry.source_path);
      } else {
        console.log('Opening archive:', entry.source_path);
      }
    } catch (error) {
      console.error('Failed to open playlist entry:', error);
      set({ error: `Failed to open: ${entry.label}` });
    }
  },

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
      scanStatus: ScanStatus.IDLE,
      scanToken: null,
      scanProgress: null,
      estimatedTotal: undefined,
      };
    }),
}));

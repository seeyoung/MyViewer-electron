import { StateCreator } from 'zustand';
import { Image } from '@shared/types/Image';
import { SourceDescriptor } from '@shared/types/Source';
import { ViewingSession, ViewMode, ReadingDirection, FitMode, Rotation } from '@shared/types/ViewingSession';
import { Bookmark } from '@shared/types/Bookmark';
import { ViewerState } from '../viewerStore';

export interface ViewerSlice {
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
    setActiveFolderId: (folderId: string | null) => void;
    setError: (error: string | null) => void;
    setLoading: (loading: boolean) => void;
    setRecentSources: (sources: SourceDescriptor[]) => void;
    addRecentSource: (source: SourceDescriptor) => void;
    removeRecentSource: (source: SourceDescriptor) => void;
}

export const createViewerSlice: StateCreator<ViewerState, [], [], ViewerSlice> = (set) => ({
    currentSource: null,
    currentSession: null,
    images: [],
    recentSources: [],
    currentPageIndex: 0,
    readingDirection: ReadingDirection.LTR,
    viewMode: ViewMode.SINGLE,
    zoomLevel: 1.0,
    fitMode: FitMode.FIT_WIDTH,
    rotation: Rotation.NONE,
    activeFolderId: null,
    searchQuery: '',
    bookmarks: [],
    isLoading: false,
    error: null,

    setSource: (source) => set({ currentSource: source }),
    setSession: (session) => set((state) => {
        if (!session) {
            return { currentSession: null };
        }
        return {
            currentSession: session,
            currentPageIndex: session.currentPageIndex,
            readingDirection: session.readingDirection,
            viewMode: session.viewMode,
            zoomLevel: session.zoomLevel,
            fitMode: session.fitMode,
            rotation: session.rotation,
            activeFolderId: session.activeFolderId,
            searchQuery: session.searchQuery,
        };
    }),
    setImages: (images) => set({ images }),
    navigateToPage: (index) => set({ currentPageIndex: index }),
    setViewMode: (mode) => set({ viewMode: mode }),
    setZoomLevel: (level) => set({ zoomLevel: level }),
    setFitMode: (mode) => set({ fitMode: mode }),
    setActiveFolderId: (folderId) => set({ activeFolderId: folderId }),
    setError: (error) => set({ error }),
    setLoading: (loading) => set({ isLoading: loading }),
    setRecentSources: (sources) => set({ recentSources: sources }),
    addRecentSource: (source) => set((state) => {
        const exists = state.recentSources.some(s => s.path === source.path && s.type === source.type);
        if (exists) return {};
        return { recentSources: [source, ...state.recentSources].slice(0, 10) };
    }),
    removeRecentSource: (source) => set((state) => ({
        recentSources: state.recentSources.filter(s => !(s.path === source.path && s.type === source.type))
    })),
});

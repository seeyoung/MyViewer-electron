import { StateCreator } from 'zustand';
import { ViewerState } from '../viewerStore';

export interface UISlice {
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

    // Folder tree state
    folderPositions: Record<string, number>;
    folderPositionsKey: string | null;

    // Actions
    setFullscreen: (fullscreen: boolean) => void;
    setShowFolderTree: (visible: boolean) => void;
    toggleFolderTree: () => void;
    loadFolderPositions: () => void;
    setFolderPosition: (folderId: string, position: number) => void;
    setShowThumbnails: (visible: boolean) => void;
    setSidebarTab: (tab: 'folders' | 'thumbnails') => void;
    setSidebarWidth: (width: number) => void;
    setThumbnailPosition: (position: 'sidebar' | 'bottom') => void;
    setShowBookmarks: (visible: boolean) => void;
    setShowSlideshowManager: (visible: boolean) => void;
    toggleSlideshowManager: () => void;
}

export const createUISlice: StateCreator<ViewerState, [], [], UISlice> = (set) => ({
    isFullscreen: false,
    showThumbnails: true,
    showFolderTree: true,
    sidebarTab: 'folders',
    sidebarWidth: 250,
    thumbnailPosition: 'bottom',
    showBookmarks: false,
    showSlideshowManager: false,
    folderPositions: {},
    folderPositionsKey: null,

    setFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),
    setShowFolderTree: (visible) => set({ showFolderTree: visible }),
    toggleFolderTree: () => set((state) => ({ showFolderTree: !state.showFolderTree })),
    loadFolderPositions: () => {
        try {
            const saved = localStorage.getItem('folderPositions');
            if (saved) {
                set({ folderPositions: JSON.parse(saved) });
            }
        } catch (e) {
            console.error('Failed to load folder positions', e);
        }
    },
    setFolderPosition: (folderId, position) => set((state) => {
        const newPositions = { ...state.folderPositions, [folderId]: position };
        localStorage.setItem('folderPositions', JSON.stringify(newPositions));
        return { folderPositions: newPositions };
    }),
    setShowThumbnails: (visible) => set({ showThumbnails: visible }),
    setSidebarTab: (tab) => set({ sidebarTab: tab }),
    setSidebarWidth: (width) => set({ sidebarWidth: width }),
    setThumbnailPosition: (position) => set({ thumbnailPosition: position }),
    setShowBookmarks: (visible) => set({ showBookmarks: visible }),
    setShowSlideshowManager: (visible) => set({ showSlideshowManager: visible }),
    toggleSlideshowManager: () => set((state) => ({ showSlideshowManager: !state.showSlideshowManager })),
});

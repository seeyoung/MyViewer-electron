export enum ViewMode {
  SINGLE = 'single', // One page at a time
  TWO_PAGE = 'two_page', // Two pages side-by-side
}

export enum ReadingDirection {
  LTR = 'ltr', // Left-to-right (Western comics, photos)
  RTL = 'rtl', // Right-to-left (Manga, some comics)
}

export enum FitMode {
  FIT_WIDTH = 'fit_width', // Fit to window width
  FIT_HEIGHT = 'fit_height', // Fit to window height
  ACTUAL_SIZE = 'actual_size', // 100% (no scaling)
  CUSTOM = 'custom', // Manual zoom (use zoomLevel)
}

export enum Rotation {
  NONE = 0,
  CLOCKWISE_90 = 90,
  ROTATE_180 = 180,
  COUNTERCLOCKWISE_90 = 270,
}

import { SourceType } from './Source';

export interface ViewingSession {
  // Identification
  id: string; // UUID
  sourceId?: string; // Active source ID (archive ID or folder ID)
  sourcePath: string; // Source path on disk
  sourceType: SourceType;

  // Navigation state
  currentPageIndex: number; // Current page (0-based)
  readingDirection: ReadingDirection; // LTR or RTL

  // View settings
  viewMode: ViewMode; // SINGLE | TWO_PAGE
  zoomLevel: number; // 1.0 = 100%, 0.5 = 50%, 2.0 = 200%
  fitMode: FitMode; // FIT_WIDTH | FIT_HEIGHT | ACTUAL_SIZE | CUSTOM
  rotation: Rotation; // 0 | 90 | 180 | 270 degrees

  // UI visibility
  showThumbnails: boolean; // Thumbnail panel visible
  showFolderTree: boolean; // Folder tree panel visible
  showBookmarks: boolean; // Bookmark panel visible

  // Filter/search
  activeFolderId?: string; // If set, show only images from this folder
  searchQuery?: string; // Active search filter

  // Timestamps
  startedAt: number; // Session start
  lastActivityAt: number; // Last interaction (for auto-resume)
}

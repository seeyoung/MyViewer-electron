/**
 * IPC Channel Constants
 * Centralized channel names to prevent typos and ensure consistency
 * between main and renderer processes
 */

// Archive operations
export const ARCHIVE_OPEN = 'archive:open';
export const ARCHIVE_CLOSE = 'archive:close';
export const ARCHIVE_LIST_IMAGES = 'archive:list-images';
export const ARCHIVE_SCAN_CANCEL = 'archive:scan-cancel';
export const FOLDER_OPEN = 'folder:open';
export const FOLDER_SCAN_CANCEL = 'folder:scan-cancel';

// Scan events (main → renderer)
export const FOLDER_SCAN_PROGRESS = 'folder:scan-progress';
export const FOLDER_SCAN_COMPLETE = 'folder:scan-complete';
export const ARCHIVE_SCAN_COMPLETE = 'archive:scan-complete';

// Image operations
export const IMAGE_LOAD = 'image:load';
export const IMAGE_GET_THUMBNAIL = 'image:get-thumbnail';
export const IMAGE_GENERATE_THUMBNAIL = 'image:generate-thumbnail';
export const IMAGE_GENERATE_THUMBNAILS_BATCH = 'image:generate-thumbnails-batch';

// Session operations
export const SESSION_GET = 'session:get';
export const SESSION_UPDATE = 'session:update';

// Filesystem helpers
export const FS_STAT = 'fs:stat';

// Recent sources
export const RECENT_SOURCES_GET = 'recentSources:get';
export const RECENT_SOURCES_ADD = 'recentSources:add';
export const RECENT_SOURCES_CLEAR = 'recentSources:clear';
export const RECENT_SOURCES_REMOVE = 'recentSources:remove';

// Bookmark operations
export const BOOKMARKS_LIST = 'bookmarks:list';
export const BOOKMARKS_CREATE = 'bookmarks:create';
export const BOOKMARKS_UPDATE = 'bookmarks:update';
export const BOOKMARKS_DELETE = 'bookmarks:delete';

// Events (main → renderer)
export const THUMBNAIL_GENERATED = 'thumbnail:generated';
export const ARCHIVE_SCAN_PROGRESS = 'archive:scan-progress';

// Settings operations
export const SETTINGS_GET = 'settings:get';
export const SETTINGS_UPDATE = 'settings:update';

// Playlist operations
export const PLAYLIST_CREATE = 'playlist:create';
export const PLAYLIST_UPDATE = 'playlist:update';
export const PLAYLIST_DELETE = 'playlist:delete';
export const PLAYLIST_GET_ALL = 'playlist:get-all';
export const PLAYLIST_GET_BY_ID = 'playlist:get-by-id';

// Playlist entry operations
export const PLAYLIST_ADD_ENTRY = 'playlist:add-entry';
export const PLAYLIST_ADD_ENTRIES_BATCH = 'playlist:add-entries-batch';
export const PLAYLIST_REMOVE_ENTRY = 'playlist:remove-entry';
export const PLAYLIST_REORDER_ENTRIES = 'playlist:reorder-entries';
export const PLAYLIST_UPDATE_ENTRY = 'playlist:update-entry';
export const PLAYLIST_CLEANUP_INVALID = 'playlist:cleanup-invalid';

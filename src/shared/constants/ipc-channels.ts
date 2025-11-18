/**
 * IPC Channel Constants
 * Centralized channel names to prevent typos and ensure consistency
 * between main and renderer processes
 */

// Archive operations
export const ARCHIVE_OPEN = 'archive:open';
export const ARCHIVE_CLOSE = 'archive:close';
export const ARCHIVE_LIST_IMAGES = 'archive:list-images';
export const FOLDER_OPEN = 'folder:open';

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

// Slideshow management
export const SLIDESHOW_LIST = 'slideshow:list';
export const SLIDESHOW_GET = 'slideshow:get';
export const SLIDESHOW_CREATE = 'slideshow:create';
export const SLIDESHOW_UPDATE = 'slideshow:update';
export const SLIDESHOW_DELETE = 'slideshow:delete';
export const SLIDESHOW_SET_ENTRIES = 'slideshow:set-entries';
export const SLIDESHOW_ADD_ENTRY = 'slideshow:add-entry';

/**
 * IPC Channel Constants
 * Centralized channel names to prevent typos and ensure consistency
 * between main and renderer processes
 */

// Archive operations
export const ARCHIVE_OPEN = 'archive:open';
export const ARCHIVE_CLOSE = 'archive:close';
export const ARCHIVE_LIST_IMAGES = 'archive:list-images';

// Image operations
export const IMAGE_LOAD = 'image:load';
export const IMAGE_GENERATE_THUMBNAIL = 'image:generate-thumbnail';
export const IMAGE_GENERATE_THUMBNAILS_BATCH = 'image:generate-thumbnails-batch';

// Session operations
export const SESSION_GET = 'session:get';
export const SESSION_UPDATE = 'session:update';

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

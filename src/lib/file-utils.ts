import path from 'path';

/**
 * Sanitize file path to prevent path traversal attacks
 * Removes '..' and ensures path doesn't start with '/'
 */
export function sanitizePath(filePath: string): string {
  // Normalize the path
  const normalized = path.normalize(filePath);

  // Check for path traversal attempts
  if (normalized.includes('..')) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }

  // Remove leading slash to prevent absolute path access
  return normalized.replace(/^\/+/, '');
}

/**
 * Validate that a path is safe to use
 * Throws error if path contains dangerous patterns
 */
export function validatePath(filePath: string): void {
  // Check for null bytes (can bypass security checks)
  if (filePath.includes('\0')) {
    throw new Error(`Null byte detected in path: ${filePath}`);
  }

  // Check for path traversal
  if (filePath.includes('..')) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }

  // Check for absolute paths (should use relative paths within archives)
  if (path.isAbsolute(filePath)) {
    throw new Error(`Absolute path not allowed: ${filePath}`);
  }
}

/**
 * Get the parent directory path
 */
export function getParentPath(filePath: string): string {
  const normalized = path.normalize(filePath);
  const dir = path.dirname(normalized);
  return dir === '.' ? '' : dir;
}

/**
 * Get the filename without extension
 */
export function getFileNameWithoutExtension(filePath: string): string {
  const basename = path.basename(filePath);
  const ext = path.extname(basename);
  return basename.slice(0, -ext.length);
}

/**
 * Get file extension (without dot)
 */
export function getFileExtension(filePath: string): string {
  const ext = path.extname(filePath);
  return ext.startsWith('.') ? ext.slice(1).toLowerCase() : ext.toLowerCase();
}

/**
 * Join path segments safely
 */
export function joinPaths(...segments: string[]): string {
  const joined = path.join(...segments);
  return sanitizePath(joined);
}

/**
 * Check if a path is within a base directory
 */
export function isPathWithinBase(filePath: string, basePath: string): boolean {
  const normalizedFile = path.normalize(filePath);
  const normalizedBase = path.normalize(basePath);

  // Resolve both paths to absolute
  const absoluteFile = path.resolve(normalizedBase, normalizedFile);
  const absoluteBase = path.resolve(normalizedBase);

  // Check if file path starts with base path
  return absoluteFile.startsWith(absoluteBase);
}

/**
 * Split a path into segments
 */
export function splitPath(filePath: string): string[] {
  const normalized = path.normalize(filePath);
  return normalized.split(path.sep).filter(segment => segment.length > 0);
}

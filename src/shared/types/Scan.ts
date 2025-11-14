import { Image } from './Image';
import { FolderNode } from './FolderNode';
import { SourceDescriptor } from './Source';

/**
 * Scan status enumeration
 */
export enum ScanStatus {
  IDLE = 'idle',
  SCANNING = 'scanning',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Initial response when opening a folder/archive with progressive scanning
 */
export interface FolderOpenInitialResponse {
  source: SourceDescriptor;
  initialImages: Image[];
  rootFolder: FolderNode;
  scanToken: string;
  estimatedTotal?: number;
  isComplete: boolean;
}

/**
 * Progress event sent during background scanning
 */
export interface ScanProgressEvent {
  token: string;
  discovered: number;
  processed: number;
  currentPath: string;
  folderChunk?: FolderNode[];
  imageChunk?: Image[];
}

/**
 * Event sent when scanning is complete
 */
export interface ScanCompleteEvent {
  token: string;
  totalImages: number;
  totalFolders: number;
  duration: number;
}

/**
 * Scan progress information for UI display
 */
export interface ScanProgress {
  discovered: number;
  processed: number;
  currentPath: string;
  percentage: number;
}

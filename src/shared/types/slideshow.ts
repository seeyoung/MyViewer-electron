export type SlideshowSourceType = 'folder' | 'archive';

export interface Slideshow {
  id: string;
  name: string;
  description?: string;
  allowDuplicates: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SlideshowEntry {
  slideshowId: string;
  position: number;
  sourcePath: string;
  sourceType: SlideshowSourceType;
  label: string;
}

export interface SlideshowWithEntries {
  slideshow: Slideshow;
  entries: SlideshowEntry[];
}

export interface SlideshowQueueItem {
  id: string;
  sourcePath: string;
  sourceType: SlideshowSourceType;
  label: string;
  duration?: number;
}

export type SlideshowQueueItemInput = Omit<SlideshowQueueItem, 'id'>;

import { Image } from './Image';

export interface FolderNode {
  // Identification
  id: string; // UUID
  archiveId: string; // Parent archive ID

  // Hierarchy
  path: string; // Full path (e.g., "comics/marvel/")
  name: string; // Folder name (e.g., "marvel")
  parentId?: string; // Parent folder ID (undefined for root)

  // Contents
  childFolders: FolderNode[]; // Subfolders
  images: Image[]; // Images directly in this folder

  // Counts (for display)
  totalImageCount: number; // Images in this folder + all subfolders
  directImageCount: number; // Images only in this folder

  // UI state
  isExpanded: boolean; // Folder tree expanded/collapsed
}

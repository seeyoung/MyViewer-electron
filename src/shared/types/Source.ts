export enum SourceType {
  ARCHIVE = 'archive',
  FOLDER = 'folder',
}

export interface SourceDescriptor {
  id: string;
  type: SourceType;
  path: string;
  label: string;
}

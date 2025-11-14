import { useMemo } from 'react';
import { useViewerStore } from '../store/viewerStore';

export function useActiveFolderImages() {
  const images = useViewerStore((state) => state.images);
  const activeFolderId = useViewerStore((state) => state.activeFolderId);

  return useMemo(() => {
    const normalizedFolder = activeFolderId || '/';
    return images.filter((img) => {
      const folderPath = img.folderPath || '/';
      const normalized = folderPath.startsWith('/') ? folderPath : `/${folderPath}`;
      return normalized === normalizedFolder;
    });
  }, [images, activeFolderId]);
}

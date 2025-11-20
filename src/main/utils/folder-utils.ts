import { FolderNode } from '@shared/types/FolderNode';
import { Image } from '@shared/types/Image';

/**
 * Helper: Get all images from folder tree recursively
 */
export function getAllImagesFromFolder(folder: FolderNode): Image[] {
    const images = [...(folder.images || [])];

    for (const childFolder of (folder.childFolders || [])) {
        const childImages = getAllImagesFromFolder(childFolder);
        images.push(...childImages);
    }

    return images;
}

import { randomUUID } from 'crypto';
import { Image } from '@shared/types/Image';
import { FolderNode } from '@shared/types/FolderNode';
import { getParentPath, splitPath } from '@lib/file-utils';
import { naturalSortBy } from '@lib/natural-sort';

export class FolderTreeBuilder {
    /**
     * Builds a hierarchical folder tree from a flat list of images.
     * @param images List of images to organize
     * @param sourceId The ID of the source (archive or folder)
     * @returns The root FolderNode
     */
    static build(images: Image[], sourceId: string): FolderNode {
        const root: FolderNode = {
            id: randomUUID(),
            archiveId: sourceId,
            path: '/',
            name: '',
            parentId: undefined,
            childFolders: [],
            images: [],
            totalImageCount: images.length,
            directImageCount: 0,
            isExpanded: true,
        };

        const folderMap = new Map<string, FolderNode>();
        folderMap.set('/', root);

        for (const image of images) {
            // Determine folder path for the image
            // If pathInArchive is 'foo/bar.jpg', folderPath is 'foo'
            // If pathInArchive is 'bar.jpg', folderPath is '' (which maps to root)
            const folderPath = getParentPath(image.pathInArchive) || '/';
            const normalizedPath = folderPath === '' ? '/' : folderPath;

            // Ensure all parent folders exist
            if (!folderMap.has(normalizedPath)) {
                const segments = splitPath(normalizedPath);
                let currentPath = '/';

                for (let i = 0; i < segments.length; i++) {
                    const segment = segments[i];
                    const parentPath = currentPath;
                    // Construct current path: / -> /foo -> /foo/bar
                    currentPath = currentPath === '/' ? `/${segment}` : `${currentPath}/${segment}`;

                    if (!folderMap.has(currentPath)) {
                        const folder: FolderNode = {
                            id: randomUUID(),
                            archiveId: sourceId,
                            path: currentPath,
                            name: segment,
                            parentId: folderMap.get(parentPath)?.id,
                            childFolders: [],
                            images: [],
                            totalImageCount: 0,
                            directImageCount: 0,
                            isExpanded: false,
                        };

                        folderMap.set(currentPath, folder);
                        const parent = folderMap.get(parentPath);
                        if (parent) {
                            parent.childFolders.push(folder);
                        }
                    }
                }
            }

            // Add image to the appropriate folder
            // Handle case where normalizedPath might not start with / if getParentPath returns relative path
            // But our map keys (except root) are constructed to start with /
            // Let's ensure consistency.
            // In the loop above, currentPath always starts with /.
            // If normalizedPath is 'foo', we want '/foo'.
            // If normalizedPath is '/', it's '/'.
            const lookupPath = normalizedPath === '/' ? '/' : (normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`);

            const folder = folderMap.get(lookupPath);
            if (folder) {
                folder.images.push(image);
                folder.directImageCount++;
            } else {
                // Fallback to root if something goes wrong, though it shouldn't
                root.images.push(image);
                root.directImageCount++;
            }
        }

        // Calculate total image counts recursively
        const calculateTotalCount = (node: FolderNode): number => {
            let total = node.directImageCount;
            for (const child of node.childFolders) {
                total += calculateTotalCount(child);
            }
            node.totalImageCount = total;
            return total;
        };

        calculateTotalCount(root);

        // Sort folders and images
        const sortNode = (node: FolderNode): void => {
            node.childFolders = naturalSortBy(node.childFolders, 'name');
            node.images = naturalSortBy(node.images, 'fileName');
            node.childFolders.forEach(sortNode);
        };

        sortNode(root);

        return root;
    }
}

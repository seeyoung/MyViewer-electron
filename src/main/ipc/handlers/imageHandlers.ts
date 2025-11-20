import { IpcHandlerRegistry } from '../IpcHandlerRegistry';
import { ArchiveService } from '../../services/ArchiveService';
import { ImageService } from '../../services/ImageService';
import { FolderService } from '../../services/FolderService';
import { ThumbnailService } from '../../services/ThumbnailService';
import { withErrorHandling, IpcErrorCode, createIpcError } from '../error-handler';
import * as channels from '@shared/constants/ipc-channels';
import { SourceType } from '@shared/types/Source';
import { Image } from '@shared/types/Image';
import { detectFormatFromExtension } from '@lib/image-utils';
import { getAllImagesFromFolder } from '../../utils/folder-utils';

interface ImageHandlersDependencies {
    registry: IpcHandlerRegistry;
    archiveService: ArchiveService;
    imageService: ImageService;
    folderService: FolderService;
    thumbnailService: ThumbnailService;
}

export function registerImageHandlers({
    registry,
    archiveService,
    imageService,
    folderService,
    thumbnailService,
}: ImageHandlersDependencies): void {
    registry.register(
        channels.IMAGE_LOAD,
        withErrorHandling(async (event, data: any) => {
            const { archiveId, imagePath, encoding, sourceType } = data;

            if (sourceType === SourceType.FOLDER) {
                const folder = folderService.getOpenFolder(archiveId);
                if (!folder) {
                    throw createIpcError(IpcErrorCode.ARCHIVE_NOT_FOUND, 'Folder source not found');
                }

                const buffer = await folderService.loadImage(archiveId, imagePath);
                const format = detectFormatFromExtension(imagePath);

                if (encoding === 'base64') {
                    return { data: buffer.toString('base64'), format };
                }
                return { data: buffer, format };
            }

            const archive = archiveService.getArchive(archiveId);
            if (!archive) {
                throw createIpcError(IpcErrorCode.ARCHIVE_NOT_FOUND, 'Archive not found');
            }

            const images = getAllImagesFromFolder(archive.rootFolder);
            const image = images.find((img) => img.pathInArchive === imagePath);

            if (!image) {
                throw createIpcError(IpcErrorCode.IMAGE_NOT_FOUND, 'Image not found');
            }

            if (encoding === 'base64') {
                const base64 = await imageService.loadImageAsBase64(archiveId, image);
                return { data: base64, format: image.format };
            }
            const buffer = await imageService.loadImage(archiveId, image);
            return { data: buffer, format: image.format };
        })
    );

    registry.register(
        channels.IMAGE_GET_THUMBNAIL,
        withErrorHandling(async (event, data: any) => {
            const { archiveId, image, sourceType, maxWidth, maxHeight, format, quality } = data || {};

            if (!archiveId || !image) {
                throw createIpcError(IpcErrorCode.INVALID_ARGUMENT, 'archiveId and image are required');
            }

            const sanitizedFormat = format === 'jpeg' || format === 'webp' ? format : undefined;

            const thumbnail = await thumbnailService.getThumbnail({
                archiveId,
                image: image as Image,
                sourceType: (sourceType as SourceType) ?? SourceType.ARCHIVE,
                options: {
                    maxWidth,
                    maxHeight,
                    format: sanitizedFormat,
                    quality,
                },
            });

            return thumbnail;
        })
    );
}

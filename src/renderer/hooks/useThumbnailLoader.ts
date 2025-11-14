import { useEffect, useRef, useState, RefObject } from 'react';
import { Image as ViewerImage } from '@shared/types/Image';
import { SourceType } from '@shared/types/Source';
import { useInViewportShared } from './useInViewport';
import { runThumbnailTask } from '../utils/thumbnailRequestQueue';
import { PLACEHOLDER_LOADING, PLACEHOLDER_ERROR } from '../constants/placeholders';

export interface ThumbnailState {
  dataUrl: string;
  status: 'loading' | 'success' | 'error';
  width?: number;
  height?: number;
}

interface UseThumbnailLoaderOptions {
  image: ViewerImage;
  sourceType: SourceType;
  maxHeight: number;
  maxWidth?: number;
  priorityResolver: () => number;
  rootMargin?: string;
  freezeOnceVisible?: boolean;
}

interface UseThumbnailLoaderResult {
  thumbnail: ThumbnailState;
  orientation: 'landscape' | 'portrait';
  cardRef: RefObject<HTMLButtonElement>;
}

export function useThumbnailLoader(options: UseThumbnailLoaderOptions): UseThumbnailLoaderResult {
  const {
    image,
    sourceType,
    maxHeight,
    maxWidth,
    priorityResolver,
    rootMargin = '96px 0px',
    freezeOnceVisible = true,
  } = options;

  const [thumbnail, setThumbnail] = useState<ThumbnailState>({
    dataUrl: PLACEHOLDER_LOADING,
    status: 'loading',
  });
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(() => {
    if (image.dimensions) {
      return image.dimensions.height > image.dimensions.width ? 'portrait' : 'landscape';
    }
    return 'landscape';
  });

  const cardRef = useRef<HTMLButtonElement | null>(null);
  const isVisible = useInViewportShared(cardRef, { rootMargin, threshold: 0, freezeOnceVisible });
  const retryCountRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const maxRetries = 2;

  useEffect(() => {
    let cancelled = false;
    if (!isVisible || hasLoadedRef.current) {
      return undefined;
    }

    const load = async () => {
      setThumbnail({ dataUrl: PLACEHOLDER_LOADING, status: 'loading' });

      try {
        const safeHeight = Math.max(1, Math.round(maxHeight));
        const safeWidth = Math.max(1, Math.round(maxWidth ?? safeHeight * (4 / 3)));

        const response: any = await runThumbnailTask(
          () =>
            window.electronAPI.invoke('image:get-thumbnail', {
              archiveId: image.archiveId,
              image,
              sourceType,
              maxHeight: safeHeight,
              maxWidth: safeWidth,
            }) as Promise<any>,
          priorityResolver()
        );

        if (!cancelled && response?.dataUrl) {
          setThumbnail({
            dataUrl: response.dataUrl as string,
            status: 'success',
            width: typeof response.width === 'number' ? response.width : undefined,
            height: typeof response.height === 'number' ? response.height : undefined,
          });

          hasLoadedRef.current = true;

          if (response.height && response.width) {
            setOrientation(response.height > response.width ? 'portrait' : 'landscape');
          }

          retryCountRef.current = 0;
          return;
        }
      } catch (error) {
        console.error('Failed to load thumbnail', error);

        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCountRef.current));

          if (!cancelled) {
            load();
          }
          return;
        }
      }

      if (!cancelled) {
        setThumbnail({ dataUrl: PLACEHOLDER_ERROR, status: 'error' });
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [image.id, image.pathInArchive, image.fileSize, sourceType, maxHeight, maxWidth, isVisible, priorityResolver]);

  useEffect(() => {
    hasLoadedRef.current = false;
    retryCountRef.current = 0;
    setThumbnail({ dataUrl: PLACEHOLDER_LOADING, status: 'loading' });
  }, [image.id]);

  useEffect(() => {
    if (image.dimensions) {
      setOrientation(image.dimensions.height > image.dimensions.width ? 'portrait' : 'landscape');
    }
  }, [image.dimensions]);

  return { thumbnail, orientation, cardRef };
}

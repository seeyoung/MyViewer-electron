import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useViewerStore } from '../../store/viewerStore';
import { Image as ViewerImage } from '@shared/types/Image';
import * as channels from '@shared/constants/ipc-channels';
import { SourceType } from '@shared/types/Source';
import { useInViewport } from '../../hooks/useInViewport';
import { runThumbnailTask } from '../../utils/thumbnailRequestQueue';

const MAX_THUMBNAILS = 300;
const PANEL_HEIGHT = 150;

const BottomThumbnails: React.FC = () => {
  const images = useViewerStore((state) => state.images);
  const currentSource = useViewerStore((state) => state.currentSource);
  const navigateToPage = useViewerStore((state) => state.navigateToPage);
  const currentPageIndex = useViewerStore((state) => state.currentPageIndex);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [panelHeight, setPanelHeight] = useState(PANEL_HEIGHT);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateHeight = () => {
      const nextHeight = element.clientHeight || PANEL_HEIGHT;
      if (nextHeight > 0) {
        setPanelHeight(nextHeight);
      }
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }

    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === element) {
          const nextHeight = entry.contentRect.height;
          if (nextHeight > 0) {
            setPanelHeight(nextHeight);
          }
        }
      });
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const cardHeight = Math.max(panelHeight - 16, 48);

  const thumbnailImages = useMemo(
    () => images.map((img, index) => ({ img, index })).slice(0, MAX_THUMBNAILS),
    [images]
  );

  useEffect(() => {
    if (!currentSource) {
      return;
    }
    const safeHeight = Math.max(cardHeight, 48);
    const maxWidth = Math.round(safeHeight * (4 / 3));
    const upcoming = thumbnailImages.filter(({ index }) => index > currentPageIndex && index <= currentPageIndex + 8);

    upcoming.forEach(({ img }) => {
      runThumbnailTask(() =>
        window.electronAPI
          .invoke(channels.IMAGE_GET_THUMBNAIL, {
            archiveId: img.archiveId,
            image: img,
            sourceType: currentSource.type ?? SourceType.ARCHIVE,
            maxHeight: safeHeight,
            maxWidth: Math.max(maxWidth, 48),
          })
          .catch(() => undefined)
      );
    });
  }, [currentSource, thumbnailImages, currentPageIndex, cardHeight]);

  return (
    <div className="bottom-thumbnails" style={{ height: PANEL_HEIGHT }} ref={containerRef}>
      <div className="thumbnail-strip">
        {thumbnailImages.map(({ img, index }) => (
          <ThumbnailCard
            key={img.id}
            image={img}
            sourceType={currentSource?.type ?? SourceType.ARCHIVE}
            isActive={index === currentPageIndex}
            onSelect={() => navigateToPage(index)}
            panelHeight={cardHeight}
          />
        ))}
      </div>
      <style>{`
        .bottom-thumbnails {
          border-top: 1px solid #333;
          background: rgba(30,30,30,0.95);
          padding: 0.5rem;
          width: 100%;
          flex-shrink: 0;
        }
        .thumbnail-strip {
          height: 100%;
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          overflow-y: hidden;
          align-items: stretch;
          scroll-behavior: smooth;
        }
        .thumbnail-strip::-webkit-scrollbar {
          height: 6px;
        }
        .thumbnail-strip::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.25);
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
};

interface ThumbnailCardProps {
  image: ViewerImage;
  sourceType: SourceType;
  onSelect: () => void;
  isActive: boolean;
  panelHeight: number;
}

type ThumbnailPayload = {
  dataUrl: string;
  width?: number;
  height?: number;
};

const ThumbnailCard: React.FC<ThumbnailCardProps> = ({ image, sourceType, onSelect, isActive, panelHeight }) => {
  const [thumbnail, setThumbnail] = useState<ThumbnailPayload | null>(null);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(() => {
    if (image.dimensions) {
      return image.dimensions.height > image.dimensions.width ? 'portrait' : 'landscape';
    }
    return 'landscape';
  });
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const isVisible = useInViewport(cardRef, { rootMargin: '96px 0px', threshold: 0, freezeOnceVisible: true });

  useEffect(() => {
    let cancelled = false;
    if (!isVisible) {
      return undefined;
    }

    const loadFallback = async () => {
      try {
        const result: any = await runThumbnailTask(() =>
          window.electronAPI.invoke(channels.IMAGE_LOAD, {
            archiveId: image.archiveId,
            imagePath: image.pathInArchive,
            encoding: 'base64',
            sourceType,
          }) as Promise<any>
        );

        if (!cancelled && result?.data && result?.format) {
          setThumbnail({ dataUrl: `data:image/${result.format};base64,${result.data}` });
        }
      } catch (fallbackError) {
        console.error('Fallback thumbnail load failed', fallbackError);
      }
    };

    const load = async () => {
      setThumbnail(null);
      try {
        const safeHeight = Math.max(panelHeight, 48);
        const maxWidth = Math.round(safeHeight * (4 / 3));
        const response: any = await runThumbnailTask(() =>
          window.electronAPI.invoke(channels.IMAGE_GET_THUMBNAIL, {
            archiveId: image.archiveId,
            image,
            sourceType,
            maxHeight: safeHeight,
            maxWidth: Math.max(maxWidth, 48),
          }) as Promise<any>
        );
        if (!cancelled && response?.dataUrl) {
          const width = typeof response.width === 'number' ? response.width : undefined;
          const height = typeof response.height === 'number' ? response.height : undefined;
          setThumbnail({
            dataUrl: response.dataUrl as string,
            width,
            height,
          });
          if (typeof height === 'number' && typeof width === 'number') {
            setOrientation(height > width ? 'portrait' : 'landscape');
          }
          return;
        }
      } catch (error) {
        console.error('Failed to load bottom thumbnail', error);
      }

      await loadFallback();
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [image.id, image.pathInArchive, image.fileSize, sourceType, panelHeight, isVisible]);

  useEffect(() => {
    if (image.dimensions) {
      setOrientation(image.dimensions.height > image.dimensions.width ? 'portrait' : 'landscape');
    }
  }, [image.dimensions]);

  return (
    <button
      className={`thumbnail-card ${orientation} ${isActive ? 'active' : ''}`}
      style={{ height: `${panelHeight}px` }}
      onClick={onSelect}
      title={image.pathInArchive}
      ref={cardRef}
    >
      {thumbnail ? (
        <img src={thumbnail.dataUrl} alt={image.fileName} loading="lazy" draggable={false} />
      ) : (
        <span>Loading…</span>
      )}
      <style>{`
        .thumbnail-card {
          flex: 0 0 auto;
          width: auto;
          height: 100%;
          aspect-ratio: 4 / 3;
          border: 1px solid #444;
          background: #222;
          border-radius: 6px;
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        .thumbnail-card.portrait {
          aspect-ratio: 3 / 4;
        }
        .thumbnail-card.active {
          border-color: #2da8ff;
          border-width: 2px;
          box-shadow: 0 0 8px rgba(45, 168, 255, 0.4);
        }
        .thumbnail-card:hover {
          border-color: #1484ff;
          transform: translateY(-2px);
        }
        .thumbnail-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background: #111;
        }
        .thumbnail-card.portrait img {
          object-fit: contain;
        }
      `}</style>
    </button>
  );
};

export default BottomThumbnails;

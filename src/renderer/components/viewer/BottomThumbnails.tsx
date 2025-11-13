import React, { useEffect, useMemo, useState } from 'react';
import { useViewerStore } from '../../store/viewerStore';
import { Image as ViewerImage } from '@shared/types/Image';
import * as channels from '@shared/constants/ipc-channels';
import { SourceType } from '@shared/types/Source';

const MAX_THUMBNAILS = 300;

const BottomThumbnails: React.FC = () => {
  const images = useViewerStore((state) => state.images);
  const currentSource = useViewerStore((state) => state.currentSource);
  const navigateToPage = useViewerStore((state) => state.navigateToPage);
  const currentPageIndex = useViewerStore((state) => state.currentPageIndex);

  const thumbnailImages = useMemo(
    () => images.map((img, index) => ({ img, index })).slice(0, MAX_THUMBNAILS),
    [images]
  );

  return (
    <div className="bottom-thumbnails">
      <div className="thumbnail-strip">
        {thumbnailImages.map(({ img, index }) => (
          <ThumbnailCard
            key={img.id}
            image={img}
            sourceType={currentSource?.type ?? SourceType.ARCHIVE}
            isActive={index === currentPageIndex}
            onSelect={() => navigateToPage(index)}
          />
        ))}
      </div>
      <style>{`
        .bottom-thumbnails {
          height: 160px;
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
          align-items: center;
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
}

const ThumbnailCard: React.FC<ThumbnailCardProps> = ({ image, sourceType, onSelect, isActive }) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result: any = await window.electronAPI.invoke(channels.IMAGE_LOAD, {
          archiveId: image.archiveId,
          imagePath: image.pathInArchive,
          encoding: 'base64',
          sourceType,
        });
        if (!cancelled && result?.data && result?.format) {
          setDataUrl(`data:image/${result.format};base64,${result.data}`);
        }
      } catch (error) {
        console.error('Failed to load bottom thumbnail', error);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [image.id, image.pathInArchive, sourceType]);

  return (
    <button
      className={`thumbnail-card ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      title={image.pathInArchive}
    >
      {dataUrl ? (
        <img src={dataUrl} alt={image.fileName} loading="lazy" />
      ) : (
        <span>Loading…</span>
      )}
      <style>{`
        .thumbnail-card {
          width: 160px;
          height: 120px;
          border: ${isActive ? '2px solid #007acc' : '1px solid #444'};
          background: #222;
          border-radius: 6px;
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .thumbnail-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      `}</style>
    </button>
  );
};

export default BottomThumbnails;

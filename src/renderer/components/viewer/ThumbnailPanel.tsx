import React from 'react';
import { Image as ViewerImage } from '@shared/types/Image';
import { SourceType } from '@shared/types/Source';
import { useThumbnailLoader } from '../../hooks/useThumbnailLoader';
import { useAutoCenter } from '../../hooks/useAutoCenter';
import { Priority } from '../../utils/thumbnailRequestQueue';

interface ThumbnailPanelProps {
  images: { img: ViewerImage; index: number }[];
  sourceType: SourceType;
  onSelect: (index: number) => void;
  orientation: 'horizontal' | 'vertical';
  itemSize: number;
  activeIndex: number;
  className?: string;
}

export const ThumbnailPanel: React.FC<ThumbnailPanelProps> = ({
  images,
  sourceType,
  onSelect,
  orientation,
  itemSize,
  activeIndex,
  className,
}) => {
  return (
    <div className={className}>
      {images.map(({ img, index }) => (
        <ThumbnailPanelItem
          key={img.id}
          image={img}
          sourceType={sourceType}
          onSelect={() => onSelect(index)}
          size={itemSize}
          isActive={index === activeIndex}
          orientation={orientation}
        />
      ))}
    </div>
  );
};

interface ThumbnailPanelItemProps {
  image: ViewerImage;
  sourceType: SourceType;
  onSelect: () => void;
  size: number;
  isActive: boolean;
  orientation: 'horizontal' | 'vertical';
}

const ThumbnailPanelItem: React.FC<ThumbnailPanelItemProps> = ({ image, sourceType, onSelect, size, isActive, orientation }) => {
  const priorityResolver = React.useCallback(() => (isActive ? Priority.CURRENT_VIEW : Priority.PREFETCH_NEAR), [isActive]);
  const { thumbnail, orientation: detectedOrientation, cardRef } = useThumbnailLoader({
    image,
    sourceType,
    maxHeight: size,
    maxWidth: size * (orientation === 'horizontal' ? 4 / 3 : 1),
    priorityResolver,
    rootMargin: orientation === 'horizontal' ? '96px 0px' : '64px 0px',
  });

  useAutoCenter(cardRef, { axis: orientation === 'horizontal' ? 'horizontal' : 'vertical', isActive });

  return (
    <button
      className={`thumbnail-panel-item ${thumbnail.status} ${detectedOrientation} ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      ref={cardRef}
      title={thumbnail.status === 'error' ? `Failed to load: ${image.pathInArchive}` : image.pathInArchive}
      style={{ width: orientation === 'horizontal' ? undefined : '100%', height: size }}
    >
      <img src={thumbnail.dataUrl} alt={image.fileName} loading="lazy" className={thumbnail.status} />
      {thumbnail.status === 'error' && <span className="error-badge">⚠️</span>}
    </button>
  );
};

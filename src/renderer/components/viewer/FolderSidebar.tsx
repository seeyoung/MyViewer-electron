import React, { useCallback, useMemo } from 'react';
import { useViewerStore } from '../../store/viewerStore';
import { useImageNavigation } from '../../hooks/useImageNavigation';
import { Image as ViewerImage } from '@shared/types/Image';
import { SourceDescriptor, SourceType } from '@shared/types/Source';
import { Priority } from '../../utils/thumbnailRequestQueue';
import { useThumbnailLoader } from '../../hooks/useThumbnailLoader';
import { useAutoCenter } from '../../hooks/useAutoCenter';

interface FolderNodeView {
  path: string;
  name: string;
  depth: number;
  imageCount: number;
  tooltip: string;
}

const MAX_THUMBNAILS = 200;

function buildFolderList(images: { folderPath: string }[], sourcePath: string): FolderNodeView[] {
  const counts = new Map<string, number>();
  images.forEach((img) => {
    const folder = img.folderPath || '/';
    const normalized = folder.startsWith('/') ? folder : `/${folder}`;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
    const segments = normalized.split('/').filter(Boolean);
    let current = '';
    segments.forEach((segment) => {
      current = `${current}/${segment}`;
      if (!counts.has(current)) {
        counts.set(current, 0);
      }
    });
  });

  const segmentsFromRoot = sourcePath ? sourcePath.replace(/\\/g, '/').split('/').filter(Boolean) : [];
  const sourceName = segmentsFromRoot.length ? segmentsFromRoot[segmentsFromRoot.length - 1] : 'Root';

  const entries: FolderNodeView[] = Array.from(counts.entries()).map(([path, count]) => {
    const segments = path.split('/').filter(Boolean);
    const name = segments.length === 0 ? sourceName : segments[segments.length - 1];
    return {
      path: path === '' ? '/' : path,
      name,
      depth: segments.length,
      imageCount: count,
      tooltip: path === '/' ? sourcePath || '/' : path,
    };
  });

  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

const FolderSidebar: React.FC = () => {
  const images = useViewerStore((state) => state.images);
  const currentSource = useViewerStore((state) => state.currentSource);
  const activeFolderId = useViewerStore((state) => state.activeFolderId);
  const setActiveFolderId = useViewerStore((state) => state.setActiveFolderId);
  const navigateToPage = useViewerStore((state) => state.navigateToPage);
  const sidebarTab = useViewerStore((state) => state.sidebarTab);
  const setSidebarTab = useViewerStore((state) => state.setSidebarTab);
  const sidebarWidth = useViewerStore((state) => state.sidebarWidth);
  const getFolderPosition = useViewerStore((state) => state.getFolderPosition);
  const { currentPageIndex } = useImageNavigation();

  const folders = useMemo(() => buildFolderList(images, currentSource?.path || ''), [images, currentSource]);
  const thumbnailImages = useMemo(() => {
    const currentFolder = activeFolderId || '/';
    return images
      .map((img, index) => ({ img, index }))
      .filter(({ img }) => {
        const folder = img.folderPath || '/';
        const normalized = folder.startsWith('/') ? folder : `/${folder}`;
        return normalized === currentFolder;
      })
      .slice(0, MAX_THUMBNAILS);
  }, [images, activeFolderId]);

  const handleSelect = (folderPath: string) => {
    const normalized = folderPath === '/' ? '/' : folderPath;
    const storedIndex = getFolderPosition(normalized);
    if (storedIndex !== undefined && images[storedIndex]) {
      navigateToPage(storedIndex);
      setActiveFolderId(normalized);
      return;
    }
    const index = images.findIndex((img) => {
      const folder = img.folderPath || '/';
      const normalizedFolder = folder.startsWith('/') ? folder : `/${folder}`;
      return normalizedFolder === normalized;
    });

    if (index >= 0) {
      navigateToPage(index);
      setActiveFolderId(normalized);
    }
  };

  return (
    <aside className="folder-sidebar" style={{ width: sidebarWidth }}>
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${sidebarTab === 'folders' ? 'active' : ''}`}
          onClick={() => setSidebarTab('folders')}
        >
          Folders {folders.length > 1 ? `(${folders.length})` : ''}
        </button>
        <button
          className={`sidebar-tab ${sidebarTab === 'thumbnails' ? 'active' : ''}`}
          onClick={() => setSidebarTab('thumbnails')}
        >
          Thumbnails
        </button>
      </div>
      {sidebarTab === 'folders' ? (
        <div className="folder-list">
          {folders.map((folder) => (
            <button
              key={folder.path}
              className={`folder-item ${activeFolderId === folder.path ? 'active' : ''}`}
              style={{ paddingLeft: `${folder.depth * 12 + 8}px` }}
              onClick={() => handleSelect(folder.path)}
              title={folder.tooltip}
            >
              <span className="name">{folder.name}</span>
              <span className="count">{folder.imageCount}</span>
            </button>
          ))}
        </div>
      ) : (
        <ThumbnailGrid
          images={thumbnailImages}
          source={currentSource}
          onSelect={(index) => navigateToPage(index)}
          width={sidebarWidth}
          activeIndex={currentPageIndex}
        />
      )}
      <style>{`
        .folder-sidebar {
          width: 240px;
          background: rgba(45, 45, 45, 0.95);
          border-right: 1px solid #333;
          display: flex;
          flex-direction: column;
          color: #ddd;
        }
        .sidebar-tabs {
          display: flex;
          border-bottom: 1px solid #333;
        }
        .sidebar-tab {
          flex: 1;
          padding: 0.5rem;
          background: none;
          border: none;
          color: #ccc;
          cursor: pointer;
          font-weight: 600;
        }
        .sidebar-tab.active {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }
        .folder-list {
          flex: 1;
          overflow-y: auto;
        }
        .folder-item {
          width: 100%;
          padding: 0.4rem 0.5rem;
          background: none;
          border: none;
          color: inherit;
          text-align: left;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 1.275rem;
          cursor: pointer;
        }
        .folder-item.active {
          background: rgba(0, 122, 204, 0.3);
        }
        .folder-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .count {
          font-size: 1.125rem;
          color: #999;
        }
        .thumbnail-grid {
          flex: 1;
          overflow-y: auto;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 0.5rem;
          padding: 0.5rem;
        }
        .thumbnail-item {
          border: none;
          background: #2c2c2c;
          border-radius: 6px;
          overflow: hidden;
          position: relative;
          padding: 0;
          cursor: pointer;
          height: 80px;
          transition: transform 0.2s ease;
        }
        .thumbnail-item:hover {
          transform: scale(1.05);
        }
        .thumbnail-item.active {
          border: 2px solid #2da8ff;
          box-shadow: 0 0 10px rgba(45, 168, 255, 0.35);
        }
        .thumbnail-item.error {
          background: #2a1a1a;
          border: 1px solid #ff4444;
        }
        .thumbnail-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          display: block;
        }
        .thumbnail-item.portrait img {
          object-fit: contain;
        }
        .thumbnail-item img.loading {
          opacity: 0.5;
          animation: pulse 1.5s ease-in-out infinite;
        }
        .thumbnail-item img.error {
          opacity: 0.3;
          filter: grayscale(100%);
        }
        .error-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          background: rgba(255, 68, 68, 0.9);
          border-radius: 50%;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </aside>
  );
};

interface ThumbnailGridProps {
  images: { img: ViewerImage; index: number }[];
  source: SourceDescriptor | null;
  onSelect: (index: number) => void;
  width: number;
  activeIndex: number;
}

const ThumbnailGrid: React.FC<ThumbnailGridProps> = ({ images, source, onSelect, width, activeIndex }) => {
  const targetWidth = Math.max(120, width - 60);
  const columnWidth = Math.min(320, targetWidth);
  const cellHeight = Math.round(columnWidth * 0.75);
  return (
    <div
      className="thumbnail-grid"
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(${Math.round(columnWidth)}px, 1fr))`,
      }}
    >
      {images.map(({ img, index }) => (
        <ThumbnailItem
          key={img.id}
          image={img}
          source={source}
          onSelect={() => onSelect(index)}
          height={cellHeight}
          isActive={index === activeIndex}
        />
      ))}
    </div>
  );
};

interface ThumbnailItemProps {
  image: ViewerImage;
  source: SourceDescriptor | null;
  onSelect: () => void;
  height: number;
  isActive: boolean;
}

const ThumbnailItem: React.FC<ThumbnailItemProps> = ({ image, source, onSelect, height, isActive }) => {
  const priorityResolver = useCallback(() => (isActive ? Priority.CURRENT_VIEW : Priority.PREFETCH_NEAR), [isActive]);

  const { thumbnail, orientation, cardRef } = useThumbnailLoader({
    image,
    sourceType: source?.type ?? SourceType.ARCHIVE,
    maxHeight: height,
    maxWidth: height * (4 / 3),
    priorityResolver,
    rootMargin: '64px 0px',
  });

  useAutoCenter(cardRef, { axis: 'vertical', isActive });

  return (
    <button
      className={`thumbnail-item ${thumbnail.status} ${orientation} ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      title={thumbnail.status === 'error' ? `Failed to load: ${image.pathInArchive}` : image.pathInArchive}
      style={{ height }}
      ref={cardRef}
    >
      <img
        src={thumbnail.dataUrl}
        alt={image.fileName}
        loading="lazy"
        className={thumbnail.status}
      />
      {thumbnail.status === 'error' && (
        <span className="error-badge" title="Failed to load thumbnail">⚠️</span>
      )}
    </button>
  );
};

export default FolderSidebar;

import React, { useMemo } from 'react';
import { useViewerStore } from '../../store/viewerStore';
import { useImageNavigation } from '../../hooks/useImageNavigation';

interface FolderNodeView {
  path: string;
  name: string;
  depth: number;
  imageCount: number;
}

function buildFolderList(images: { folderPath: string }[]): FolderNodeView[] {
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

  const entries: FolderNodeView[] = Array.from(counts.entries()).map(([path, count]) => {
    const segments = path.split('/').filter(Boolean);
    const name = segments.length === 0 ? 'Root' : segments[segments.length - 1];
    return {
      path: path === '' ? '/' : path,
      name,
      depth: segments.length,
      imageCount: count,
    };
  });

  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

const FolderSidebar: React.FC = () => {
  const images = useViewerStore((state) => state.images);
  const activeFolderId = useViewerStore((state) => state.activeFolderId);
  const setActiveFolderId = useViewerStore((state) => state.setActiveFolderId);
  const navigateToPage = useViewerStore((state) => state.navigateToPage);
  const { currentPageIndex } = useImageNavigation();

  const folders = useMemo(() => buildFolderList(images), [images]);

  const handleSelect = (folderPath: string) => {
    const normalized = folderPath === '/' ? '/' : folderPath;
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
    <aside className="folder-sidebar">
      <div className="sidebar-header">
        <h4>Folders</h4>
        <span>{folders.length} paths</span>
      </div>
      <div className="folder-list">
        {folders.map((folder) => (
          <button
            key={folder.path}
            className={`folder-item ${activeFolderId === folder.path ? 'active' : ''}`}
            style={{ paddingLeft: `${folder.depth * 12 + 8}px` }}
            onClick={() => handleSelect(folder.path)}
          >
            <span className="name">{folder.name}</span>
            <span className="count">{folder.imageCount}</span>
          </button>
        ))}
      </div>
      <style>{`
        .folder-sidebar {
          width: 220px;
          background: rgba(45, 45, 45, 0.9);
          border-right: 1px solid #333;
          display: flex;
          flex-direction: column;
          color: #ddd;
        }
        .sidebar-header {
          padding: 0.75rem;
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          border-bottom: 1px solid #333;
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
          font-size: 0.85rem;
          cursor: pointer;
        }
        .folder-item.active {
          background: rgba(0, 122, 204, 0.3);
        }
        .folder-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .count {
          font-size: 0.75rem;
          color: #999;
        }
      `}</style>
    </aside>
  );
};

export default FolderSidebar;

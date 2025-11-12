import React from 'react';
import { SourceDescriptor, SourceType } from '@shared/types/Source';

interface RecentSourcesProps {
  sources: SourceDescriptor[];
  onOpen: (source: SourceDescriptor) => Promise<void>;
}

const RecentSources: React.FC<RecentSourcesProps> = ({ sources, onOpen }) => {
  if (!sources.length) {
    return null;
  }

  return (
    <div className="recent-sources">
      <h3>Recent Sources</h3>
      <ul>
        {sources.map((source) => (
          <li key={`${source.type}-${source.path}`}>
            <div className="source-meta">
              <span className="badge">{source.type === SourceType.FOLDER ? 'Folder' : 'Archive'}</span>
              <span className="label">{source.label}</span>
            </div>
            <button onClick={() => onOpen(source)}>Open</button>
          </li>
        ))}
      </ul>
      <style>{`
        .recent-sources {
          margin-top: 1.5rem;
          text-align: left;
        }
        .recent-sources h3 {
          margin-bottom: 0.75rem;
        }
        .recent-sources ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .recent-sources li {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
        }
        .source-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .badge {
          font-size: 0.7rem;
          text-transform: uppercase;
          color: #ccc;
          letter-spacing: 0.05em;
        }
        .label {
          font-weight: 600;
        }
        button {
          padding: 0.25rem 0.75rem;
          background: #007acc;
          border: none;
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
        }
        button:hover {
          background: #1586d8;
        }
      `}</style>
    </div>
  );
};

export default RecentSources;

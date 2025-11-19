import React from 'react';
import { Slideshow } from '@shared/types/slideshow';

interface SlideshowControlsProps {
    savedSlideshows: Slideshow[];
    selectedSlideshowId: string;
    onSelectSlideshow: (id: string) => void;
    onBeginRename: () => void;
    isRenaming: boolean;
    renameValue: string;
    onRenameChange: (value: string) => void;
    onConfirmRename: () => void;
    onCancelRename: () => void;
}

export const SlideshowControls: React.FC<SlideshowControlsProps> = ({
    savedSlideshows,
    selectedSlideshowId,
    onSelectSlideshow,
    onBeginRename,
    isRenaming,
    renameValue,
    onRenameChange,
    onConfirmRename,
    onCancelRename,
}) => {
    return (
        <>
            <div className="panel-row">
                <h3>Slideshow Queue</h3>
                <div className="saved-selector">
                    <select
                        value={selectedSlideshowId}
                        onChange={(e) => onSelectSlideshow(e.target.value)}
                    >
                        <option value="">Load saved list…</option>
                        {savedSlideshows.map((list) => (
                            <option key={list.id} value={list.id}>
                                {list.name}
                            </option>
                        ))}
                    </select>
                    <button className="icon-button" title="Rename list" onClick={onBeginRename}>
                        ✎
                    </button>
                </div>
            </div>

            {isRenaming && (
                <div className="rename-inline">
                    <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => onRenameChange(e.target.value)}
                        autoFocus
                    />
                    <button onClick={onConfirmRename} disabled={!renameValue.trim()}>
                        Save
                    </button>
                    <button onClick={onCancelRename}>Cancel</button>
                </div>
            )}

            <style>{`
        .panel-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }
        .saved-selector {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        .saved-selector select {
          background: #1c1c1c;
          color: #fff;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 4px;
          padding: 0.25rem 0.5rem;
        }
        .saved-selector .icon-button {
          padding: 0.3rem 0.75rem;
          border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.05);
          color: #fff;
          cursor: pointer;
        }
        .rename-inline {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .rename-inline input {
          flex: 1;
          padding: 0.3rem 0.4rem;
          border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(0,0,0,0.4);
          color: #fff;
        }
        .rename-inline button {
          padding: 0.3rem 0.75rem;
          border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.05);
          color: #fff;
          cursor: pointer;
        }
      `}</style>
        </>
    );
};

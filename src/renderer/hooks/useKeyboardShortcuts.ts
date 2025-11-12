import { useEffect } from 'react';
import { useImageNavigation } from './useImageNavigation';
import { useViewerStore } from '../store/viewerStore';

export function useKeyboardShortcuts() {
  const { goToNext, goToPrevious, goToFirst, goToLast } = useImageNavigation();
  const zoomLevel = useViewerStore(state => state.zoomLevel);
  const setZoomLevel = useViewerStore(state => state.setZoomLevel);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ': // Space
          event.preventDefault();
          goToNext();
          break;

        case 'ArrowLeft':
        case 'PageUp':
          event.preventDefault();
          goToPrevious();
          break;

        case 'Home':
          event.preventDefault();
          goToFirst();
          break;

        case 'End':
          event.preventDefault();
          goToLast();
          break;

        case '=':
        case '+':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setZoomLevel(zoomLevel * 1.2);
          }
          break;

        case '-':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setZoomLevel(zoomLevel / 1.2);
          }
          break;

        case '0':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setZoomLevel(1.0);
          }
          break;

        case 'Escape':
          event.preventDefault();
          // 창 최소화
          window.electronAPI.send('window-minimize');
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goToNext, goToPrevious, goToFirst, goToLast, zoomLevel, setZoomLevel]);
}

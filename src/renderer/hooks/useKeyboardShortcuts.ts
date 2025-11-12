import { useEffect } from 'react';
import { useImageNavigation } from './useImageNavigation';
import { useViewerStore } from '../store/viewerStore';

export function useKeyboardShortcuts() {
  const { goToNext, goToPrevious, goToFirst, goToLast } = useImageNavigation();
  const zoomLevel = useViewerStore(state => state.zoomLevel);
  const setZoomLevel = useViewerStore(state => state.setZoomLevel);

  useEffect(() => {
    console.log('⌨️  Initializing keyboard shortcuts...');

    const handleKeyDown = (event: KeyboardEvent) => {
      // DEBUG: 모든 키보드 이벤트 로그
      console.log('🎹 Key pressed:', {
        key: event.key,
        code: event.code,
        target: event.target,
        targetElement: event.target?.tagName,
        isActive: document.hasFocus(),
        windowFocused: document.visibilityState === 'visible'
      });

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
          console.log('⌨️  ESC key pressed in renderer');
          event.preventDefault();
          console.log('📤 Sending window-minimize IPC message');
          // 창 최소화
          window.electronAPI.send('window-minimize');
          break;

        default:
          break;
      }
    };

    console.log('👂 Adding keyboard event listener to document...');
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      console.log('🔇 Removing keyboard event listener...');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [goToNext, goToPrevious, goToFirst, goToLast, zoomLevel, setZoomLevel]);
}

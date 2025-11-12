import { useEffect } from 'react';
import { useImageNavigation } from './useImageNavigation';
import { useViewerStore } from '../store/viewerStore';

export function useKeyboardShortcuts() {
  const { goToNext, goToPrevious, goToFirst, goToLast } = useImageNavigation();
  const zoomLevel = useViewerStore(state => state.zoomLevel);
  const setZoomLevel = useViewerStore(state => state.setZoomLevel);
  const isFullscreen = useViewerStore(state => state.isFullscreen);

  useEffect(() => {
    console.log('⌨️  Initializing keyboard shortcuts...');

    const handleKeyDown = (event: KeyboardEvent) => {
      const targetElement = event.target as (HTMLElement | null);
      // DEBUG: 모든 키보드 이벤트 로그
      console.log('🎹 Key pressed:', {
        key: event.key,
        code: event.code,
        target: targetElement,
        targetElement: targetElement?.tagName,
        isActive: document.hasFocus(),
        windowFocused: document.visibilityState === 'visible'
      });

      // Don't handle if user is typing in an input
      if (
        targetElement instanceof HTMLInputElement ||
        targetElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case 'ArrowRight':
        case 'PageDown':
          event.preventDefault();
          goToNext();
          break;

        case 'Enter': // Enter key for fullscreen
          event.preventDefault();
          window.electronAPI.send('window-toggle-fullscreen');
          break;

        case ' ': // Space (without modifier)
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            // 다음 이미지
            goToNext();
          }
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
          if (isFullscreen) {
            event.preventDefault();
            window.electronAPI.send('window-set-fullscreen', false);
            break;
          }

          break;

        case 'F11':
          console.log('⌨️  F11 key pressed - toggling fullscreen');
          event.preventDefault();
          // 전체 화면 토글
          window.electronAPI.send('window-toggle-fullscreen');
          break;

        case 'b':
        case 'B':
          if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            console.log('⌨️  B key pressed - boss key minimize');
            event.preventDefault();
            window.electronAPI.send('window-minimize');
          }
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
  }, [
    goToNext,
    goToPrevious,
    goToFirst,
    goToLast,
    zoomLevel,
    setZoomLevel,
    isFullscreen,
  ]);
}

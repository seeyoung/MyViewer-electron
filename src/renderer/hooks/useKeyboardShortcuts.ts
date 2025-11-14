import { useEffect } from 'react';
import { useImageNavigation } from './useImageNavigation';
import { useViewerStore } from '../store/viewerStore';
import { FitMode } from '@shared/types/ViewingSession';

export function useKeyboardShortcuts() {
  const { goToNext, goToPrevious, goToFirst, goToLast } = useImageNavigation();
  const zoomLevel = useViewerStore(state => state.zoomLevel);
  const setZoomLevel = useViewerStore(state => state.setZoomLevel);
  const setFitMode = useViewerStore(state => state.setFitMode);
  const isFullscreen = useViewerStore(state => state.isFullscreen);
  const autoSlideEnabled = useViewerStore(state => state.autoSlideEnabled);
  const autoSlideInterval = useViewerStore(state => state.autoSlideInterval);
  const setAutoSlideInterval = useViewerStore(state => state.setAutoSlideInterval);
  const showAutoSlideOverlay = useViewerStore(state => state.showAutoSlideOverlay);

  // Playlist shortcuts
  const goToNextEntry = useViewerStore(state => state.goToNextEntry);
  const goToPrevEntry = useViewerStore(state => state.goToPrevEntry);
  const togglePlaylistPanel = useViewerStore(state => state.togglePlaylistPanel);
  const isPlaylistMode = useViewerStore(state => state.isPlaylistMode);

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

      switch (event.code) {
        case 'ArrowRight':
        case 'PageDown':
          // Ctrl/Cmd + Right Arrow: Next playlist entry
          if ((event.ctrlKey || event.metaKey) && isPlaylistMode) {
            event.preventDefault();
            goToNextEntry();
          } else {
            event.preventDefault();
            goToNext();
          }
          break;

        case 'ArrowLeft':
        case 'PageUp':
          // Ctrl/Cmd + Left Arrow: Previous playlist entry
          if ((event.ctrlKey || event.metaKey) && isPlaylistMode) {
            event.preventDefault();
            goToPrevEntry();
          } else {
            event.preventDefault();
            goToPrevious();
          }
          break;

        case 'KeyP':
          // 'P' key: Toggle playlist panel
          if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
            event.preventDefault();
            togglePlaylistPanel();
          }
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

        case 'ArrowUp':
          if (autoSlideEnabled) {
            event.preventDefault();
            const nextInterval = Math.min(20000, autoSlideInterval + 1000);
            setAutoSlideInterval(nextInterval);
            showAutoSlideOverlay(nextInterval);
          }
          break;

        case 'ArrowDown':
          if (autoSlideEnabled) {
            event.preventDefault();
            const nextInterval = Math.max(1000, autoSlideInterval - 1000);
            setAutoSlideInterval(nextInterval);
            showAutoSlideOverlay(nextInterval);
          }
          break;

        case 'Home':
          event.preventDefault();
          goToFirst();
          break;

        case 'End':
          event.preventDefault();
          goToLast();
          break;

        case 'Equal':
        case 'NumpadAdd':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setZoomLevel(zoomLevel * 1.2);
          }
          break;

        case 'Minus':
        case 'NumpadSubtract':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setZoomLevel(zoomLevel / 1.2);
          }
          break;

        case 'Digit0':
        case 'Numpad0':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setZoomLevel(1.0);
          }
          break;

        case 'KeyO':
          event.preventDefault();
          setZoomLevel(1.0);
          setFitMode(FitMode.ACTUAL_SIZE);
          break;

        case 'KeyW':
          event.preventDefault();
          setFitMode(FitMode.FIT_WIDTH);
          break;

        case 'KeyH':
          event.preventDefault();
          setFitMode(FitMode.FIT_HEIGHT);
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

        case 'KeyB':
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
    const handleMouseButton = (event: MouseEvent) => {
      if (event.button === 3) {
        event.preventDefault();
        goToPrevious();
      } else if (event.button === 4) {
        event.preventDefault();
        goToNext();
      }
    };

    const handleDoubleClick = (event: MouseEvent) => {
      const targetElement = event.target as HTMLElement | null;
      // 입력 필드에서 발생한 더블클릭은 무시
      if (
        targetElement instanceof HTMLInputElement ||
        targetElement instanceof HTMLTextAreaElement ||
        targetElement?.isContentEditable
      ) {
        return;
      }

      event.preventDefault();
      window.electronAPI.send('window-toggle-fullscreen');
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mouseup', handleMouseButton);
    document.addEventListener('dblclick', handleDoubleClick);

    return () => {
      console.log('🔇 Removing keyboard event listener...');
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mouseup', handleMouseButton);
      document.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [
    goToNext,
    goToPrevious,
    goToFirst,
    goToLast,
    zoomLevel,
    setZoomLevel,
    setFitMode,
    isFullscreen,
    autoSlideEnabled,
    autoSlideInterval,
    setAutoSlideInterval,
    showAutoSlideOverlay,
  ]);
}

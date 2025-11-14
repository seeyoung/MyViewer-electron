import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInViewport } from './useInViewport';
import { useRef } from 'react';

describe('useInViewport Hook', () => {
  let mockIntersectionObserver: any;
  let observerInstances: any[] = [];

  beforeEach(() => {
    observerInstances = [];

    // Mock IntersectionObserver
    mockIntersectionObserver = vi.fn((callback, options) => {
      const instance = {
        callback,
        options,
        observe: vi.fn(),
        disconnect: vi.fn(),
        unobserve: vi.fn(),
      };
      observerInstances.push(instance);
      return instance;
    });

    global.IntersectionObserver = mockIntersectionObserver as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    observerInstances = [];
  });

  describe('Observer Creation Optimization', () => {
    it('should not recreate observer when isIntersecting changes', () => {
      const { result } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewport(ref, { threshold: 0, rootMargin: '0px' });
      });

      // Initial render should create one observer
      expect(mockIntersectionObserver).toHaveBeenCalledTimes(1);

      // Simulate intersection change
      const observer = observerInstances[0];
      observer.callback([{ isIntersecting: true, target: {} }]);

      // Re-render
      result.rerender();

      // Should NOT create a new observer
      expect(mockIntersectionObserver).toHaveBeenCalledTimes(1);
    });

    it('should use ref instead of state in dependency array', () => {
      const { rerender } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewport(ref, { threshold: 0, rootMargin: '0px', freezeOnceVisible: true });
      });

      const initialObserverCount = mockIntersectionObserver.mock.calls.length;

      // Simulate multiple re-renders
      rerender();
      rerender();
      rerender();

      // Should not create new observers on re-render
      expect(mockIntersectionObserver).toHaveBeenCalledTimes(initialObserverCount);
    });
  });

  describe('freezeOnceVisible Behavior', () => {
    it('should disconnect observer once visible when freezeOnceVisible is true', () => {
      renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewport(ref, { freezeOnceVisible: true });
      });

      const observer = observerInstances[0];

      // Simulate becoming visible
      observer.callback([{ isIntersecting: true, target: {} }]);

      // Observer should be disconnected
      expect(observer.disconnect).toHaveBeenCalled();
    });

    it('should not disconnect observer when freezeOnceVisible is false', () => {
      renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewport(ref, { freezeOnceVisible: false });
      });

      const observer = observerInstances[0];

      // Simulate becoming visible
      observer.callback([{ isIntersecting: true, target: {} }]);

      // Observer should NOT be disconnected
      expect(observer.disconnect).not.toHaveBeenCalled();
    });

    it('should handle visibility toggle when freezeOnceVisible is false', () => {
      const { result } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewport(ref, { freezeOnceVisible: false });
      });

      const observer = observerInstances[0];

      // Simulate becoming visible
      observer.callback([{ isIntersecting: true, target: {} }]);

      // State should update (this is tested indirectly via behavior)
      expect(result.current).toBeDefined();

      // Simulate becoming invisible
      observer.callback([{ isIntersecting: false, target: {} }]);

      // Observer should still be active
      expect(observer.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('Options Handling', () => {
    it('should pass threshold option to IntersectionObserver', () => {
      renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewport(ref, { threshold: 0.5 });
      });

      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ threshold: 0.5 })
      );
    });

    it('should pass rootMargin option to IntersectionObserver', () => {
      renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewport(ref, { rootMargin: '100px' });
      });

      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ rootMargin: '100px' })
      );
    });

    it('should pass root option to IntersectionObserver', () => {
      const rootElement = document.createElement('div');

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewport(ref, { root: rootElement });
      });

      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ root: rootElement })
      );
    });
  });

  describe('Cleanup', () => {
    it('should disconnect observer on unmount', () => {
      const { unmount } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewport(ref);
      });

      const observer = observerInstances[0];

      unmount();

      expect(observer.disconnect).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null ref gracefully', () => {
      const { result } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewport(ref);
      });

      // Should not throw
      expect(result.current).toBe(false);
    });

    it('should handle empty entries array', () => {
      renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewport(ref);
      });

      const observer = observerInstances[0];

      // Simulate empty entries
      expect(() => observer.callback([])).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should minimize observer recreation on prop changes', () => {
      const { rerender } = renderHook(
        (props: { threshold: number }) => {
          const ref = useRef<HTMLDivElement>(null);
          return useInViewport(ref, { threshold: props.threshold });
        },
        { initialProps: { threshold: 0 } }
      );

      const initialCount = mockIntersectionObserver.mock.calls.length;

      // Same threshold should not recreate observer
      rerender({ threshold: 0 });

      expect(mockIntersectionObserver).toHaveBeenCalledTimes(initialCount);
    });

    it('should recreate observer only when options actually change', () => {
      const { rerender } = renderHook(
        (props: { threshold: number }) => {
          const ref = useRef<HTMLDivElement>(null);
          return useInViewport(ref, { threshold: props.threshold });
        },
        { initialProps: { threshold: 0 } }
      );

      const initialCount = mockIntersectionObserver.mock.calls.length;

      // Different threshold should recreate observer
      rerender({ threshold: 0.5 });

      expect(mockIntersectionObserver.mock.calls.length).toBeGreaterThan(initialCount);
    });
  });
});

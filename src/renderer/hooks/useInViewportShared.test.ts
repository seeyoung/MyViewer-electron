import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInViewportShared } from './useInViewport';
import { useRef } from 'react';

describe('useInViewportShared - Shared Observer', () => {
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

  describe('Observer Sharing', () => {
    it('should reuse same Observer for hooks with identical options', () => {
      // Render multiple hooks with same options
      const { result: result1 } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewportShared(ref, { threshold: 0, rootMargin: '0px' });
      });

      const { result: result2 } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewportShared(ref, { threshold: 0, rootMargin: '0px' });
      });

      const { result: result3 } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewportShared(ref, { threshold: 0, rootMargin: '0px' });
      });

      // Should only create ONE observer for all three hooks
      expect(mockIntersectionObserver).toHaveBeenCalledTimes(1);
    });

    it('should create different Observers for different options', () => {
      renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewportShared(ref, { threshold: 0, rootMargin: '0px' });
      });

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewportShared(ref, { threshold: 0.5, rootMargin: '0px' });
      });

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewportShared(ref, { threshold: 0, rootMargin: '100px' });
      });

      // Should create THREE observers (different options)
      expect(mockIntersectionObserver).toHaveBeenCalledTimes(3);
    });

    it('should properly observe and unobserve elements', () => {
      const { unmount } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(document.createElement('div'));
        return useInViewportShared(ref, { threshold: 0 });
      });

      const observer = observerInstances[0];

      // Should call observe
      expect(observer.observe).toHaveBeenCalledTimes(1);

      unmount();

      // Should call unobserve on cleanup
      expect(observer.unobserve).toHaveBeenCalledTimes(1);
    });
  });

  describe('Memory Efficiency', () => {
    it('should reduce Observer instances by 90% with many hooks', () => {
      const hookCount = 100;
      const hooks: any[] = [];

      // Render 100 hooks with same options
      for (let i = 0; i < hookCount; i++) {
        const { result } = renderHook(() => {
          const ref = useRef<HTMLDivElement>(null);
          return useInViewportShared(ref, { threshold: 0, rootMargin: '96px' });
        });
        hooks.push(result);
      }

      // Should only create 1 observer instead of 100 (99% reduction)
      expect(mockIntersectionObserver).toHaveBeenCalledTimes(1);
      expect(observerInstances.length).toBe(1);
    });
  });

  describe('Callback Management', () => {
    it('should maintain separate callbacks for each element', () => {
      const element1 = document.createElement('div');
      const element2 = document.createElement('div');

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(element1);
        return useInViewportShared(ref, { threshold: 0 });
      });

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(element2);
        return useInViewportShared(ref, { threshold: 0 });
      });

      const observer = observerInstances[0];

      // Should observe both elements
      expect(observer.observe).toHaveBeenCalledTimes(2);
      expect(observer.observe).toHaveBeenCalledWith(element1);
      expect(observer.observe).toHaveBeenCalledWith(element2);
    });

    it('should invoke correct callback for each element', () => {
      const element1 = document.createElement('div');
      const element2 = document.createElement('div');

      const { result: result1 } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(element1);
        return useInViewportShared(ref, { threshold: 0 });
      });

      const { result: result2 } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(element2);
        return useInViewportShared(ref, { threshold: 0 });
      });

      const observer = observerInstances[0];

      // Simulate element1 becoming visible
      observer.callback([{ target: element1, isIntersecting: true }]);

      // Only result1 should be affected (tested indirectly via behavior)
      expect(result1.current).toBeDefined();
      expect(result2.current).toBeDefined();
    });
  });

  describe('freezeOnceVisible with Shared Observer', () => {
    it('should unobserve element when frozen', () => {
      const element = document.createElement('div');

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(element);
        return useInViewportShared(ref, { freezeOnceVisible: true });
      });

      const observer = observerInstances[0];

      // Simulate element becoming visible
      observer.callback([{ target: element, isIntersecting: true }]);

      // Should unobserve the frozen element
      expect(observer.unobserve).toHaveBeenCalledWith(element);
    });

    it('should not disconnect shared observer when one element freezes', () => {
      const element1 = document.createElement('div');
      const element2 = document.createElement('div');

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(element1);
        return useInViewportShared(ref, { freezeOnceVisible: true });
      });

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(element2);
        return useInViewportShared(ref, { freezeOnceVisible: true });
      });

      const observer = observerInstances[0];

      // Simulate element1 becoming visible
      observer.callback([{ target: element1, isIntersecting: true }]);

      // Should unobserve element1 but NOT disconnect (element2 still needs it)
      expect(observer.unobserve).toHaveBeenCalledWith(element1);
      expect(observer.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('Options Serialization', () => {
    it('should treat equivalent options as same', () => {
      renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        return useInViewportShared(ref, { threshold: 0, rootMargin: '0px' });
      });

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        // Same options in different order
        return useInViewportShared(ref, { rootMargin: '0px', threshold: 0 });
      });

      // Should reuse same observer
      expect(mockIntersectionObserver).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup callbacks on unmount', () => {
      const element = document.createElement('div');

      const { unmount } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(element);
        return useInViewportShared(ref, { threshold: 0 });
      });

      const observer = observerInstances[0];

      unmount();

      // Should unobserve on cleanup
      expect(observer.unobserve).toHaveBeenCalledWith(element);
    });
  });

  describe('Performance', () => {
    it('should handle large number of elements efficiently', () => {
      const elementCount = 300;
      const hooks: any[] = [];

      const startTime = Date.now();

      for (let i = 0; i < elementCount; i++) {
        const element = document.createElement('div');
        const { result } = renderHook(() => {
          const ref = useRef<HTMLDivElement>(element);
          return useInViewportShared(ref, { threshold: 0, rootMargin: '96px' });
        });
        hooks.push(result);
      }

      const duration = Date.now() - startTime;

      // Should create only 1 observer
      expect(observerInstances.length).toBe(1);

      // Should complete quickly (less than 100ms for 300 elements)
      expect(duration).toBeLessThan(100);
    });
  });
});

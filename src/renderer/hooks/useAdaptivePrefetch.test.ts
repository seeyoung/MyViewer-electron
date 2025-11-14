import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdaptivePrefetch } from './useAdaptivePrefetch';

describe('useAdaptivePrefetch Hook', () => {
  describe('Initial State', () => {
    it('should start with default config', () => {
      const { result } = renderHook(() => useAdaptivePrefetch(0));

      expect(result.current).toEqual({
        forward: 8,
        backward: 2,
      });
    });
  });

  describe('Fast Forward Scrolling', () => {
    it('should increase forward prefetch for fast forward scrolling', () => {
      const { result, rerender } = renderHook(
        ({ index }) => useAdaptivePrefetch(index),
        { initialProps: { index: 0 } }
      );

      // Simulate fast forward scrolling (jump by 10)
      act(() => {
        rerender({ index: 10 });
      });

      // Should increase forward prefetch
      expect(result.current.forward).toBeGreaterThan(8);
      expect(result.current.backward).toBeLessThan(result.current.forward);
    });

    it('should maximize forward prefetch for very fast scrolling', () => {
      const { result, rerender } = renderHook(
        ({ index }) => useAdaptivePrefetch(index),
        { initialProps: { index: 0 } }
      );

      // Very fast scrolling (jump by 20)
      act(() => {
        rerender({ index: 20 });
      });

      // Should set maximum forward prefetch
      expect(result.current.forward).toBe(16);
      expect(result.current.backward).toBe(1);
    });
  });

  describe('Fast Backward Scrolling', () => {
    it('should increase backward prefetch for fast backward scrolling', () => {
      const { result, rerender } = renderHook(
        ({ index }) => useAdaptivePrefetch(index),
        { initialProps: { index: 50 } }
      );

      // Simulate fast backward scrolling (jump by -10)
      act(() => {
        rerender({ index: 40 });
      });

      // Should increase backward prefetch
      expect(result.current.backward).toBeGreaterThan(2);
      expect(result.current.forward).toBeLessThan(result.current.backward);
    });

    it('should maximize backward prefetch for very fast backward scrolling', () => {
      const { result, rerender } = renderHook(
        ({ index }) => useAdaptivePrefetch(index),
        { initialProps: { index: 50 } }
      );

      // Very fast backward scrolling (jump by -20)
      act(() => {
        rerender({ index: 30 });
      });

      // Should set maximum backward prefetch
      expect(result.current.forward).toBe(1);
      expect(result.current.backward).toBe(16);
    });
  });

  describe('Moderate Scrolling', () => {
    it('should use moderate prefetch for normal forward scrolling', () => {
      const { result, rerender } = renderHook(
        ({ index }) => useAdaptivePrefetch(index),
        { initialProps: { index: 0 } }
      );

      // Normal forward scrolling (jump by 3)
      act(() => {
        rerender({ index: 3 });
      });

      // Should use moderate forward prefetch
      expect(result.current.forward).toBe(12);
      expect(result.current.backward).toBe(2);
    });

    it('should use moderate prefetch for normal backward scrolling', () => {
      const { result, rerender } = renderHook(
        ({ index }) => useAdaptivePrefetch(index),
        { initialProps: { index: 20 } }
      );

      // Normal backward scrolling (jump by -3)
      act(() => {
        rerender({ index: 17 });
      });

      // Should use moderate backward prefetch
      expect(result.current.forward).toBe(2);
      expect(result.current.backward).toBe(12);
    });
  });

  describe('Slow Scrolling', () => {
    it('should use balanced prefetch for slow scrolling', () => {
      const { result, rerender } = renderHook(
        ({ index }) => useAdaptivePrefetch(index),
        { initialProps: { index: 10 } }
      );

      // Slow scrolling (jump by 1)
      act(() => {
        rerender({ index: 11 });
      });

      // Should use balanced prefetch
      expect(result.current.forward).toBe(6);
      expect(result.current.backward).toBe(6);
    });
  });

  describe('Direction Consistency', () => {
    it('should track scrolling direction history', () => {
      const { result, rerender } = renderHook(
        ({ index }) => useAdaptivePrefetch(index),
        { initialProps: { index: 0 } }
      );

      // Scroll forward consistently
      act(() => {
        rerender({ index: 2 });
      });
      act(() => {
        rerender({ index: 4 });
      });
      act(() => {
        rerender({ index: 6 });
      });

      // Should prefer forward direction
      expect(result.current.forward).toBeGreaterThan(result.current.backward);
    });

    it('should adapt to direction changes', () => {
      const { result, rerender } = renderHook(
        ({ index }) => useAdaptivePrefetch(index),
        { initialProps: { index: 0 } }
      );

      // Scroll forward
      act(() => {
        rerender({ index: 5 });
      });

      const forwardConfig = { ...result.current };

      // Change direction to backward
      act(() => {
        rerender({ index: 2 });
      });

      // Should adjust to backward preference
      expect(result.current.backward).toBeGreaterThan(forwardConfig.backward);
    });
  });

  describe('No Movement', () => {
    it('should not change config when index stays the same', () => {
      const { result, rerender } = renderHook(
        ({ index }) => useAdaptivePrefetch(index),
        { initialProps: { index: 10 } }
      );

      const initialConfig = { ...result.current };

      // Same index
      act(() => {
        rerender({ index: 10 });
      });

      // Config should remain unchanged
      expect(result.current).toEqual(initialConfig);
    });
  });

  describe('History Limits', () => {
    it('should maintain only recent history (max 10 entries)', () => {
      const { result, rerender } = renderHook(
        ({ index }) => useAdaptivePrefetch(index),
        { initialProps: { index: 0 } }
      );

      // Scroll through many indices
      for (let i = 1; i <= 20; i++) {
        act(() => {
          rerender({ index: i });
        });
      }

      // Should still work correctly (history should be limited)
      expect(result.current.forward).toBeGreaterThan(0);
      expect(result.current.backward).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative indices', () => {
      const { result } = renderHook(() => useAdaptivePrefetch(-5));

      expect(result.current.forward).toBeDefined();
      expect(result.current.backward).toBeDefined();
    });

    it('should handle very large indices', () => {
      const { result } = renderHook(() => useAdaptivePrefetch(999999));

      expect(result.current.forward).toBeDefined();
      expect(result.current.backward).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should update config efficiently with rapid changes', () => {
      const { result, rerender } = renderHook(
        ({ index }) => useAdaptivePrefetch(index),
        { initialProps: { index: 0 } }
      );

      const startTime = Date.now();

      // Rapid index changes
      for (let i = 1; i <= 100; i++) {
        act(() => {
          rerender({ index: i });
        });
      }

      const duration = Date.now() - startTime;

      // Should complete quickly (< 100ms)
      expect(duration).toBeLessThan(100);

      // Should have valid config
      expect(result.current.forward).toBeGreaterThan(0);
      expect(result.current.backward).toBeGreaterThan(0);
    });
  });
});

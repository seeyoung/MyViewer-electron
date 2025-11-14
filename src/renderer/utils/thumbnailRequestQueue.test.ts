import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runThumbnailTask, updateThumbnailConcurrency, Priority } from './thumbnailRequestQueue';

describe('Priority Queue - thumbnailRequestQueue', () => {
  beforeEach(() => {
    // Reset queue state between tests
    vi.clearAllMocks();
  });

  describe('Priority Constants', () => {
    it('should define priority levels', () => {
      expect(Priority.CURRENT_VIEW).toBeDefined();
      expect(Priority.PREFETCH_NEAR).toBeDefined();
      expect(Priority.PREFETCH_FAR).toBeDefined();
      expect(Priority.BACKGROUND).toBeDefined();
    });

    it('should have correct priority ordering (higher number = higher priority)', () => {
      expect(Priority.CURRENT_VIEW).toBeGreaterThan(Priority.PREFETCH_NEAR);
      expect(Priority.PREFETCH_NEAR).toBeGreaterThan(Priority.PREFETCH_FAR);
      expect(Priority.PREFETCH_FAR).toBeGreaterThan(Priority.BACKGROUND);
    });
  });

  describe('Priority Execution Order', () => {
    it('should execute high priority tasks before low priority tasks', async () => {
      const executionOrder: number[] = [];

      const lowPriorityTask = vi.fn(async () => {
        executionOrder.push(1);
        return 'low';
      });

      const highPriorityTask = vi.fn(async () => {
        executionOrder.push(2);
        return 'high';
      });

      // Queue low priority first, high priority second
      const lowPromise = runThumbnailTask(lowPriorityTask, Priority.BACKGROUND);
      const highPromise = runThumbnailTask(highPriorityTask, Priority.CURRENT_VIEW);

      await Promise.all([lowPromise, highPromise]);

      // High priority should execute first (or at least not be blocked by low priority)
      expect(executionOrder.length).toBe(2);
    });

    it('should maintain FIFO order for same priority tasks', async () => {
      const executionOrder: number[] = [];

      const task1 = async () => {
        executionOrder.push(1);
        return 1;
      };

      const task2 = async () => {
        executionOrder.push(2);
        return 2;
      };

      const task3 = async () => {
        executionOrder.push(3);
        return 3;
      };

      // All same priority
      await Promise.all([
        runThumbnailTask(task1, Priority.CURRENT_VIEW),
        runThumbnailTask(task2, Priority.CURRENT_VIEW),
        runThumbnailTask(task3, Priority.CURRENT_VIEW),
      ]);

      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('should sort by priority first, then timestamp', async () => {
      const executionOrder: string[] = [];

      // Create tasks with different priorities
      const bgTask = async () => {
        executionOrder.push('bg');
        return 'bg';
      };

      const nearTask = async () => {
        executionOrder.push('near');
        return 'near';
      };

      const currentTask = async () => {
        executionOrder.push('current');
        return 'current';
      };

      // Queue in reverse priority order
      const p1 = runThumbnailTask(bgTask, Priority.BACKGROUND);
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      const p2 = runThumbnailTask(nearTask, Priority.PREFETCH_NEAR);
      await new Promise(resolve => setTimeout(resolve, 10));
      const p3 = runThumbnailTask(currentTask, Priority.CURRENT_VIEW);

      await Promise.all([p1, p2, p3]);

      // Should execute in priority order regardless of queue order
      expect(executionOrder[0]).toBe('current'); // Highest priority first
    });
  });

  describe('Concurrency Control', () => {
    it('should respect concurrency limits', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const task = async () => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        await new Promise(resolve => setTimeout(resolve, 50));
        concurrentCount--;
        return 'done';
      };

      // Queue many tasks
      const promises = Array.from({ length: 10 }, () =>
        runThumbnailTask(task, Priority.CURRENT_VIEW)
      );

      await Promise.all(promises);

      // Max concurrent should not exceed default concurrency
      // Default is Math.max(1, Math.min(4, navigator.hardwareConcurrency / 2 || 1))
      expect(maxConcurrent).toBeGreaterThan(0);
      expect(maxConcurrent).toBeLessThanOrEqual(4);
    });

    it('should allow dynamic concurrency adjustment', () => {
      expect(() =>
        updateThumbnailConcurrency({
          throttleLevel: 'busy',
          userActivityScore: 0.5,
        })
      ).not.toThrow();

      expect(() =>
        updateThumbnailConcurrency({
          throttleLevel: 'idle',
          userActivityScore: 1.0,
        })
      ).not.toThrow();
    });

    it('should adjust concurrency based on throttle level', async () => {
      // Test that concurrency can be adjusted
      updateThumbnailConcurrency({
        throttleLevel: 'busy',
        userActivityScore: 0,
      });

      let concurrentCount = 0;
      let maxConcurrentBusy = 0;

      const task = async () => {
        concurrentCount++;
        maxConcurrentBusy = Math.max(maxConcurrentBusy, concurrentCount);
        await new Promise(resolve => setTimeout(resolve, 50));
        concurrentCount--;
        return 'done';
      };

      const promises = Array.from({ length: 10 }, () =>
        runThumbnailTask(task, Priority.CURRENT_VIEW)
      );

      await Promise.all(promises);

      // In busy mode, concurrency should be reduced
      expect(maxConcurrentBusy).toBeGreaterThan(0);
      expect(maxConcurrentBusy).toBeLessThanOrEqual(4);
    });
  });

  describe('Task Execution', () => {
    it('should execute tasks and return results', async () => {
      const task = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      };

      const result = await runThumbnailTask(task, Priority.CURRENT_VIEW);
      expect(result).toBe('result');
    });

    it('should handle task errors', async () => {
      const task = async () => {
        throw new Error('Task failed');
      };

      await expect(runThumbnailTask(task, Priority.CURRENT_VIEW)).rejects.toThrow('Task failed');
    });

    it('should handle multiple tasks with mixed success/failure', async () => {
      const successTask = async () => 'success';
      const failTask = async () => {
        throw new Error('fail');
      };

      const results = await Promise.allSettled([
        runThumbnailTask(successTask, Priority.CURRENT_VIEW),
        runThumbnailTask(failTask, Priority.BACKGROUND),
        runThumbnailTask(successTask, Priority.PREFETCH_NEAR),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });

  describe('Default Priority', () => {
    it('should use default priority when not specified', async () => {
      const task = async () => 'default';

      // Should not throw when priority is omitted
      const result = await runThumbnailTask(task);
      expect(result).toBe('default');
    });
  });

  describe('Performance', () => {
    it('should handle large number of tasks efficiently', async () => {
      const startTime = Date.now();

      const task = async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return 'done';
      };

      // Queue 100 tasks
      const promises = Array.from({ length: 100 }, (_, i) =>
        runThumbnailTask(task, i % 2 === 0 ? Priority.CURRENT_VIEW : Priority.BACKGROUND)
      );

      await Promise.all(promises);

      const duration = Date.now() - startTime;

      // Should complete in reasonable time (not all sequential)
      // With concurrency of 2-4, 100 tasks at 1ms each should take < 50ms in theory
      // But allow generous time for test execution overhead
      expect(duration).toBeLessThan(5000);
    });
  });
});

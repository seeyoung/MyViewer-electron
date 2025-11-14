type Task<T> = () => Promise<T>;

interface PrioritizedTask<T> {
  task: Task<T>;
  priority: number;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
  timestamp: number;
}

// Priority levels (higher number = higher priority)
export const Priority = {
  CURRENT_VIEW: 100,
  PREFETCH_NEAR: 60,
  PREFETCH_FAR: 30,
  BACKGROUND: 0,
} as const;

const DEFAULT_CONCURRENCY = Math.max(
  1,
  Math.min(4, (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 2) / 2 || 1)
);

class PrioritizedQueue {
  private active = 0;
  private readonly pending: PrioritizedTask<unknown>[] = [];
  private concurrency = DEFAULT_CONCURRENCY;

  setConcurrency(next: number): void {
    this.concurrency = Math.max(1, Math.min(6, Math.round(next)));
  }

  async run<T>(task: Task<T>, priority: number = Priority.BACKGROUND): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        task,
        priority,
        resolve: resolve as (value: unknown) => void,
        reject,
        timestamp: performance.now(),
      });

      // Sort by priority (descending), then by timestamp (ascending)
      this.pending.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.timestamp - b.timestamp; // Earlier timestamp first (FIFO)
      });

      this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.active >= this.concurrency) {
      return;
    }

    const next = this.pending.shift();
    if (!next) {
      return;
    }

    this.active++;

    try {
      const result = await next.task();
      next.resolve(result);
    } catch (error) {
      next.reject(error);
    } finally {
      this.active--;
      this.drain();
    }
  }
}

const queue = new PrioritizedQueue();

export function runThumbnailTask<T>(task: Task<T>, priority: number = Priority.BACKGROUND): Promise<T> {
  return queue.run(task, priority);
}

export function updateThumbnailConcurrency({
  throttleLevel,
  userActivityScore,
}: {
  throttleLevel: 'idle' | 'busy';
  userActivityScore: number; // 0~1
}): void {
  const base = throttleLevel === 'busy' ? DEFAULT_CONCURRENCY / 2 : DEFAULT_CONCURRENCY;
  const adjusted = base + userActivityScore * 2;
  queue.setConcurrency(adjusted);
}

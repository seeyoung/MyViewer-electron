type Task<T> = () => Promise<T>;

const waitForIdle = (timeout = 500): Promise<void> => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return new Promise(resolve => {
      (window as any).requestIdleCallback(
        () => resolve(),
        { timeout }
      );
    });
  }

  return new Promise(resolve => setTimeout(resolve, Math.min(timeout, 100)));
};

class TaskQueue {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly concurrency: number) {}

  async run<T>(task: Task<T>): Promise<T> {
    if (this.active >= this.concurrency) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }

    this.active++;

    try {
      await waitForIdle();
      return await task();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }
}

const thumbnailQueue = new TaskQueue(2);

export function runThumbnailTask<T>(task: Task<T>): Promise<T> {
  return thumbnailQueue.run(task);
}

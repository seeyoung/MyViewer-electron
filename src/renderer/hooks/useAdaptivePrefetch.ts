import { useEffect, useRef, useState } from 'react';

export interface PrefetchConfig {
  forward: number; // Number of items to prefetch forward
  backward: number; // Number of items to prefetch backward
}

export function useAdaptivePrefetch(currentIndex: number): PrefetchConfig {
  const [config, setConfig] = useState<PrefetchConfig>({ forward: 8, backward: 2 });
  const lastIndexRef = useRef(currentIndex);
  const directionHistoryRef = useRef<number[]>([]);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeDelta = now - lastUpdateRef.current;
    const indexDelta = currentIndex - lastIndexRef.current;

    // Skip if no movement
    if (indexDelta === 0) {
      return;
    }

    // Track direction in history
    directionHistoryRef.current.push(indexDelta);

    // Keep only last 10 entries
    if (directionHistoryRef.current.length > 10) {
      directionHistoryRef.current.shift();
    }

    // Calculate scrolling velocity (indices per second)
    const velocity = Math.abs(indexDelta) / (timeDelta / 1000);

    // Analyze recent scrolling direction
    const recentHistory = directionHistoryRef.current.slice(-5);
    const forwardCount = recentHistory.filter((d) => d > 0).length;
    const backwardCount = recentHistory.filter((d) => d < 0).length;

    let newConfig: PrefetchConfig;

    // Fast scrolling (> 5 indices/second)
    if (velocity > 5) {
      if (forwardCount > backwardCount) {
        // Fast forward
        newConfig = { forward: 16, backward: 1 };
      } else {
        // Fast backward
        newConfig = { forward: 1, backward: 16 };
      }
    }
    // Moderate scrolling (1-5 indices/second)
    else if (velocity > 1) {
      if (forwardCount > backwardCount) {
        // Moderate forward
        newConfig = { forward: 12, backward: 2 };
      } else {
        // Moderate backward
        newConfig = { forward: 2, backward: 12 };
      }
    }
    // Slow scrolling/browsing (<= 1 index/second)
    else {
      // Balanced for slow browsing
      newConfig = { forward: 6, backward: 6 };
    }

    setConfig(newConfig);

    lastIndexRef.current = currentIndex;
    lastUpdateRef.current = now;
  }, [currentIndex]);

  return config;
}

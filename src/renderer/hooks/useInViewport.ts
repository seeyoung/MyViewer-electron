import { RefObject, useEffect, useState, useRef } from 'react';

interface UseInViewportOptions extends IntersectionObserverInit {
  freezeOnceVisible?: boolean;
}

export function useInViewport<T extends Element>(
  targetRef: RefObject<T>,
  { threshold = 0, root = null, rootMargin = '0px', freezeOnceVisible = false }: UseInViewportOptions = {}
): boolean {
  const [isIntersecting, setIntersecting] = useState(false);
  const frozenRef = useRef(false);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) {
      return;
    }

    // Skip if already frozen
    if (freezeOnceVisible && frozenRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }

        if (entry.isIntersecting) {
          setIntersecting(true);

          if (freezeOnceVisible) {
            frozenRef.current = true;
            observer.disconnect();
          }
        } else {
          // Only update state if not frozen
          if (!freezeOnceVisible) {
            setIntersecting(false);
          }
        }
      },
      { threshold, root, rootMargin }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [targetRef, threshold, root, rootMargin, freezeOnceVisible]); // Removed isIntersecting

  return isIntersecting;
}

// Global Observer management for shared instances
const observerCache = new Map<string, IntersectionObserver>();
const observerCallbacks = new Map<Element, IntersectionObserverCallback>();

function getSharedObserver(options: UseInViewportOptions): IntersectionObserver {
  const key = JSON.stringify({
    threshold: options.threshold ?? 0,
    rootMargin: options.rootMargin ?? '0px',
  });

  let observer = observerCache.get(key);

  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const callback = observerCallbacks.get(entry.target);
          callback?.([entry]);
        });
      },
      {
        threshold: options.threshold,
        root: options.root,
        rootMargin: options.rootMargin,
      }
    );

    observerCache.set(key, observer);
  }

  return observer;
}

export function useInViewportShared<T extends Element>(
  targetRef: RefObject<T>,
  options: UseInViewportOptions = {}
): boolean {
  const [isIntersecting, setIntersecting] = useState(false);
  const frozenRef = useRef(false);
  const callbackRef = useRef<IntersectionObserverCallback>();

  useEffect(() => {
    const target = targetRef.current;
    if (!target) {
      return;
    }

    if (options.freezeOnceVisible && frozenRef.current) {
      return;
    }

    callbackRef.current = (entries) => {
      const entry = entries.find((e) => e.target === target);
      if (!entry) return;

      if (entry.isIntersecting) {
        setIntersecting(true);

        if (options.freezeOnceVisible) {
          frozenRef.current = true;
          getSharedObserver(options).unobserve(target);
        }
      } else if (!options.freezeOnceVisible) {
        setIntersecting(false);
      }
    };

    const observer = getSharedObserver(options);
    observerCallbacks.set(target, callbackRef.current);
    observer.observe(target);

    return () => {
      observer.unobserve(target);
      observerCallbacks.delete(target);
    };
  }, [targetRef, options.threshold, options.root, options.rootMargin, options.freezeOnceVisible]);

  return isIntersecting;
}

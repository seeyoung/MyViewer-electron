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

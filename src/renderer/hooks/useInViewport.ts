import { RefObject, useEffect, useState } from 'react';

interface UseInViewportOptions extends IntersectionObserverInit {
  freezeOnceVisible?: boolean;
}

export function useInViewport<T extends Element>(
  targetRef: RefObject<T>,
  { threshold = 0, root = null, rootMargin = '0px', freezeOnceVisible = false }: UseInViewportOptions = {}
): boolean {
  const [isIntersecting, setIntersecting] = useState(false);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) {
      return;
    }

    if (freezeOnceVisible && isIntersecting) {
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
            observer.disconnect();
          }
        } else {
          setIntersecting(false);
        }
      },
      { threshold, root, rootMargin }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [targetRef, threshold, root, rootMargin, freezeOnceVisible, isIntersecting]);

  return isIntersecting;
}

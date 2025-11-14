import { RefObject, useEffect } from 'react';

interface UseAutoCenterOptions {
  axis: 'horizontal' | 'vertical';
  isActive: boolean;
  behavior?: ScrollBehavior;
}

export function useAutoCenter(ref: RefObject<HTMLElement>, options: UseAutoCenterOptions): void {
  const { axis, isActive, behavior = 'smooth' } = options;

  useEffect(() => {
    if (!isActive || !ref.current) {
      return;
    }

    const container = ref.current.parentElement as HTMLElement | null;
    if (!container) {
      return;
    }

    const containerSize = axis === 'horizontal' ? container.clientWidth : container.clientHeight;
    const contentSize = axis === 'horizontal' ? container.scrollWidth : container.scrollHeight;
    const itemSize = axis === 'horizontal' ? ref.current.clientWidth : ref.current.clientHeight;
    const offset = axis === 'horizontal' ? ref.current.offsetLeft : ref.current.offsetTop;

    const target = offset - (containerSize / 2 - itemSize / 2);
    const clamped = Math.max(0, Math.min(target, contentSize - containerSize));

    if (axis === 'horizontal') {
      container.scrollTo({ left: clamped, behavior });
    } else {
      container.scrollTo({ top: clamped, behavior });
    }
  }, [axis, behavior, isActive, ref]);
}

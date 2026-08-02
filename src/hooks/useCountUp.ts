import { useEffect, useRef, useState } from "react";

const DURATION = 1200;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function useCountUp(target: number, skip: boolean): number {
  const [value, setValue] = useState(skip ? target : 0);
  const rafRef = useRef(0);
  const lastValueRef = useRef(value);

  useEffect(() => {
    if (skip) {
      setValue(target);
      lastValueRef.current = target;
      return;
    }

    const start = performance.now();
    const from = lastValueRef.current;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / DURATION);
      const next = Math.round(from + (target - from) * easeOutCubic(progress));
      setValue(next);
      lastValueRef.current = next;
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, skip]);

  return value;
}

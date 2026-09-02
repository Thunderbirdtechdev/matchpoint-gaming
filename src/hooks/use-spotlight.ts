import { useRef, useCallback, type MouseEvent } from "react";

/**
 * Cursor-tracking spotlight + tilt for a card. Sets `--spot-x`/`--spot-y` and
 * `--tilt-x`/`--tilt-y` on the element so child layers can read them.
 */
export function useSpotlight() {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = x / rect.width - 0.5;
    const cy = y / rect.height - 0.5;
    el.style.setProperty("--spot-x", `${x}px`);
    el.style.setProperty("--spot-y", `${y}px`);
    el.style.setProperty("--tilt-x", `${cy * -4}deg`);
    el.style.setProperty("--tilt-y", `${cx * 6}deg`);
  }, []);

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
  }, []);

  return { ref, onMove, onLeave };
}

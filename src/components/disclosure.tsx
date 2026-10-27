"use client";

import { useRef, useState } from "react";

const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

// A <details> that slides open and shut instead of snapping. `data-open` flips the
// moment it's clicked (so a Chevron turns right away), while the native `open`
// stays set until the closing slide finishes so the content is still there to see.
export function Disclosure({
  summary,
  summaryClassName,
  className,
  children,
}: {
  summary: React.ReactNode;
  summaryClassName?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const running = useRef<Animation[]>([]);
  const [open, setOpen] = useState(false);

  function toggle(e: React.MouseEvent) {
    const el = ref.current;
    if (!el || !body.current) return;
    e.preventDefault();
    const opening = !open;
    setOpen(opening);

    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.open = opening;
      return;
    }

    // Start from wherever a slide in flight left off.
    const from = el.getBoundingClientRect().height;
    running.current.forEach((a) => a.cancel());
    el.open = false;
    const closed = el.getBoundingClientRect().height;
    el.open = true;
    const full = el.getBoundingClientRect().height;

    el.style.overflow = "hidden";
    const duration = opening ? 260 : 200;
    const slide = el.animate({ height: [`${from}px`, `${opening ? full : closed}px`] }, { duration, easing: EASE });
    const fade = body.current.animate({ opacity: opening ? [0, 1] : [1, 0] }, { duration, easing: EASE, fill: "forwards" });
    running.current = [slide, fade];
    slide.onfinish = () => {
      el.open = opening;
      el.style.overflow = "";
      fade.cancel();
      running.current = [];
    };
  }

  return (
    <details ref={ref} className={className} data-open={open || undefined}>
      <summary className={summaryClassName} onClick={toggle}>
        {summary}
      </summary>
      <div ref={body}>{children}</div>
    </details>
  );
}

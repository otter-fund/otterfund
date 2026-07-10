"use client";

import { useEffect, useState } from "react";
import { LOGO_CORAL } from "@/components/otterfund/theme";

/* Coral otter that blinks. The BODY is a single fixed layer (otter-body.png,
   drawn with empty eye sockets) that never changes — only the eyes swap. Two
   eye patches (open donuts / closed arcs) are stacked over the sockets, both
   registered to the same coordinates and decoded from mount; we flip which one
   is at opacity 1. That's a compositor-only swap (no mask reload → no white
   flash), and since the body is one static layer nothing "boils" between
   frames. It double-blinks, holds eyes open for a beat, then double-blinks. */
const BODY = "/otter-body.png";
const EYES_OPEN = "/otter-eyes-open.png";
const EYES_CLOSED = "/otter-eyes-closed.png";

// `closed` = eyes closed. Double-blink (close/open/close), then a long open hold.
const SEQUENCE: Array<{ closed: boolean; hold: number }> = [
  { closed: true, hold: 110 },   // blink 1: close
  { closed: false, hold: 130 },  // blink 1: open
  { closed: true, hold: 110 },   // blink 2: close
  { closed: false, hold: 3400 }, // open, long pause before next double-blink
];

const maskStyle = (src: string) =>
  ({
    position: "absolute",
    inset: 0,
    background: LOGO_CORAL,
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  }) as const;

export function BlinkingOtter({ width = 104, height = 58 }: { width?: number; height?: number }) {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    // Respect reduced-motion: hold eyes open, never animate.
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    let step = 0;
    const tick = () => {
      const { closed: isClosed, hold } = SEQUENCE[step];
      setClosed(isClosed);
      step = (step + 1) % SEQUENCE.length;
      timer = setTimeout(tick, hold);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  return (
    <span aria-hidden style={{ position: "relative", display: "block", width, height }}>
      <span style={maskStyle(BODY)} />
      <span style={{ ...maskStyle(EYES_OPEN), opacity: closed ? 0 : 1 }} />
      <span style={{ ...maskStyle(EYES_CLOSED), opacity: closed ? 1 : 0 }} />
    </span>
  );
}

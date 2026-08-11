import { useEffect, useState } from "react";

/** Ticking clock for live countdowns. */
export function useNow(interval = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fn = () => setReduced(mq.matches);
    mq.addEventListener?.("change", fn);
    return () => mq.removeEventListener?.("change", fn);
  }, []);
  return reduced;
}

const GLYPHS = "!<>-_\\/[]{}=+*^?#@$%&";

/** Scramble-decode text effect; snaps instantly under prefers-reduced-motion. */
export function useScramble(text: string, enabled = true): string {
  const reduced = useReducedMotion();
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!enabled || reduced) {
      setOut(text);
      return;
    }
    let frame = 0;
    let raf = 0;
    const total = Math.max(20, text.length * 4);
    const tick = () => {
      frame += 1;
      const reveal = Math.floor((frame / total) * text.length);
      let s = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === " " || ch === ".") {
          s += ch;
          continue;
        }
        s += i < reveal ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setOut(frame >= total ? text : s);
      if (frame < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, enabled, reduced]);
  return out;
}

/** Clipboard helper with fallback. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

import { useLayoutEffect, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { saveScrollPosition, getScrollPosition } from "./scroll-memory.js";

/**
 * Records window scroll per location key (pathname+search) via a passive
 * scroll listener, and restores the remembered position before paint when
 * the location changes. Hash navigations are left to the browser/anchor
 * logic. Mounted once inside the native shell — the web tree keeps its
 * existing ScrollToTop behavior untouched.
 */
export default function NativeScrollMemory() {
  const location = useLocation();
  const key = `${location.pathname}${location.search}`;
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        saveScrollPosition(keyRef.current, window.scrollY);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    if (location.hash) return;
    const saved = getScrollPosition(key);
    window.scrollTo({ top: saved ?? 0, left: 0, behavior: "instant" });
  }, [key, location.hash]);

  return null;
}

import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { scrollToAnchor } from "@/lib/scroll-to-anchor";

const getHashId = (hash) => {
  const rawId = hash.slice(1);

  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
};

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (hash) {
      // The shared helper (not a bare smooth scrollIntoView, which this loop
      // used to be): it already waits up to 4s for lazily-mounted targets and
      // re-pins the position while sections hydrate and reflow underneath the
      // scroll — the exact failure scroll-to-anchor.js exists to prevent.
      // History is left alone: the router already owns the URL on this path.
      scrollToAnchor(`#${getHashId(hash)}`, { updateHistory: false });
      return;
    }

    if (navigationType === "POP") return;

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash, navigationType]);

  return null;
}
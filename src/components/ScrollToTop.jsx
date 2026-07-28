import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { scrollToHashTarget } from "@/lib/scroll-to-hash";

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (hash) {
      return scrollToHashTarget(hash);
    }

    if (navigationType === "POP") return;

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash, navigationType]);

  return null;
}

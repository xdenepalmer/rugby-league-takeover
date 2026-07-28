const decodeHash = (hash) => {
  const value = String(hash || "").replace(/^\/?#/, "");
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const headerOffset = () => {
  const header = document.querySelector("[data-site-header]");
  const height = header?.getBoundingClientRect().height || 72;
  return Math.ceil(height + 8);
};

const alignTarget = (element, behavior) => {
  const top = Math.max(
    0,
    window.scrollY + element.getBoundingClientRect().top - headerOffset()
  );
  window.scrollTo({ top, left: 0, behavior });
};

/**
 * Scroll to a potentially lazy-loaded homepage section and re-align after
 * nearby sections expand. Returns a cleanup function for React effects.
 */
export function scrollToHashTarget(hash, { behavior = "smooth", updateHistory = false } = {}) {
  const id = decodeHash(hash);
  if (!id) return () => {};

  let cancelled = false;
  const timers = [];
  const schedule = (callback, delay) => {
    const timer = window.setTimeout(() => {
      if (!cancelled) callback();
    }, delay);
    timers.push(timer);
  };

  const findAndAlign = (attempt = 0) => {
    const element = document.getElementById(id);
    if (!element) {
      if (attempt < 10) schedule(() => findAndAlign(attempt + 1), 150);
      return;
    }

    alignTarget(element, behavior);
    if (updateHistory) window.history.replaceState(null, "", `/#${id}`);

    // Lazy homepage blocks above the target can change height on mobile.
    // Re-align only while the target remains close to the viewport.
    [250, 700, 1300].forEach((delay) => {
      schedule(() => {
        const liveElement = document.getElementById(id);
        if (!liveElement) return;
        const distance = Math.abs(liveElement.getBoundingClientRect().top - headerOffset());
        if (distance <= window.innerHeight * 1.5) alignTarget(liveElement, "auto");
      }, delay);
    });
  };

  findAndAlign();
  return () => {
    cancelled = true;
    timers.forEach((timer) => window.clearTimeout(timer));
  };
}

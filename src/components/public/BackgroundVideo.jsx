import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { hideBrokenImage } from "@/lib/img-fallback";
import {
  WATCHDOG_INTERVAL_MS,
  claimReload,
  createWatchdogState,
  decideVideoAction,
} from "@/lib/video-watchdog";

// WCAG 2.2.2 (Pause, Stop, Hide): the user's choice about the ambient
// background video persists across pages and visits. Tri-state on purpose:
//   "1"  — explicitly paused
//   "0"  — explicitly playing, which OVERRIDES the environment gate below
//   null — no preference, follow the environment
// The override exists because "the video stopped moving" has more than once
// turned out to be Low Power Mode, iOS Reduce Motion, or Chrome's data saver
// doing their job. Those are worth respecting by default, but the user must be
// able to say "no, play it" — previously the control was hidden in exactly the
// cases where the video was not moving, which is when it was needed most.
const PAUSE_STORAGE_KEY = "rlt_bg_video_paused";

const readStoredPref = () => {
  try {
    const value = localStorage.getItem(PAUSE_STORAGE_KEY);
    return value === "1" || value === "0" ? value : null;
  } catch {
    return null;
  }
};

const extOf = (url) => String(url).split("?")[0].split(".").pop()?.toLowerCase();
const mimeFor = (url) => ({ mp4: "video/mp4", webm: "video/webm", ogg: "video/ogg", mov: "video/quicktime" }[extOf(url)] || "");

// Order sources so browser-friendly formats win. QuickTime (.mov) does NOT play
// in Chrome/Edge/Firefox, so it must never be the first/only source — otherwise
// autoplay silently fails and only the poster shows. mp4 first, mov last.
const FORMAT_RANK = { mp4: 0, webm: 1, ogg: 2, mov: 9 };
const IOS_FORMAT_RANK = { mov: 0, mp4: 1, webm: 2, ogg: 3 };

const prefersQuickTimeVideo = () => {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

const normalizeVideoSources = (sources, src) => {
  const rawList = sources?.length ? sources : [src];
  return rawList
    .flatMap((value) => String(value || "").split(/[\n,]+/))
    .flatMap((value) => value.split(/(?=https?:\/\/)/g))
    .map((value) => value.trim())
    .filter(Boolean);
};

// A high-quality static image of Allegiant Stadium to serve as the background poster
const DEFAULT_POSTER = "https://ohytlrgfpcpvnqgdpqap.supabase.co/storage/v1/object/public/media/migrated/4d882498b_57895bb2-6bf0-4062-bbf3-78c2b309651a.jpeg";

// Fallback stadium footage used across every public page when SiteSettings has
// no admin-uploaded background_video_urls. Keep in sync with the list Home.jsx
// falls back to.
export const DEFAULT_BACKGROUND_VIDEO_SOURCES = [
  "https://ohytlrgfpcpvnqgdpqap.supabase.co/storage/v1/object/public/media/migrated/7753542d9_b39f245c-2207-4f31-bd97-2cb52f47dc3a.mov",
  "https://ohytlrgfpcpvnqgdpqap.supabase.co/storage/v1/object/public/media/migrated/bf55ac1e7_allegiantstadiumparadisenevadaclaytonhaamallegiantallegiantstadiumparadis.mp4",
];

export default function BackgroundVideo({ src, sources, poster = DEFAULT_POSTER }) {
  const videoRef = useRef(null);
  const isAdvancingRef = useRef(false);
  const [shouldPlayVideo, setShouldPlayVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pref, setPref] = useState(readStoredPref);
  const userPaused = pref === "1";

  const ordered = useMemo(() => {
    const list = normalizeVideoSources(sources, src);
    const isIos = prefersQuickTimeVideo();
    const browserFriendly = list.filter((url) => ["mp4", "webm", "ogg"].includes(extOf(url)));
    const playableList = isIos ? list : (browserFriendly.length ? browserFriendly : list);
    const rank = isIos ? IOS_FORMAT_RANK : FORMAT_RANK;
    return [...playableList].sort((a, b) => (rank[extOf(a)] ?? 5) - (rank[extOf(b)] ?? 5));
  }, [sources, src]);
  const key = ordered.join("|");
  const activeVideo = ordered[currentIndex % Math.max(ordered.length, 1)] || "";

  useEffect(() => {
    setCurrentIndex(0);
  }, [key]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Respect data-saver and reduced-motion only — do NOT gate on mobile viewport
    // (muted+playsInline autoplay is expected on mobile by design).
    const isSaveData = !!(navigator.connection && navigator.connection.saveData);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // An explicit "play" beats the environment gate; an explicit "pause" beats
    // everything. With no preference stored, the environment decides.
    if (userPaused || ((isSaveData || prefersReducedMotion) && pref !== "0")) {
      setShouldPlayVideo(false);
      return;
    }
    setShouldPlayVideo(true);
  }, [key, userPaused, pref]);

  // Toggle against what the user can actually see, not against the stored
  // preference: with no preference stored and the environment suppressing
  // playback, the button is a Play button and must store "play".
  const togglePaused = () => {
    const next = shouldPlayVideo ? "1" : "0";
    try {
      localStorage.setItem(PAUSE_STORAGE_KEY, next);
    } catch {
      /* private browsing — the choice just won't persist */
    }
    setPref(next);
  };

  useEffect(() => {
    if (!shouldPlayVideo) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    let cancelled = false;
    setVideoReady(false);
    isAdvancingRef.current = false;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    const playVideo = () => {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.play().then(() => {
        if (!cancelled) setVideoReady(true);
      }).catch(() => {
        // Autoplay can reject briefly on mobile while the video is still loading.
        // Do not switch sources here — the real media error handler handles bad files.
      });
    };

    // Full recovery for a stalled/frozen media pipeline: play() alone cannot fix
    // a broken buffer — re-load the source, then play. Every caller goes through
    // claimReload() so the watchdog and the event listeners share one budget;
    // an unbudgeted load() on a timer is what froze the video last time.
    let watchdogState = createWatchdogState();
    const recover = () => {
      if (cancelled) return;
      try { video.load(); } catch { /* ignore */ }
      playVideo();
    };
    const recoverIfAllowed = () => {
      if (cancelled) return;
      const { allowed, state } = claimReload(watchdogState, Date.now());
      watchdogState = state;
      if (allowed) recover();
    };

    video.load();
    window.setTimeout(playVideo, 80);

    // Watchdog: retry play if still paused after a few seconds
    const watchdog1 = window.setTimeout(() => {
      if (!cancelled && (video.paused || video.readyState < 2)) playVideo();
    }, 2000);
    const watchdog2 = window.setTimeout(() => {
      if (!cancelled && video.paused) playVideo();
    }, 4500);
    const watchdog3 = window.setTimeout(() => {
      if (!cancelled && video.paused) playVideo();
    }, 8000);

    // Self-healing keep-alive. Desktop browsers pause OR silently FREEZE a
    // background video (tab-switch throttle, GPU/power saving, a network stall on
    // the remote asset). A frozen video is NOT `paused` — it holds a stuck frame
    // with currentTime not advancing — so checking `paused` alone misses it and
    // it "never comes back". decideVideoAction() owns the rules for telling a
    // real freeze apart from ordinary buffering; see the note in video-watchdog.
    const keepAlive = window.setInterval(() => {
      if (cancelled) return;
      const v = videoRef.current;
      if (!v) return;
      const { action, state } = decideVideoAction(
        {
          hidden: document.hidden,
          paused: v.paused,
          ended: v.ended,
          currentTime: v.currentTime,
          readyState: v.readyState,
        },
        watchdogState,
        Date.now(),
      );
      watchdogState = state;
      if (action === "play") playVideo();
      else if (action === "reload") recover();
    }, WATCHDOG_INTERVAL_MS);

    // Recover from media stalls (common with remote-hosted video on desktop).
    // Debounced, and budgeted through claimReload. `error` is deliberately NOT
    // wired here: the element's own onError advances to the next source, and
    // reloading a file the browser has already rejected only wastes the budget.
    let recoverTimer = null;
    const scheduleRecover = () => {
      if (recoverTimer || cancelled) return;
      recoverTimer = window.setTimeout(() => { recoverTimer = null; recoverIfAllowed(); }, 1500);
    };
    video.addEventListener("stalled", scheduleRecover);

    window.addEventListener("touchstart", playVideo, { once: true });
    window.addEventListener("click", playVideo, { once: true });

    // Battery saver: pause the background video while the app is backgrounded
    // (home-screen PWA switched away / tab hidden) and resume on return.
    const handleVisibility = () => {
      if (document.hidden) {
        video.pause();
      } else {
        // Small delay to let browser settle after returning from background
        window.setTimeout(playVideo, 200);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog1);
      window.clearTimeout(watchdog2);
      window.clearTimeout(watchdog3);
      window.clearInterval(keepAlive);
      window.clearTimeout(recoverTimer);
      video.removeEventListener("stalled", scheduleRecover);
      window.removeEventListener("touchstart", playVideo);
      window.removeEventListener("click", playVideo);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [shouldPlayVideo, activeVideo, ordered.length]);

  return (
    <>
    <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-background">
      {/* Fallback Static Poster Image (always rendered under video, or as main background) */}
      <img
        src={poster}
        alt=""
        decoding="async"
        onError={hideBrokenImage}
        fetchPriority="high"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          videoReady ? "opacity-0" : "opacity-60"
        }`}
      />

      {/* Background Video — only loaded and rendered when conditions are met */}
      {shouldPlayVideo && (
        <video
          ref={videoRef}
          key={activeVideo}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            videoReady ? "opacity-100" : "opacity-0"
          }`}
          autoPlay
          muted
          loop={ordered.length <= 1}
          playsInline
          preload="auto"
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
          onLoadedData={() => videoRef.current?.play().catch(() => {})}
          onCanPlay={() => videoRef.current?.play().catch(() => {})}
          onPlaying={() => setVideoReady(true)}
          onTimeUpdate={(event) => {
            const video = event.currentTarget;
            if (ordered.length > 1 && video.duration && video.currentTime >= video.duration - 0.4 && !isAdvancingRef.current) {
              isAdvancingRef.current = true;
              setVideoReady(false);
              setCurrentIndex((index) => (index + 1) % ordered.length);
            }
          }}
          onPause={() => {
            // Don't fight an intentional battery-saver pause while backgrounded
            if (!document.hidden) videoRef.current?.play().catch(() => {});
          }}
          onEnded={() => {
            if (ordered.length > 1 && !isAdvancingRef.current) {
              isAdvancingRef.current = true;
              setVideoReady(false);
              setCurrentIndex((index) => (index + 1) % ordered.length);
            }
          }}
          onError={() => ordered.length > 1 && setCurrentIndex((index) => (index + 1) % ordered.length)}
        >
          <source src={activeVideo} type={mimeFor(activeVideo) || undefined} />
        </video>
      )}

      {/* Dark Vegas neon-supporting vignette overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/15 via-background/25 to-background/85" />
    </div>

    {/* WCAG 2.2.2 pause/play control. A sibling of the aria-hidden layer so it
        stays reachable by keyboard and screen readers. Always rendered: it used
        to be hidden whenever data-saver or reduced-motion suppressed playback,
        which meant the one control that could start the video disappeared in
        precisely the situations where the video was not moving. It doubles as
        the manual start for iOS Low Power Mode, where autoplay is blocked
        outright but a tap (a user gesture) is still allowed to play.
        Sits bottom-left, clear of the cart/scroll FABs on the right, above the
        mobile tab bar. */}
    <button
      type="button"
      onClick={togglePaused}
      aria-label={shouldPlayVideo ? "Pause background video" : "Play background video"}
      aria-pressed={!shouldPlayVideo}
      className="fixed bottom-[calc(5.5rem+var(--safe-bottom))] left-4 z-30 flex h-11 w-11 items-center justify-center border border-border/60 bg-background/60 text-slate-300 backdrop-blur-sm transition-colors hover:border-primary/50 hover:text-white focus-visible:ring-2 focus-visible:ring-primary lg:bottom-[calc(1.5rem+var(--safe-bottom))]"
    >
      {shouldPlayVideo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
    </button>
    </>
  );
}
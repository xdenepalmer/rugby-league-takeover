import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Image as ImageIcon, PlayCircle } from "lucide-react";
import PullToRefresh from "@/components/PullToRefresh";
import { useGalleryItems } from "@/hooks/data/use-fan-data";
import { hideBrokenImage } from "@/lib/img-fallback";
import { emitHaptic } from "@/lib/native/haptic-events";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import NativeMediaViewer from "./NativeMediaViewer.jsx";

const TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "photo", label: "Photos" },
  { id: "video", label: "Videos" },
];

const thumbFor = (item) => {
  if (item.thumbnail_url) return item.thumbnail_url;
  if (item.media_type === "photo") return item.media_url;
  if (item.media_type === "youtube") {
    const match = String(item.embed_url || item.media_url || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    if (match) return `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return "";
};

/**
 * Touch-first gallery: square grid with event/type filters and the
 * gesture-driven fullscreen viewer. Supports /gallery?item=<id> deep links
 * (the share URL the viewer produces).
 */
export default function NativeGalleryScreen() {
  const { data: items = [], isLoading } = useGalleryItems();
  const [searchParams, setSearchParams] = useSearchParams();
  const [eventFilter, setEventFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewerIndex, setViewerIndex] = useState(null);

  const events = useMemo(() => {
    const set = new Set(items.map((i) => i.event_label).filter(Boolean));
    return ["All", ...set];
  }, [items]);

  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (eventFilter === "All" || item.event_label === eventFilter) &&
          (typeFilter === "all" || (typeFilter === "video" ? item.media_type !== "photo" : item.media_type === "photo"))
      ),
    [items, eventFilter, typeFilter]
  );

  // Deep link: /gallery?item=<id> opens the viewer directly.
  useEffect(() => {
    const target = searchParams.get("item");
    if (!target || !items.length) return;
    const idx = visible.findIndex((i) => String(i.id) === String(target));
    if (idx >= 0) {
      setViewerIndex(idx);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, searchParams]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <NativeTopBar title="Gallery" fallback="/" />
      <PullToRefresh queryKeys={[["gallery"]]}>
        <div className="mx-auto w-full max-w-2xl">
          <div className="ios-scroll flex gap-2 overflow-x-auto px-4 py-2">
            {events.map((event) => (
              <button
                key={event}
                type="button"
                aria-pressed={eventFilter === event}
                onClick={() => setEventFilter(event)}
                className={`ios-pressable min-h-9 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                  eventFilter === event ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {event}
              </button>
            ))}
            <span className="mx-1 w-px shrink-0 bg-border" aria-hidden="true" />
            {TYPE_FILTERS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={typeFilter === t.id}
                onClick={() => setTypeFilter(t.id)}
                className={`ios-pressable min-h-9 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                  typeFilter === t.id ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {isLoading && items.length === 0 ? (
            <div className="grid grid-cols-3 gap-1 px-1">
              {Array.from({ length: 9 }).map((_, i) => (
                <NativeSkeleton key={i} className="aspect-square w-full" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="px-4 pt-6">
              <NativeEmptyState icon={ImageIcon} title="No media yet" description="Takeover photos and videos land here." />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1 px-1 pb-6">
              {visible.map((item, idx) => {
                const thumb = thumbFor(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.title || `Open media ${idx + 1}`}
                    onClick={() => {
                      emitHaptic("sheet.snap");
                      setViewerIndex(idx);
                    }}
                    className="ios-pressable relative aspect-square w-full overflow-hidden border border-border/30 bg-card/40"
                  >
                    {thumb ? (
                      <img src={thumb} alt="" onError={hideBrokenImage} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-6 w-6" aria-hidden="true" />
                      </span>
                    )}
                    {item.media_type !== "photo" && (
                      <PlayCircle className="absolute bottom-1.5 right-1.5 h-5 w-5 text-white drop-shadow" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PullToRefresh>

      {viewerIndex !== null && visible[viewerIndex] && (
        <NativeMediaViewer
          items={visible}
          index={viewerIndex}
          onNavigate={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { emitHaptic } from "@/lib/native/haptic-events";

/**
 * Safe-area-aware sticky top bar for native sub-screens (More-sheet
 * destinations and detail screens). Back pops history when the app has one,
 * otherwise falls back to the given tab root so cold deep links still get a
 * working Back affordance.
 */
export default function NativeTopBar({ title, fallback = "/", right = null }) {
  const navigate = useNavigate();

  const handleBack = () => {
    emitHaptic("nav.back");
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur pt-[env(safe-area-inset-top,0px)]">
      <div className="flex h-12 items-center gap-1 px-2">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back"
          className="ios-pressable flex h-11 min-w-11 items-center justify-center gap-0.5 pr-2 text-primary"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          <span className="text-sm font-bold uppercase tracking-wide">Back</span>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center font-display text-base font-bold uppercase tracking-widest">
          {title}
        </h1>
        <div className="flex h-11 min-w-11 items-center justify-end pl-2">{right}</div>
      </div>
    </header>
  );
}

import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { emitHaptic } from "@/lib/native/haptic-events";

/**
 * Native-only escape hatch around the shared auth pages. They mount
 * full-screen OUTSIDE the tab shell, so without this a signed-out guest who
 * taps Account is trapped on /login — no tab bar, no home link, nothing but
 * authenticate or force-kill. Renders a fixed Close affordance back to the
 * home tab; the shared AuthLayout and the web tree are untouched.
 */
export default function NativeAuthFrame({ children }) {
  const navigate = useNavigate();
  return (
    <div className="relative min-h-dvh">
      <button
        type="button"
        aria-label="Close and return home"
        onClick={() => {
          emitHaptic("tab.select");
          navigate("/");
        }}
        className="ios-pressable fixed right-3 top-[calc(env(safe-area-inset-top,0px)+0.6rem)] z-50 flex h-11 w-11 items-center justify-center border border-border/80 bg-background/85 text-foreground backdrop-blur"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}

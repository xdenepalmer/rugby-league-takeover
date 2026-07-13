import { NativeSkeleton } from "./NativePrimitives.jsx";

/**
 * Loading fallback for lazy native fan screens. A shimmer skeleton that
 * approximates a top block + rows, instead of the web app's full-screen
 * spinner — so a cold navigation (before the tab's chunk is cached) reads as
 * "content arriving" rather than a webby "Loading…" flash. Native-only.
 */
export default function NativeRouteSkeleton() {
  return (
    <div className="px-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)]" aria-hidden="true">
      <NativeSkeleton className="h-8 w-2/3" />
      <NativeSkeleton className="mt-4 h-44 w-full" />
      <div className="mt-4 space-y-3">
        <NativeSkeleton className="h-20 w-full" />
        <NativeSkeleton className="h-20 w-full" />
        <NativeSkeleton className="h-20 w-full" />
      </div>
    </div>
  );
}

/**
 * NativeSheet — a reusable native iOS bottom-sheet primitive built on vaul.
 *
 * NATIVE-ONLY: intended to be mounted behind isNativeApp() by the maintainer.
 * It gives other native surfaces (composers, pickers, confirmations, detail
 * peeks) a consistent iOS sheet feel: rounded top corners, a drag grabber,
 * drag-to-dismiss, a dimmed backdrop, home-indicator safe-area padding, and
 * keyboard-awareness (content lifts by var(--keyboard-height) so inputs stay
 * visible above the on-screen keyboard). Reduced-motion is honoured by falling
 * back on vaul's own transition plus the global prefers-reduced-motion reset in
 * index.css, and by dropping the entrance fade when the user opts out.
 *
 * Self-contained: depends only on vaul (peer of the existing ui/drawer.jsx
 * wrapper) and framer-motion's useReducedMotion, both already in the bundle.
 */
import React from "react";
import { Drawer } from "vaul";
import { useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { selectionChanged } from "@/lib/native/haptics";

/**
 * @param {object}   props
 * @param {boolean}  props.open            Controlled open state.
 * @param {(open:boolean)=>void} props.onOpenChange  Open-state change handler.
 * @param {string}  [props.title]          Accessible sheet title (visually shown).
 * @param {React.ReactNode} props.children Scrollable sheet body.
 * @param {React.ReactNode} [props.footer] Sticky footer (e.g. primary CTA).
 * @param {boolean} [props.dismissible=true] Allow drag / backdrop / close to dismiss.
 */
export default function NativeSheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
  dismissible = true,
}) {
  const reduceMotion = useReducedMotion();
  // A stable id lets us wire aria-labelledby even when the title is omitted
  // (we still render a visually-hidden title so the dialog is always labelled).
  const titleId = React.useId();

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      dismissible={dismissible}
      // vaul repositions focused inputs above the keyboard; we additionally
      // lift the whole content by --keyboard-height below for sticky footers.
      repositionInputs
      shouldScaleBackground={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay
          className="fixed inset-0 z-[190] bg-black/60 backdrop-blur-[2px]"
        />
        <Drawer.Content
          aria-labelledby={titleId}
          className="nt-legible-floor fixed inset-x-0 bottom-0 z-[200] mt-24 flex max-h-[92dvh] flex-col rounded-t-[1.25rem] border border-b-0 border-border/60 bg-background text-foreground outline-none"
          style={{
            // Lift the sheet (and its sticky footer) above the on-screen
            // keyboard; falls back to 0px on web / when closed.
            paddingBottom: "var(--keyboard-height, 0px)",
          }}
        >
          {/* Grabber handle — vaul routes drag-to-dismiss through it. */}
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />

          <div className="flex items-start justify-between gap-3 nt-gutter-x pb-2 pt-3">
            {title ? (
              <Drawer.Title
                id={titleId}
                className="nt-title min-w-0 flex-1 truncate text-foreground"
              >
                {title}
              </Drawer.Title>
            ) : (
              // Always give the dialog an accessible name even without a title.
              <Drawer.Title id={titleId} className="sr-only">
                Sheet
              </Drawer.Title>
            )}
            {dismissible && (
              <Drawer.Close
                onClick={() => selectionChanged()}
                aria-label="Close"
                className="ios-pressable -mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card/60 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </Drawer.Close>
            )}
          </div>

          {/* Scrollable body. -webkit-overflow-scrolling for momentum on iOS. */}
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain nt-gutter-x pb-4"
            style={{
              WebkitOverflowScrolling: "touch",
              opacity: reduceMotion ? 1 : undefined,
            }}
          >
            {children}
          </div>

          {footer && (
            <div
              className="nt-material-bar shrink-0 border-t border-white/[0.06] nt-gutter-x pt-3"
              style={{ paddingBottom: "max(1rem, var(--safe-bottom))" }}
            >
              {footer}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

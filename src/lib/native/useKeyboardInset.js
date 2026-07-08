/**
 * Keyboard inset for native composers/forms. Returns the current on-screen
 * keyboard height in px (0 on web and when closed). Reads the `--keyboard-height`
 * CSS var that NativeAppBootstrap keeps in sync via @capacitor/keyboard events,
 * so a sticky footer can lift above the keyboard:
 *   style={{ paddingBottom: `max(var(--safe-bottom), ${inset}px)` }}
 */
import { useEffect, useState } from "react";
import { isNativeApp } from "./native-env";

export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!isNativeApp()) return undefined;
    let cancelled = false;
    let removeShow = null;
    let removeHide = null;
    import("@capacitor/keyboard")
      .then(async ({ Keyboard }) => {
        if (cancelled) return;
        removeShow = await Keyboard.addListener("keyboardWillShow", (info) => {
          if (!cancelled) setInset(info?.keyboardHeight || 0);
        });
        removeHide = await Keyboard.addListener("keyboardWillHide", () => {
          if (!cancelled) setInset(0);
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      removeShow?.remove?.().catch(() => {});
      removeHide?.remove?.().catch(() => {});
    };
  }, []);

  return { inset, isOpen: inset > 0 };
}

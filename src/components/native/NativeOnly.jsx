/**
 * Render-gates for the native-divergent app. <NativeOnly> renders only inside
 * the Capacitor iOS shell; <WebOnly> renders only on web/PWA. Use these to give
 * the iOS app its own product surfaces without touching the web experience.
 */
import { useNative } from "@/lib/native/NativeContext";

export function NativeOnly({ children }) {
  return useNative().isNative ? children : null;
}

export function WebOnly({ children }) {
  return useNative().isNative ? null : children;
}

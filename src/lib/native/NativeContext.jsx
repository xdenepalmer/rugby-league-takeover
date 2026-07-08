/**
 * Native runtime context. Captures whether we're inside the Capacitor iOS
 * shell ONCE at mount and exposes it via useNative(). The Capacitor bridge is
 * injected before any web code runs in the real app, so this is stable for the
 * session — components read a constant instead of re-probing window.Capacitor
 * on every render, which keeps native-divergent rendering deterministic.
 *
 * The web/PWA gets { isNative: false } and every native-only branch is skipped,
 * so nothing here changes the web experience.
 */
import React, { createContext, useContext, useMemo } from "react";
import { isNativeApp, getPlatform } from "./native-env";

const NativeContext = createContext({ isNative: false, platform: "web" });

export function NativeProvider({ children }) {
  const value = useMemo(
    () => ({ isNative: isNativeApp(), platform: getPlatform() }),
    []
  );
  return <NativeContext.Provider value={value}>{children}</NativeContext.Provider>;
}

export function useNative() {
  return useContext(NativeContext);
}

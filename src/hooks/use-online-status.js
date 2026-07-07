import { useEffect, useState } from "react";
import { subscribeNativeNetwork } from "@/lib/native/network";

export function useOnlineStatus() {
  const [online, setOnline] = useState(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
    // In the native shell the Network plugin is authoritative — navigator.onLine
    // can report stale values inside a WKWebView. No-op subscription on web.
    const unsubscribeNative = subscribeNativeNetwork(setOnline);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      unsubscribeNative();
    };
  }, []);

  return online;
}

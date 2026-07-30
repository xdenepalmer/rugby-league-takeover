import { shouldEnablePwa } from "@/lib/pwa-env";

export async function registerServiceWorker() {
  if (!shouldEnablePwa()) {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith("rlt-")).map((key) => caches.delete(key)));
      }
    }
    return null;
  }

  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    console.warn("Service worker registration failed", error);
    return null;
  }
}

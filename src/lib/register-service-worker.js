import { shouldEnablePwa } from "@/lib/pwa-env";

export async function registerServiceWorker() {
  if (!shouldEnablePwa()) {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin") && "serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
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
import { shouldEnablePwa } from "@/lib/pwa-env";

export async function registerServiceWorker() {
  if (!shouldEnablePwa()) return null;

  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    console.warn("Service worker registration failed", error);
    return null;
  }
}

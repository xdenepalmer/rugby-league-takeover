/**
 * Push notification FOUNDATION only. This wraps permission/registration/token
 * plumbing for the native shell; there is deliberately no automatic permission
 * prompt (Apple rejects permission requests with no visible purpose) and no
 * send pipeline — delivery requires APNs credentials plus a Supabase send
 * function that do not exist yet. See supabase/migrations/0009_user_push_tokens.sql
 * for the token persistence path this is designed to feed.
 */
import { isNativeApp } from "./native-env.js";

export async function isPushSupported() {
  return isNativeApp();
}

export async function getPushPermissionStatus() {
  if (!isNativeApp()) return "unsupported";
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const { receive } = await PushNotifications.checkPermissions();
    return receive; // "prompt" | "granted" | "denied"
  } catch {
    return "unsupported";
  }
}

/**
 * Ask the user for push permission and register with APNs. Only call this from
 * an explicit user action (e.g. a notification-preferences toggle) — never on
 * app launch.
 */
export async function requestPushPermission() {
  if (!isNativeApp()) return "unsupported";
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const { receive } = await PushNotifications.requestPermissions();
    if (receive === "granted") await PushNotifications.register();
    return receive;
  } catch {
    return "unsupported";
  }
}

/**
 * Attach push listeners. Returns a cleanup function. `onToken` receives the
 * APNs device token string; persisting it (user_push_tokens) is the caller's
 * responsibility so auth context stays out of this module.
 */
export function addPushListeners({ onToken, onError, onReceived, onActioned } = {}) {
  if (!isNativeApp()) return () => {};

  const listeners = [];
  let cancelled = false;

  import("@capacitor/push-notifications")
    .then(async ({ PushNotifications }) => {
      if (cancelled) return;
      const add = async (event, handler) => {
        // Re-check cancellation before AND after each awaited registration:
        // cleanup can run between the sequential awaits, and a handle created
        // after cancellation would otherwise leak (duplicate tap handlers).
        if (typeof handler !== "function" || cancelled) return;
        const handle = await PushNotifications.addListener(event, handler);
        if (cancelled) {
          handle.remove().catch(() => {});
          return;
        }
        listeners.push(handle);
      };
      await add("registration", (token) => onToken?.(token?.value));
      await add("registrationError", (error) => onError?.(error));
      await add("pushNotificationReceived", (notification) => onReceived?.(notification));
      await add("pushNotificationActionPerformed", (action) => onActioned?.(action));
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    listeners.forEach((listener) => listener.remove().catch(() => {}));
  };
}

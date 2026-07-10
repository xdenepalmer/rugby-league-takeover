/**
 * Haptic feedback wrappers. Every helper is fire-and-forget and a strict
 * no-op on the web — the Capacitor plugin is only loaded inside the native
 * shell, so nothing here adds weight to the web bundle's critical path.
 */
import { isNativeApp } from "./native-env.js";

async function withHaptics(run) {
  if (!isNativeApp()) return;
  try {
    const mod = await import("@capacitor/haptics");
    await run(mod);
  } catch {
    // Haptics are decoration — never surface an error for them.
  }
}

export function lightImpact() {
  return withHaptics(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }));
}

export function mediumImpact() {
  return withHaptics(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Medium }));
}

export function heavyImpact() {
  return withHaptics(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Heavy }));
}

export function successImpact() {
  return withHaptics(({ Haptics, NotificationType }) =>
    Haptics.notification({ type: NotificationType.Success })
  );
}

export function warningImpact() {
  return withHaptics(({ Haptics, NotificationType }) =>
    Haptics.notification({ type: NotificationType.Warning })
  );
}

export function errorImpact() {
  return withHaptics(({ Haptics, NotificationType }) =>
    Haptics.notification({ type: NotificationType.Error })
  );
}

export function selectionChanged() {
  // A bare selectionStart/selectionEnd pair produces no perceptible tick on
  // iOS (the tick fires on selectionChanged between them). A light impact is
  // the standard tab-tap feel and is what UIKit tab bars use.
  return withHaptics(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }));
}

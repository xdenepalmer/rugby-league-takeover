/**
 * Mounts the native first-launch onboarding overlay once per install. Native
 * only: on the web isNativeApp() is false so nothing loads and the NativeOnboarding
 * chunk never enters the web bundle. The gate replicates NativeOnboarding's
 * shouldShowOnboarding() check inline (rather than importing it) precisely so the
 * component stays a lazy chunk.
 */
import React, { lazy, Suspense, useState } from "react";
import { isNativeApp } from "@/lib/native/native-env";

const NativeOnboarding = lazy(() => import("@/components/native/NativeOnboarding"));
const ONBOARDED_KEY = "rlt_native_onboarded";

function shouldShow() {
  if (!isNativeApp()) return false;
  try {
    return window.localStorage.getItem(ONBOARDED_KEY) !== "1";
  } catch {
    return false;
  }
}

export default function NativeOnboardingGate() {
  const [show, setShow] = useState(shouldShow);
  if (!show) return null;
  return (
    <Suspense fallback={null}>
      <NativeOnboarding onDone={() => setShow(false)} />
    </Suspense>
  );
}

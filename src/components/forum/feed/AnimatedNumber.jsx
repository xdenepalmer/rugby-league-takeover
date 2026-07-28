/* ━━━ Animated Number Counter ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Thin wrapper over the shared counter hook so forum stats can animate inline.
 */
import React from "react";
import useAnimatedCount from "@/hooks/use-animated-count";

export default function AnimatedNumber({ value, duration = 1200 }) {
  const display = useAnimatedCount(value, { duration });
  return <>{display}</>;
}

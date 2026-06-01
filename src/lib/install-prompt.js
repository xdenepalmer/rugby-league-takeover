const IOS_RE = /iPad|iPhone|iPod/i;
const SAFARI_RE = /Safari/i;
const NON_SAFARI_IOS_RE = /CriOS|FxiOS|EdgiOS|OPiOS/i;
const DEFAULT_COOLDOWN_DAYS = 14;

export function getInstallPromptMode({
  userAgent = "",
  displayModeStandalone = false,
  navigatorStandalone = false,
  hasBeforeInstallPrompt = false,
} = {}) {
  if (displayModeStandalone || navigatorStandalone) return "hidden";
  if (hasBeforeInstallPrompt) return "native";

  const isIos = IOS_RE.test(userAgent);
  const isSafari = SAFARI_RE.test(userAgent) && !NON_SAFARI_IOS_RE.test(userAgent);
  return isIos && isSafari ? "ios" : "hidden";
}

export function shouldShowInstallNudge({
  dismissedAt,
  now = Date.now(),
  cooldownDays = DEFAULT_COOLDOWN_DAYS,
} = {}) {
  if (!dismissedAt) return true;
  return now - Number(dismissedAt) >= cooldownDays * 86400000;
}

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { isNativeApp } from "@/lib/native/native-env";
import { initDeepLinks, mapUrlToRoute } from "@/lib/native/deep-links";
import { classifyHref, openExternalUrl, openSystemUrl } from "@/lib/native/open-external";

/**
 * Single home for native-shell startup behavior. Renders nothing and does
 * nothing on the web. Must be mounted inside the Router (deep links navigate).
 */
export default function NativeAppBootstrap() {
  // Under BrowserRouter, `navigate` changes identity on every navigation.
  // Startup wiring (status bar, splash, deep links, click interceptor) must
  // run once per mount, so the effect reads the latest navigate via a ref
  // instead of depending on it.
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!isNativeApp()) return undefined;

    document.documentElement.classList.add("is-native-app");
    document.body.classList.add("is-native-app");

    // Status bar: light content over the dark brand background, overlaying the
    // WebView so env(safe-area-inset-top) keeps governing layout.
    import("@capacitor/status-bar")
      .then(({ StatusBar, Style }) =>
        Promise.allSettled([
          StatusBar.setStyle({ style: Style.Dark }),
          StatusBar.setOverlaysWebView({ overlay: true }),
        ])
      )
      .catch(() => {});

    // capacitor.config.json sets launchAutoHide: false so the splash covers
    // the WebView until React has painted; hide it now that we've mounted.
    import("@capacitor/splash-screen")
      .then(({ SplashScreen }) => SplashScreen.hide())
      .catch(() => {});

    const removeDeepLinks = initDeepLinks((route) => navigateRef.current(route));

    // Inside the shell: absolute http(s) links (ticket vendors, sponsor sites,
    // user-authored forum links) must open in the system browser sheet,
    // absolute links to our own domain must become router navigations, and
    // mailto:/tel:/sms: must go to the OS handler (WKWebView silently ignores
    // them). Nothing may navigate the WebView off the local app.
    const handleClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      const kind = classifyHref(href);
      if (kind === "http") {
        const route = mapUrlToRoute(href);
        event.preventDefault();
        if (route) {
          navigateRef.current(route);
        } else {
          openExternalUrl(href);
        }
      } else if (kind === "mailto" || kind === "tel" || kind === "sms") {
        event.preventDefault();
        openSystemUrl(href);
      }
      // relative links: leave to the router/anchor defaults
    };
    document.addEventListener("click", handleClick, true);

    return () => {
      removeDeepLinks();
      document.removeEventListener("click", handleClick, true);
    };
    // Run once per mount — navigation goes through navigateRef.
  }, []);

  return null;
}

import React from "react";

// App-wide safety net. A render/runtime throw anywhere below this boundary would
// otherwise unmount the whole React tree and leave a black screen. Instead we
// show a recoverable error with the message + a reload that also clears the
// service-worker cache (the common "stale publish" cause).
export default class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surface it for diagnosis; harmless in production consoles.
    console.error("RootErrorBoundary caught:", error, info?.componentStack);
  }

  async handleReload() {
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      /* best-effort */
    }
    window.location.reload(true);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          background: "#030512",
          color: "#e5e7eb",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2rem" }}>🏉</div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "0.04em", margin: 0 }}>
          Something went wrong loading the site
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#9ca3af", maxWidth: 420, margin: 0 }}>
          We hit an unexpected error. Reloading usually fixes it — it clears the cached app and fetches the latest version.
        </p>
        <button
          type="button"
          onClick={() => this.handleReload()}
          style={{
            marginTop: "0.5rem",
            border: "1px solid #f97316",
            background: "rgba(249,115,22,0.15)",
            color: "#fff",
            padding: "0.75rem 1.5rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            fontSize: "0.75rem",
            cursor: "pointer",
            borderRadius: 2,
          }}
        >
          Reload &amp; clear cache
        </button>
        <pre
          style={{
            marginTop: "1rem",
            maxWidth: "90vw",
            overflow: "auto",
            fontSize: "0.7rem",
            color: "#6b7280",
            whiteSpace: "pre-wrap",
          }}
        >
          {String(this.state.error?.message || this.state.error || "Unknown error")}
        </pre>
      </div>
    );
  }
}

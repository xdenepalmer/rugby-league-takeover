import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import RootErrorBoundary from '@/components/RootErrorBoundary'
import { registerServiceWorker } from '@/lib/register-service-worker'
import '@/index.css'

// Last-resort fallback if React never mounts anything (e.g. a broken/partial
// publish, or a hung boot). Renders a recoverable message into #root rather
// than leaving a black screen.
const renderFatalFallback = (rootEl, message) => {
  if (!rootEl) return;
  rootEl.innerHTML = `
    <div style="min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:2rem;background:#030512;color:#e5e7eb;font-family:system-ui,sans-serif;text-align:center;">
      <div style="font-size:2rem;">🏉</div>
      <h1 style="font-size:1.25rem;font-weight:800;margin:0;">We couldn't load the site</h1>
      <p style="font-size:.875rem;color:#9ca3af;max-width:420px;margin:0;">Tap reload to clear the cached app and fetch the latest version.</p>
      <button id="rlt-fatal-reload" style="margin-top:.5rem;border:1px solid #f97316;background:rgba(249,115,22,.15);color:#fff;padding:.75rem 1.5rem;font-weight:700;text-transform:uppercase;letter-spacing:.15em;font-size:.75rem;cursor:pointer;">Reload &amp; clear cache</button>
      ${message ? `<pre style="margin-top:1rem;max-width:90vw;overflow:auto;font-size:.7rem;color:#6b7280;white-space:pre-wrap;">${String(message)}</pre>` : ''}
    </div>`;
  const btn = document.getElementById('rlt-fatal-reload');
  if (btn) btn.addEventListener('click', async () => {
    try {
      if ('caches' in window) { const k = await caches.keys(); await Promise.all(k.map((x) => caches.delete(x))); }
      if ('serviceWorker' in navigator) { const r = await navigator.serviceWorker.getRegistrations(); await Promise.all(r.map((x) => x.unregister())); }
    } catch { /* best-effort */ }
    window.location.reload(true);
  });
};

const scheduleServiceWorkerRegistration = () => {
  const register = () => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => registerServiceWorker(), { timeout: 3000 });
      return;
    }
    setTimeout(() => registerServiceWorker(), 0);
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
};

scheduleServiceWorkerRegistration()

const rootEl = document.getElementById('root');
try {
  ReactDOM.createRoot(rootEl).render(
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  );
} catch (err) {
  // Synchronous mount failure — show a recoverable screen instead of black.
  renderFatalFallback(rootEl, err?.message || err);
}

// Watchdog: if nothing rendered into #root within a few seconds (broken/partial
// publish, hung boot), replace the black screen with a recoverable fallback.
setTimeout(() => {
  if (rootEl && rootEl.childElementCount === 0) {
    renderFatalFallback(rootEl, 'The app did not start.');
  }
}, 8000);

// Dynamically load and log web vitals performance metrics in development mode
// or when the URL contains '?show_vitals=true'
if (import.meta.env.DEV || (typeof window !== 'undefined' && window.location.search.includes('show_vitals=true'))) {
  import('web-vitals').then(({ onCLS, onFID, onLCP, onFCP, onINP }) => {
    const logMetric = (name, metric) => {
      console.log(`[Web Vitals] ${name}:`, Math.round(metric.value * 100) / 100, `(${metric.rating.toUpperCase()})`);
    };
    onCLS((m) => logMetric('CLS', m));
    onFID((m) => logMetric('FID', m));
    onLCP((m) => logMetric('LCP', m));
    onFCP((m) => logMetric('FCP', m));
    onINP((m) => logMetric('INP', m));
  }).catch(() => {});
}

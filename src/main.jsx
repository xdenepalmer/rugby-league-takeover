import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { registerServiceWorker } from '@/lib/register-service-worker'
import '@/index.css'

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

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

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

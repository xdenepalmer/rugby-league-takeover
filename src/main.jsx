import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { registerServiceWorker } from '@/lib/register-service-worker'
import '@/index.css'

registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

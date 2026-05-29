import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import './i18n';
import App from './App.jsx'

// Register Service Worker with automatic update reload hooks
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('New content available, updating service worker...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  }
});

// Periodically check for updates every 5 minutes
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    setInterval(() => {
      console.log('Checking for service worker updates...');
      registration.update().catch(err => console.error('SW update check failed:', err));
    }, 300000); // 5 minutes
  });

  // Automatically refresh page once the new service worker activates and claims the client
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    console.log('Service worker updated. Reloading page...');
    window.location.reload();
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

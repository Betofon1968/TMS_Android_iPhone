import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import DriverApp from './DriverApp.jsx';
import './driver.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DriverApp />
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

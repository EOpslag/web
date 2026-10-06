import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-ext-400.css';
import './index.css';
import App from './App.tsx';

// The site is designed for light mode only: never let a stored or system dark preference apply.
const forceLightMode = () => {
  document.documentElement.classList.toggle('dark', false);
};
forceLightMode();
document.addEventListener('DOMContentLoaded', forceLightMode);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', forceLightMode);

// Swap broken images for a neutral placeholder icon instead of showing a browser error glyph.
document.addEventListener(
  'error',
  event => {
    if (!(event.target instanceof HTMLImageElement)) return;
    const img = event.target;
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = 'true';
    img.src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='18' height='18' x='3' y='3' rx='2' ry='2'/%3E%3Ccircle cx='9' cy='9' r='2'/%3E%3Cpath d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/%3E%3C/svg%3E";
    img.classList.add('broken-image-fallback');
    if (!img.alt || img.alt.trim() === '') img.alt = 'Afbeelding niet beschikbaar';
  },
  true
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

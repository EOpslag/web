import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Public URL the site is served from (no trailing slash). Drives canonical/OG tags, robots.txt and
// sitemap.xml. Override per deployment: `SITE_URL=https://user.github.io/repo yarn build`.
const SITE_URL = (process.env.SITE_URL || 'https://extraopslag.nl').replace(/\/+$/, '');

// GitHub Pages cannot send HTTP headers, so the Content-Security-Policy is delivered via <meta> in
// production builds only (the dev server needs inline scripts for hot reload).
// - scripts: same-origin only (no inline, no eval, no third-party CDN)
// - styles: 'unsafe-inline' is required by Leaflet marker HTML and React inline style attributes
// - img: OpenStreetMap tiles for the location map
// - connect: EmailJS REST endpoint used by the lead forms
// `frame-ancestors` is intentionally absent: it is ignored in <meta> CSP (needs a real header).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "font-src 'self'",
  "connect-src 'self' https://api.emailjs.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

const PAGES = ['/', '/privacybeleid.html', '/algemene-voorwaarden.html'];

function siteMeta(): Plugin {
  return {
    name: 'site-meta',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const csp = ctx.server ? '' : `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`;
        return html.replaceAll('%SITE_URL%', SITE_URL).replace('<!--CSP-->', csp);
      },
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: '404.html',
        source: `<!doctype html>
<html lang="nl"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" />
<meta name="robots" content="noindex" /><title>Pagina niet gevonden — ExtraOpslag.nl</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#111827;color:#fff;font-family:Inter,system-ui,sans-serif;text-align:center;padding:24px}a{color:#f97316;font-weight:700}h1{font-size:2rem;margin:0 0 .5rem}p{color:#9ca3af}</style></head>
<body><main><h1>Pagina niet gevonden</h1><p>Deze pagina bestaat niet (meer).</p><p><a href="${SITE_URL}/">Naar ExtraOpslag.nl</a></p></main></body></html>
`,
      });
      const today = new Date().toISOString().slice(0, 10);
      const urls = PAGES.map(
        page => `  <url><loc>${SITE_URL}${page}</loc><lastmod>${today}</lastmod></url>`
      ).join('\n');
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs: works on a custom domain AND on https://<user>.github.io/<repo>/.
  base: './',
  plugins: [react(), tailwindcss(), siteMeta()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // The lazy-loaded 3D viewer chunk (three.js) is intentionally large; it is not on the critical path.
    chunkSizeWarningLimit: 1000,
  },
});

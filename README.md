# ExtraOpslag.nl — landingspagina

Statische React/Vite-website (Tailwind v4, three.js voor de 3D-box, Leaflet/OpenStreetMap voor de kaart).
Wordt gepubliceerd op **GitHub Pages** via GitHub Actions. Leads gaan via EmailJS naar `hallo@extraopslag.nl`.

## Lokaal werken

```bash
yarn install --frozen-lockfile
yarn dev                  # http://localhost:5173
yarn build                # typecheck + productiebuild naar dist/
yarn preview              # bekijk de productiebuild (met de echte CSP)
yarn check:launch         # launch-gate (waarschuwt bij open placeholders)
yarn check:launch:strict  # zoals CI: faalt bij open placeholders
```

Node ≥ 20 (CI gebruikt Node 22, zie `.nvmrc`).

## Publiceren (GitHub Pages)

1. Maak een repository en push `main`.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Settings → Pages → Custom domain: `extraopslag.nl`**, daarna **Enforce HTTPS** aanvinken.
   DNS bij uw registrar: vier `A`-records (185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153),
   evt. vier `AAAA`-records en `www` als `CNAME` naar `<account>.github.io`
   ([GitHub-docs](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site)).
   Verifieer het domein ook onder **Account → Settings → Pages** (beschermt tegen domain takeover).
4. Elke push naar `main` bouwt en deployt automatisch (`.github/workflows/deploy.yml`).

`SITE_URL` (canonical, Open Graph, sitemap) komt standaard uit het ingestelde Pages-domein; overschrijven kan met een
repository-variabele `SITE_URL`. Lokaal staat de standaard op `https://extraopslag.nl` (`vite.config.ts`).

### Launch-gate (bewust streng)

De pipeline draait `node scripts/check-launch.mjs --strict` en **faalt zolang er placeholders openstaan**:

| Bestand | Placeholder |
| --- | --- |
| `public/privacybeleid.html` | `[[BEDRIJFSNAAM]]`, `[[E-MAILPROVIDER]]`, `[[BEWAARTERMIJN]]` |
| `public/algemene-voorwaarden.html` | `[[ALGEMENE-VOORWAARDEN: …]]` (tekst of link naar PDF) |

Vul die in en push — dan deployt de site. De gate controleert ook: geen verboden externe hosts (CDN's, Google Fonts),
CSP aanwezig, canonical/`lang="nl"`, robots/sitemap/404.

## Beveiliging — wat er is ingebouwd

- **Content-Security-Policy** (meta-tag, alleen in productiebuild): scripts alleen van eigen origin (geen inline/eval),
  verbindingen alleen naar `api.emailjs.com`, afbeeldingen alleen eigen + OpenStreetMap-tegels, geen frames/objecten.
- **Geen externe CDN's of lettertypen**: Leaflet, lettertypen (Inter/Roboto) en alle afbeeldingen worden zelf gehost;
  de kaart laadt pas vlak voordat u erheen scrolt (dan pas gaat het bezoekers-IP naar OpenStreetMap).
- **Formulieren**: strengere validatie (e-mail/telefoon), lengtebeperkingen, besturingstekens gestript, honeypot,
  throttling (1 aanvraag per 20 s, max. 5 per sessie), geen `console.log` van persoonsgegevens, geen `accessToken`,
  alleen `origin + pad` van de pagina wordt meegestuurd, `credentials: 'omit'`.
- **Supply chain**: ongebruikte dependencies verwijderd (33 → 13 runtime), `fflate` gepatcht, build-tooling bijgewerkt,
  `yarn audit --groups dependencies` = 0 kwetsbaarheden; CI installeert met `--frozen-lockfile --ignore-scripts`;
  GitHub Actions zijn vastgepind op commit-SHA; Dependabot (npm + actions) staat aan.
- **CI-rechten**: standaard alleen `contents: read`; de deploy-job krijgt als enige `pages: write` + `id-token: write`.

### Checklist die u zelf moet doen (kan niet vanuit code)

**EmailJS-dashboard** — de Public Key, Service ID en Template ID staan in de broncode en zijn *per ontwerp openbaar*.
Iedereen die de site bekijkt kan ze zien, dus de bescherming zit in uw dashboard:

- [ ] Beperk toegestane herkomst (origins) tot `https://extraopslag.nl` (en tijdelijk de github.io-URL tijdens testen).
- [ ] Laat IP-rate-limiting aan staan; overweeg reCAPTCHA op de template.
- [ ] Zet een gebruikslimiet/alarm zodat spam uw maandquotum niet kan opmaken.
- [ ] Gebruik nooit een *Private Key* in deze repository.
- [ ] Controleer de verwerkersovereenkomst/doorgifte-waarborgen van EmailJS (data kan buiten de EER worden verwerkt).
- [ ] Optioneel: zet een EmailJS auto-reply-template op als u bezoekers een bevestigingsmail wilt sturen (de site belooft dat nu níet).

**GitHub-account/repository**

- [ ] 2FA aan voor alle beheerders; branch protection op `main` (PR + groene checks verplicht).
- [ ] Secret scanning + push protection en Dependabot alerts aanzetten (Settings → Code security).
- [ ] Domein verifiëren voor Pages (zie hierboven) en HTTPS afdwingen.

### Bekende beperkingen (GitHub Pages)

- Geen eigen HTTP-headers mogelijk: `frame-ancestors`/`X-Frame-Options` (clickjacking), `Permissions-Policy` en HSTS-tuning
  kunnen alleen met een proxy ervoor (bijv. Cloudflare). De CSP via `<meta>` dekt de rest.
- Client-side spamcontroles (honeypot, throttling) zijn drempels, geen garantie: een bot kan de EmailJS-API direct
  aanroepen. Daarom zijn de dashboard-instellingen hierboven belangrijk.

## Inhoud / juridisch — let op

- De site toont een “LIVE”-beschikbaarheidsteller die automatisch afneemt (2 units/week vanaf 7 september 2026,
  zie `LAUNCH_DATE`/`WEEKLY_DECREASE` in `ExtraOpslagLanding.tsx`), een score “4.9/5 op basis van 47 beoordelingen”,
  “47 eigenaren” en vier eigenaarsreviews. Zijn dit geen werkelijke, controleerbare aantallen/reviews, dan zijn het in
  NL/EU misleidende handelspraktijken (Wet handhaving consumentenbescherming / UCPD, ACM-toezicht).
- Rendementsclaims (6–8%) staan als “indicatief” met disclaimer; richt ze zo in dat ze aantoonbaar onderbouwd zijn.
- De site vermeldt geen KvK-/BTW-nummer en geen statutair adres; voor webwinkels/ondernemers geldt een wettelijke
  identificatieplicht (o.a. KvK-nummer, vestigingsadres) — voeg dat toe vóór livegang als dat op u van toepassing is.
- Controleer dat u de rechten heeft op alle beelden (renders/foto's in `src/assets/images/`).

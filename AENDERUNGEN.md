# Änderungsübersicht (22.10.2026)

## Neu
- `tools/build.py`, `content/*.html` – Seitengenerator und Rechtstexte als Quelle
- `css/style.css` – ein überarbeitetes Stylesheet (ersetzt nav.css, main.css, responsive.css)
- `js/site.js` – neue Logik (ersetzt main.js)
- `data/site.json`, `data/menu.json`, `data/report.json`, `data/analytics.json` – pflegbare Inhalte
- `admin/` – Verwaltung (`index.html`, `admin.js`, `admin.css`) und Kundenreport (`report.html`)
- `.github/workflows/pages.yml` (Veröffentlichen), `.github/workflows/analytics.yml` (Reichweite)
- `tools/images.py`, `tools/fetch_analytics.py`
- `404.html`, `robots.txt`, `sitemap.xml`
- Bilder als WebP inkl. Handy-/Vorschauvarianten, `icon-48.png`, `icon-180.png`
- `assets/videos/video.webm` (AV1), `assets/videos/poster.webp`

## Geändert
- Alle HTML-Seiten (jetzt generiert), `js/hero_carousel.js`, `js/about_carousel.js`
- `assets/videos/video.mp4` neu kodiert (9,6 → 8,1 MB)

## Entfernt
- `js/main.js`, `css/nav.css`, `css/main.css`, `css/responsive.css`
- Alle PNG/JPG-Originale in `assets/` (ersetzt durch WebP; in der Git-Historie weiterhin vorhanden)

## Unverändert
- Speisekarte inhaltlich (49 Gerichte, alle Preise), PDF-Speisekarten, Video-Inhalt, Fotos, CNAME, Reservierungs- und Maps-Einbindung

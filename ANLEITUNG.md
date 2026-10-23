# IZ Mannheim – Anleitung

## 1. Einmalig nach dem Hochladen
1. Den Inhalt dieses Ordners ins GitHub-Repository übernehmen (alte Dateien ersetzen, gelöschte Dateien mit löschen).
2. GitHub → Repository → **Settings → Pages → Build and deployment → Source: „GitHub Actions“**.
   Danach erzeugt die Aktion „Website veröffentlichen“ bei jeder Änderung die Seiten neu und stellt sie online (ca. 1–2 Minuten).
   Die Domain (CNAME `iz-mannheim.de`) bleibt erhalten; ggf. unter Settings → Pages „Custom domain“ prüfen.
3. Falls Pages auf „Deploy from a branch“ bleibt, funktioniert die Website trotzdem – Änderungen aus der Verwaltung
   erscheinen dann per JavaScript, die HTML-Dateien selbst bleiben aber auf dem alten Stand, bis jemand
   `python3 tools/build.py` ausführt und das Ergebnis hochlädt.

## 2. Inhalte selbst ändern (Verwaltung)
1. `https://iz-mannheim.de/admin/` öffnen.
2. Anmelden mit Repository (`Besitzer/Name`) und einem GitHub-Token:
   GitHub → Settings → Developer settings → Fine-grained tokens → nur dieses Repository → **Contents: Read and write**.
3. Tabs: **Speisekarte** (Preis, Name, Beschreibung, Allergene, „Verfügbar“, „Unsere Empfehlung“, Foto, Reihenfolge, neue Gerichte/Kategorien),
   **Texte & Infos** (alle Texte, Links, Hinweisbanner, Reichweitenmessung), **Öffnungszeiten**, **Report**, **Änderungen**.
4. Unten **Veröffentlichen** → nach 1–2 Minuten online. Jede Änderung ist in GitHub gespeichert und kann dort rückgängig gemacht werden.

Hinweise: Die ersten drei als „Unsere Empfehlung“ markierten Gerichte erscheinen auf der Startseite.
Die **PDF-Speisekarten** werden nicht automatisch geändert. Fotos werden beim Hochladen automatisch verkleinert (WebP, 640 px).
Sicherheit: Speichern ist nur mit gültigem Token möglich – das prüft GitHub, nicht die Website. Token nie weitergeben; bei Verlust in GitHub löschen.

## 3. Reichweite (Besucherzahlen)
1. Kostenloses Konto auf goatcounter.com (Code z. B. `iz-mannheim`).
2. Verwaltung → Texte & Infos → „Reichweitenmessung“ → Code eintragen → Veröffentlichen.
   Erst dann erscheint der Cookie-Hinweis; gemessen wird nur nach „Akzeptieren“ (cookielos).
3. GoatCounter → API-Schlüssel (nur Lesen). GitHub → Settings → Secrets and variables → Actions:
   Secret `GOATCOUNTER_TOKEN`, Variable `GOATCOUNTER_CODE`.
4. Aktion „Reichweiten-Daten aktualisieren“ läuft montags (oder manuell) und füllt den Report.
   Nicht gegen ein echtes Konto getestet – beim ersten Lauf das Ergebnis unter Actions prüfen.

## 4. Kundenreport
Verwaltung → Report → „Kundenreport öffnen“ → „Als PDF speichern“. Inhalte: `data/report.json`.

## 5. Für Entwickler
- `tools/build.py` – erzeugt alle HTML-Seiten aus `data/*.json` und `content/*.html` (nur Python-Standardbibliothek).
  HTML-Dateien nie direkt bearbeiten – sie werden überschrieben.
- `content/impressum.html`, `content/datenschutz.html` – Rechtstexte.
- `css/style.css` – einziges Stylesheet. `js/site.js` – Logik. `admin/` – Verwaltung und Report.
- `tools/images.py` – erzeugt WebP-Varianten aus Original-JPG/PNG (Originale liegen in der Git-Historie).
- `tools/fetch_analytics.py` – GoatCounter-Abruf (von der Aktion genutzt).

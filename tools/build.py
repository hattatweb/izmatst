#!/usr/bin/env python3
"""Erzeugt alle HTML-Seiten aus data/site.json, data/menu.json und content/*.html.

Aufruf im Projektordner:   python3 tools/build.py
Nur Python-Standardbibliothek – läuft auch in der GitHub-Action (.github/workflows/build.yml).

Texte und Preise werden NICHT hier gepflegt, sondern über die Verwaltung (/admin/)
bzw. in data/*.json. Die Seiten enthalten den Inhalt fertig als HTML (gut für Google
und ohne JavaScript lesbar); js/site.js aktualisiert ihn zusätzlich live aus den JSON-Dateien.
"""
import datetime
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE_URL = "https://iz-mannheim.de"
site = json.loads((ROOT / "data/site.json").read_text(encoding="utf8"))
menu = json.loads((ROOT / "data/menu.json").read_text(encoding="utf8"))
R = site["restaurant"]
TODAY = datetime.date.today().isoformat()


def e(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def rich(s):
    """**fett** erlaubt, alles andere wird maskiert."""
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", e(s))


def g(path, default=""):
    cur = site
    for k in path.split("."):
        if isinstance(cur, list):
            k = int(k)
        try:
            cur = cur[k]
        except (KeyError, IndexError, TypeError):
            return default
    return cur if cur not in (None, "") else default


def safe_url(u):
    u = str(u or "").strip()
    return u if re.match(r"^(https?:|tel:|mailto:|assets/|/|#)", u, re.I) else ""


def tel_href():
    d = re.sub(r"[^\d+]", "", R.get("phoneHref") or R.get("phone", ""))
    return "tel:" + d


ROUTE_URL = "https://www.google.com/maps/dir/?api=1&destination=" + "+".join(
    [re.sub(r"\s+", "+", R["name"]), R["street"].replace(" ", "+"), R["zip"], R["city"]])

# ---------------------------------------------------------------- Öffnungszeiten
DAY_SHORT = {"Montag": "Mo", "Dienstag": "Di", "Mittwoch": "Mi", "Donnerstag": "Do",
             "Freitag": "Fr", "Samstag": "Sa", "Sonntag": "So"}


def hours_text(d):
    if d.get("closed") or not d.get("slots"):
        return "geschlossen"
    return " & ".join(f"{a} – {b}" for a, b in d["slots"]) + " Uhr"


def hours_groups():
    groups = []
    for d in site["hours"]:
        t = hours_text(d)
        if groups and groups[-1][2] == t:
            groups[-1][1] = d["day"]
        else:
            groups.append([d["day"], d["day"], t])
    out = []
    for a, b, t in groups:
        label = DAY_SHORT[a] if a == b else f"{DAY_SHORT[a]}–{DAY_SHORT[b]}"
        out.append((label, t))
    return out


def hours_table():
    rows = "".join(
        f'<tr{" class=\"closed\"" if d.get("closed") else ""} data-dow="{e(d["dow"])}"><th scope="row">{e(d["day"])}</th><td>{e(hours_text(d))}</td></tr>'
        for d in site["hours"])
    note = f'<p class="note">{e(site.get("hoursNote", ""))}</p>' if site.get("hoursNote") else ""
    return f'<table class="hours-table"><caption class="sr-only">Öffnungszeiten</caption><tbody>{rows}</tbody></table>{note}'


# ---------------------------------------------------------------- Icons (inline SVG, keine Icon-Schrift nötig)
ICON = {
    "ubereats": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8zm4 0a3 3 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "lieferando": '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 17h6l-3-8h-3m6 8 2-6h2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "instagram": '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor"/></svg>',
    "tiktok": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.6 2.1 4.2 5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "phone": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    "calendar": '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
}


def delivery_buttons():
    return "".join(
        f'<a class="delivery-btn {e(i.get("type"))}" href="{e(safe_url(i.get("url")))}" target="_blank" rel="noopener noreferrer">{ICON.get(i.get("type"), "")}{e(i.get("label"))}</a>'
        for i in g("delivery.items", []) if safe_url(i.get("url")))


def social_links():
    out = ""
    for key, label in (("instagram", "Instagram"), ("tiktok", "TikTok")):
        u = safe_url(g("social." + key))
        if u:
            out += f'<a href="{e(u)}" target="_blank" rel="noopener noreferrer">{ICON[key]}<span>{label}</span></a>'
    return out


# ---------------------------------------------------------------- Speisekarte (gleiches Markup wie js/site.js)
def visible_categories():
    return [c for c in menu["categories"]
            if c.get("visible", True) and any(i.get("available", True) for i in c.get("items", []))]


def menu_card(i):
    nr = f'{e(i["nr"])}. ' if i.get("nr") else ""
    badge = '<span class="badge">Unsere Empfehlung</span>' if i.get("recommended") else ""
    img = (f'<img loading="lazy" decoding="async" src="{e(i["image"])}" alt="{e(i["name"])}" width="640" height="480">'
           if i.get("image") else "")
    desc = f'<p>{e(i["description"])}</p>' if i.get("description") else '<p class="muted">Keine weitere Beschreibung.</p>'
    allerg = f'<p class="allergens"><strong>Enthält:</strong> {e(i["allergens"])}</p>' if i.get("allergens") else ""
    return (f'<div class="menu-item" role="button" tabindex="0" aria-pressed="false" '
            f'aria-label="{e(i["name"])}, {e(i["price"])}. Für Details aktivieren.">'
            f'<div class="menu-flip-inner"><div class="menu-flip-front">{badge}<div class="menu-image-wrapper">{img}</div>'
            f'<h3>{nr}{e(i["name"])}</h3><p class="price">{e(i["price"])}</p><p class="hint">Tippen für Details</p></div>'
            f'<div class="menu-flip-back"><div class="menu-back-scroll"><h3>{e(i["name"])}</h3>{desc}{allerg}'
            f'<p class="price">{e(i["price"])}</p></div></div></div></div>')


def menu_html():
    cats = visible_categories()
    chips = '<nav class="menu-chips" aria-label="Kategorien">' + "".join(
        f'<a href="#cat-{e(c["id"])}" data-cat="{e(c["id"])}">{e(c["title"])}</a>' for c in cats) + "</nav>"
    secs = ""
    for c in cats:
        items = [i for i in c["items"] if i.get("available", True)]
        secs += (f'<section class="accordion-section" id="cat-{e(c["id"])}">'
                 f'<h2 class="accordion-heading"><button class="accordion-toggle" type="button" aria-expanded="false" aria-controls="panel-{e(c["id"])}">'
                 f'<span>{e(c["title"])}</span><span class="count">{len(items)}</span><span class="accordion-icon" aria-hidden="true">&#9660;</span></button></h2>'
                 f'<div class="accordion-body" id="panel-{e(c["id"])}" role="region" aria-label="{e(c["title"])}"><div class="menu-grid">'
                 + "".join(menu_card(i) for i in items) + "</div></div></section>")
    note = f'<p class="note allergen-note">{e(g("menuPage.allergenNote"))}</p>' if g("menuPage.allergenNote") else ""
    return chips + secs + note


def recommended():
    out = []
    for c in visible_categories():
        for i in c["items"]:
            if i.get("recommended") and i.get("available", True):
                out.append(i)
    return out[:3]


def dish_cards():
    return "".join(
        f'<a class="dish-card" href="menu.html#cat-{e(c_id)}"><div class="ph"><span class="badge">Unsere Empfehlung</span>'
        f'<img loading="lazy" decoding="async" src="{e(i["image"])}" alt="{e(i["name"])}" width="640" height="480"></div>'
        f'<div class="body"><h3>{e(i["name"])}</h3><p>{e(i.get("description", ""))}</p><span class="price">{e(i["price"])}</span></div></a>'
        for i, c_id in ((i, cat_of(i)) for i in recommended()))


def cat_of(item):
    for c in menu["categories"]:
        if item in c["items"]:
            return c["id"]
    return ""


# ---------------------------------------------------------------- Strukturierte Daten
def ld_restaurant():
    spec = []
    for d in site["hours"]:
        if not d.get("closed"):
            for a, b in d.get("slots", []):
                spec.append({"@type": "OpeningHoursSpecification", "dayOfWeek": d["dow"], "opens": a, "closes": b})
    data = {
        "@context": "https://schema.org", "@type": "Restaurant", "name": R["name"], "url": SITE_URL + "/",
        "image": SITE_URL + "/assets/images/extra/hero1.webp", "logo": SITE_URL + "/assets/images/extra/icon-180.png",
        "servesCuisine": ["Uigurisch", "Zentralasiatisch"], "telephone": tel_href()[4:], "priceRange": R.get("priceRange") or None,
        "address": {"@type": "PostalAddress", "streetAddress": R["street"], "postalCode": R["zip"],
                    "addressLocality": R["city"], "addressCountry": "DE"},
        "geo": {"@type": "GeoCoordinates", "latitude": R["lat"], "longitude": R["lng"]} if R.get("lat") else None,
        "hasMenu": SITE_URL + "/menu.html", "acceptsReservations": "True",
        "sameAs": [u for u in (safe_url(g("social.instagram")), safe_url(g("social.tiktok"))) if u.startswith("http")],
        "openingHoursSpecification": spec,
    }
    data = {k: v for k, v in data.items() if v is not None}
    return '<script type="application/ld+json" id="ld-restaurant">' + json.dumps(data, ensure_ascii=False) + "</script>"


def ld_menu():
    secs = []
    for c in visible_categories():
        items = []
        for i in c["items"]:
            if not i.get("available", True):
                continue
            m = {"@type": "MenuItem", "name": i["name"]}
            if i.get("description"):
                m["description"] = i["description"]
            p = re.match(r"^(\d+),(\d{2})\s*€$", i.get("price", ""))
            if p:
                m["offers"] = {"@type": "Offer", "price": f"{p[1]}.{p[2]}", "priceCurrency": "EUR"}
            items.append(m)
        secs.append({"@type": "MenuSection", "name": c["title"], "hasMenuItem": items})
    data = {"@context": "https://schema.org", "@type": "Menu", "name": "Speisekarte " + R["name"], "inLanguage": "de",
            "hasMenuSection": secs}
    return '<script type="application/ld+json" id="ld-menu">' + json.dumps(data, ensure_ascii=False) + "</script>"


# ---------------------------------------------------------------- Seitengerüst
NAV = [("index.html", "Start"), ("about.html", "Über uns"), ("menu.html", "Speisekarte"),
       ("gallery.html", "Galerie"), ("contact.html", "Kontakt"), ("reservierung.html", "Reservierung")]


def head(page, title, desc, extra="", index=True, og_image="assets/images/extra/hero1.webp"):
    canon = SITE_URL + "/" + ("" if page == "index.html" else page)
    robots = ('\n  <link rel="canonical" href="' + canon + '">') if index else '\n  <meta name="robots" content="noindex, follow">'
    return f'''<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}">{robots}
  <meta property="og:type" content="website">
  <meta property="og:locale" content="de_DE">
  <meta property="og:site_name" content="{e(R["name"])}">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(desc)}">
  <meta property="og:url" content="{canon}">
  <meta property="og:image" content="{SITE_URL}/{og_image}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#000000">
  <link rel="icon" type="image/png" sizes="48x48" href="assets/images/extra/icon-48.png">
  <link rel="apple-touch-icon" href="assets/images/extra/icon-180.png">
{extra}  <link rel="stylesheet" href="css/style.css">
  <script>document.documentElement.classList.add('js')</script>
  {ld_restaurant()}
</head>
'''


BANNER = '''<div id="cookie-banner" class="cookie-banner" role="dialog" aria-label="Hinweis zur Reichweitenmessung">
  <p>Wir möchten anonym messen, wie unsere Website genutzt wird (cookielos, ohne Profile). Externe Inhalte wie Google Maps
    laden wir nur nach deiner Zustimmung. Mehr in der <a href="datenschutz.html">Datenschutzerklärung</a>.</p>
  <div class="cookie-actions">
    <button id="cookie-accept" type="button">Akzeptieren</button>
    <button id="cookie-decline" type="button">Ablehnen</button>
  </div>
</div>'''


def header(page):
    items = "\n".join(
        f'      <li><a href="{h}"' + (' class="active" aria-current="page"' if h == page else "") + f">{t}</a></li>"
        for h, t in NAV)
    notice = ""
    if g("notice.enabled") is True and g("notice.text"):
        notice = f'\n<div id="site-notice" class="site-notice" role="status">{e(g("notice.text"))}</div>'
    return f'''<a class="skip-link" href="#main">Zum Inhalt springen</a>
{BANNER}
<header class="navbar">
  <a class="logo" href="index.html" aria-label="{e(R["name"])} – Startseite">
    <img src="assets/images/extra/logo1.webp" alt="" width="52" height="50">
    <img src="assets/images/extra/logo2.webp" alt="IZ Uigurisches Restaurant" width="164" height="50">
  </a>
  <button class="hamburger" id="hamburger" type="button" aria-label="Menü" aria-expanded="false" aria-controls="nav-menu">☰</button>
  <nav aria-label="Hauptnavigation">
    <ul class="nav-menu" id="nav-menu">
{items}
    </ul>
  </nav>
</header>{notice}
'''


def footer(scripts=""):
    hours = "".join(f"<dt>{e(a)}</dt><dd>{e(b)}</dd>" for a, b in hours_groups())
    return f'''
<footer class="site-footer">
  <div class="footer-grid">
    <div>
      <h2>Kontakt</h2>
      <p data-address>{e(R["name"])}<br>{e(R["street"])}<br>{e(R["zip"])} {e(R["city"])}</p>
      <p><a href="{e(tel_href())}" data-phone>{e(R["phone"])}</a></p>
      <p><a href="{e(ROUTE_URL)}" target="_blank" rel="noopener noreferrer">Route planen ↗</a></p>
    </div>
    <div>
      <h2>Öffnungszeiten</h2>
      <dl class="footer-hours" id="footer-hours">{hours}</dl>
    </div>
    <div>
      <h2>Folge uns</h2>
      <p><a href="{e(safe_url(g("social.instagram")))}" target="_blank" rel="noopener noreferrer">Instagram</a></p>
      <p><a href="{e(safe_url(g("social.tiktok")))}" target="_blank" rel="noopener noreferrer">TikTok</a></p>
      <p><a href="reservierung.html">Tisch reservieren</a></p>
    </div>
  </div>
  <div class="footer-bottom">
    <nav class="footer-nav" aria-label="Rechtliches">
      <a href="impressum.html">Impressum</a>
      <a href="datenschutz.html">Datenschutzerklärung</a>
      <button type="button" class="linklike" data-open-consent>Cookie-Einstellungen</button>
    </nav>
    <p class="footer-copyright">&copy; {datetime.date.today().year} IZ Mannheim – <a href="https://www.instagram.com/hattat_web" rel="noopener">powered by Hattat Webdesign</a></p>
  </div>
</footer>

<div class="mobile-cta" aria-label="Schnellzugriff">
  <a href="{e(tel_href())}" data-phone-only class="mc-call">{ICON["phone"]}Anrufen</a>
  <a href="reservierung.html" class="mc-res">{ICON["calendar"]}Tisch reservieren</a>
</div>
<script src="js/site.js" defer></script>{scripts}
'''


def page(name, title, desc, body, extra_head="", index=True, scripts=""):
    hd = head(name, title, desc, extra_head, index)
    if '<base href' in extra_head:  # <base> muss vor allen relativen Links stehen
        hd = hd.replace(extra_head, "").replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n  <base href="/">')
    out = hd + "<body>\n" + header(name) + body + footer(scripts) + "</body>\n</html>\n"
    (ROOT / name).write_text(out, encoding="utf8")
    print(f"  {name:20} {len(out.encode()) // 1024} KB")


# ================================================================ Seiten
def build():
    print("Erzeuge Seiten …")

    # ---------------- Startseite
    hero = f'''
<section class="hero-carousel" aria-label="Eindrücke aus dem Restaurant">
  <div class="hero-slide active"><img src="assets/images/extra/hero1-800.webp"
      srcset="assets/images/extra/hero1-800.webp 800w, assets/images/extra/hero1-1100.webp 1100w, assets/images/extra/hero1.webp 1345w" sizes="100vw"
      alt="Sitzecke mit uigurischen Kissen und Teppichen im IZ Restaurant" fetchpriority="high" width="1345" height="734"></div>
  <div class="hero-slide"><img data-src="assets/images/extra/hero2-800.webp"
      data-srcset="assets/images/extra/hero2-800.webp 800w, assets/images/extra/hero2.webp 1358w" sizes="100vw"
      alt="Sitzbereich mit blauen Kissen, Wandbild und Musikinstrumenten" width="1358" height="886"></div>
  <div class="hero-slide"><img data-src="assets/images/extra/gallery4-800.webp"
      data-srcset="assets/images/extra/gallery4-800.webp 800w, assets/images/extra/gallery4.webp 1050w" sizes="100vw"
      alt="Goldener Torbogen mit Blick in den Gastraum" width="1050" height="670"></div>
  <div class="hero-content">
    <h1 data-text="hero.title">{e(g("hero.title"))}</h1>
    <p class="hero-sub" data-text="hero.subtitle">{e(g("hero.subtitle"))}</p>
    <p class="hero-text" data-text="hero.text">{e(g("hero.text"))}</p>
    <div class="hero-buttons">
      <a href="reservierung.html" class="btn-new-res" data-text="hero.buttonReserve">{e(g("hero.buttonReserve"))}</a>
      <a href="menu.html" class="btn-dark" data-text="hero.buttonMenu">{e(g("hero.buttonMenu"))}</a>
    </div>
  </div>
</section>

<div class="infobar" aria-label="Kurzinfos">
  <div><span class="label">Heute</span><span id="today-hours">Öffnungszeiten siehe Kontakt</span></div>
  <div><span class="label">Adresse</span><a href="{e(ROUTE_URL)}" target="_blank" rel="noopener noreferrer"><span data-street>{e(R["street"])}</span>, {e(R["zip"])} {e(R["city"])}</a></div>
  <div><span class="label">Telefon</span><a href="{e(tel_href())}" data-phone>{e(R["phone"])}</a></div>
</div>
'''
    idx = hero + f'''
<main id="main">
  <section class="section container narrow reveal">
    <h2 class="section-title" data-text="intro.title">{e(g("intro.title"))}</h2>
    <p class="lead" data-text="intro.text">{e(g("intro.text"))}</p>
    <div class="btn-row"><a class="btn-outline" href="about.html">Mehr über uns</a></div>
  </section>

  <section class="section container reveal" aria-labelledby="h-highlights">
    <h2 class="section-title" id="h-highlights" data-text="highlights.title">{e(g("highlights.title", "Unsere Empfehlungen"))}</h2>
    <p class="lead" data-text="highlights.text">{e(g("highlights.text"))}</p>
    <div class="dish-grid" id="dish-highlights">{dish_cards()}</div>
    <div class="btn-row"><a class="btn-new-res" href="menu.html">Ganze Speisekarte ansehen</a></div>
  </section>

  <section class="section container reveal">
    <div class="split">
      <div class="panel">
        <h2 data-text="lunch.title">{e(g("lunch.title"))}</h2>
        <a id="lunch-link" href="{e(safe_url(g("lunch.pdf")))}" class="btn-new-res" download data-text="lunch.button">{e(g("lunch.button"))}</a>
      </div>
      <div class="panel">
        <h2 data-text="delivery.title">{e(g("delivery.title"))}</h2>
        <div class="delivery-buttons" id="delivery-buttons">{delivery_buttons()}</div>
      </div>
    </div>
  </section>

  <section class="section container reveal">
    <h2 class="section-title" data-text="video.title">{e(g("video.title"))}</h2>
    <div class="video-wrapper">
      <video muted loop playsinline controls preload="none" data-poster="assets/videos/poster.webp" width="1280" height="720"
        aria-label="Video: Einblicke ins IZ Restaurant Mannheim">
        <source src="assets/videos/video.webm" type='video/webm; codecs="av01.0.05M.08, opus"'>
        <source src="assets/videos/video.mp4" type="video/mp4">
        Dein Browser unterstützt dieses Video nicht.
      </video>
    </div>
  </section>

  <section class="section container reveal">
    <h2 class="section-title" data-text="social.title">{e(g("social.title"))}</h2>
    <div class="social-media" id="social-links">{social_links()}</div>
  </section>
</main>
'''
    page("index.html", "Uigurisches Restaurant Mannheim – IZ | Laghmen, Manta & Polo",
         "IZ Uigurisches Restaurant in Mannheim (G7 15): handgezogene Laghmen-Nudeln, Manta und Polo in traditionellem Ambiente. Tisch reservieren oder bestellen.",
         idx, extra_head='  <link rel="preload" as="image" href="assets/images/extra/hero1-800.webp" imagesrcset="assets/images/extra/hero1-800.webp 800w, assets/images/extra/hero1-1100.webp 1100w, assets/images/extra/hero1.webp 1345w" imagesizes="100vw" fetchpriority="high">\n',
         scripts='\n<script src="js/hero_carousel.js" defer></script>')

    # ---------------- Über uns
    a = site["about"]
    paras = lambda arr: "".join(f"<p>{rich(p)}</p>" for p in (arr or []))
    car = [("assets/images/interior1.webp", "Eingang des IZ Uigurischen Restaurants mit Logo-Schild"),
           ("assets/images/interior2-thumb.webp", "Landkarte Zentralasiens mit eingezeichneter Seidenstraße"),
           ("assets/images/interior3-thumb.webp", "Teller mit Laghmen-Nudeln, Fleisch und Paprika"),
           ("assets/images/extra/gallery3-thumb.webp", "Langer Gastraum mit Holztischen und Deckenbeleuchtung"),
           ("assets/images/interior5-thumb.webp", "Gastraum mit Sitzecke, Steinwand und Lichtdecke")]
    carousel = ('<section class="carousel-about" aria-label="Bilder aus dem Restaurant">'
                '<button class="carousel-btn prev" type="button" aria-label="Vorheriges Bild">&#8249;</button>'
                '<div class="carousel-track-container"><ul class="carousel-track">'
                + "".join(f'<li class="carousel-item"><img src="{s}" alt="{e(t)}" loading="lazy" decoding="async" width="640" height="427"></li>' for s, t in car)
                + '</ul></div><button class="carousel-btn next" type="button" aria-label="Nächstes Bild">&#8250;</button></section>')
    secs = "".join(f'<h2 class="section-title">{e(s["title"])}</h2>{paras(s.get("paragraphs"))}' for s in a.get("sections", []))
    cta = (f'<div class="about-cta panel"><h2>{e(a["cta"]["title"])}</h2><a href="reservierung.html" class="btn-new-res">{e(a["cta"]["button"])}</a></div>'
           if a.get("cta") else "")
    expl = (f'<section class="about-explainer"><h2 class="section-title">{e(a["explainer"]["title"])}</h2>{paras(a["explainer"].get("paragraphs"))}</section>'
            if a.get("explainer") else "")
    about = f'''
<main id="main" class="page container narrow about-page prose">
  <div id="about-dynamic">
    <h1 class="section-title">{e(a["title"])}</h1>
    {paras(a.get("intro"))}
    <div id="about-carousel-slot">{carousel}</div>
    {secs}
    {cta}
    {expl}
  </div>
</main>
'''
    page("about.html", "Über uns – IZ Restaurant Mannheim | Uigurische Küche & Seidenstraße",
         "IZ Restaurant Mannheim: authentische uigurische Küche von der Seidenstraße – handgezogene Laghmen-Nudeln, traditionelle Rezepte, besonderes Ambiente.",
         about, scripts='\n<script src="js/about_carousel.js" defer></script>')

    # ---------------- Speisekarte
    extra = g("menuPage.extra")
    menu_page = f'''
<main id="main" class="page container">
  <h1 class="section-title" data-text="menuPage.title">{e(g("menuPage.title"))}</h1>
  <p class="lead" data-text="menuPage.subtitle">{e(g("menuPage.subtitle"))}</p>
  <p class="menu-intro" data-text="menuPage.text">{e(g("menuPage.text"))}</p>
  <div class="btn-row">
    <a id="menu-pdf-link" href="{e(safe_url(g("menuPage.pdf")))}" class="btn-outline" download data-text="menuPage.pdfLabel">{e(g("menuPage.pdfLabel"))}</a>
    <a id="lunch-pdf-link" href="{e(safe_url(g("menuPage.lunchPdf")))}" class="btn-outline" download data-text="menuPage.lunchLabel">{e(g("menuPage.lunchLabel"))}</a>
  </div>
  <div id="menu" class="menu-root">{menu_html()}</div>
  {f'<p class="menu-extra" data-text="menuPage.extra">{e(extra)}</p>' if extra else ''}
</main>
'''
    page("menu.html", "Speisekarte – IZ Uigurisches Restaurant Mannheim | Laghmen, Manta, Polo",
         "Speisekarte des IZ Restaurants Mannheim: Laghmen, Manta, Polo, Reis- und Spezialgerichte, Vegetarisches und Getränke – mit Preisen und Allergenen.",
         menu_page, extra_head="  " + ld_menu() + "\n")

    # ---------------- Galerie
    gal = [("extra/hero1", "Sitzecke mit Teppichen und Kissen im traditionellen Stil", True),
           ("extra/hero2", "Sitzbereich mit blauen Kissen, Wandbild und Musikinstrumenten", False),
           ("extra/gallery4", "Goldener Torbogen mit Blick in den Gastraum", False),
           ("interior6", "Verschiedene uigurische Gerichte auf einem Tisch, von oben fotografiert", True),
           ("extra/gallery3", "Gastraum mit Holztischen und Deckenbeleuchtung", False),
           ("interior5", "Gastraum mit Sitzecke, Steinwand und Lichtdecke", False),
           ("extra/gallery1", "Großes Wandbild mit Musikern und Gästen", True),
           ("extra/gallery2", "Ecke mit Steinwand, Holztisch und Stühlen", False),
           ("interior3", "Teller mit Laghmen-Nudeln, Fleisch und Paprika", False),
           ("extra/hero3", "Reis mit gebratenem Fleisch und Zwiebeln", False),
           ("interior1", "Eingang mit Logo-Schild des Restaurants", False)]
    full = lambda p: f"assets/images/{p}.webp"
    items = "\n".join(
        f'    <li{" class=\"wide\"" if wide else ""}><img src="assets/images/{p}-thumb.webp" data-full="{full(p)}" alt="{e(alt)}" loading="{"eager" if n < 2 else "lazy"}" decoding="async" width="640" height="480"></li>'
        for n, (p, alt, wide) in enumerate(gal))
    gallery = f'''
<main id="main" class="page container">
  <h1 class="section-title">Galerie</h1>
  <p class="lead">Ein Blick in unser Restaurant und auf unsere Gerichte. Tippe ein Bild an, um es zu vergrößern.</p>
  <ul class="gallery-grid">
{items}
  </ul>
</main>
'''
    page("gallery.html", "Galerie – IZ Restaurant Mannheim | Ambiente & Gerichte",
         "Bilder aus dem IZ Uigurischen Restaurant in Mannheim: traditionelles Ambiente, Sitzecken mit Teppichen und uigurische Spezialitäten.",
         gallery)

    # ---------------- Kontakt
    contact = f'''
<main id="main" class="page container">
  <h1 class="section-title" data-text="contact.title">{e(g("contact.title"))}</h1>
  <p class="lead" data-rich="contact.intro">{rich(g("contact.intro"))}</p>
  <div class="contact-grid">
    <div class="panel">
      <h2>Adresse</h2>
      <p data-address="full">{e(R["name"])}<br>{e(R["street"])}<br>{e(R["zip"])} {e(R["city"])}<br>{e(R["country"])}</p>
      <h2>Telefon</h2>
      <p><a href="{e(tel_href())}" data-phone>{e(R["phone"])}</a></p>
      <div class="btn-row"><a class="btn-outline" href="{e(ROUTE_URL)}" target="_blank" rel="noopener noreferrer">Route planen</a>
        <a class="btn-outline" href="{e(tel_href())}" data-phone-only>Anrufen</a></div>
      <h2>Reservierung</h2>
      <p data-text="contact.reservationText">{e(g("contact.reservationText"))}</p>
      <div class="btn-row"><a href="reservierung.html" class="btn-new-res">Jetzt Tisch reservieren</a></div>
      <h2>Anfahrt</h2>
      <p data-text="contact.directionsText">{e(g("contact.directionsText"))}</p>
    </div>
    <div class="panel">
      <h2>Öffnungszeiten</h2>
      <div class="opening-hours" id="opening-hours">{hours_table()}</div>
    </div>
  </div>

  <section class="map-section">
    <h2 class="section-title">Unser Standort in Mannheim</h2>
    <div class="iframe-consent" data-type="maps" data-title="Karte: {e(R["name"])}" data-height="420">
      <p>Um die Karte anzuzeigen, werden Inhalte von Google geladen. Dabei werden Daten (z. B. deine IP-Adresse) an Google übermittelt.</p>
      <button type="button" data-load-embed>Google Maps laden</button>
      <p class="note"><a href="{e(ROUTE_URL)}" target="_blank" rel="noopener noreferrer">Oder direkt in Google Maps öffnen ↗</a></p>
    </div>
  </section>
</main>
'''
    page("contact.html", "Kontakt & Öffnungszeiten – IZ Restaurant Mannheim | G7 15",
         "Kontakt zum IZ Uigurischen Restaurant Mannheim: Adresse G7 15, 68159 Mannheim, Telefon, Öffnungszeiten und Anfahrt. Jetzt Tisch reservieren.",
         contact)

    # ---------------- Reservierung
    res = f'''
<main id="main" class="reservation-box">
  <h1>Tisch reservieren</h1>
  <div class="iframe-consent" data-type="reservation" data-title="Reservierungsformular {e(R["name"])}" data-height="680">
    <p>Das Reservierungsformular wird von CentralPlanner (42he GmbH, Köln) bereitgestellt. Beim Laden werden Daten an den Anbieter übertragen.</p>
    <button type="button" data-load-embed>Reservierungsformular laden</button>
    <p class="note">Lieber telefonisch? <a href="{e(tel_href())}" data-phone>{e(R["phone"])}</a></p>
  </div>
</main>
'''
    page("reservierung.html", "Tisch reservieren – IZ Uigurisches Restaurant Mannheim",
         "Online einen Tisch im IZ Uigurischen Restaurant in Mannheim reservieren – schnell per Formular oder telefonisch.", res)

    # ---------------- Rechtliches
    for name, title, desc in (("impressum", "Impressum – IZ Uigurisches Restaurant Mannheim", "Impressum des IZ Uigurischen Restaurants Mannheim."),
                              ("datenschutz", "Datenschutzerklärung – IZ Uigurisches Restaurant Mannheim", "Datenschutzerklärung des IZ Uigurischen Restaurants Mannheim.")):
        body = (ROOT / f"content/{name}.html").read_text(encoding="utf8")
        page(f"{name}.html", title, desc, f'\n<main id="main" class="page container legal">\n{body}</main>\n')

    # ---------------- 404 (GitHub Pages liefert sie für jede unbekannte URL aus)
    page("404.html", "Seite nicht gefunden – IZ Uigurisches Restaurant Mannheim", "Diese Seite gibt es nicht.",
         '\n<main id="main" class="page container narrow"><h1 class="section-title">Seite nicht gefunden</h1>'
         '<p class="lead">Die gewünschte Seite gibt es leider nicht (mehr).</p>'
         '<div class="btn-row"><a class="btn-new-res" href="index.html">Zur Startseite</a><a class="btn-outline" href="menu.html">Zur Speisekarte</a></div></main>\n',
         extra_head='  <base href="/">\n', index=False)

    # ---------------- Sitemap
    urls = ["", "about.html", "menu.html", "gallery.html", "contact.html", "reservierung.html", "impressum.html", "datenschutz.html"]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
        f"  <url><loc>{SITE_URL}/{u}</loc><lastmod>{TODAY}</lastmod></url>\n" for u in urls) + "</urlset>\n"
    (ROOT / "sitemap.xml").write_text(sm, encoding="utf8")
    print("  sitemap.xml")


if __name__ == "__main__":
    build()

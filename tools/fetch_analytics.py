#!/usr/bin/env python3
"""Holt Kennzahlen aus GoatCounter und schreibt data/analytics.json.
Benötigt: Umgebungsvariablen GOATCOUNTER_CODE (z. B. "iz-mannheim") und GOATCOUNTER_TOKEN (API-Schlüssel, nur Lesen).
Ohne beide Variablen wird ehrlich "nicht verfügbar" geschrieben – es werden niemals Zahlen erfunden."""
import os, json, datetime, urllib.request, urllib.parse, pathlib, sys
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "analytics.json"
code, token = os.environ.get("GOATCOUNTER_CODE", "").strip(), os.environ.get("GOATCOUNTER_TOKEN", "").strip()
today = datetime.date.today()
start = today - datetime.timedelta(days=30)

def write(d):
    OUT.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf8"); print("geschrieben:", d["status"])

if not code or not token:
    write({"status": "unavailable", "generated": today.isoformat(),
           "reason": "GoatCounter ist noch nicht verbunden (Code bzw. API-Schlüssel fehlen)."}); sys.exit(0)

def api(path, **q):
    url = f"https://{code}.goatcounter.com/api/v0/{path}?" + urllib.parse.urlencode(q)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

try:
    q = dict(start=start.isoformat() + "T00:00:00Z", end=today.isoformat() + "T23:59:59Z")
    total = api("stats/total", **q)
    hits = api("stats/hits", limit=100, **q)
    pages, events = [], []
    for h in hits.get("hits", []):
        row = {"path": h.get("path", ""), "count": h.get("count", 0)}
        (events if h.get("event") else pages).append(row)
    pages.sort(key=lambda x: -x["count"]); events.sort(key=lambda x: -x["count"])
    write({"status": "ok", "generated": today.isoformat(), "from": start.isoformat(), "to": today.isoformat(),
           "source": "GoatCounter (cookielos, nur nach Zustimmung)",
           "total": {"visitors": total.get("total", 0), "pageviews": sum(p["count"] for p in pages)},
           "pages": pages[:15], "events": events[:20]})
except Exception as e:  # nie mit erfundenen Werten füllen
    write({"status": "error", "generated": today.isoformat(), "reason": f"Abruf fehlgeschlagen: {type(e).__name__}"})

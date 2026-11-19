#!/usr/bin/env python3
"""Buduje aplikację ze źródeł w src/.

Wynik:
  dist/dziennik-silowy.html  — wersja do artefaktu w Claude (bez <head>, Claude dokłada szkielet)
  index.html, sw.js, manifest*.webmanifest, ikony (w katalogu głównym) — wersja instalowana, GitHub Pages

Użycie: python3 tools/build.py
"""
import datetime, json, os, shutil, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(ROOT, p), encoding="utf8").read()
wr = lambda p, s: open(os.path.join(ROOT, p), "w", encoding="utf8").write(s)

# numer wersji: kolejny numer commita + data budowania (widoczny w Więcej → O aplikacji)
try:
    n = int(subprocess.check_output(["git", "-C", ROOT, "rev-list", "--count", "HEAD"], text=True).strip()) + 1
except Exception:
    n = 0
VERSION = f"0.{n} ({datetime.date.today().strftime('%d.%m.%Y')})"
body = rd("src/template.html").replace("/*CSS*/", rd("src/style.css")).replace("/*ENGINE*/", rd("src/engine.js")).replace("/*STARTER*/", rd("src/starter.js")).replace("/*APP*/", rd("src/app.js").replace("/*VERSION*/", VERSION))

# 1. artefakt w Claude
os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
wr("dist/dziennik-silowy.html", body)

# 2. wersja instalowana (PWA) w katalogu głównym repozytorium
wr("index.html", rd("src/pwa/head.html") + body + rd("src/pwa/tail.html"))
shutil.copy(os.path.join(ROOT, "src/pwa/sw.js"), os.path.join(ROOT, "sw.js"))
for f in ("icon-192.png", "icon-512.png", "apple-touch-icon.png"):
    shutil.copy(os.path.join(ROOT, "assets", f), os.path.join(ROOT, f))
# Android bierze kolor dolnego paska z manifestu, więc jeden manifest na kolor tła stylu (wspólne "id")
for fname, color in [("manifest.webmanifest", "#eef1f5"), ("manifest-dark.webmanifest", "#0e1116"),
                     ("manifest-pomost.webmanifest", "#0a0a0b"), ("manifest-notes.webmanifest", "#f2f3ee")]:
    with open(os.path.join(ROOT, fname), "w", encoding="utf8") as fh:
        json.dump({
            "id": "./", "name": "Dziennik Siłowy", "short_name": "Dziennik", "lang": "pl",
            "start_url": "./", "scope": "./", "display": "standalone",
            "background_color": color, "theme_color": color,
            "icons": [
                {"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
                {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
            ],
        }, fh, ensure_ascii=False, indent=1)
print("zbudowano: dist/dziennik-silowy.html", len(body), "B; index.html", os.path.getsize(os.path.join(ROOT, "index.html")), "B")

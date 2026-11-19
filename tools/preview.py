#!/usr/bin/env python3
"""Podgląd do testów: wersja artefaktu z danymi z kopii zapasowej w localStorage.

Użycie: python3 tools/preview.py ŚCIEŻKA/DO/kopii.json [wynik.html]
Dane osobiste trzymaj POZA repozytorium (repozytorium jest publiczne).
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = json.load(open(sys.argv[1], encoding="utf8"))
state = {k: src.get(k) for k in ("settings", "exercises", "plans", "blocks")}
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "dist", "preview.html")
body = open(os.path.join(ROOT, "dist", "dziennik-silowy.html"), encoding="utf8").read()
skeleton = ('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<style>body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>')
seed = "<script>try{if(!localStorage.getItem('trening-app-v1'))localStorage.setItem('trening-app-v1', JSON.stringify(%s));}catch(e){}</script>" % json.dumps(state, ensure_ascii=False)
open(out, "w", encoding="utf8").write(skeleton + seed + body + "</body></html>")
print("podgląd:", out)

# Dziennik Siłowy

Dziennik treningu siłowego (trójbój): plany od trenera, RPE, % Training maxa, e1RM, eksport do arkusza.

**Aplikacja:** https://zielinov.github.io/Big-Boy-Note/ — otwórz na telefonie i wybierz „Dodaj do ekranu głównego” / „Zainstaluj aplikację”. Dane zapisują się na urządzeniu; kopię zapasową zrobisz w zakładce Więcej.

## Struktura

- `src/` — źródła: `template.html`, `style.css`, `engine.js` (obliczenia), `app.js` (interfejs), `pwa/` (nagłówek, stopka i service worker wersji instalowanej)
- `assets/` — ikony
- `tools/build.py` — buduje `index.html` i pliki PWA w katalogu głównym oraz `dist/dziennik-silowy.html` (artefakt w Claude)
- `tools/preview.py` — podgląd z danymi z kopii zapasowej (dane trzymaj poza repozytorium)
- `test/engine.test.js` — testy silnika (`node test/engine.test.js`)

Pliki w katalogu głównym (`index.html`, `sw.js`, `manifest*.webmanifest`, ikony) są generowane — nie edytuj ich ręcznie.

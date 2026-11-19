# Dziennik Siłowy — zasady projektu

Właściciel: Paweł (nie programista, pisze po polsku). Odpowiadaj po polsku, prosto, bez żargonu.

## Jak pracować
- Edytuj tylko `src/`, `assets/`, `tools/`, `test/`. Pliki w katalogu głównym generuje `python3 tools/build.py`.
- Po każdej zmianie: `node test/engine.test.js`, `python3 tools/build.py`, sprawdzenie w przeglądarce (Playwright, ekran 390×844), commit, push na `main` (GitHub Pages publikuje sam).
- Repozytorium jest publiczne: nigdy nie commituj danych treningowych użytkownika (kopie JSON trzymaj poza repo).
- Aplikacja to jeden plik HTML bez bibliotek zewnętrznych (vanilla JS), musi działać offline.
- Artefakt w Claude (dane w bazie artefaktu) i wersja na GitHub Pages (dane w localStorage) to ten sam kod; `Store.mode` rozróżnia „cloud” i lokalny.

## Model danych (skrót)
state = {settings, exercises{id:{name,family,comp,max,bw,e1rmManual{value,date,after}}}, plans[{id,name,bases{exId:TM}}], blocks[{id,planId,name,start,weeks[{days[{id,name,date,entries[]}]}]}]}
entry = {id, exId, sets, reps, type: rpe|pct_e1rm|pct_max|pct_top|kg, value, rpe, refEx?, prog{m,step}, note, kgMode?, kgPlan?, skip?, log{kg,reps,rpe,note,at}, sug, basis}

## Decyzje (nie zmieniaj bez pytania)
- RPE obowiązkowe przy zapisie (komunikat, gdy brak).
- Widełki sugestii na RPE: ±1 RPE (gorszy/dobry dzień), w oknie zapisu pasek zakresu i „Dojście do ciężaru” (pusty gryf, równe skoki ok. 20% celu: min. 10 kg, max 25 kg wyciskanie / 40 kg przysiad i martwy, ostatnie ok. 93%; powtórzenia 5 › 3 › 2 › 1) dla pierwszej serii ćwiczenia w dniu.
- Zaokrąglanie sugestii zawsze w dół do kroku (jak QUOTIENT w arkuszu trenera).
- Pojęcia: Rekord = najcięższy single (dowolne RPE); e1RM = średnia z 2 ostatnich wiarygodnych sesji (RPE ≥ 6, ≤ 10 powt.), z wykrywaniem skoków >10%; Training max (TM) = baza do % ustawiana per plan (fallback: TM przy ćwiczeniu).
- „Nie licz do e1RM” (skip) dla słabych dni; ręczny e1RM puszcza po pierwszym wyniku nowszym niż `after`.
- Seria z dowolnym ciężarem i docelowym RPE wyświetla się jako „@ RPE x”.
- Podpowiedź kg z % TM przy seriach na RPE: usunięta (dublowała sugestię z e1RM).
- XLSX: tygodnie poziomo, formuły tylko dla % TM i serii z top seta; sugestia i wynik w jednym polu (formatowanie warunkowe ISFORMULA).
- Plik dla czatu z AI: Markdown, bez gotowego promptu.
- Zapis każdej serii: opcja (settings.perSet, domyślnie wyłączona); log.kg/reps/rpe = ostatnia seria, log.sets = wszystkie serie; e1RM z najlepszej wiarygodnej serii.
- Nazwy ćwiczeń po angielsku, pełnymi słowami.
- W przyszłości: tryb prosty i zaawansowany (nowi użytkownicy: prosty).

Więcej kontekstu: dokumenty w projekcie Claude „Aplikacja treningowa” (kolejka-pomyslow, analiza-konkurencji, materialy-krytyka-i-funkcje).

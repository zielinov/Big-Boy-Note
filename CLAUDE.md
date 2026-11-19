# Dziennik Siłowy — zasady projektu

Właściciel: Paweł (nie programista, pisze po polsku). Odpowiadaj po polsku, prosto, bez żargonu.

## Jak pracować
- Edytuj tylko `src/`, `assets/`, `tools/`, `test/`. Pliki w katalogu głównym generuje `python3 tools/build.py`.
- Po każdej zmianie: `node test/engine.test.js`, `python3 tools/build.py`, sprawdzenie w przeglądarce (Playwright, ekran 390×844), commit, push na `main` (GitHub Pages publikuje sam).
- Repozytorium jest publiczne: nigdy nie commituj danych treningowych użytkownika (kopie JSON trzymaj poza repo).
- Aplikacja to jeden plik HTML bez bibliotek zewnętrznych (vanilla JS), musi działać offline.
- Artefakt w Claude (dane w bazie artefaktu) i wersja na GitHub Pages (dane w localStorage) to ten sam kod; `Store.mode` rozróżnia „cloud” i lokalny.

## Model danych (skrót)
state = {settings, exercises{id:{name,family,muscle,comp,max,bw,e1rmManual{value,date,after}}}, plans[{id,name,bases{exId:TM}}], blocks[{id,planId,name,start,weeks[{days[{id,name,date,entries[]}]}]}]}
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
- Nowa osoba: ekran powitalny (gotowy plan / własny plan / kopia), biblioteka startowa (src/starter.js). Katalog: zaczynający — 5×5 FBW A/B, GZCLP, 5/3/1 dla początkujących (stały ciężar / % TM, bez RPE); trenujący dłużej — 5/3/1 BBB, trójbój na RPE 3 i 4 dni. Ciężary startowe z „ciężaru na 5 powt. z 2 w zapasie”: liniowe 85% (puste = gryf, martwy 40), 5/3/1 TM = 90% szac. 1RM, RPE → ręczny e1RM. Plany liniowe: tylko tydzień 1, kolejne przez „+ tydzień” (progresja z wyników). Bez podziału na płeć.
- Import arkuszy (lista treningów → „+ Z arkusza”, ekran powitalny): XLSX/CSV czytane w przeglądarce (unzip + DecompressionStream). Formaty: eksport z aplikacji (zakładka TM + bloki; odtwarza plan, wyniki, TM; progresje nie są w arkuszu, „@ RPE x” wraca jako typ RPE) i szablon (kolumny Tydzień, Dzień, Ćwiczenie, Serie, Powtórzenia, Intensywność, Notatka; intensywność: „80 kg”, „RPE 8”, „75%”/„75% TM”, „70% e1RM”, „-10%”). Zawsze jako nowy trening. Dowolny inny arkusz: jeszcze nie (wymaga AI).
- Widok prosty / zaawansowany: settings.ui ("simple"/"advanced"), funkcja adv(); nowe osoby bez danych: prosty, z danymi: zaawansowany. Prosty chowa: typy % (zostaje RPE i kg), progresje, TM, ręczny e1RM, źródło ciężaru, kartę Obliczenia i Eksport. Istniejące serie % dalej działają. Nowe funkcje: zawsze decyduj, w którym widoku są.
- Konta i synchronizacja (tylko GitHub Pages, oba widoki): Supabase, projekt hzeyvcnbxsrrxcvbsmlb, klucz publiczny w src/app.js. Tabela user_state (user_id, data jsonb, updated_at) z RLS „tylko własne”. Logowanie kodem/linkiem z maila (bez hasła). Cały stan jako jeden JSON; zapis warunkowy po updated_at, przy rozbieżności pytanie „Które dane zostawić?”. Bez konta działa jak wcześniej (localStorage). Service worker nie cache’uje supabase.co.
- Biblioteka ćwiczeń: src/starter.js (LIB, ok. 200 pozycji z uporządkowanej biblioteki Pawła), każde ćwiczenie ma partię mięśniową (muscle: chest, back, shoulders, biceps, triceps, forearms, quads, hamstrings, glutes, hips, calves, core, full, other). Zmiana listy = podbij Starter.VERSION; syncLibrary() dopisuje brakujące pozycje (po id i nazwie) i uzupełnia partie, nie zmienia istniejących nazw. Ćwiczenia: grupowanie według bojów lub partii; wybór ćwiczenia: „W Twoich planach”, potem partie. Ćwiczenia od użytkowników trafiają do biblioteki tylko po akceptacji Pawła. Filmy (YouTube) i opisy ćwiczeń: nie w aplikacji, tylko od trenera w przyszłym panelu trenera (zawodnicy widzą je u siebie).

Więcej kontekstu: dokumenty w projekcie Claude „Aplikacja treningowa” (kolejka-pomyslow, analiza-konkurencji, materialy-krytyka-i-funkcje).

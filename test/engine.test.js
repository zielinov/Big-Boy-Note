// Testy silnika obliczeń. Uruchom: node test/engine.test.js
const E = require("../src/engine.js");
let fail = 0;
const ok = (cond, name) => { if (!cond) { fail++; console.log("FAIL", name); } };
const near = (a, b, eps = 0.05) => Math.abs(a - b) <= eps;

// --- tabela RPE i zaokrąglanie w dół
ok(E.rpePct(1, 10) === 1, "1@10 = 100%");
ok(near(E.rpePct(4, 5), 0.762, 0.002), "4@5 ≈ 76,2%");
ok(E.roundTo(79.8, 2.5) === 77.5, "zaokrąglenie w dół 79,8 -> 77,5");
ok(E.roundTo(77.5, 2.5) === 77.5, "dokładna wielokrotność zostaje");
ok(E.roundTo(140 * 0.55, 2.5) === 75, "77 -> 75");
ok(E.roundTo((0.1 * 3 * 100) / 3, 2.5) === 10, "ochrona przed błędem zmiennoprzecinkowym");

// --- Training max: plan, potem ćwiczenie
{
  const st = { settings: {}, exercises: { a: { id: "a", max: 100 }, b: { id: "b", max: 200 } }, plans: [{ id: "p", bases: { a: 140 } }], blocks: [] };
  ok(E.baseTm(st, "p", "a") === 140, "TM z planu");
  ok(E.baseTm(st, "p", "b") === 200, "TM z ćwiczenia, gdy plan go nie ma");
  ok(E.baseTm(st, "zz", "a") === 100, "TM bez planu");
  const mk = (e) => E.suggest(st, { b: { planId: "p" }, wi: 0, d: { entries: [], date: "2026-01-01" }, di: 0, e: { id: "e1", exId: "b", sets: "1", reps: "3", ...e } });
  ok(mk({ type: "pct_max", value: 57, refEx: "a" }).kg === 77.5, "% TM od innego ćwiczenia");
  ok(mk({ type: "pct_max", value: 50 }).kg === 100, "% TM własnego ćwiczenia");
  ok(mk({ type: "kg", value: 60 }).kg === 60, "stały ciężar");
  ok(mk({ kgMode: "manual", kgPlan: 42.5, type: "rpe", value: 8 }).kg === 42.5, "ciężar wpisany ręcznie");
}

// --- historia do e1RM
const entry = (id, date, kg, reps, rpe, extra = {}) => ({ id: "d" + id, date, entries: [{ id: "s" + id, exId: "q", sets: "1", reps: String(reps), type: "rpe", value: 7, ...extra, log: { kg, reps, rpe, at: date } }] });
const stateOf = (days, ex = {}) => ({ settings: {}, plans: [], exercises: { q: { id: "q", ...ex } }, blocks: [{ id: "bb", planId: null, weeks: [{ days }] }] });

// e1RM: średnia z 2 ostatnich sesji
{
  const st = stateOf([entry(1, "2026-09-21", 125, 2, 7.5), entry(2, "2026-10-12", 125, 2, 7.5)]);
  const a = E.analyze(st, "q");
  ok(a.sessions.length === 2 && near(a.current.value, a.sessions[1].value), "e1RM z dwóch równych sesji");
}
// „poza e1RM” (słaby dzień) nie wchodzi do bieżącego e1RM
{
  const st = stateOf([entry(1, "2026-09-21", 125, 2, 7.5), entry(2, "2026-10-05", 107.5, 2, 6, { skip: true }), entry(3, "2026-10-12", 125, 2, 7.5)]);
  const a = E.analyze(st, "q");
  ok(a.sessions[1].skipped && !a.current.from.includes("bb/0/1"), "pominięta sesja poza e1RM");
  ok(near(a.current.value, a.sessions[2].value), "średnia bez pominiętej sesji");
}
// ręczny e1RM obowiązuje do pierwszego nowszego wyniku (porównanie z "after", nie z datą wpisania)
{
  const st = stateOf([entry(1, "2026-10-05", 120, 2, 7), entry(2, "2026-10-12", 125, 2, 7.5)], { e1rmManual: { value: 140, date: "2026-10-20", after: "2026-10-05" } });
  ok(!E.currentE1rm(st, "q").manual, "ręczny e1RM puszcza po nowszym wyniku");
  st.blocks[0].weeks[0].days.pop();
  const c = E.currentE1rm(st, "q");
  ok(c.manual && c.value === 140, "ręczny e1RM trzyma bez nowszego wyniku");
}
// % z top seta liczy się od zrobionego top seta
{
  const st = { settings: {}, plans: [], exercises: { q: { id: "q" } }, blocks: [] };
  const top = { id: "t", exId: "q", sets: "1", reps: "4", type: "rpe", value: 8, log: { kg: 120, reps: 4, rpe: 8, at: "2026-10-01" } };
  const back = { id: "k", exId: "q", sets: "2", reps: "4", type: "pct_top", value: 10 };
  const d = { date: "2026-10-01", entries: [top, back] };
  ok(E.suggest(st, { b: null, wi: 0, d, di: 0, e: back }).kg === 107.5, "−10% z top seta 120 -> 107,5");
}

// --- progresja tydzień do tygodnia
const rs = { exId: "x", sets: "1", reps: "3", type: "rpe", value: 6, prog: { m: "rpe_step", step: 0.5 } };
ok(E.progressEntry(rs).entry.value === 6.5, "RPE +0,5");
ok(E.progressEntry({ ...rs, value: 10 }).entry.value === 10, "RPE nie przekracza 10");
const lin = { exId: "x", sets: "3", reps: "5", type: "kg", value: 100, prog: { m: "linear", step: 2.5 } };
ok(E.progressEntry({ ...lin, log: { kg: 100, reps: 5, rpe: 8 } }).entry.value === 102.5, "liniowa: wykonane -> +2,5");
ok(E.progressEntry({ ...lin, log: { kg: 100, reps: 4, rpe: 9 } }).entry.value === 100, "liniowa: niewykonane -> bez zmian");
ok(E.progressEntry({ ...lin, type: "pct_e1rm", value: 70, prog: { m: "pct_step", step: 2.5 } }).entry.value === 72.5, "procent +2,5");
ok(E.parseReps("6.2").kind === "list", "6.2 to lista powtórzeń");

// widełki sugestii na RPE: ±1 RPE
{
  const st = { settings: {}, plans: [], exercises: { q: { id: "q", e1rmManual: { value: 150, date: "2026-01-01" } } }, blocks: [] };
  const x = E.suggest(st, { b: null, wi: 0, d: { date: "2026-02-01", entries: [] }, di: 0, e: { id: "z", exId: "q", sets: "1", reps: "2", type: "rpe", value: 8 } });
  ok(x.lo === E.roundTo(150 * E.rpePct(2, 7), 2.5) && x.hi === E.roundTo(150 * E.rpePct(2, 9), 2.5), "widełki = RPE 7 i RPE 9");
  ok(x.hi - x.lo >= 7.5, "widełki co najmniej 7,5 kg przy 150 kg e1RM");
}

// --- kalkulator talerzy
ok(JSON.stringify(E.plates(142.5)) === JSON.stringify([25, 25, 10, 1.25]), "talerze 142,5 kg");

console.log(fail ? `\n${fail} FAILED` : "\nall checks passed");
process.exit(fail ? 1 : 0);

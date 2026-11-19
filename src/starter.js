/* Start dla nowej osoby: biblioteka ćwiczeń i plany startowe (RPE, więc ciężary same dopasowują się do wyników). */
const Starter = (() => {
  // [id, nazwa, rodzina, bój startowy, masa ciała]
  const LIB = [
    ["competition-squat", "Competition Squat", "squat", 1, 0],
    ["competition-bench-press", "Competition Bench Press", "bench", 1, 0],
    ["competition-deadlift", "Competition Deadlift", "deadlift", 1, 0],
    ["paused-squat", "Paused Squat", "squat", 0, 0],
    ["highbar-squat", "High-Bar Squat", "squat", 0, 0],
    ["front-squat", "Front Squat", "other", 0, 0],
    ["2ct-paused-bench-press", "Paused Bench Press (2 s)", "bench", 0, 0],
    ["close-grip-bench-press", "Close-Grip Bench Press", "bench", 0, 0],
    ["incline-bench-press", "Incline Barbell Bench Press", "other", 0, 0],
    ["overhead-press", "Overhead Press", "other", 0, 0],
    ["dumbbell-shoulder-press", "Dumbbell Shoulder Press", "other", 0, 0],
    ["rdl-deadlift", "Romanian Deadlift", "deadlift", 0, 0],
    ["paused-deadlift", "Paused Deadlift", "deadlift", 0, 0],
    ["deficit-deadlift", "Deficit Deadlift", "deadlift", 0, 0],
    ["leg-press", "Leg Press", "other", 0, 0],
    ["goblet-squat", "Goblet Squat", "other", 0, 0],
    ["front-foot-elevated-split-squat", "Front-Foot Elevated Split Squat", "other", 0, 0],
    ["walking-lunge", "Walking Lunge", "other", 0, 0],
    ["leg-curl-machine", "Leg Curl (Machine)", "other", 0, 0],
    ["back-extension", "Back Extension", "other", 0, 0],
    ["hip-thrust", "Barbell Hip Thrust", "other", 0, 0],
    ["lat-pulldown", "Lat Pulldown", "other", 0, 0],
    ["pull-up", "Pull-Up", "other", 0, 1],
    ["barbell-row", "Barbell Row", "other", 0, 0],
    ["seated-cable-row", "Seated Cable Row", "other", 0, 0],
    ["chest-supported-row", "Chest-Supported Dumbbell Row", "other", 0, 0],
    ["dumbbell-row", "One-Arm Dumbbell Row", "other", 0, 0],
    ["dumbbell-lateral-raise", "Dumbbell Lateral Raise", "other", 0, 0],
    ["face-pull", "Face Pull (Cable)", "other", 0, 0],
    ["triceps-pushdown", "Triceps Pushdown (Cable)", "other", 0, 0],
    ["dips", "Dips", "other", 0, 1],
    ["dumbbell-curl", "Dumbbell Biceps Curl", "other", 0, 0],
    ["plank", "Plank", "other", 0, 1],
    ["ab-wheel-rollout", "Ab Wheel Rollout", "other", 0, 1],
    ["hanging-leg-raise", "Hanging Leg Raise", "other", 0, 1],
  ];
  function library() {
    const out = {};
    for (const [id, name, family, comp, bw] of LIB) out[id] = { id, name, family, comp: !!comp, max: null, bw: !!bw, prog: { m: "none", step: 0 }, used: false };
    return out;
  }
  // Wpis planu: T = top set na RPE z progresją +0,5/tydz., B = serie zejściowe −x% z top seta,
  // R = seria na RPE bez progresji, A = akcesorium (ciężar dobierasz, docelowe RPE)
  const T = (ex, sets, reps, rpe) => ({ exId: ex, sets: String(sets), reps: String(reps), type: "rpe", value: rpe, rpe: null, prog: { m: "rpe_step", step: 0.5 }, note: null, top: true });
  const B = (ex, sets, reps, pct) => ({ exId: ex, sets: String(sets), reps: String(reps), type: "pct_top", value: pct, rpe: null, prog: { m: "none", step: 0 }, note: null, back: true });
  const R = (ex, sets, reps, rpe, prog) => ({ exId: ex, sets: String(sets), reps: String(reps), type: "rpe", value: rpe, rpe: null, prog: prog ? { m: "rpe_step", step: 0.5 } : { m: "none", step: 0 }, note: null });
  const A = (ex, sets, reps, rpe, note) => ({ exId: ex, sets: String(sets), reps: String(reps), type: "kg", value: null, rpe: String(rpe), prog: { m: "none", step: 0 }, note: note || null, acc: true });

  // Ciężary na start liczone z „ciężaru na 5 powtórzeń z 2 w zapasie” (ok. 81% 1RM). Bez niego: pusty gryf / typowe minimum.
  const SQ = "competition-squat", BP = "competition-bench-press", DL = "competition-deadlift", OHP = "overhead-press", ROW = "barbell-row";
  const DEF = { [SQ]: 20, [BP]: 20, [OHP]: 20, [ROW]: 30, [DL]: 40 };
  // L = stały ciężar z progresją liniową (+krok co tydzień, gdy zrobisz wszystkie powtórzenia); f = ułamek ciężaru na 5
  const L = (ex, sets, reps, step, f, note) => ({ exId: ex, sets: String(sets), reps: String(reps), type: "kg", value: null, rpe: null, prog: { m: "linear", step }, note: note || null, f });

  const PROGRAMS = [
    { id: "fbw5x5", level: "beg", kind: "linear", name: "5×5 FBW A/B", days: 3, lifts: [SQ, BP, DL, OHP, ROW],
      desc: "Pełne ciało 3 razy w tygodniu, treningi A i B na zmianę (układ znany ze StrongLifts 5×5). Stały ciężar, który rośnie co tydzień, gdy zrobisz wszystkie powtórzenia.",
      plan: [
        ["Trening A", [L(SQ, 5, 5, 5, 0.85), L(BP, 5, 5, 2.5, 0.85), L(ROW, 5, 5, 2.5, 0.85)]],
        ["Trening B", [L(SQ, 5, 5, 5, 0.85), L(OHP, 5, 5, 2.5, 0.85), L(DL, 1, 5, 5, 0.85)]],
        ["Trening A", [L(SQ, 5, 5, 5, 0.85), L(BP, 5, 5, 2.5, 0.85), L(ROW, 5, 5, 2.5, 0.85)]],
      ] },
    { id: "gzclp", level: "beg", kind: "linear", name: "GZCLP · 4 dni", days: 4, lifts: [SQ, BP, DL, OHP],
      desc: "Metoda Cody'ego Lefevera: każdego dnia jeden bój ciężko (T1, 5×3), drugi średnio (T2, 3×10) i lekkie ćwiczenie (T3, 3×15). Progresja liniowa.",
      plan: [
        ["Dzień 1", [L(SQ, 5, 3, 5, 1, "T1 · ostatnia seria: ile się da"), L(BP, 3, 10, 2.5, 0.75, "T2"), A("lat-pulldown", 3, 15, 8, "T3")]],
        ["Dzień 2", [L(OHP, 5, 3, 2.5, 1, "T1 · ostatnia seria: ile się da"), L(DL, 3, 10, 5, 0.7, "T2"), A("dumbbell-row", 3, 15, 8, "T3")]],
        ["Dzień 3", [L(BP, 5, 3, 2.5, 1, "T1 · ostatnia seria: ile się da"), L(SQ, 3, 10, 5, 0.75, "T2"), A("lat-pulldown", 3, 15, 8, "T3")]],
        ["Dzień 4", [L(DL, 5, 3, 5, 1, "T1 · ostatnia seria: ile się da"), L(OHP, 3, 10, 2.5, 0.75, "T2"), A("dumbbell-row", 3, 15, 8, "T3")]],
      ] },
    { id: "531beg", level: "beg", kind: "531", name: "5/3/1 dla początkujących", days: 3, lifts: [SQ, BP, DL, OHP], fsl: true,
      desc: "Program Jima Wendlera: 3 dni, dwa boje dziennie, ciężary w procentach Training maxa, cykl 4 tygodni (ostatni lżejszy). Po seriach głównych 5×5 lżej.",
      mains: [[SQ, BP], [DL, OHP], [BP, SQ]],
      assist: [[A("dips", 3, 10, 8), A("lat-pulldown", 3, 10, 8), A("ab-wheel-rollout", 3, "MAX", 8)],
               [A("pull-up", 3, "MAX", 8), A("dumbbell-row", 3, 10, 8), A("walking-lunge", 3, 10, 8)],
               [A("dips", 3, 10, 8), A("seated-cable-row", 3, 10, 8), A("hanging-leg-raise", 3, "MAX", 8)]] },
    { id: "531bbb", level: "mid", kind: "531", name: "5/3/1 Boring But Big", days: 4, lifts: [OHP, DL, BP, SQ], bbb: true,
      desc: "Program Jima Wendlera: 4 dni, jeden bój dziennie w procentach Training maxa, potem 5×10 na 50% TM tego samego boju. Dużo objętości na siłę i masę.",
      mains: [[OHP], [DL], [BP], [SQ]],
      assist: [[A("lat-pulldown", 5, 10, 8)], [A("hanging-leg-raise", 5, 10, 8)], [A("dumbbell-row", 5, 10, 8)], [A("ab-wheel-rollout", 5, "MAX", 8)]] },
    { id: "rpe3", level: "mid", kind: "rpe", name: "Trójbój na RPE · 3 dni", days: 3, lifts: [SQ, BP, DL],
      desc: "Top set i serie zejściowe (−10%), dni ciężkie i lżejsze. Ciężar dobiera aplikacja z Twoich wyników (RPE). Blok 4 tygodni, ostatni lżejszy.",
      plan: [
        ["Dzień 1 · ciężki przysiad", [T(SQ, 1, 4, 7.5), B(SQ, 2, 4, 10), T(BP, 1, 5, 7), B(BP, 3, 5, 10), R("rdl-deadlift", 3, 6, 7), A("lat-pulldown", 3, 10, 8), A("ab-wheel-rollout", 3, "MAX", 8)]],
        ["Dzień 2 · ciężki martwy", [T(DL, 1, 3, 7.5), B(DL, 2, 3, 10), T("2ct-paused-bench-press", 1, 3, 7.5), B("2ct-paused-bench-press", 3, 3, 10), R("paused-squat", 3, 4, 6), A("seated-cable-row", 3, 10, 8), A("back-extension", 2, 12, 8)]],
        ["Dzień 3 · lekki", [R("highbar-squat", 3, 6, 6), R("close-grip-bench-press", 4, 6, 7, true), A("front-foot-elevated-split-squat", 3, 8, 8), A("chest-supported-row", 3, 10, 8), A("dumbbell-lateral-raise", 2, 15, 8)]],
      ] },
    { id: "rpe4", level: "mid", kind: "rpe", name: "Trójbój na RPE · 4 dni", days: 4, lifts: [SQ, BP, DL],
      desc: "Jak wyżej, ale każdy bój ma swój dzień, a wyciskanie dwa. Ciężar dobiera aplikacja z RPE. Blok 4 tygodni, ostatni lżejszy.",
      plan: [
        ["Dzień 1 · przysiad", [T(SQ, 1, 3, 7.5), B(SQ, 3, 3, 10), R("rdl-deadlift", 3, 6, 7), A("leg-curl-machine", 3, 10, 8), A("ab-wheel-rollout", 3, "MAX", 8)]],
        ["Dzień 2 · wyciskanie", [T(BP, 1, 3, 7.5), B(BP, 3, 3, 10), A("chest-supported-row", 3, 8, 8), R(OHP, 3, 6, 7), A("triceps-pushdown", 2, 12, 8)]],
        ["Dzień 3 · martwy", [T(DL, 1, 3, 7.5), B(DL, 2, 3, 10), R("paused-squat", 3, 4, 6), A("front-foot-elevated-split-squat", 3, 8, 8), A("back-extension", 2, 12, 8)]],
        ["Dzień 4 · wyciskanie objętość", [T("2ct-paused-bench-press", 1, 4, 7), B("2ct-paused-bench-press", 3, 4, 10), R("close-grip-bench-press", 3, 6, 7), A("lat-pulldown", 3, 10, 8), A("dumbbell-lateral-raise", 2, 15, 8), A("dumbbell-curl", 2, 12, 8)]],
      ] },
  ];

  // 5/3/1: procenty TM i powtórzenia w tygodniach 1–4 (tydzień 4 = deload)
  const W531 = [[65, 75, 85], [70, 80, 90], [75, 85, 95], [40, 50, 60]];
  const R531 = [[5, 5, 5], [3, 3, 3], [5, 3, 1], [5, 5, 5]];
  const strip = (x) => { const { top, back, acc, f, ...e } = x; return JSON.parse(JSON.stringify(e)); };

  /** Buduje dni planu. w5: {exId: ciężar na 5 z 2 w zapasie}. roundTo, rpePct z silnika.
   *  Zwraca {weeks: [[{name, entries}]], bases: {exId: TM}, e1rm: {exId: kg}, rpeBlock: bool}. */
  function build(prog, w5, roundTo, rpePct) {
    const out = { weeks: [], bases: {}, e1rm: {}, rpeBlock: false };
    if (prog.kind === "linear") {
      out.weeks.push(prog.plan.map(([name, ents]) => ({ name, entries: ents.map((x) => {
        const e = strip(x);
        if (x.f) e.value = w5[x.exId] > 0 ? Math.max(20, roundTo(w5[x.exId] * x.f, 2.5)) : (x.f < 1 ? 20 : DEF[x.exId] || 20);
        if (x.f && x.f < 1 && !(w5[x.exId] > 0)) e.value = x.exId === DL ? 40 : 20;
        return e;
      }) })));
    } else if (prog.kind === "531") {
      for (const ex of prog.lifts) if (w5[ex] > 0) out.bases[ex] = roundTo((w5[ex] / 0.811) * 0.9, 2.5); // TM = 90% szacowanego 1RM
      for (let w = 0; w < 4; w++) {
        out.weeks.push(prog.mains.map((lifts, di) => {
          const entries = [];
          for (const ex of lifts) {
            W531[w].forEach((pct, i) => entries.push({ exId: ex, sets: "1", reps: String(R531[w][i]), type: "pct_max", value: pct, rpe: null, prog: { m: "none", step: 0 }, note: i === 2 && w < 3 ? "ostatnia seria: ile się da (min. " + R531[w][i] + ")" : null }));
            if (w < 3 && prog.fsl) entries.push({ exId: ex, sets: "5", reps: "5", type: "pct_max", value: W531[w][0], rpe: null, prog: { m: "none", step: 0 }, note: "FSL: jak pierwsza seria" });
            if (w < 3 && prog.bbb) entries.push({ exId: ex, sets: "5", reps: "10", type: "pct_max", value: 50, rpe: null, prog: { m: "none", step: 0 }, note: "BBB: 5×10 na 50% TM" });
          }
          for (const a of prog.assist[di] || []) entries.push(strip(a));
          return { name: `Dzień ${di + 1}` + (w === 3 ? " · lżej" : ""), entries };
        }));
      }
    } else {
      out.rpeBlock = true;
      for (const ex of prog.lifts) if (w5[ex] > 0) out.e1rm[ex] = Math.round((w5[ex] / rpePct(5, 8)) * 10) / 10;
      out.weeks.push(prog.plan.map(([name, ents]) => ({ name, entries: ents.map(strip) })));
    }
    return out;
  }
  return { library, PROGRAMS, build };
})();

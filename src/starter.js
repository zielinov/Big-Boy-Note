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

  // Plany: tydzień ciężki / średni / lekki, topset + backoffy, akcesoria 2–3 serie (materiały Podsztanga).
  const PLANS = {
    "beg-3": { name: "Start · początkujący · 3 dni", days: [
      ["Dzień 1", [R("competition-squat", 3, 5, 7, true), R("competition-bench-press", 3, 5, 7, true), R("rdl-deadlift", 3, 8, 7), A("lat-pulldown", 3, 10, 8), A("plank", 3, "MAX", 8, "trzymaj do załamania techniki")]],
      ["Dzień 2", [R("competition-deadlift", 3, 5, 7, true), R("overhead-press", 3, 6, 7, true), A("goblet-squat", 3, 10, 8), A("seated-cable-row", 3, 10, 8), A("back-extension", 2, 12, 8)]],
      ["Dzień 3", [R("paused-squat", 3, 4, 6), R("close-grip-bench-press", 3, 6, 7, true), A("dumbbell-row", 3, 10, 8), A("dumbbell-lateral-raise", 2, 12, 8), A("ab-wheel-rollout", 3, "MAX", 8)]],
    ] },
    "beg-4": { name: "Start · początkujący · 4 dni", days: [
      ["Dzień 1 · dół", [R("competition-squat", 3, 5, 7, true), R("rdl-deadlift", 3, 8, 7), A("leg-press", 3, 10, 8), A("plank", 3, "MAX", 8)]],
      ["Dzień 2 · góra", [R("competition-bench-press", 3, 5, 7, true), A("chest-supported-row", 3, 10, 8), R("overhead-press", 3, 8, 7), A("lat-pulldown", 3, 10, 8), A("triceps-pushdown", 2, 12, 8)]],
      ["Dzień 3 · dół", [R("competition-deadlift", 3, 5, 7, true), R("paused-squat", 3, 4, 6), A("walking-lunge", 3, 10, 8), A("hanging-leg-raise", 3, "MAX", 8)]],
      ["Dzień 4 · góra", [R("close-grip-bench-press", 3, 6, 7, true), A("pull-up", 3, "MAX", 8), A("dumbbell-shoulder-press", 3, 10, 8), A("seated-cable-row", 3, 10, 8), A("dumbbell-curl", 2, 12, 8)]],
    ] },
    "mid-3": { name: "Start · średniozaawansowany · 3 dni", days: [
      ["Dzień 1 · ciężki przysiad", [T("competition-squat", 1, 4, 7.5), B("competition-squat", 2, 4, 10), T("competition-bench-press", 1, 5, 7), B("competition-bench-press", 3, 5, 10), R("rdl-deadlift", 3, 6, 7), A("lat-pulldown", 3, 10, 8), A("ab-wheel-rollout", 3, "MAX", 8)]],
      ["Dzień 2 · ciężki martwy", [T("competition-deadlift", 1, 3, 7.5), B("competition-deadlift", 2, 3, 10), T("2ct-paused-bench-press", 1, 3, 7.5), B("2ct-paused-bench-press", 3, 3, 10), R("paused-squat", 3, 4, 6), A("seated-cable-row", 3, 10, 8), A("back-extension", 2, 12, 8)]],
      ["Dzień 3 · lekki", [R("highbar-squat", 3, 6, 6), R("close-grip-bench-press", 4, 6, 7, true), A("front-foot-elevated-split-squat", 3, 8, 8), A("chest-supported-row", 3, 10, 8), A("dumbbell-lateral-raise", 2, 15, 8)]],
    ] },
    "mid-4": { name: "Start · średniozaawansowany · 4 dni", days: [
      ["Dzień 1 · przysiad", [T("competition-squat", 1, 3, 7.5), B("competition-squat", 3, 3, 10), R("rdl-deadlift", 3, 6, 7), A("leg-curl-machine", 3, 10, 8), A("ab-wheel-rollout", 3, "MAX", 8)]],
      ["Dzień 2 · wyciskanie", [T("competition-bench-press", 1, 3, 7.5), B("competition-bench-press", 3, 3, 10), A("chest-supported-row", 3, 8, 8), R("overhead-press", 3, 6, 7), A("triceps-pushdown", 2, 12, 8)]],
      ["Dzień 3 · martwy", [T("competition-deadlift", 1, 3, 7.5), B("competition-deadlift", 2, 3, 10), R("paused-squat", 3, 4, 6), A("front-foot-elevated-split-squat", 3, 8, 8), A("back-extension", 2, 12, 8)]],
      ["Dzień 4 · wyciskanie objętość", [T("2ct-paused-bench-press", 1, 4, 7), B("2ct-paused-bench-press", 3, 4, 10), R("close-grip-bench-press", 3, 6, 7), A("lat-pulldown", 3, 10, 8), A("dumbbell-lateral-raise", 2, 15, 8), A("dumbbell-curl", 2, 12, 8)]],
    ] },
  };
  return { library, PLANS };
})();

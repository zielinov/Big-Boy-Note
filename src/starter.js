/* Start dla nowej osoby: biblioteka ćwiczeń i plany startowe (RPE, więc ciężary same dopasowują się do wyników). */
const Starter = (() => {
  // Biblioteka ćwiczeń (z uporządkowanej biblioteki Pawła, 19.10.2026). Zwiększ VERSION po każdej zmianie listy:
  // aplikacja dopisze wtedy nowe pozycje dotychczasowym użytkownikom (niczego nie nadpisuje).
  const VERSION = 2;
  const MUSCLES = { chest: "Klatka", back: "Plecy", shoulders: "Barki", biceps: "Biceps", triceps: "Triceps", forearms: "Przedramiona", quads: "Uda — przód", hamstrings: "Uda — tył", glutes: "Pośladki", hips: "Biodra i przywodziciele", calves: "Łydki", core: "Brzuch i core", full: "Całe ciało", other: "Inne" };
  // [id, nazwa, rodzina, partia, bój startowy, masa ciała]
  const LIB = [
    ["competition-bench-press", "Competition Bench Press", "bench", "chest", 1, 0],
    ["banded-comp-bench-press", "Banded Bench Press", "bench", "chest", 0, 0],
    ["board-press", "Board Press", "bench", "chest", 0, 0],
    ["close-grip-bench-press", "Close-Grip Bench Press", "bench", "chest", 0, 0],
    ["dead-bench-press", "Dead-Stop Bench Press", "bench", "chest", 0, 0],
    ["hooklying-bench-comp-grip", "Feet-Up Bench Press", "bench", "chest", 0, 0],
    ["floor-press", "Floor Press", "bench", "chest", 0, 0],
    ["larsen-bench-press-comp-grip", "Larsen Press", "bench", "chest", 0, 0],
    ["med-grip-bench-press", "Medium-Grip Bench Press", "bench", "chest", 0, 0],
    ["2ct-paused-bench-press", "Paused Bench Press (2 s)", "bench", "chest", 0, 0],
    ["3ct-paused-bench-press", "Paused Bench Press (3 s)", "bench", "chest", 0, 0],
    ["pin-bench-press", "Pin Press", "bench", "chest", 0, 0],
    ["t-shirt-bench-press", "Shirted Bench Press", "bench", "chest", 0, 0],
    ["spoto-bench-press", "Spoto Press", "bench", "chest", 0, 0],
    ["max-width-bench-press", "Wide-Grip Bench Press", "bench", "chest", 0, 0],
    ["banded-db-bp", "Banded Bench Press (Dumbbell)", "other", "chest", 0, 0],
    ["flat-db-bench", "Bench Press (Dumbbell)", "other", "chest", 0, 0],
    ["cable-pec-fly", "Chest Fly (Cable)", "other", "chest", 0, 0],
    ["db-pec-fly", "Chest Fly (Dumbbell)", "other", "chest", 0, 0],
    ["machine-chest-press", "Chest Press (Machine)", "other", "chest", 0, 0],
    ["close-grip-incline-barbell-bench-press", "Close-Grip Incline Bench Press", "other", "chest", 0, 0],
    ["decline-bench-press", "Decline Bench Press", "other", "chest", 0, 0],
    ["dips", "Dips", "other", "chest", 0, 1],
    ["hooklying-bench-close-r-grip", "Feet-Up Bench Press (Close Grip)", "other", "chest", 0, 0],
    ["incline-barbell-bench-press-30", "Incline Bench Press (30°)", "other", "chest", 0, 0],
    ["incline-barbell-bench-press-45", "Incline Bench Press (45°)", "other", "chest", 0, 0],
    ["incline-db-bench", "Incline Bench Press (Dumbbell)", "other", "chest", 0, 0],
    ["cable-incline-bp", "Incline Chest Press (Cable)", "other", "chest", 0, 0],
    ["larsen-press-close-r-grip", "Larsen Press (Close Grip)", "other", "chest", 0, 0],
    ["larsen-bench-spoto-press", "Larsen Spoto Press", "other", "chest", 0, 0],
    ["db-neutral-db", "Neutral-Grip Bench Press (Dumbbell)", "other", "chest", 0, 0],
    ["pec-dec", "Pec Deck (Machine)", "other", "chest", 0, 0],
    ["poliquin-flies-db-flat", "Poliquin Fly (Dumbbell)", "other", "chest", 0, 0],
    ["push-up", "Push-Up", "other", "chest", 0, 1],
    ["seesaw-dumbbell-bp", "Seesaw Bench Press (Dumbbell)", "other", "chest", 0, 0],
    ["tempo-bench", "Tempo Bench Press", "other", "chest", 0, 0],
    ["competition-deadlift", "Competition Deadlift", "deadlift", "back", 1, 0],
    ["block-pull", "Block Pull", "deadlift", "back", 0, 0],
    ["conventional-deadlift", "Conventional Deadlift", "deadlift", "back", 0, 0],
    ["deficit-comp-deadlift", "Deficit Deadlift", "deadlift", "back", 0, 0],
    ["double-paused-deadlift", "Double-Paused Deadlift", "deadlift", "back", 0, 0],
    ["bottom-paused-deadlift", "Paused Deadlift (Off the Floor)", "deadlift", "back", 0, 0],
    ["paused-sumo-deadlift-pod-kolanem", "Paused Sumo Deadlift (Below Knee)", "deadlift", "back", 0, 0],
    ["paused-sumo-deadlift-po-oderwaniu", "Paused Sumo Deadlift (Off the Floor)", "deadlift", "back", 0, 0],
    ["snatch-grip-deadlift", "Snatch-Grip Deadlift", "deadlift", "back", 0, 0],
    ["sumo-deadlift", "Sumo Deadlift", "deadlift", "back", 0, 0],
    ["glass-floor-deadlift", "Touch-and-Go Deadlift", "deadlift", "back", 0, 0],
    ["trap-bar-deadlift", "Trap Bar Deadlift", "deadlift", "back", 0, 0],
    ["atg-lat-pulldown", "ATG Lat Pulldown", "other", "back", 0, 0],
    ["hyper-extensions", "Back Extension", "other", "back", 0, 0],
    ["barbell-row", "Barbell Row", "other", "back", 0, 0],
    ["chest-supported-pullover", "Chest-Supported Pullover", "other", "back", 0, 0],
    ["chest-supported-row-machine", "Chest-Supported Row (Machine)", "other", "back", 0, 0],
    ["chinups", "Chin-Up", "other", "back", 0, 1],
    ["inverted-row", "Inverted Row", "other", "back", 0, 1],
    ["chest-supported-retraction-shrugs", "Kelso Shrug (Dumbbell)", "other", "back", 0, 0],
    ["lat-pulldown", "Lat Pulldown", "other", "back", 0, 0],
    ["lat-pulldown-neutral", "Lat Pulldown (Neutral Grip)", "other", "back", 0, 0],
    ["lat-pulldown-pronated", "Lat Pulldown (Overhand Grip)", "other", "back", 0, 0],
    ["lat-pulldown-supinated", "Lat Pulldown (Underhand Grip)", "other", "back", 0, 0],
    ["meadows-row", "Meadows Row", "other", "back", 0, 0],
    ["one-arm-chest-supported-pulldown", "One-Arm Lat Pulldown (Chest-Supported)", "other", "back", 0, 0],
    ["one-arm-retraction-row", "One-Arm Retraction Row", "other", "back", 0, 0],
    ["single-arm-db-row", "One-Arm Row (Dumbbell)", "other", "back", 0, 0],
    ["pendlay-row", "Pendlay Row", "other", "back", 0, 0],
    ["pullup", "Pull-Up", "other", "back", 0, 1],
    ["pullovers", "Pullover (Dumbbell)", "other", "back", 0, 0],
    ["lat-pulldown-scapular-retractions", "Scapular Lat Pulldown", "other", "back", 0, 0],
    ["deep-scapular-pull-up", "Scapular Pull-Up", "other", "back", 0, 1],
    ["db-seal-row", "Seal Row (Dumbbell)", "other", "back", 0, 0],
    ["seated-cable-row", "Seated Cable Row", "other", "back", 0, 0],
    ["lat-row-neutral-grip", "Seated Cable Row (Neutral Grip)", "other", "back", 0, 0],
    ["cable-seated-wide-grip-row", "Seated Cable Row (Wide Grip)", "other", "back", 0, 0],
    ["shrugs", "Shrug (Barbell)", "other", "back", 0, 0],
    ["straight-arm-pulldown-cable", "Straight-Arm Pulldown (Cable)", "other", "back", 0, 0],
    ["t-bar-row", "T-Bar Row", "other", "back", 0, 0],
    ["upper-back-row-neutral", "Upper Back Row (Cable, Neutral Grip)", "other", "back", 0, 0],
    ["upper-back-row-pronated", "Upper Back Row (Cable, Overhand Grip)", "other", "back", 0, 0],
    ["upper-back-row-supinated", "Upper Back Row (Cable, Underhand Grip)", "other", "back", 0, 0],
    ["arnold-shoulder-press", "Arnold Press (Dumbbell)", "other", "shoulders", 0, 0],
    ["facepulls", "Face Pull (Cable)", "other", "shoulders", 0, 0],
    ["facepull-to-y-raise-eccentric-overload", "Face Pull to Y-Raise (Cable)", "other", "shoulders", 0, 0],
    ["barbell-front-raise", "Front Raise (Barbell)", "other", "shoulders", 0, 0],
    ["cable-front-raise", "Front Raise (Cable)", "other", "shoulders", 0, 0],
    ["db-front-raise", "Front Raise (Dumbbell)", "other", "shoulders", 0, 0],
    ["landamine-press", "Landmine Press", "other", "shoulders", 0, 0],
    ["cable-machine-lateral-raise", "Lateral Raise (Cable)", "other", "shoulders", 0, 0],
    ["db-lateral-raise", "Lateral Raise (Dumbbell)", "other", "shoulders", 0, 0],
    ["press", "Overhead Press", "other", "shoulders", 0, 0],
    ["db-ohp", "Overhead Press (Dumbbell)", "other", "shoulders", 0, 0],
    ["push-press", "Push Press", "other", "shoulders", 0, 0],
    ["bent-over-rear-delt-row", "Rear Delt Row (Dumbbell)", "other", "shoulders", 0, 0],
    ["reverse-pec-dec", "Reverse Pec Deck (Machine)", "other", "shoulders", 0, 0],
    ["scapular-push-up", "Scapular Push-Up", "other", "shoulders", 0, 1],
    ["seated-overhead-press-dumbbell", "Seated Overhead Press (Dumbbell)", "other", "shoulders", 0, 0],
    ["cable-shoulder-internal-rotation", "Shoulder Internal Rotation (Cable)", "other", "shoulders", 0, 0],
    ["shoulder-internal-rotation-lying-deficit-dumbbell", "Shoulder Internal Rotation (Dumbbell, Lying)", "other", "shoulders", 0, 0],
    ["snach-grip-overhead-holds", "Snatch-Grip Overhead Hold", "other", "shoulders", 0, 1],
    ["trap-y-raise", "Y-Raise", "other", "shoulders", 0, 0],
    ["z-press", "Z Press", "other", "shoulders", 0, 0],
    ["bayesian-curl-cable", "Bayesian Curl (Cable)", "other", "biceps", 0, 0],
    ["bb-curl", "Biceps Curl (Barbell)", "other", "biceps", 0, 0],
    ["cable-curls-supinated", "Biceps Curl (Cable)", "other", "biceps", 0, 0],
    ["db-curl", "Biceps Curl (Dumbbell)", "other", "biceps", 0, 0],
    ["curl-machine", "Biceps Curl (Machine)", "other", "biceps", 0, 0],
    ["cable-hammer-curl", "Hammer Curl (Cable)", "other", "biceps", 0, 0],
    ["db-curls-hammer", "Hammer Curl (Dumbbell)", "other", "biceps", 0, 0],
    ["incline-curl-dumbbell", "Incline Curl (Dumbbell)", "other", "biceps", 0, 0],
    ["db-preacher-culrs", "Preacher Curl (Dumbbell)", "other", "biceps", 0, 0],
    ["cross-body-extensions", "Cross-Body Triceps Extension (Cable)", "other", "triceps", 0, 0],
    ["french-press-cable", "French Press (Cable)", "other", "triceps", 0, 0],
    ["cable-incline-bench-triceps-extension", "Incline Triceps Extension (Cable)", "other", "triceps", 0, 0],
    ["incline-bench-cable-tricep-pressdown", "Incline Triceps Pushdown (Cable)", "other", "triceps", 0, 0],
    ["jm-press", "JM Press", "other", "triceps", 0, 0],
    ["cable-overhead-triceps-extension", "Overhead Triceps Extension (Cable)", "other", "triceps", 0, 0],
    ["overhead-extension", "Overhead Triceps Extension (Dumbbell)", "other", "triceps", 0, 0],
    ["db-skull-crushers", "Skull Crusher (Dumbbell)", "other", "triceps", 0, 0],
    ["skull-crushers-barbell", "Skull Crusher (EZ Bar)", "other", "triceps", 0, 0],
    ["db-tate-press", "Tate Press (Dumbbell)", "other", "triceps", 0, 0],
    ["tricep-kickbacks", "Triceps Kickback (Dumbbell)", "other", "triceps", 0, 0],
    ["tricpes-pushdowns", "Triceps Pushdown (Cable)", "other", "triceps", 0, 0],
    ["triceps-pushdown-supinated", "Triceps Pushdown (Reverse Grip)", "other", "triceps", 0, 0],
    ["triceps-pushdown-neutral", "Triceps Pushdown (Rope)", "other", "triceps", 0, 0],
    ["triceps-pushdown-pronated", "Triceps Pushdown (Straight Bar)", "other", "triceps", 0, 0],
    ["wrist-extensions", "Reverse Wrist Curl", "other", "forearms", 0, 0],
    ["wrist-curls", "Wrist Curl", "other", "forearms", 0, 0],
    ["competition-squat", "Competition Squat", "squat", "quads", 1, 0],
    ["box-squat", "Box Squat", "squat", "quads", 0, 0],
    ["double-paused-squat", "Double-Paused Squat", "squat", "quads", 0, 0],
    ["highbar-squat", "High-Bar Squat", "squat", "quads", 0, 0],
    ["paused-highbar-squat", "Paused High-Bar Squat", "squat", "quads", 0, 0],
    ["paused-ssb-squat", "Paused Safety Bar Squat", "squat", "quads", 0, 0],
    ["paused-squat", "Paused Squat", "squat", "quads", 0, 0],
    ["pin-squat", "Pin Squat", "squat", "quads", 0, 0],
    ["platz-squat", "Platz Squat (Heels Elevated)", "squat", "quads", 0, 0],
    ["ssb-squat", "Safety Bar Squat", "squat", "quads", 0, 0],
    ["tempo-squat", "Tempo Squat", "squat", "quads", 0, 0],
    ["belt-squat", "Belt Squat", "other", "quads", 0, 0],
    ["bulgarian-split-squats", "Bulgarian Split Squat", "other", "quads", 0, 0],
    ["bb-cosssac-sq", "Cossack Squat (Barbell)", "other", "quads", 0, 0],
    ["deficit-bulgarian-split-squat", "Deficit Bulgarian Split Squat", "other", "quads", 0, 0],
    ["reverse-deficit-lunge", "Deficit Reverse Lunge", "other", "quads", 0, 0],
    ["front-squat", "Front Squat", "other", "quads", 0, 0],
    ["front-foot-elevated-split-squat", "Front-Foot Elevated Split Squat", "other", "quads", 0, 0],
    ["front-foot-elevated-split-squat-smith", "Front-Foot Elevated Split Squat (Smith Machine)", "other", "quads", 0, 0],
    ["goblet-squat", "Goblet Squat", "other", "quads", 0, 0],
    ["hack-squat", "Hack Squat (Machine)", "other", "quads", 0, 0],
    ["quad-extension", "Leg Extension (Machine)", "other", "quads", 0, 0],
    ["leg-press", "Leg Press", "other", "quads", 0, 0],
    ["pendulum-squat-machine", "Pendulum Squat (Machine)", "other", "quads", 0, 0],
    ["split-squat-dumbbell", "Split Squat (Dumbbell)", "other", "quads", 0, 0],
    ["landmine-split-sq", "Split Squat (Landmine)", "other", "quads", 0, 0],
    ["step-up-dumbbell", "Step-Up (Dumbbell)", "other", "quads", 0, 0],
    ["walking-lunge-dumbbell", "Walking Lunge (Dumbbell)", "other", "quads", 0, 0],
    ["rdl-deadlift", "Romanian Deadlift", "deadlift", "hamstrings", 0, 0],
    ["snatch-grip-deadlift-rdl", "Snatch-Grip Romanian Deadlift", "deadlift", "hamstrings", 0, 0],
    ["stiff-leg-deadlift", "Stiff-Leg Deadlift", "deadlift", "hamstrings", 0, 0],
    ["tempo-romanian-deadlift", "Tempo Romanian Deadlift (4-0-1-1)", "deadlift", "hamstrings", 0, 0],
    ["split-rdl-b-stance-rdl", "B-Stance Romanian Deadlift (Dumbbell)", "other", "hamstrings", 0, 0],
    ["belt-squat-rdl", "Belt Squat Romanian Deadlift", "other", "hamstrings", 0, 0],
    ["bb-good-morning", "Good Morning", "other", "hamstrings", 0, 0],
    ["hamstring-strengthening-with-slide-plates", "Hamstring Slide Curl", "other", "hamstrings", 0, 1],
    ["leg-curl-machine", "Leg Curl (Machine)", "other", "hamstrings", 0, 0],
    ["laying-hamstring-curl", "Lying Leg Curl (Machine)", "other", "hamstrings", 0, 0],
    ["nordic-hamstring-curl", "Nordic Hamstring Curl", "other", "hamstrings", 0, 1],
    ["db-rdl-deadlift", "Romanian Deadlift (Dumbbell)", "other", "hamstrings", 0, 0],
    ["seated-hamstring-curl", "Seated Leg Curl (Machine)", "other", "hamstrings", 0, 0],
    ["single-leg-romanian-deadlift-dumbbell", "Single-Leg Romanian Deadlift (Dumbbell)", "other", "hamstrings", 0, 0],
    ["standing-hamstring-curl", "Standing Leg Curl (Machine)", "other", "hamstrings", 0, 0],
    ["swiss-ball-leg-curl", "Swiss Ball Leg Curl", "other", "hamstrings", 0, 1],
    ["glute-bridge", "Glute Bridge", "other", "glutes", 0, 0],
    ["hip-thrust", "Hip Thrust", "other", "glutes", 0, 0],
    ["kettlebell-swing", "Kettlebell Swing", "other", "glutes", 0, 1],
    ["reverse-hyperextension", "Reverse Hyperextension", "other", "glutes", 0, 0],
    ["rower-abduction-adduction", "Adductor Slide (Rowing Machine)", "other", "hips", 0, 0],
    ["copenhagen-adduction", "Copenhagen Adduction", "other", "hips", 0, 1],
    ["cable-abduction", "Hip Abduction (Cable)", "other", "hips", 0, 0],
    ["hip-adduction-cable", "Hip Adduction (Cable)", "other", "hips", 0, 0],
    ["hip-airplane", "Hip Airplane", "other", "hips", 0, 1],
    ["hip-airplane-kettlebell", "Hip Airplane (Kettlebell)", "other", "hips", 0, 1],
    ["landamine-hip-airplane", "Hip Airplane (Landmine)", "other", "hips", 0, 1],
    ["kettlebell-hip-flexor-strength", "Hip Flexor Raise (Kettlebell)", "other", "hips", 0, 1],
    ["psoas-back-rock", "Psoas Back Rock", "other", "hips", 0, 1],
    ["psoas-march-cable", "Psoas March (Cable)", "other", "hips", 0, 0],
    ["seated-calf-raise", "Seated Calf Raise (Machine)", "other", "calves", 0, 0],
    ["standing-calf-raise", "Standing Calf Raise", "other", "calves", 0, 0],
    ["ab-wheel-rollout", "Ab Wheel Rollout", "other", "core", 0, 1],
    ["cable-crunch", "Cable Crunch", "other", "core", 0, 0],
    ["candle-raise", "Candle Raise", "other", "core", 0, 1],
    ["dead-bugs", "Dead Bug", "other", "core", 0, 0],
    ["leg-raises", "Hanging Leg Raise", "other", "core", 0, 0],
    ["hollow-body-hold-band", "Hollow Body Hold (Band Resisted)", "other", "core", 0, 1],
    ["pallof-press-cable", "Pallof Press (Cable)", "other", "core", 0, 1],
    ["plank", "Plank", "other", "core", 0, 1],
    ["reverse-crunch", "Reverse Crunch", "other", "core", 0, 1],
    ["incline-bench-reverse-crunch", "Reverse Crunch (Incline Bench)", "other", "core", 0, 1],
    ["ghd-russian-twist", "Russian Twist (GHD)", "other", "core", 0, 0],
    ["side-bend-roman-chair", "Side Bend (Roman Chair)", "other", "core", 0, 0],
    ["side-plank", "Side Plank", "other", "core", 0, 1],
    ["starfish", "Starfish", "other", "core", 0, 1],
    ["suitcase-carry", "Suitcase Carry", "other", "core", 0, 1],
    ["farmer-s-carry", "Farmer's Carry", "other", "full", 0, 1],
    ["hang-clean", "Hang Clean", "other", "full", 0, 0],
    ["kb-overhead-carry", "Overhead Carry (Kettlebell)", "other", "full", 0, 1],
    ["power-snach", "Power Snatch", "other", "full", 0, 0],
    ["snach-grip-balance", "Snatch Balance", "other", "full", 0, 0],
  ];
  // identyfikatory z pierwszej, małej biblioteki startowej (do 11.2026) → odpowiedniki w obecnej
  const OLD = { "overhead-press": "press", "pull-up": "pullup", "dumbbell-curl": "db-curl", "dumbbell-lateral-raise": "db-lateral-raise", "dumbbell-row": "single-arm-db-row",
    "chest-supported-row": "chest-supported-row-machine", "triceps-pushdown": "tricpes-pushdowns", "walking-lunge": "walking-lunge-dumbbell", "back-extension": "hyper-extensions",
    "hanging-leg-raise": "leg-raises", "incline-bench-press": "incline-barbell-bench-press-30", "dumbbell-shoulder-press": "db-ohp", "paused-deadlift": "bottom-paused-deadlift", "deficit-deadlift": "deficit-comp-deadlift" };
  const BY_ID = new Map(LIB.map((r) => [r[0], r]));
  const make = ([id, name, family, muscle, comp, bw]) => ({ id, name, family, muscle, comp: !!comp, max: null, bw: !!bw, prog: { m: "none", step: 0 }, used: false });
  function library() {
    const out = {};
    for (const r of LIB) out[r[0]] = make(r);
    return out;
  }
  // partia mięśniowa po id albo nazwie (dla ćwiczeń z biblioteki)
  const BY_NAME = new Map(LIB.map((r) => [r[1].toLowerCase(), r]));
  function muscleOf(x) { const r = BY_ID.get(x.id) || BY_NAME.get(String(x.name || "").toLowerCase()); return r ? r[3] : null; }
  // Wpis planu: T = top set na RPE z progresją +0,5/tydz., B = serie zejściowe −x% z top seta,
  // R = seria na RPE bez progresji, A = akcesorium (ciężar dobierasz, docelowe RPE)
  const T = (ex, sets, reps, rpe) => ({ exId: ex, sets: String(sets), reps: String(reps), type: "rpe", value: rpe, rpe: null, prog: { m: "rpe_step", step: 0.5 }, note: null, top: true });
  const B = (ex, sets, reps, pct) => ({ exId: ex, sets: String(sets), reps: String(reps), type: "pct_top", value: pct, rpe: null, prog: { m: "none", step: 0 }, note: null, back: true });
  const R = (ex, sets, reps, rpe, prog) => ({ exId: ex, sets: String(sets), reps: String(reps), type: "rpe", value: rpe, rpe: null, prog: prog ? { m: "rpe_step", step: 0.5 } : { m: "none", step: 0 }, note: null });
  const A = (ex, sets, reps, rpe, note) => ({ exId: ex, sets: String(sets), reps: String(reps), type: "kg", value: null, rpe: String(rpe), prog: { m: "none", step: 0 }, note: note || null, acc: true });

  // Ciężary na start liczone z „ciężaru na 5 powtórzeń z 2 w zapasie” (ok. 81% 1RM). Bez niego: pusty gryf / typowe minimum.
  const SQ = "competition-squat", BP = "competition-bench-press", DL = "competition-deadlift", OHP = "press", ROW = "barbell-row";
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
        ["Dzień 2", [L(OHP, 5, 3, 2.5, 1, "T1 · ostatnia seria: ile się da"), L(DL, 3, 10, 5, 0.7, "T2"), A("single-arm-db-row", 3, 15, 8, "T3")]],
        ["Dzień 3", [L(BP, 5, 3, 2.5, 1, "T1 · ostatnia seria: ile się da"), L(SQ, 3, 10, 5, 0.75, "T2"), A("lat-pulldown", 3, 15, 8, "T3")]],
        ["Dzień 4", [L(DL, 5, 3, 5, 1, "T1 · ostatnia seria: ile się da"), L(OHP, 3, 10, 2.5, 0.75, "T2"), A("single-arm-db-row", 3, 15, 8, "T3")]],
      ] },
    { id: "531beg", level: "beg", kind: "531", name: "5/3/1 dla początkujących", days: 3, lifts: [SQ, BP, DL, OHP], fsl: true,
      desc: "Program Jima Wendlera: 3 dni, dwa boje dziennie, ciężary w procentach Training maxa, cykl 4 tygodni (ostatni lżejszy). Po seriach głównych 5×5 lżej.",
      mains: [[SQ, BP], [DL, OHP], [BP, SQ]],
      assist: [[A("dips", 3, 10, 8), A("lat-pulldown", 3, 10, 8), A("ab-wheel-rollout", 3, "MAX", 8)],
               [A("pullup", 3, "MAX", 8), A("single-arm-db-row", 3, 10, 8), A("walking-lunge-dumbbell", 3, 10, 8)],
               [A("dips", 3, 10, 8), A("seated-cable-row", 3, 10, 8), A("leg-raises", 3, "MAX", 8)]] },
    { id: "531bbb", level: "mid", kind: "531", name: "5/3/1 Boring But Big", days: 4, lifts: [OHP, DL, BP, SQ], bbb: true,
      desc: "Program Jima Wendlera: 4 dni, jeden bój dziennie w procentach Training maxa, potem 5×10 na 50% TM tego samego boju. Dużo objętości na siłę i masę.",
      mains: [[OHP], [DL], [BP], [SQ]],
      assist: [[A("lat-pulldown", 5, 10, 8)], [A("leg-raises", 5, 10, 8)], [A("single-arm-db-row", 5, 10, 8)], [A("ab-wheel-rollout", 5, "MAX", 8)]] },
    { id: "rpe3", level: "mid", kind: "rpe", name: "Trójbój na RPE · 3 dni", days: 3, lifts: [SQ, BP, DL],
      desc: "Top set i serie zejściowe (−10%), dni ciężkie i lżejsze. Ciężar dobiera aplikacja z Twoich wyników (RPE). Blok 4 tygodni, ostatni lżejszy.",
      plan: [
        ["Dzień 1 · ciężki przysiad", [T(SQ, 1, 4, 7.5), B(SQ, 2, 4, 10), T(BP, 1, 5, 7), B(BP, 3, 5, 10), R("rdl-deadlift", 3, 6, 7), A("lat-pulldown", 3, 10, 8), A("ab-wheel-rollout", 3, "MAX", 8)]],
        ["Dzień 2 · ciężki martwy", [T(DL, 1, 3, 7.5), B(DL, 2, 3, 10), T("2ct-paused-bench-press", 1, 3, 7.5), B("2ct-paused-bench-press", 3, 3, 10), R("paused-squat", 3, 4, 6), A("seated-cable-row", 3, 10, 8), A("hyper-extensions", 2, 12, 8)]],
        ["Dzień 3 · lekki", [R("highbar-squat", 3, 6, 6), R("close-grip-bench-press", 4, 6, 7, true), A("front-foot-elevated-split-squat", 3, 8, 8), A("chest-supported-row-machine", 3, 10, 8), A("db-lateral-raise", 2, 15, 8)]],
      ] },
    { id: "rpe4", level: "mid", kind: "rpe", name: "Trójbój na RPE · 4 dni", days: 4, lifts: [SQ, BP, DL],
      desc: "Jak wyżej, ale każdy bój ma swój dzień, a wyciskanie dwa. Ciężar dobiera aplikacja z RPE. Blok 4 tygodni, ostatni lżejszy.",
      plan: [
        ["Dzień 1 · przysiad", [T(SQ, 1, 3, 7.5), B(SQ, 3, 3, 10), R("rdl-deadlift", 3, 6, 7), A("leg-curl-machine", 3, 10, 8), A("ab-wheel-rollout", 3, "MAX", 8)]],
        ["Dzień 2 · wyciskanie", [T(BP, 1, 3, 7.5), B(BP, 3, 3, 10), A("chest-supported-row-machine", 3, 8, 8), R(OHP, 3, 6, 7), A("tricpes-pushdowns", 2, 12, 8)]],
        ["Dzień 3 · martwy", [T(DL, 1, 3, 7.5), B(DL, 2, 3, 10), R("paused-squat", 3, 4, 6), A("front-foot-elevated-split-squat", 3, 8, 8), A("hyper-extensions", 2, 12, 8)]],
        ["Dzień 4 · wyciskanie objętość", [T("2ct-paused-bench-press", 1, 4, 7), B("2ct-paused-bench-press", 3, 4, 10), R("close-grip-bench-press", 3, 6, 7), A("lat-pulldown", 3, 10, 8), A("db-lateral-raise", 2, 15, 8), A("db-curl", 2, 12, 8)]],
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
  return { library, PROGRAMS, build, VERSION, MUSCLES, OLD, LIB: BY_ID, make, muscleOf };
})();

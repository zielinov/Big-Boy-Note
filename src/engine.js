
/* Silnik obliczeń — czyste funkcje, bez interfejsu.
   Wszystko, co liczy aplikacja (e1RM, sugestie, progresje, podsumowania), jest tutaj,
   żeby dało się to testować osobno i przenieść później do aplikacji na telefon. */
const Engine = (() => {
  // ---------- Tabela RPE (Tuchscherer) ----------
  // Jedna sekwencja: każde pół punktu RPE poniżej 10 albo każde dodatkowe powtórzenie
  // to jeden krok w dół. Zgodna z poprawną tabelą z Twojego arkusza (wiersze 392–408).
  const SEQ = [100, 97.8, 95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3, 85.0, 83.7, 82.4, 81.1, 79.9,
    78.6, 77.4, 76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68.0, 66.7, 65.3, 64.0, 62.6, 61.3, 59.9, 58.6,
    57.2, 55.8, 54.4, 53.0, 51.6, 50.2, 48.8];
  const seqAt = (i) => (i < SEQ.length ? SEQ[i] : SEQ[SEQ.length - 1] - 1.4 * (i - SEQ.length + 1));

  /** Ułamek 1RM dla danej liczby powtórzeń i RPE (np. 0.863 dla 5 powt. @10). */
  function rpePct(reps, rpe) {
    if (!(reps >= 1) || !(rpe >= 1) || rpe > 10) return null;
    const idx = (reps - 1) * 2 + (10 - rpe) * 2;
    const i0 = Math.floor(idx), f = idx - i0;
    return (seqAt(i0) * (1 - f) + seqAt(i0 + 1) * f) / 100;
  }

  const DEFAULT_SETTINGS = {
    step: 2.5,          // zaokrąglanie ciężaru
    minRpe: 6,          // od jakiego RPE seria liczy się do e1RM
    maxReps: 10,        // do ilu powtórzeń seria liczy się do e1RM
    sessions: 2,        // z ilu ostatnich sesji średnia e1RM
    jump: 0.1,          // próg podejrzanego skoku e1RM (10%)
    overshoot: 1.5,     // o ile RPE może przekroczyć plan, zanim pokażemy ostrzeżenie
    bar: 20,            // gryf do kalkulatora talerzy
  };

  // Zaokrąglanie zawsze w dół do kroku (jak QUOTIENT w arkuszu trenera); epsilon chroni przed błędem zmiennoprzecinkowym
  const roundTo = (x, step) => (x == null || !isFinite(x) ? null : Math.floor(x / step + 1e-9) * step);
  // Training max (TM): baza z planu, a gdy jej brak - maks zapisany przy ćwiczeniu
  function baseTm(state, planId, exId) {
    const plan = ((state && state.plans) || []).find((p) => p.id === planId);
    const v = plan && plan.bases ? num(plan.bases[exId]) : null;
    if (v && v > 0) return v;
    const ex = ((state && state.exercises) || {})[exId];
    const m = ex ? num(ex.max) : null;
    return m && m > 0 ? m : null;
  }
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);

  // ---------- Parsowanie zapisu serii i powtórzeń ----------
  /** "5" | "8-12" | "8,6,3" | "6>4>3" | "MAX" | "10-20s" -> opis */
  function parseReps(str) {
    const s = String(str ?? "").trim();
    if (!s) return { kind: "none" };
    if (/^\d+$/.test(s)) { const n = +s; return { kind: "fixed", min: n, max: n }; }
    let m = s.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (m) return { kind: "range", min: +m[1], max: +m[2] };
    if (/^\d+(\s*[,>.]\s*\d+)+$/.test(s)) {
      const list = s.split(/[,>.]/).map((x) => +x.trim());
      return { kind: "list", list, min: Math.min(...list), max: Math.max(...list), last: list[list.length - 1] };
    }
    if (/^(max|amrap)/i.test(s)) return { kind: "amrap" };
    if (/(s|sek|sekund|sec)\b/i.test(s)) return { kind: "time", text: s };
    return { kind: "text", text: s };
  }
  /** "3" | "2-3" -> {min,max} */
  function parseSets(str) {
    const s = String(str ?? "").trim();
    if (/^\d+$/.test(s)) return { min: +s, max: +s };
    const m = s.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (m) return { min: +m[1], max: +m[2] };
    return { min: null, max: null };
  }
  /** "8-9" | "8" | 8 -> {min,max} */
  function parseRpe(v) {
    if (typeof v === "number") return { min: v, max: v };
    const s = String(v ?? "").trim().replace(",", ".");
    if (/^\d+(\.\d+)?$/.test(s)) return { min: +s, max: +s };
    const m = s.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
    if (m) return { min: +m[1], max: +m[2] };
    return null;
  }
  /** Liczba powtórzeń, dla której liczymy sugestię ciężaru. */
  function targetReps(entry) {
    const r = parseReps(entry.reps);
    if (r.kind === "fixed" || r.kind === "range") return r.min;
    return null;
  }

  // ---------- e1RM z pojedynczego wpisu ----------
  /** e1RM z wpisu (ciężar ostatniej serii, powtórzenia, RPE). null gdy się nie da. */
  function entryE1rm(entry, settings = DEFAULT_SETTINGS) {
    const log = entry && entry.log;
    if (!log) return null;
    const kg = num(log.kg), rpe = num(log.rpe);
    if (!(kg > 0) || rpe == null || rpe < 4) return null;
    let reps = num(log.reps);
    if (reps == null) {
      const r = parseReps(entry.reps);
      if (r.kind === "fixed") reps = r.min;
      else if (r.kind === "list" && !log.kgText) reps = r.last;
    }
    if (!(reps >= 1) || reps > 12) return null;
    const pct = rpePct(reps, rpe);
    if (!pct) return null;
    return {
      value: kg / pct,
      reps, rpe, kg,
      reliable: rpe >= settings.minRpe && reps <= settings.maxReps,
    };
  }

  // ---------- Iteracja po planie ----------
  function walk(state) {
    const out = [];
    for (const b of state.blocks || []) {
      (b.weeks || []).forEach((w, wi) => {
        (w.days || []).forEach((d, di) => {
          (d.entries || []).forEach((e, ei) => out.push({ b, w, wi, d, di, e, ei }));
        });
      });
    }
    return out;
  }

  const dayKey = (b, wi, di) => `${b.id}/${wi}/${di}`;
  const entryDate = (d, e) => (e.log && e.log.at) || d.date || null;

  // ---------- Sesje i bieżący e1RM ----------
  /**
   * Analiza historii jednego ćwiczenia: sesje chronologicznie, z bieżącym e1RM
   * po każdej sesji i oznaczeniem podejrzanych skoków.
   */
  function analyze(state, exId, opts = {}) {
    const settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}), ...(opts.settings || {}) };
    const map = new Map();
    const exDef = (state.exercises || {})[exId];
    if (exDef && exDef.bw) return { sessions: [], current: null, best: null, settings };
    for (const { b, wi, d, di, e, ei } of walk(state)) {
      if (e.exId !== exId) continue;
      const r = entryE1rm(e, settings);
      if (!r) continue;
      const key = dayKey(b, wi, di);
      if (opts.excludeKey && key === opts.excludeKey) continue;
      const date = entryDate(d, e);
      if (opts.before && date && date >= opts.before) continue;
      if (!map.has(key)) map.set(key, { key, blockId: b.id, blockName: b.name, wi, di, dayName: d.name, date, sets: [] });
      map.get(key).sets.push({ ...r, ei, entryId: e.id, confirmed: !!e.ok, skip: !!e.skip });
    }
    const sessions = [...map.values()].sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.key.localeCompare(b.key));
    const used = [];    // wiarygodne sesje wliczone do bieżącego e1RM
    const usedLow = []; // sesje z niskim RPE — tylko gdy nie ma wiarygodnych
    let pending = [];   // podejrzane skoki czekające na potwierdzenie
    for (const s of sessions) {
      // wyniki oznaczone "nie licz do e1RM" (np. słaby dzień) widać w historii, ale nie wchodzą do bieżącego e1RM
      const live = s.sets.filter((x) => !x.skip);
      s.skipped = !live.length;
      const rel = (live.length ? live : s.sets).filter((x) => x.reliable);
      const pool = rel.length ? rel : live.length ? live : s.sets;
      const top = pool.reduce((a, x) => (x.value > a.value ? x : a), pool[0]);
      s.value = top.value; s.top = top; s.reliable = rel.length > 0;
      const prev = currentFrom(used, usedLow, settings);
      s.before = prev;
      const ref = prev && !prev.low ? prev.value : null;
      s.change = prev ? s.value / prev.value - 1 : null;
      s.flagged = false;
      if (s.skipped) { s.after = prev; continue; }
      if (!s.reliable) { usedLow.push(s); s.after = currentFrom(used, usedLow, settings); continue; }
      const jump = ref != null && s.value / ref - 1 > settings.jump;
      if (jump && !top.confirmed && !pending.length) {
        s.flagged = true; pending.push(s);          // pojedynczy skok: wstrzymany
      } else {
        if (jump && pending.length) {                // kolejna sesja też wysoko: skok był prawdziwy
          for (const p of pending) { p.flagged = false; p.corroborated = true; used.push(p); }
        }
        pending = [];
        used.push(s);
      }
      s.after = currentFrom(used, usedLow, settings);
    }
    const current = currentFrom(used, usedLow, settings);
    const best = sessions.reduce((a, s) => (s.reliable && !s.flagged && !s.skipped && (!a || s.value > a.value) ? s : a), null);
    return { sessions, current, best, settings };
  }

  function currentFrom(used, usedLow, settings) {
    const pool = used.length ? used : usedLow;
    if (!pool.length) return null;
    const last = pool.slice(-settings.sessions);
    const value = last.reduce((a, s) => a + s.value, 0) / last.length;
    return { value, from: last.map((s) => s.key), low: !used.length, lastDate: last[last.length - 1].date };
  }

  /** Bieżący e1RM ćwiczenia z sesji przed podaną datą (lub ze wszystkich). */
  function currentE1rm(state, exId, before, excludeKey) {
    const cur = analyze(state, exId, { before, excludeKey }).current;
    // Ręczny e1RM ćwiczenia (np. po przerwie) obowiązuje, dopóki nie ma nowszych wyników.
    const ex = (state.exercises || {})[exId];
    const m = ex && ex.e1rmManual;
    const mv = m ? num(m.value) : null;
    // "after" = data ostatniego zapisanego wyniku w chwili wpisania ręcznego e1RM (daty w planie bywają wcześniejsze niż dzień zapisu,
    // więc porównujemy z nią, a nie z dniem wpisania). Stare wpisy bez "after" porównują się z datą wpisania.
    const newer = cur && cur.lastDate && (m && m.after ? cur.lastDate > m.after : m && m.date && cur.lastDate >= m.date);
    if (mv && mv > 0 && !newer) {
      return { value: mv, from: [], low: false, lastDate: m.date || null, manual: true };
    }
    return cur;
  }

  // ---------- Sugestia ciężaru ----------
  /**
   * Sugerowany ciężar dla wpisu w planie.
   * Zwraca {kg, lo, hi, basis, src, note} albo null.
   * Wpis z zapisanym wynikiem ma sugestię zamrożoną (e.sug).
   */
  function suggest(state, ctx) {
    const { b, wi, d, di, e } = ctx;
    const settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
    const ex = (state.exercises || {})[e.exId] || {};
    if (e.log && e.sug != null) return { kg: e.sug, basis: e.basis ?? null, src: "frozen" };
    const step = settings.step;
    const reps = targetReps(e);
    const val = num(e.value);
    // Ciężar wpisany ręcznie przy tym wpisie (zamiast liczonego z planu)
    if (e.kgMode === "manual") return num(e.kgPlan) != null ? { kg: num(e.kgPlan), src: "manual" } : null;
    if (e.type === "kg") {
      if (val == null) return null;
      return { kg: val, src: "kg" };
    }
    if (e.type === "pct_top") {
      // X% mniej niż top set tego samego ćwiczenia, który stoi wcześniej w dniu
      if (val == null) return null;
      const list = (d && d.entries) || [];
      let i = list.findIndex((x) => x.id === e.id);
      if (i < 0) i = list.length;
      let top = null;
      for (let k = i - 1; k >= 0; k--) { if (list[k].exId === e.exId && list[k].type !== "pct_top") { top = list[k]; break; } }
      if (!top) return { kg: null, src: "pct_top", note: "brak top seta" };
      const tk = top.log && num(top.log.kg) != null ? num(top.log.kg) : (suggest(state, { b, wi, d, di, e: top }) || {}).kg;
      if (tk == null) return { kg: null, src: "pct_top", note: "brak ciężaru top seta" };
      return { kg: roundTo(tk * (1 - val / 100), step), basis: tk, src: "pct_top" };
    }
    const cur = currentE1rm(state, (e.type === "pct_e1rm" && e.refEx) || e.exId, d && d.date, b ? dayKey(b, wi, di) : null);
    if (e.type === "rpe") {
      if (!cur || !reps || val == null) return cur ? null : { kg: null, src: "rpe", note: "brak e1RM" };
      const p = rpePct(reps, val);
      // widełki na gorszy i lepszy dzień: ±1 RPE (ok. ±4–5%), nie ±0,5 — dzienne wahania siły są większe niż dokładność skali RPE
      const pLo = rpePct(reps, Math.max(1, val - 1));
      const pHi = rpePct(reps, Math.min(10, val + 1));
      return { kg: roundTo(cur.value * p, step), lo: roundTo(cur.value * pLo, step), hi: roundTo(cur.value * pHi, step), basis: cur.value, low: cur.low, manual: !!cur.manual, src: "rpe" };
    }
    if (e.type === "pct_e1rm") {
      if (!cur || val == null) return { kg: null, src: "pct_e1rm", note: "brak e1RM" };
      return { kg: roundTo(cur.value * val / 100, step), basis: cur.value, low: cur.low, manual: !!cur.manual, src: "pct_e1rm" };
    }
    if (e.type === "pct_max") {
      const mx = baseTm(state, b && b.planId, e.refEx || e.exId);
      if (!mx || val == null) return { kg: null, src: "pct_max", note: "brak TM" };
      return { kg: roundTo(mx * val / 100, step), basis: mx, src: "pct_max", refEx: e.refEx || null };
    }
    return null;
  }

  // ---------- Ocena wykonanego wpisu ----------
  function evaluate(state, e) {
    const settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
    if (!e.log) return null;
    const out = {};
    const rpe = num(e.log.rpe);
    const target = e.type === "rpe" ? parseRpe(e.value) : parseRpe(e.rpe);
    if (rpe != null && target) {
      if (rpe >= target.max + settings.overshoot) out.over = rpe - target.max;
      else if (rpe <= target.min - settings.overshoot) out.under = target.min - rpe;
    }
    return out;
  }

  // ---------- Progresja: następny tydzień ----------
  const PROG_LABEL = {
    rpe_step: "RPE + co tydzień",
    pct_step: "% + co tydzień",
    linear: "liniowa + kg",
    double: "double progression",
    none: "bez zmian",
  };
  /** Które metody pasują do typu intensywności. */
  function progOptions(type) {
    if (type === "rpe") return ["rpe_step", "none"];
    if (type === "pct_top") return ["none"];
    if (type === "pct_e1rm" || type === "pct_max") return ["pct_step", "none"];
    return ["double", "linear", "none"];
  }

  /** Wpis na kolejny tydzień na podstawie planu i wyniku z tego tygodnia. */
  function progressEntry(e, settings = DEFAULT_SETTINGS) {
    const next = {
      id: uid(), exId: e.exId, sets: e.sets, reps: e.reps, type: e.type,
      value: e.value, rpe: e.rpe, prog: e.prog ? { ...e.prog } : { m: "none", step: 0 },
      note: e.note || null, log: null,
    };
    if (e.refEx) next.refEx = e.refEx;
    if (e.kgMode === "manual") { next.kgMode = "manual"; next.kgPlan = null; }
    const p = next.prog, step = num(p.step) || 0;
    const val = num(e.value);
    const log = e.log || null;
    const why = [];
    if (p.m === "rpe_step" && e.type === "rpe" && val != null) {
      next.value = Math.min(10, +(val + step).toFixed(2));
      why.push(`RPE ${fmt(val)} → ${fmt(next.value)}`);
    } else if (p.m === "pct_step" && (e.type === "pct_e1rm" || e.type === "pct_max") && val != null) {
      next.value = +(val + step).toFixed(2);
      why.push(`${fmt(val)}% → ${fmt(next.value)}%`);
    } else if ((p.m === "linear" || p.m === "double") && e.type === "kg") {
      const prevKg = log && num(log.kg) != null ? num(log.kg) : val;
      const r = parseReps(e.reps);
      const tgtRpe = parseRpe(e.rpe);
      const done = log ? num(log.reps) ?? (r.kind === "fixed" ? r.min : null) : null;
      const rpeOk = !tgtRpe || !log || num(log.rpe) == null || num(log.rpe) <= tgtRpe.max;
      let up = false;
      if (log && prevKg != null) {
        if (p.m === "double") {
          if (r.kind === "range" || r.kind === "fixed") {
            if (done == null) why.push("brak powtórzeń ostatniej serii — ciężar bez zmian");
            else up = done >= r.max && rpeOk;
          }
        } else {
          up = (done == null || done >= (r.min || 0)) && rpeOk;
        }
      }
      next.value = prevKg == null ? null : up ? +(prevKg + step).toFixed(2) : prevKg;
      if (prevKg != null) why.push(up ? `+${fmt(step)} kg (${fmt(prevKg)} → ${fmt(next.value)})` : `zostaje ${fmt(prevKg)} kg`);
    }
    return { entry: next, why: why.join(", ") };
  }

  function addDays(iso, n) {
    if (!iso) return null;
    const dt = new Date(iso + "T12:00:00Z");
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }

  /** Nowy tydzień zbudowany z ostatniego tygodnia bloku. */
  function nextWeek(block, settings = DEFAULT_SETTINGS) {
    const last = block.weeks[block.weeks.length - 1];
    if (!last) return { days: [] };
    return {
      days: last.days.map((d) => ({
        id: uid(), name: d.name, date: addDays(d.date, 7),
        entries: d.entries.map((e) => progressEntry(e, settings).entry),
      })),
    };
  }

  /** Kopia tygodnia jako start nowego bloku (bez wyników). */
  function copyWeek(week, startDate) {
    const first = week.days.find((d) => d.date)?.date;
    const shift = first && startDate ? Math.round((Date.parse(startDate) - Date.parse(first)) / 864e5) : 0;
    return {
      days: week.days.map((d) => ({
        id: uid(), name: d.name, date: d.date ? addDays(d.date, shift) : startDate || null,
        entries: d.entries.map((e) => ({
          id: uid(), exId: e.exId, sets: e.sets, reps: e.reps, type: e.type, value: e.value,
          rpe: e.rpe, prog: e.prog ? { ...e.prog } : { m: "none", step: 0 }, note: e.note || null, log: null,
          ...(e.refEx ? { refEx: e.refEx } : {}),
          ...(e.kgMode === "manual" ? { kgMode: "manual", kgPlan: null } : {}),
        })),
      })),
    };
  }

  // ---------- Podsumowania ----------
  /** Tygodniowe sumy dla rodziny bojów (squat/bench/deadlift/other). */
  function weeklyByFamily(state, family, planId) {
    const settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
    const rows = [];
    for (const b of state.blocks || []) {
      if (planId && b.planId !== planId) continue;
      b.weeks.forEach((w, wi) => {
        let sets = 0, reps = 0, volume = 0, top = null, logged = 0, start = null;
        w.days.forEach((d) => {
          if (d.date && (!start || d.date < start)) start = d.date;
          d.entries.forEach((e) => {
            const ex = (state.exercises || {})[e.exId];
            if (!ex || ex.family !== family || !e.log || num(e.log.kg) == null) return;
            logged++;
            const s = parseSets(e.sets).min || 0;
            const r = parseReps(e.reps);
            const rr = r.kind === "fixed" ? r.min : num(e.log.reps) ?? (r.kind === "range" ? r.min : r.kind === "list" ? r.list.reduce((a, x) => a + x, 0) / r.list.length : 0);
            sets += s; reps += s * rr; volume += s * rr * e.log.kg;
            const x = entryE1rm(e, settings);
            if (x && x.reliable && (!top || x.value > top)) top = x.value;
          });
        });
        if (logged) rows.push({ blockId: b.id, blockName: b.name, wi, start, sets, reps, volume, top });
      });
    }
    return rows;
  }

  /** Talerze na stronę dla danego ciężaru. */
  function plates(kg, bar = 20) {
    const set = [25, 20, 15, 10, 5, 2.5, 1.25];
    let side = (kg - bar) / 2;
    if (!(side > 0)) return [];
    const out = [];
    for (const p of set) { while (side >= p - 1e-9) { out.push(p); side -= p; } }
    return side > 0.01 ? null : out;
  }

  function fmt(x, d = 1) {
    if (x == null || !isFinite(x)) return "–";
    const r = Math.round(x * 10 ** d) / 10 ** d;
    return String(r).replace(".", ",");
  }

  let _n = 0;
  function uid() { return Date.now().toString(36) + (_n++).toString(36) + Math.random().toString(36).slice(2, 6); }

  /** Uzupełnia brakujące id i pola (np. po imporcie). Mutuje i zwraca stan. */
  function normalize(state) {
    state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
    state.exercises = state.exercises || {};
    state.blocks = state.blocks || [];
    // Treningi (plany): starsze dane bez planu trafiają do pierwszego planu.
    if (!Array.isArray(state.plans) || !state.plans.length) {
      state.plans = state.blocks.length ? [{ id: "p1", name: "Plan od trenera" }] : [];
    }
    for (const b of state.blocks) {
      if (!b.planId || !state.plans.some((p) => p.id === b.planId)) b.planId = state.plans[0] ? state.plans[0].id : null;
      b.id = b.id || uid();
      b.weeks = b.weeks || [];
      for (const w of b.weeks) {
        w.days = w.days || [];
        for (const d of w.days) {
          d.id = d.id || uid();
          d.entries = d.entries || [];
          for (const e of d.entries) {
            e.id = e.id || uid();
            e.prog = e.prog || { m: "none", step: 0 };
          }
        }
      }
    }
    return state;
  }

  return {
    SEQ, DEFAULT_SETTINGS, PROG_LABEL,
    rpePct, roundTo, baseTm, parseReps, parseSets, parseRpe, targetReps,
    entryE1rm, analyze, currentE1rm, suggest, evaluate,
    progOptions, progressEntry, nextWeek, copyWeek, addDays,
    weeklyByFamily, plates, fmt, uid, normalize, dayKey,
  };
})();
if (typeof module !== "undefined") module.exports = Engine;


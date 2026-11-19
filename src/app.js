
/* Interfejs aplikacji. Stan w S, widok renderowany z szablonów, zdarzenia przez data-act. */
(() => {
  const E = Engine;
  const F = E.fmt;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const parseNum = (v) => { const s = String(v ?? "").trim().replace(",", "."); if (!s) return null; const n = Number(s); return isFinite(n) ? n : null; };
  const today = () => new Date().toISOString().slice(0, 10);
  const DOW = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];
  const fmtDate = (iso, withDow = true) => {
    if (!iso) return "";
    const d = new Date(iso + "T12:00:00");
    const s = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    return withDow ? `${DOW[d.getDay()]} ${s}` : s;
  };
  const APP_VERSION = "/*VERSION*/"; // wstawia tools/build.py
  const FEEDBACK_URL = ""; // link do formularza Google ze zgłoszeniami (pusty = przycisk ukryty)
  // tryb prosty / zaawansowany (settings.ui); nowe osoby: prosty, osoby z danymi: zaawansowany
  const adv = () => S.settings.ui !== "simple";
  const CALC_KEYS = ["step", "bar", "minRpe", "maxReps", "sessions", "jump", "overshoot"]; // ustawienia z karty „Obliczenia”
  const FAMILY = { squat: "Przysiad", bench: "Wyciskanie", deadlift: "Martwy ciąg", other: "Inne" };
  const TYPE_LABEL = { rpe: "RPE", pct_e1rm: "% e1RM", pct_max: "% TM", pct_top: "% z top seta", kg: "kg" };

  let S = E.normalize({ blocks: [], exercises: {} });

  // Wygląd: rozmiar i styl zapisujemy na tym urządzeniu (telefon i komputer mogą mieć inne).
  const SKINS = {
    calm: { name: "Spokojny", desc: "Jasny lub ciemny jak system, miękkie karty.", sw: ["#eef1f5", "#1d4ed8", "#3d64c9", "#2f8a68"] },
    pomost: { name: "Pomost", desc: "Czerń pomostu, ostre krawędzie, kolory talerzy.", sw: ["#0a0a0b", "#ffd31a", "#e8352d", "#2563ff"], fonts: "family=Big+Shoulders+Display:wght@600;700;800&family=Archivo:wght@400;500;600;700" },
    notes: { name: "Notes", desc: "Zeszyt w kratkę, długopis i zakreślacz.", sw: ["#f2f3ee", "#1d3ec2", "#ffe14d", "#c4302a"], fonts: "family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@500;600" },
  };
  const SIZES = [{ v: 0.875, name: "Mały" }, { v: 1, name: "Standard" }, { v: 1.15, name: "Duży" }, { v: 1.3, name: "Bardzo duży" }];
  const look = (() => { try { return { scale: 1, skin: "calm", ...JSON.parse(localStorage.getItem("trening-look") || "{}") }; } catch { return { scale: 1, skin: "calm" }; } })();
  function applyLook() {
    const root = document.documentElement;
    root.style.fontSize = 16 * (look.scale || 1) + "px";
    if (look.skin && look.skin !== "calm") root.setAttribute("data-skin", look.skin); else root.removeAttribute("data-skin");
    const sk = SKINS[look.skin];
    if (sk && sk.fonts && !document.getElementById("font-" + look.skin)) {
      const l = document.createElement("link"); l.id = "font-" + look.skin; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?" + sk.fonts + "&display=swap"; document.head.appendChild(l);
    }
    try { localStorage.setItem("trening-look", JSON.stringify(look)); } catch { }
    syncThemeColor();
  }
  // pasek stanu i nawigacji telefonu w kolorze tła aplikacji (zamiast białych pasów)
  function syncThemeColor() {
    try {
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      if (!bg) return;
      document.documentElement.style.background = bg;
      // jeden znacznik theme-color, w <head> (tam czyta go przeglądarka)
      document.querySelectorAll('meta[name="theme-color"]').forEach((x) => { if (x.parentNode !== document.head) x.remove(); });
      let m = document.head.querySelector('meta[name="theme-color"]');
      if (!m) { m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); }
      m.content = bg;
      // wersja instalowana: manifest w kolorze stylu (z niego Android bierze kolor dolnego paska)
      const ml = document.head.querySelector('link[rel="manifest"]');
      if (ml) {
        const map = { "#0a0a0b": "manifest-pomost.webmanifest", "#0e1116": "manifest-dark.webmanifest", "#f2f3ee": "manifest-notes.webmanifest" };
        const want = map[bg.toLowerCase()] || "manifest.webmanifest";
        if (!ml.getAttribute("href").endsWith(want)) ml.setAttribute("href", want);
      }
    } catch { }
  }
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeColor); } catch { }
  applyLook();
  const ui = { tab: "train", planId: null, blockId: null, wi: 0, ex: null, showUnused: false, search: "", ready: false, pos: {} };

  // ---------------------------------------------------------------- zapis danych
  const Store = {
    mode: "loading", db: null, cacheKey: "trening-app-v1", sync: "", pending: new Map(), gotMeta: false, gotBlocks: false,
    loadCache() { try { const raw = localStorage.getItem(this.cacheKey); return raw ? JSON.parse(raw) : null; } catch { return null; } },
    saveCache() {
      clearTimeout(this._ct);
      this._ct = setTimeout(() => { try { localStorage.setItem(this.cacheKey, JSON.stringify(S)); } catch { /* brak miejsca lub zablokowane */ } }, 300);
    },
    metaDoc() { return { v: 1, settings: S.settings, exercises: S.exercises, plans: S.plans, order: S.blocks.map((b) => b.id) }; },
    blockDoc(id) { const b = S.blocks.find((x) => x.id === id); return b ? JSON.parse(JSON.stringify(b)) : null; },
    touchMeta() { this.saveCache(); if (this.mode === "cloud") this.queue("app/meta", () => this.metaDoc()); },
    touchBlock(id) { this.saveCache(); if (this.mode === "cloud") this.queue("blocks/" + id, () => this.blockDoc(id)); },
    queue(path, get) {
      let p = this.pending.get(path);
      if (!p) { p = { timer: 0, inflight: false, dirty: false, fails: 0 }; this.pending.set(path, p); }
      p.get = get; p.dirty = true;
      clearTimeout(p.timer); p.timer = setTimeout(() => this.flush(path), 450);
      this.setSync("saving");
    },
    async flush(path) {
      const p = this.pending.get(path);
      if (!p || p.inflight || !p.dirty) return;
      p.inflight = true; p.dirty = false;
      const data = p.get();
      try {
        if (data == null) await this.db.doc(path).delete(); else await this.db.doc(path).set(data);
        p.fails = 0;
      } catch (err) {
        p.dirty = true; p.fails++;
        const code = err && err.code;
        if (code === "invalid_argument" || code === "quota_exceeded" || code === "revoked" || code === "not_granted") {
          p.dirty = false;
          toast(code === "quota_exceeded" ? "Baza jest pełna — usuń stare bloki i spróbuj ponownie." : "Nie udało się zapisać zmian w chmurze. Zapis na tym urządzeniu działa dalej.");
          this.setSync("err");
        } else {
          setTimeout(() => this.flush(path), Math.min(30000, 1500 * 2 ** p.fails));
          this.setSync("err");
        }
      } finally {
        p.inflight = false;
        if (p.dirty && !p.fails) this.flush(path);
        else if (![...this.pending.values()].some((x) => x.dirty || x.inflight)) this.setSync("ok");
      }
    },
    setSync(s) { this.sync = s; const el = $("#sync"); if (el) el.outerHTML = syncBadge(); },
    isDirty(path) { const p = this.pending.get(path); return !!(p && (p.dirty || p.inflight)); },
    async connect() {
      const cache = this.loadCache();
      if (cache && cache.blocks) { S = E.normalize(cache); pickDefault(); render(); }
      let db = null, user = null;
      try {
        if (window.claude && window.claude.use) [user, db] = await Promise.all([window.claude.use("user"), window.claude.use("db")]);
      } catch { db = null; }
      let owner = false;
      try { owner = user ? await user.isOwner() : false; } catch { owner = false; }
      if (!db || !owner) {
        this.mode = "local"; ui.ready = true; if (!S.blocks.length) pickDefault(); render();
        try { if (!window.claude && navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { }
        return;
      }
      this.db = db; this.mode = "cloud"; this.setSync("ok");
      db.doc("app/meta").onSnapshot((snap) => {
        this.gotMeta = true;
        if (snap.exists && !this.isDirty("app/meta")) {
          const m = snap.data();
          S.settings = { ...E.DEFAULT_SETTINGS, ...(m.settings || {}) };
          S.exercises = JSON.parse(JSON.stringify(m.exercises || {}));
          if (Array.isArray(m.plans) && m.plans.length) S.plans = JSON.parse(JSON.stringify(m.plans));
          S._order = m.order || [];
          E.normalize(S); sortBlocks();
        }
        this.afterSnap();
      }, (err) => this.onSubError(err));
      db.collection("blocks").onSnapshot((qs) => {
        this.gotBlocks = true;
        const fresh = new Map(qs.docs.map((d) => [d.id, d.data()]));
        const out = [];
        for (const [id, data] of fresh) {
          if (this.isDirty("blocks/" + id)) { const local = S.blocks.find((b) => b.id === id); if (local) { out.push(local); continue; } }
          out.push(JSON.parse(JSON.stringify(data)));
        }
        for (const b of S.blocks) if (!fresh.has(b.id) && this.isDirty("blocks/" + b.id)) out.push(b);
        S.blocks = out; E.normalize(S); sortBlocks();
        this.afterSnap();
      }, (err) => this.onSubError(err));
    },
    afterSnap() {
      if (!this.gotMeta || !this.gotBlocks) return;
      const first = !ui.ready; ui.ready = true;
      if (first || !S.blocks.some((b) => b.id === ui.blockId) || !S.plans.some((p) => p.id === ui.planId)) pickDefault();
      this.saveCache();
      if (!sheetOpen()) render(); else render(true);
    },
    onSubError(err) { this.setSync("err"); if (err && err.code === "revoked") { this.mode = "local"; render(); } },
  };
  function sortBlocks() {
    const order = S._order || [];
    S.blocks.sort((a, b) => {
      const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
      if (ia !== -1 && ib !== -1) return ia - ib;
      return (a.start || "").localeCompare(b.start || "");
    });
  }
  function syncBadge() {
    const m = Store.mode, s = Store.sync;
    if (m === "local") return `<span id="sync" class="sync local"><i></i>Zapis tylko na tym urządzeniu</span>`;
    if (m === "loading") return `<span id="sync" class="sync"><i></i>Łączenie…</span>`;
    if (s === "err") return `<span id="sync" class="sync err"><i></i>Brak połączenia — ponawiam zapis</span>`;
    if (s === "saving") return `<span id="sync" class="sync"><i></i>Zapisywanie…</span>`;
    return `<span id="sync" class="sync ok"><i></i>Zapisane na koncie</span>`;
  }

  // ---------------------------------------------------------------- pomocnicze
  const block = () => S.blocks.find((b) => b.id === ui.blockId && b.planId === ui.planId) || null;
  const plan = () => S.plans.find((p) => p.id === ui.planId) || null;
  const planBlocks = (pid = ui.planId) => S.blocks.filter((b) => b.planId === pid);
  const byStartDesc = (a, b) => (b.start || "").localeCompare(a.start || "");
  const lastLogAt = (b) => { let m = ""; for (const w of b.weeks) for (const d of w.days) for (const e of d.entries) if (e.log && e.log.at && e.log.at > m) m = e.log.at; return m; };
  // domyślnie: blok, w którym ostatnio coś zapisano; bez zapisów — najpóźniej zaczynający się
  const byActivityDesc = (a, b) => lastLogAt(b).localeCompare(lastLogAt(a)) || byStartDesc(a, b);
  const planName = (pid) => (S.plans.find((p) => p.id === pid) || {}).name || "";
  const dayClass = (di) => `d${(di % 7) + 1}`;
  // najcięższy single (1 powt.), przy dowolnym RPE; excludeId pomija wpis, który właśnie zapisujemy
  function bestSingle(exId, excludeId) {
    let best = null;
    for (const b of S.blocks) for (const w of b.weeks) for (const d of w.days) for (const e of d.entries) {
      if (e.exId !== exId || e.id === excludeId || !e.log) continue;
      const kg = Number(e.log.kg), reps = e.log.reps != null ? Number(e.log.reps) : E.targetReps(e);
      if (!(kg > 0) || reps !== 1) continue;
      if (!best || kg > best.kg) best = { kg, at: e.log.at || null };
    }
    return best;
  }
  // data (z planu) ostatniego zapisanego wyniku ćwiczenia z RPE
  function lastLoggedAt(exId) {
    let m = null;
    for (const b of S.blocks) for (const w of b.weeks) for (const d of w.days) for (const e of d.entries)
      if (e.exId === exId && e.log && e.log.rpe != null && e.log.at && (!m || e.log.at > m)) m = e.log.at;
    return m;
  }
  const exName = (id) => (S.exercises[id] && S.exercises[id].name) || id;
  function ctxOf(ref) {
    const b = S.blocks.find((x) => x.id === ref.b);
    const w = b && b.weeks[ref.w];
    const d = w && w.days[ref.d];
    const e = d && d.entries[ref.e];
    return { b, w, wi: ref.w, d, di: ref.d, e, ei: ref.e };
  }
  function refAttr(b, wi, di, ei) { return `data-b="${esc(b.id)}" data-w="${wi}" data-d="${di}" data-e="${ei ?? ""}"`; }
  function refFrom(el) { return { b: el.dataset.b, w: +el.dataset.w, d: +el.dataset.d, e: el.dataset.e === "" ? null : +el.dataset.e }; }

  function pickDefault() {
    if (!S.plans.some((p) => p.id === ui.planId)) {
      const latest = [...S.blocks].sort(byActivityDesc)[0];
      ui.planId = latest ? latest.planId : S.plans[0] ? S.plans[0].id : null;
    }
    selectPlanBlock();
    if (!ui.ex) {
      const comp = Object.values(S.exercises).find((x) => x.comp && x.family === "squat") || Object.values(S.exercises).find((x) => x.used);
      ui.ex = comp ? comp.id : null;
    }
  }
  function selectPlanBlock(blockId) {
    const list = planBlocks();
    if (!list.length) { ui.blockId = null; ui.wi = 0; return; }
    if (!blockId) {
      // wracamy tam, gdzie użytkownik skończył w tym treningu (blok i tydzień)
      const p = ui.pos && ui.pos[ui.planId];
      const pb = p && list.find((x) => x.id === p.b);
      if (pb) { ui.blockId = pb.id; ui.wi = Math.min(Math.max(0, p.w | 0), Math.max(0, pb.weeks.length - 1)); return; }
    }
    const b = list.find((x) => x.id === blockId) || [...list].sort(byActivityDesc)[0];
    ui.blockId = b.id;
    let wi = 0;
    b.weeks.forEach((w, i) => { if (w.days.some((d) => d.entries.some((e) => e.log))) wi = i; });
    const w = b.weeks[wi];
    const allDone = w && w.days.every((d) => d.entries.every((e) => e.log));
    if (allDone && b.weeks[wi + 1]) wi++;
    ui.wi = wi;
  }

  function rxText(e) {
    const sets = e.sets || "?";
    const reps = e.reps || "?";
    return `${esc(sets)} × ${esc(reps)}`;
  }
  // seria z dowolnym ciężarem i docelowym RPE = w praktyce seria "na RPE" (bez podpowiedzi z e1RM)
  const freeRpe = (e) => e.type === "kg" && e.value == null && !!e.rpe;
  function rxSub(e) {
    const v = e.value;
    let s = "";
    if (freeRpe(e)) return `@ RPE ${esc(String(e.rpe).replace(".", ","))}`;
    if (e.type === "rpe") s = v != null ? `@ RPE ${F(v)}` : "RPE —";
    else if (e.type === "pct_e1rm") s = v != null ? `${F(v)}% e1RM${e.refEx && S.exercises[e.refEx] ? " " + esc(exName(e.refEx)) : ""}` : "% e1RM —";
    else if (e.type === "pct_max") s = v != null ? `${F(v)}% TM${e.refEx && S.exercises[e.refEx] ? " " + esc(exName(e.refEx)) : ""}` : "% TM —";
    else if (e.type === "pct_top") s = v != null ? `−${F(v)}% z top seta` : "% z top seta —";
    else s = v != null ? (v === 0 ? "masa ciała" : `${F(v, 2)} kg`) : "ciężar dowolny";
    if (e.type !== "rpe" && e.rpe) s += ` · RPE ${esc(String(e.rpe).replace(".", ","))}`;
    return s;
  }

  // flagi skoków e1RM dla wpisów (liczone raz na render)
  let flagCache = null;
  function flaggedEntries() {
    if (flagCache) return flagCache;
    const set = new Map();
    const ids = new Set();
    for (const b of S.blocks) for (const w of b.weeks) for (const d of w.days) for (const e of d.entries) if (e.log) ids.add(e.exId);
    for (const id of ids) {
      for (const s of E.analyze(S, id).sessions) if (s.flagged) set.set(s.top.entryId, s);
    }
    return (flagCache = set);
  }

  // ---------------------------------------------------------------- render
  let rendering = false, renderAgain = false;
  function render(skipSheet) {
    if (rendering) { renderAgain = true; return; }
    rendering = true;
    try { renderNow(skipSheet); } finally { rendering = false; }
    if (renderAgain) { renderAgain = false; setTimeout(() => render(true), 0); }
  }
  function renderNow(skipSheet) {
    flagCache = null;
    if (ui.ready && S.settings.ui == null) { S.settings.ui = S.blocks.length ? "advanced" : "simple"; Store.touchMeta(); }
    const app = $("#app");
    let html = "";
    if (!ui.ready && !S.blocks.length) html = `<div class="stack"><div class="card empty"><div class="big">Wczytywanie</div><p class="muted">Pobieram Twoje bloki treningowe.</p></div></div>`;
    else if (ui.tab === "train") html = viewTrain();
    else if (ui.tab === "progress") html = viewProgress();
    else if (ui.tab === "exercises") html = viewExercises();
    else html = viewMore();
    app.innerHTML = html;
    $$(".tab").forEach((t) => t.setAttribute("aria-current", t.dataset.tab === ui.tab ? "page" : "false"));
    if (ui.tab === "progress") drawChart();
    if (!skipSheet && sheetOpen() && currentSheet && currentSheet.refresh) currentSheet.refresh();
    const bk = block();
    if (bk && ui.planId) ui.pos[ui.planId] = { b: bk.id, w: ui.wi };
    try { localStorage.setItem("trening-ui", JSON.stringify({ tab: ui.tab, ex: ui.ex, planId: ui.planId, pos: ui.pos })); } catch { }
  }

  function viewTrain() {
    const p = plan();
    if (!p) {
      return `<div class="stack"><div class="card empty"><div class="big">Brak treningu</div>
        <p class="muted">Trening to Twój plan: bloki po kilka tygodni. Każdy kolejny tydzień aplikacja zbuduje z poprzedniego według metod progresji.</p>
        <button class="btn primary" data-act="newPlan">Utwórz pierwszy trening</button>
        <button class="btn" data-act="importJson">Wczytaj kopię z pliku</button></div></div>`;
    }
    const b = block();
    if (!b) {
      return `<div class="top"><div class="top-row"><div class="titles"><button class="plan-btn" data-act="plans">${esc(p.name)} <span class="caret">▾</span></button></div><div class="top-meta">${syncBadge()}</div></div></div>
        <div class="stack"><div class="card empty"><div class="big">Pusty trening</div>
        <p class="muted">Dodaj pierwszy blok. Możesz zacząć od zera albo skopiować tydzień z innego treningu.</p>
        <button class="btn primary" data-act="newBlock">Utwórz pierwszy blok</button></div></div>`;
    }
    if (ui.wi >= b.weeks.length) ui.wi = Math.max(0, b.weeks.length - 1);
    const w = b.weeks[ui.wi];
    const dates = b.weeks.flatMap((x) => x.days.map((d) => d.date)).filter(Boolean).sort();
    const range = dates.length ? `${fmtDate(dates[0], false)} – ${fmtDate(dates[dates.length - 1], false)}` : "";
    const chips = b.weeks.map((wk, i) => {
      const done = wk.days.length && wk.days.every((d) => d.entries.length && d.entries.every((e) => e.log));
      return `<button class="chip" aria-pressed="${i === ui.wi}" data-act="week" data-i="${i}">T${i + 1}${done ? '<span class="dot" aria-label="ukończony"></span>' : ""}</button>`;
    }).join("");
    const top = `<div class="top">
      <div class="top-row">
        <div class="titles">
          <button class="plan-btn" data-act="plans" aria-label="Zmień trening">${esc(p.name)} <span class="caret">▾</span></button>
          <button class="block-btn" data-act="blocks" aria-label="Zmień blok">${esc(b.name)}<span class="caret">▾</span></button>
        </div>
        <div class="top-meta">${esc(range)}<br>${syncBadge()}</div>
      </div>
      <div class="weeks" role="toolbar" aria-label="Tygodnie">${chips}
        <button class="chip ghost" data-act="addWeek" aria-label="Dodaj tydzień">+ tydzień</button>
        <button class="chip ghost" data-act="weekMenu" aria-label="Opcje tygodnia">⋯</button>
      </div></div>`;
    const days = w ? w.days.map((d, di) => viewDay(b, ui.wi, d, di)).join("") : "";
    const empty = !w || !w.days.length ? `<div class="card empty"><div class="big">Pusty tydzień</div><button class="btn primary" data-act="addDay">Dodaj dzień</button></div>` : "";
    return top + `<div class="stack">${backupBanner()}${days}${empty}</div>`;
  }

  function viewDay(b, wi, d, di) {
    const total = d.entries.length, done = d.entries.filter((e) => e.log).length;
    const groups = [];
    d.entries.forEach((e, ei) => {
      const g = groups[groups.length - 1];
      if (g && g.exId === e.exId) g.items.push([e, ei]); else groups.push({ exId: e.exId, items: [[e, ei]] });
    });
    const flags = flaggedEntries();
    const body = groups.map((g) => {
      const ex = S.exercises[g.exId] || {};
      const fam = ex.family && ex.family !== "other" ? `<small>${FAMILY[ex.family]}</small>` : "";
      const rows = g.items.map(([e, ei]) => viewEntry(b, wi, d, di, e, ei, flags)).join("");
      return `<div class="exg"><div class="exg-name">${esc(exName(g.exId))}${fam}</div>${rows}</div>`;
    }).join("");
    return `<section class="day ${dayClass(di)}" aria-label="${esc(d.name)}">
      <div class="day-head"><span class="day-title">${esc(d.name)}</span><span class="day-date">${esc(fmtDate(d.date))}</span>
        <span class="day-count">${done}/${total}</span>
        <button class="icon-btn" data-act="dayMenu" ${refAttr(b, wi, di)} aria-label="Opcje dnia">⋯</button></div>
      ${body || `<div class="exg"><p class="muted small">Brak ćwiczeń w tym dniu.</p></div>`}
      <button class="day-add" data-act="addEntry" ${refAttr(b, wi, di)}>+ Dodaj ćwiczenie</button>
    </section>`;
  }

  function viewEntry(b, wi, d, di, e, ei, flags) {
    let right = "";
    if (e.log) {
      const kg = e.log.kg;
      const kgTxt = e.log.kgText ? esc(e.log.kgText) : kg != null ? `${F(kg, 2)} kg` : "—";
      const parts = [];
      if (e.log.rpe != null) parts.push(`RPE ${F(e.log.rpe)}`);
      if (e.log.reps != null) parts.push(`${e.log.reps} powt.`);
      if (Array.isArray(e.log.sets) && e.log.sets.length > 1) parts.push(`${e.log.sets.length} serie`);
      const ev = E.evaluate(S, e) || {};
      let pill = `<span class="pill good">✓ zrobione</span>`;
      if (e.skip) pill = `<span class="pill info">✓ poza e1RM</span>`;
      else if (flags.has(e.id)) pill = `<span class="pill bad">! skok e1RM +${Math.round(flags.get(e.id).change * 100)}%</span>`;
      else if (ev.over) pill = `<span class="pill warn">RPE +${F(ev.over)} ponad plan</span>`;
      else if (ev.under) pill = `<span class="pill info">lżej o ${F(ev.under)} RPE</span>`;
      right = `<div class="res"><span class="res-kg num">${kgTxt}</span><span class="res-sub">${parts.join(" · ")}</span>${pill}</div>`;
    } else {
      const s = E.suggest(S, { b, wi, d, di, e });
      if (s && s.kg != null) right = `<div class="res"><span class="res-kg sug num">${s.src === "manual" ? "" : "≈ "}${F(s.kg, 2)} kg</span>${s.lo != null && s.lo !== s.hi ? `<span class="res-sub">${F(s.lo, 2)}–${F(s.hi, 2)}</span>` : ""}</div>`;
      else right = `<div class="res"><span class="res-kg none">dobierz ciężar</span></div>`;
    }
    const note = e.log && e.log.note ? `<div class="note-line">„${esc(e.log.note)}”</div>` : e.note ? `<div class="note-line">${esc(e.note)}</div>` : "";
    return `<button class="entry" data-act="log" ${refAttr(b, wi, di, ei)}>
      <div class="rx"><div class="rx-main">${rxText(e)}</div><div class="rx-sub">${rxSub(e)}</div></div>${right}</button>${note}`;
  }

  // ---------------------------------------------------------------- Postęp
  function usedExercises() {
    const counts = new Map();
    for (const b of S.blocks) for (const w of b.weeks) for (const d of w.days) for (const e of d.entries) if (e.log) counts.set(e.exId, (counts.get(e.exId) || 0) + 1);
    return counts;
  }
  function viewProgress() {
    const counts = usedExercises();
    const list = Object.values(S.exercises).filter((x) => counts.has(x.id) && !x.bw);
    if (!list.length) return `<div class="stack"><h2 class="h2">Postęp</h2><div class="card empty"><div class="big">Brak wyników</div><p class="muted">Zapisz pierwsze serie, a tu pojawi się e1RM i jego trend.</p></div></div>`;
    if (!ui.ex || !list.some((x) => x.id === ui.ex)) ui.ex = list[0].id;
    const order = ["squat", "bench", "deadlift", "other"];
    const opts = order.map((f) => {
      const items = list.filter((x) => x.family === f).sort((a, b) => (b.comp - a.comp) || a.name.localeCompare(b.name));
      if (!items.length) return "";
      return `<optgroup label="${FAMILY[f]}">${items.map((x) => `<option value="${esc(x.id)}" ${x.id === ui.ex ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</optgroup>`;
    }).join("");
    const ex = S.exercises[ui.ex];
    const a = E.analyze(S, ui.ex);
    const cur = a.current;
    const set = S.settings;
    // zmiana w 4 tygodnie
    let delta = null;
    if (cur && cur.lastDate) {
      const ref = E.addDays(cur.lastDate, -27);
      const past = E.currentE1rm(S, ui.ex, ref);
      if (past && !past.low) delta = cur.value / past.value - 1;
    }
    const sessions = a.sessions.slice().reverse();
    const flaggedCount = a.sessions.filter((s) => s.flagged).length;
    const sessHtml = sessions.slice(0, ui.allSess ? 999 : 10).map((s) => {
      const t = s.top;
      const tag = s.skipped ? `<span class="pill info">poza e1RM</span>` : s.flagged ? `<span class="pill bad">! skok +${Math.round(s.change * 100)}%</span>` : !s.reliable ? `<span class="pill info">niskie RPE</span>` : "";
      const conf = s.flagged ? `<button class="btn link" data-act="confirmSession" data-entry="${esc(t.entryId)}">To prawdziwy wynik — wlicz</button>` : "";
      return `<div class="sess"><div><div><b>${esc(fmtDate(s.date))}</b> <span class="muted small">${S.plans.length > 1 ? esc(planName((S.blocks.find((x) => x.id === s.blockId) || {}).planId)) + " · " : ""}${esc(s.blockName)} · T${s.wi + 1} · ${esc(s.dayName)}</span></div>
        <div class="small">${F(t.kg, 2)} kg × ${t.reps} @ RPE ${F(t.rpe)} ${tag}</div>${conf}</div>
        <div class="num" style="font-size:1.375rem;font-weight:700">${F(s.value)}</div></div>`;
    }).join("");
    const fam = ex.family;
    const multi = S.plans.length > 1;
    const weeks = E.weeklyByFamily(S, fam, multi ? ui.planId : null).reverse();
    const weekRows = weeks.slice(0, 16).map((r) => `<tr><td>${esc(r.blockName.replace("Blok ", "B"))} T${r.wi + 1} <span class="muted">${esc(fmtDate(r.start, false))}</span></td>
      <td>${r.sets}</td><td>${Math.round(r.reps)}</td><td>${F(r.volume / 1000, 1)}</td><td>${r.top ? F(r.top) : "–"}</td></tr>`).join("");
    return `<div class="stack">
      <h2 class="h2">Postęp</h2>
      <label class="field"><span>Ćwiczenie</span><select class="input" id="f-progress-ex" data-change="progressEx">${opts}</select></label>
      <div class="card">
        <div class="hero"><span class="label">Bieżący e1RM</span>
          <span class="hero-num">${cur ? F(cur.value) : "–"}<small>kg</small></span>
          <span class="small muted">${cur ? (cur.low ? "Mało pewne: tylko serie z niskim RPE." : `Średnia z ${Math.min(set.sessions, cur.from.length)} ostatnich sesji · serie RPE ≥ ${F(set.minRpe)}, do ${set.maxReps} powt.`) : "Brak serii, z których da się policzyć e1RM."}</span>
        </div>
        <div class="kpis">
          <div class="kpi"><div class="label">Najlepszy</div><div class="v">${a.best ? F(a.best.value) : "–"}</div><div class="small muted">${a.best ? esc(fmtDate(a.best.date)) : ""}</div></div>
          <div class="kpi"><div class="label">Zmiana 4 tyg.</div><div class="v" style="color:${delta == null ? "inherit" : delta >= 0 ? "var(--good)" : "var(--bad)"}">${delta == null ? "–" : (delta >= 0 ? "+" : "−") + F(Math.abs(delta) * 100) + "%"}</div><div class="small muted">względem e1RM sprzed 4 tygodni</div></div>
        </div>
        ${adv() && E.baseTm(S, ui.planId, ui.ex) ? `<p class="small muted" style="margin:10px 0 0">Training max (TM) w tym treningu: <b>${F(E.baseTm(S, ui.planId, ui.ex), 2)} kg</b> (do serii na % TM).</p>` : ""}${(() => { const pr = bestSingle(ui.ex); return pr ? `<p class="small muted" style="margin:6px 0 0">Rekord (najcięższy single): <b>${F(pr.kg, 2)} kg</b>${pr.at ? " · " + esc(fmtDate(pr.at, false)) : ""}.</p>` : ""; })()}
        <div class="chart-wrap" id="chart"></div>
        <div class="legend"><span><i style="background:var(--accent)"></i>e1RM sesji</span><span><i style="border:2px solid var(--muted);background:transparent"></i>niskie RPE lub pominięty (niewliczone)</span><span><i style="border:2px solid var(--bad);background:transparent"></i>podejrzany skok</span><span><i style="background:none;border-top:2px dashed var(--ink-2);border-radius:0;height:0;width:.875rem"></i>bieżący e1RM</span></div>
      </div>
      ${(() => {
        const items = [];
        for (const b of S.blocks) b.weeks.forEach((w, wi) => w.days.forEach((d, di) => d.entries.forEach((e, ei) => {
          if (e.exId === ui.ex && e.log && e.log.rpe == null && Number(e.log.kg) > 0 && (e.type === "rpe" || e.rpe)) items.push({ b, wi, d, di, ei, e, date: e.log.at || d.date || "" });
        })));
        if (!items.length) return "";
        items.sort((x, y) => y.date.localeCompare(x.date));
        const multi = S.plans.length > 1;
        const list = items.slice(0, 8).map((x) => `<button class="list-row" data-act="gotoEntry" ${refAttr(x.b, x.wi, x.di, x.ei)}><div><div class="t">${esc(fmtDate(x.date))} · ${F(Number(x.e.log.kg), 2)} kg × ${x.e.log.reps != null ? x.e.log.reps : esc(x.e.reps || "?")}</div><div class="s">${multi ? esc(planName(x.b.planId)) + " · " : ""}${esc(x.b.name)} · T${x.wi + 1} · ${esc(x.d.name)}</div></div><span class="muted">Uzupełnij ›</span></button>`).join("");
        return `<div class="banner warn" style="display:grid;gap:8px"><div>${items.length} ${items.length === 1 ? "zapisana seria nie ma" : "zapisanych serii nie ma"} RPE. Bez RPE nie da się policzyć e1RM, więc te wyniki nie trafiają na wykres ani do sugestii na kolejne tygodnie. Kliknij serię, żeby od razu uzupełnić RPE.</div>
          <div>${list}</div>${items.length > 8 ? `<div class="small">…i jeszcze ${items.length - 8}.</div>` : ""}</div>`;
      })()}
      ${flaggedCount ? `<div class="banner bad">Masz ${flaggedCount} ${flaggedCount === 1 ? "wynik oznaczony" : "wyniki oznaczone"} jako skok e1RM powyżej ${Math.round(set.jump * 100)}%. Nie liczą się do bieżącego e1RM, dopóki ich nie potwierdzisz albo kolejna sesja nie pokaże podobnego poziomu.</div>` : ""}
      <div class="card"><div class="label" style="margin-bottom:4px">Sesje</div>${sessHtml || '<p class="muted small">Brak sesji.</p>'}
        ${sessions.length > 10 ? `<button class="btn link" data-act="allSess">${ui.allSess ? "Pokaż mniej" : `Pokaż wszystkie (${sessions.length})`}</button>` : ""}</div>
      <div class="card"><div class="label" style="margin-bottom:6px">Tygodnie · ${FAMILY[fam]}${fam === "other" ? "" : " (wszystkie warianty)"}${multi ? ` · ${esc(planName(ui.planId))}` : ""}</div>
        <div class="table-wrap"><table><thead><tr><th>Tydzień</th><th>Serie</th><th>Powt.</th><th>Tonaż t</th><th>Top e1RM</th></tr></thead><tbody>${weekRows || '<tr><td colspan="5" class="muted">Brak danych</td></tr>'}</tbody></table></div>
      </div>
    </div>`;
  }

  function drawChart() {
    const host = $("#chart");
    if (!host || !ui.ex) return;
    const a = E.analyze(S, ui.ex);
    const pts = a.sessions.filter((s) => s.date);
    if (pts.length < 2) { host.innerHTML = `<p class="muted small">Za mało sesji na wykres.</p>`; return; }
    const k = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
    const W = Math.max(280, host.clientWidth || 320), H = Math.round(220 * k);
    const m = { l: 40 * k, r: 12, t: 22 * k, b: 26 * k };
    const t0 = Date.parse(pts[0].date), t1 = Date.parse(pts[pts.length - 1].date);
    const vals = pts.map((p) => p.value);
    if (a.current) vals.push(a.current.value);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = Math.max(2, (hi - lo) * 0.08); lo -= pad; hi += pad;
    const stepY = niceStep((hi - lo) / 4);
    lo = Math.floor(lo / stepY) * stepY; hi = Math.ceil(hi / stepY) * stepY;
    const x = (iso) => m.l + ((Date.parse(iso) - t0) / Math.max(1, t1 - t0)) * (W - m.l - m.r);
    const y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
    let g = "";
    for (let v = lo; v <= hi + 1e-9; v += stepY) {
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/>`;
      g += `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="${11 * k}" fill="var(--muted)">${Math.round(v)}</text>`;
    }
    // granice bloków
    const seen = new Set();
    for (const p of pts) {
      if (seen.has(p.blockId)) continue; seen.add(p.blockId);
      const bx = x(p.date);
      g += `<line x1="${bx}" x2="${bx}" y1="${m.t - 6}" y2="${H - m.b}" stroke="var(--line)" stroke-dasharray="2 3"/>`;
      g += `<text x="${bx + 3}" y="${m.t - 9}" font-size="${10.5 * k}" fill="var(--muted)">${esc(p.blockName.replace("Blok ", "B"))}</text>`;
    }
    const inc = pts.filter((p) => p.reliable && !p.flagged && !p.skipped);
    const line = inc.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
    const area = inc.length ? `${line} L${x(inc[inc.length - 1].date).toFixed(1)},${H - m.b} L${x(inc[0].date).toFixed(1)},${H - m.b} Z` : "";
    if (area) g += `<path d="${area}" fill="var(--accent)" opacity=".08"/>`;
    if (line) g += `<path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (a.current) {
      const cy = y(a.current.value);
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${cy}" y2="${cy}" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    }
    pts.forEach((p, i) => {
      const cx = x(p.date), cy = y(p.value);
      if (p.flagged) g += `<circle cx="${cx}" cy="${cy}" r="5.5" fill="var(--surface)" stroke="var(--bad)" stroke-width="2"/>`;
      else if (!p.reliable || p.skipped) g += `<circle cx="${cx}" cy="${cy}" r="4" fill="var(--surface)" stroke="var(--muted)" stroke-width="1.5"/>`;
      else g += `<circle cx="${cx}" cy="${cy}" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`;
    });
    const last = inc[inc.length - 1];
    if (last) g += `<circle cx="${x(last.date)}" cy="${y(last.value)}" r="6" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`;
    g += `<line id="xh" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}" stroke="var(--ink-2)" stroke-width="1" visibility="hidden"/>`;
    g += `<text x="${m.l}" y="${H - 6}" font-size="${11 * k}" fill="var(--muted)">${esc(fmtDate(pts[0].date, false))}</text><text x="${W - m.r}" y="${H - 6}" text-anchor="end" font-size="${11 * k}" fill="var(--muted)">${esc(fmtDate(pts[pts.length - 1].date, false))}</text>`;
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Wykres e1RM w czasie">${g}<rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent" id="hit"/></svg><div class="chart-tip" id="tip" hidden></div>`;
    const svg = host.querySelector("svg"), tip = $("#tip", host), xh = $("#xh", host);
    const show = (clientX) => {
      const r = svg.getBoundingClientRect();
      const px = (clientX - r.left) * (W / r.width);
      let best = pts[0], bd = Infinity;
      for (const p of pts) { const d = Math.abs(x(p.date) - px); if (d < bd) { bd = d; best = p; } }
      const cx = x(best.date);
      xh.setAttribute("x1", cx); xh.setAttribute("x2", cx); xh.setAttribute("visibility", "visible");
      const t = best.top;
      tip.innerHTML = `<b>${F(best.value)} kg</b> e1RM<br>${esc(fmtDate(best.date))} · ${esc(best.blockName)} T${best.wi + 1}<br>${F(t.kg, 2)} kg × ${t.reps} @ ${F(t.rpe)}${best.skipped ? "<br>pominięty — nie liczy się do e1RM" : best.flagged ? "<br>podejrzany skok" : !best.reliable ? "<br>niskie RPE — niewliczone" : ""}`;
      tip.hidden = false;
      const left = Math.min(r.width - tip.offsetWidth, Math.max(0, cx * (r.width / W) - tip.offsetWidth / 2));
      tip.style.left = left + "px"; tip.style.top = Math.max(0, y(best.value) * (r.height / H) - tip.offsetHeight - 12) + "px";
    };
    svg.addEventListener("pointermove", (ev) => show(ev.clientX));
    svg.addEventListener("pointerdown", (ev) => show(ev.clientX));
    svg.addEventListener("pointerleave", () => { tip.hidden = true; xh.setAttribute("visibility", "hidden"); });
  }
  function niceStep(raw) {
    const p = 10 ** Math.floor(Math.log10(Math.max(raw, 0.1)));
    for (const k of [1, 2, 2.5, 5, 10]) if (raw <= k * p) return k * p;
    return 10 * p;
  }

  // ---------------------------------------------------------------- Ćwiczenia
  function viewExercises() {
    const counts = usedExercises();
    const inPlan = new Set();
    for (const b of S.blocks) for (const w of b.weeks) for (const d of w.days) for (const e of d.entries) inPlan.add(e.exId);
    const q = ui.search.trim().toLowerCase();
    const all = Object.values(S.exercises).filter((x) => (ui.showUnused || inPlan.has(x.id) || counts.has(x.id)) && (!q || x.name.toLowerCase().includes(q)));
    const order = ["squat", "bench", "deadlift", "other"];
    const groups = order.map((f) => {
      const items = all.filter((x) => x.family === f).sort((a, b) => (b.comp - a.comp) || a.name.localeCompare(b.name));
      if (!items.length) return "";
      const rows = items.map((x) => {
        const cur = x.bw ? null : E.analyze(S, x.id).current;
        const right = cur ? `<div class="num" style="font-size:1.25rem;font-weight:700">${F(cur.value)}</div>` : `<div class="muted small">${x.bw ? "masa ciała" : "–"}</div>`;
        const sub = [counts.get(x.id) ? `${counts.get(x.id)} wpisów` : "bez wyników", x.max ? `TM ${F(x.max, 2)} kg` : ""].filter(Boolean).join(" · ");
        return `<button class="list-row" data-act="editExercise" data-id="${esc(x.id)}"><div><div class="t">${esc(x.name)}</div><div class="s">${esc(sub)}</div></div>${right}</button>`;
      }).join("");
      return `<div class="card"><div class="label">${FAMILY[f]} · ${items.length}</div>${rows}</div>`;
    }).join("");
    return `<div class="stack">
      <h2 class="h2">Ćwiczenia</h2>
      <input class="input" id="f-search" type="search" placeholder="Szukaj ćwiczenia" value="${esc(ui.search)}" data-input="search" aria-label="Szukaj ćwiczenia">
      <label class="check"><input type="checkbox" id="f-unused" data-change="unused" ${ui.showUnused ? "checked" : ""}> Pokaż też ćwiczenia z biblioteki, których nie ma w planie</label>
      ${adv() && plan() ? `<button class="btn" data-act="bases">Training max (TM) · ${esc(plan().name)}</button>` : ""}
      <p class="small muted" style="margin:0">Liczba po prawej to bieżący e1RM. Rodzina decyduje, gdzie ćwiczenie liczy się w podsumowaniach tygodni.</p>
      ${groups || '<div class="card empty"><p class="muted">Nic nie znaleziono.</p></div>'}
      <button class="btn" data-act="editExercise" data-id="">+ Nowe ćwiczenie</button>
    </div>`;
  }

  // ---------------------------------------------------------------- Więcej
  function viewMore() {
    const s = S.settings;
    const stepOpts = [2.5, 1.25, 1, 0.5].map((v) => `<option value="${v}" ${s.step === v ? "selected" : ""}>${F(v, 2)} kg</option>`).join("");
    const sizes = SIZES.map((z) => `<button data-act="lookScale" data-v="${z.v}" aria-pressed="${look.scale === z.v}"><span class="size-sample"><span style="font-size:${0.8 * z.v}rem">A</span><span style="font-size:${1.1 * z.v}rem">a</span></span>${z.name}</button>`).join("");
    const skins = Object.entries(SKINS).map(([id, k]) => `<button class="look-opt" data-act="lookSkin" data-v="${id}" aria-pressed="${look.skin === id}">
      <span class="swatch">${k.sw.map((c) => `<i style="background:${c}"></i>`).join("")}</span><span><b>${k.name}</b><span>${k.desc}</span></span></button>`).join("");
    return `<div class="stack">
      <h2 class="h2">Więcej</h2>
      <div class="card" style="display:grid;gap:10px"><div class="label">Widok</div>
        <div class="seg" role="group" aria-label="Widok aplikacji"><button data-act="uiMode" data-v="simple" aria-pressed="${!adv()}">Prosty</button><button data-act="uiMode" data-v="advanced" aria-pressed="${adv()}">Zaawansowany</button></div>
        <p class="small muted" style="margin:0">${adv() ? "Wszystkie narzędzia: % Training maxa, % e1RM, serie z top seta, progresje, Training max, eksport do arkusza i dla AI, ustawienia obliczeń." : "Plan, zapis wyników z podpowiedzią ciężaru i postęp. Plany na RPE i kilogramach. Narzędzia dla zaawansowanych (Training max, procenty, progresje, eksporty) włączysz w widoku zaawansowanym."}</p></div>
      <div class="card" style="display:grid;gap:12px"><div class="label">Wygląd na tym urządzeniu</div>
        <div class="field"><span>Rozmiar interfejsu</span><div class="seg seg-size" role="group" aria-label="Rozmiar interfejsu">${sizes}</div></div>
        <div class="field"><span>Styl</span><div class="look-grid">${skins}</div></div></div>
      <div class="card" style="display:grid;gap:8px"><div class="label">Zapis</div>${syncBadge()}
        <label class="check"><input type="checkbox" data-change="settingBool" data-key="perSet" ${s.perSet ? "checked" : ""}> Zapisuj każdą serię osobno (ćwiczenia z kilkoma seriami)</label>
        <p class="small muted" style="margin:0">Domyślnie zapisujesz tylko ostatnią serię — to wystarcza do e1RM i sugestii. Włącz, jeśli chcesz mieć w dzienniku każdą serię z ciężarem, powtórzeniami i RPE.</p>
        <p class="small muted" style="margin:0">${Store.mode === "cloud" ? "Dane są na Twoim koncie Claude, więc to samo zobaczysz na telefonie i na komputerze. Kopia na tym urządzeniu pozwala otworzyć aplikację od razu." : "Ta przeglądarka trzyma dane tylko u siebie. Zrób kopię zapasową, zanim wyczyścisz dane przeglądarki."}</p></div>
      ${adv() ? `<div class="card" style="display:grid;gap:12px"><div class="label">Obliczenia</div>
        <div class="row2">
          <label class="field"><span>Krok obciążenia (zaokrąglanie w dół)</span><select class="input" id="s-step" data-change="setting" data-key="step">${stepOpts}</select></label>
          <label class="field"><span>Gryf (talerze)</span><input class="input" id="s-bar" inputmode="decimal" value="${F(s.bar, 2)}" data-change="setting" data-key="bar"></label>
          <label class="field"><span>e1RM od RPE</span><input class="input" id="s-minRpe" inputmode="decimal" value="${F(s.minRpe)}" data-change="setting" data-key="minRpe"></label>
          <label class="field"><span>e1RM do powt.</span><input class="input" id="s-maxReps" inputmode="numeric" value="${s.maxReps}" data-change="setting" data-key="maxReps"></label>
          <label class="field"><span>Średnia z sesji</span><input class="input" id="s-sessions" inputmode="numeric" value="${s.sessions}" data-change="setting" data-key="sessions"></label>
          <label class="field"><span>Próg skoku e1RM %</span><input class="input" id="s-jump" inputmode="decimal" value="${F(s.jump * 100)}" data-change="setting" data-key="jump"></label>
          <label class="field"><span>Ostrzeżenie RPE ponad plan</span><input class="input" id="s-over" inputmode="decimal" value="${F(s.overshoot)}" data-change="setting" data-key="overshoot"></label>
        </div>
        ${CALC_KEYS.some((k) => S.settings[k] !== E.DEFAULT_SETTINGS[k]) ? `<div class="btn-row"><button class="btn" data-act="resetCalc">Przywróć domyślne</button></div>
        <p class="small muted" style="margin:-4px 0 0">Domyślnie: krok ${F(E.DEFAULT_SETTINGS.step, 2)} kg, gryf ${E.DEFAULT_SETTINGS.bar} kg, e1RM od RPE ${F(E.DEFAULT_SETTINGS.minRpe)} i do ${E.DEFAULT_SETTINGS.maxReps} powt., średnia z ${E.DEFAULT_SETTINGS.sessions} sesji, próg skoku ${F(E.DEFAULT_SETTINGS.jump * 100)}%, ostrzeżenie RPE +${F(E.DEFAULT_SETTINGS.overshoot)}.</p>` : `<p class="small muted" style="margin:0">Ustawienia domyślne.</p>`}
      </div>
      <div class="card" style="display:grid;gap:12px"><div class="label">Eksport</div>
        ${S.plans.length > 1 ? `<label class="field"><span>Trening</span><select class="input" id="tx-plan">${S.plans.map((x) => `<option value="${esc(x.id)}" ${x.id === ui.planId ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>` : ""}
        <div class="field"><span>Arkusz kalkulacyjny (XLSX)</span>
          <span class="small muted">Cały plan z wynikami: zakładka TM i osobna zakładka na każdy blok. Otwiera się w Excelu, Google Sheets i LibreOffice.</span>
          <label class="check"><input type="checkbox" id="xl-formulas" checked> Z formułami: zmiana TM w zakładce TM przelicza ciężary</label>
          <div class="btn-row"><button class="btn" data-act="exportXlsx">Pobierz XLSX</button></div></div>
        <div class="field"><span>Plik dla czatu z AI</span>
          <span class="small muted">Plan i wyniki jako tekst z tabelami (Markdown), który czatbot czyta bez problemu. Wklej go i zadaj własne pytanie.</span>
          <label class="check"><input type="checkbox" id="tx-future"> Dołącz wszystkie przyszłe tygodnie (sam plan)</label>
          <div class="btn-row"><button class="btn" data-act="exportTrainer" data-v="copy">Kopiuj tekst</button><button class="btn" data-act="exportTrainer" data-v="file">Pobierz plik</button></div></div></div>` : ""}
      <div class="card" style="display:grid;gap:10px"><div class="label">Kopia zapasowa</div>
        <p class="small muted" style="margin:0">Plik JSON z całym planem, wynikami i ćwiczeniami. Przyda się też przy przenosinach do przyszłej aplikacji na telefon.</p>
        <div class="btn-row"><button class="btn" data-act="exportJson">Pobierz kopię</button><button class="btn" data-act="importJson">Wczytaj kopię</button></div></div>
      <div class="card" style="display:grid;gap:10px"><div class="label">O aplikacji</div>
        <p class="small" style="margin:0">Dziennik treningu siłowego dla trójboistów: prowadzisz plan od trenera (RPE, % Training maxa, serie z top seta), a aplikacja podpowiada ciężary i liczy e1RM.</p>
        <p class="small muted" style="margin:0">${Store.mode === "cloud" ? "W tej wersji dane są na Twoim koncie Claude." : "Twoje dane nie opuszczają tego urządzenia: nie ma kont ani serwera. Dlatego rób kopie zapasowe."} Aplikacja nie zastępuje trenera ani lekarza — ciężary to podpowiedzi, a decyzja na treningu należy do Ciebie.</p>
        <p class="small muted" style="margin:0">Wersja ${esc(APP_VERSION)}</p>
        ${FEEDBACK_URL ? `<div class="btn-row"><a class="btn" href="${esc(FEEDBACK_URL)}" target="_blank" rel="noopener">Zgłoś błąd albo pomysł</a></div>` : ""}</div>
      <div class="card"><details><summary>Jak aplikacja liczy</summary>
        <ul>
          <li><b>e1RM serii</b> = ciężar ÷ procent z tabeli RPE (Tuchscherer) dla liczby powtórzeń i RPE ostatniej serii.</li>
          <li><b>Bieżący e1RM</b> = średnia najlepszych e1RM z ${s.sessions} ostatnich sesji, tylko z serii o RPE ≥ ${F(s.minRpe)} i do ${s.maxReps} powtórzeń. Gdy takich nie ma, aplikacja bierze serie z niższym RPE i oznacza wynik jako mało pewny.</li>
          <li><b>Podejrzany skok</b>: sesja wyższa o ponad ${F(s.jump * 100)}% od bieżącego e1RM nie liczy się, dopóki jej nie potwierdzisz albo następna sesja nie pokaże podobnego poziomu.</li>
          <li><b>Sugestia na RPE</b> = bieżący e1RM × procent z tabeli dla zadanych powtórzeń i RPE. Zakres pod sugestią to ciężar na RPE o 1 punkt niżej (gorszy dzień) i wyżej (dobry dzień). Dojście do ciężaru podpowiada serie rozgrzewkowe; ostatnia, na ok. 93%, pokazuje, jaki to dzień.</li>
          <li><b>% e1RM</b> liczy się z bieżącego e1RM, <b>% TM</b> z Training maxu (TM), czyli bazy wpisanej przez Ciebie w ustawieniach treningu (a gdy jej brak, przy ćwiczeniu). TM to nie rekord ani e1RM: zwykle 85–90% rekordu, ustalasz go sam. Rekord to najcięższy single, przy dowolnym RPE. Wszystkie sugestie zaokrąglają się w dół do kroku obciążenia.</li>
          <li>Sugestia zamraża się w chwili zapisu wyniku, więc późniejsze treningi nie zmieniają przeszłości.</li>
          <li><b>Double progression</b>: gdy ostatnia seria dojdzie do górnej granicy powtórzeń przy RPE nie wyższym niż zadane, następny tydzień dostaje +krok kg. W przeciwnym razie ciężar zostaje.</li>
          <li><b>Liniowa</b>: +krok kg, gdy zrobisz zadane powtórzenia przy RPE w normie.</li>
        </ul></details></div>
    </div>`;
  }

  // ---------------------------------------------------------------- arkusze (bottom sheets)
  let currentSheet = null;
  function sheetOpen() { return !!$(".sheet-back"); }
  function openSheet(html, opts = {}) {
    const existing = $(".sheet-back .sheet");
    if (opts.replace && existing) {
      const top = existing.scrollTop;
      existing.innerHTML = `<div class="grab"></div>${html}`;
      existing.scrollTop = top;
      currentSheet = opts;
      if (opts.mount) opts.mount(existing.parentElement);
      return;
    }
    closeSheet(true);
    const back = document.createElement("div");
    back.className = "sheet-back";
    back.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
    back.addEventListener("click", (ev) => { if (ev.target === back) closeSheet(); });
    document.body.appendChild(back);
    swipeToClose(back);
    currentSheet = opts;
    document.body.style.overflow = "hidden";
    const first = back.querySelector("[autofocus]");
    if (first && !matchMedia("(pointer: coarse)").matches) first.focus();
    if (opts.mount) opts.mount(back);
  }
  // przeciągnięcie panelu w dół zamyka go (jak sugeruje pasek na górze); działa, gdy panel jest przewinięty do góry
  function swipeToClose(back) {
    const sh = back.querySelector(".sheet"); if (!sh) return;
    let y0 = null, dy = 0, t0 = 0, dragging = false;
    sh.addEventListener("touchstart", (ev) => {
      if (ev.touches.length !== 1) return;
      const onGrab = ev.target.closest && ev.target.closest(".grab");
      if (!onGrab && sh.scrollTop > 0) return;
      if (!onGrab && ev.target.closest && ev.target.closest("input, textarea, select")) return;
      y0 = ev.touches[0].clientY; dy = 0; t0 = Date.now(); dragging = false;
    }, { passive: true });
    sh.addEventListener("touchmove", (ev) => {
      if (y0 == null) return;
      dy = ev.touches[0].clientY - y0;
      if (!dragging && dy > 8 && sh.scrollTop <= 0) { dragging = true; sh.style.transition = "none"; }
      if (dragging) { ev.preventDefault(); sh.style.transform = `translateY(${Math.max(0, dy - 8)}px)`; }
      else if (dy < 0) y0 = null; // ruch w górę = zwykłe przewijanie
    }, { passive: false });
    const end = () => {
      if (y0 == null) return;
      y0 = null;
      if (!dragging) return;
      dragging = false;
      const fast = dy > 40 && Date.now() - t0 < 250;
      sh.style.transition = "transform .18s ease-out";
      if (dy > Math.min(140, sh.offsetHeight * 0.25) || fast) { sh.style.transform = "translateY(100%)"; setTimeout(() => closeSheet(), 170); }
      else sh.style.transform = "";
    };
    sh.addEventListener("touchend", end);
    sh.addEventListener("touchcancel", end);
  }
  function closeSheet(silent) {
    const el = $(".sheet-back");
    if (el) el.remove();
    currentSheet = null;
    document.body.style.overflow = "";
    if (!silent) render();
  }
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && sheetOpen()) closeSheet(); });

  let toastTimer = 0;
  function toast(msg) {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 3200);
  }

  // ---- zapis wyniku
  // widełki dnia: pasek od gorszego do lepszego dnia, kropka = sugestia
  function rangeHtml(sug) {
    if (!sug || sug.src === "frozen" || sug.lo == null || sug.hi == null || !(sug.hi > sug.lo)) return "";
    const pos = Math.max(0, Math.min(100, ((sug.kg - sug.lo) / (sug.hi - sug.lo)) * 100));
    return `<div class="sugrange" aria-label="Zakres na dzień od ${F(sug.lo, 2)} do ${F(sug.hi, 2)} kg">
        <span class="num">${F(sug.lo, 2)}</span><span class="bar"><i style="left:${pos.toFixed(1)}%"></i></span><span class="num">${F(sug.hi, 2)}</span>
      </div>
      <div class="sugrange-lab small muted"><span>gorszy dzień</span><span>dobry dzień</span></div>`;
  }
  // Kroki rozgrzewki do celu T: pusty gryf, potem równe skoki do ok. 93% T.
  // Skok ok. 20% celu, ale nie mniej niż 10 kg i nie więcej niż 25 kg (wyciskanie) / 40 kg (przysiad, martwy),
  // więc im cięższy cel, tym więcej podejść (np. 100 kg: 5 podejść, 400 kg: 10). Powtórzenia maleją z ciężarem.
  function workUpSteps(T, reps, family, step, bar) {
    const cap = family === "squat" || family === "deadlift" ? 40 : 25;
    const jump = Math.min(cap, Math.max(10, T * 0.2));
    const last = T * 0.93, first = Math.max(bar, Math.min(T * 0.45, 60));
    const n = Math.max(1, Math.ceil((last - first) / jump));
    // powtórzenia zależą od % celu, nie od powtórzeń top seta: gryf i pierwsze lekkie podejście po 5, potem 3 › 2 › 1
    const repsAt = (p, i) => (i === 0 && p < 0.6 ? 5 : p < 0.7 ? 3 : p < 0.85 ? 2 : 1);
    const out = [];
    if (T >= 60) out.push({ kg: bar, r: 5, bar: true });
    for (let i = 0; i <= n; i++) {
      const kg = E.roundTo(first + ((last - first) * i) / n, step);
      if (kg <= bar || kg >= T || out.some((x) => x.kg === kg)) continue;
      out.push({ kg, r: repsAt(kg / T, out.filter((x) => !x.bar).length) });
    }
    return out;
  }
  // dojście do top seta: kilka podejść, ostatnie (ok. 93%) to sprawdzian dnia
  function workUpHtml(c, sug) {
    const e = c.e;
    if (!sug || e.log || e.type !== "rpe" || sug.src === "frozen" || !(sug.kg >= 40)) return "";
    if ((S.exercises[e.exId] || {}).bw) return "";
    if (c.d.entries.findIndex((x) => x.exId === e.exId) !== c.d.entries.indexOf(e)) return ""; // tylko pierwsza seria ćwiczenia w dniu (top set)
    const step = S.settings.step || 2.5, bar = Number(S.settings.bar) || 20;
    const reps = E.targetReps(e) || 1;
    const out = workUpSteps(sug.kg, reps, (S.exercises[e.exId] || {}).family, step, bar);
    if (!out.length) return "";
    const pill = (kg, r, top, isBar) => `<span class="wu${top ? " wu-goal" : ""}"><b class="num">${isBar ? "gryf" : F(kg, 2)}</b>×${r}</span>`;
    return `<details class="workup"><summary>Dojście do ciężaru · ${out.length} ${out.length < 5 ? "podejścia" : "podejść"}</summary>
        <div class="wu-row">${out.map((x) => pill(x.kg, x.r, false, x.bar)).join('<span class="wu-arr">›</span>')}</div>
        <div class="wu-target"><span class="small muted">Seria robocza</span>${pill(sug.kg, reps, true)}</div>
        <p class="small muted" style="margin:0">Ostatnie podejście to sprawdzian dnia. Idzie ciężej niż zwykle: celuj w dolną granicę. Lekko i szybko: w górną.</p></details>`;
  }
  function sheetLog(ref, replace) {
    const c = ctxOf(ref);
    if (!c.e) return;
    const { b, wi, d, di, e } = c;
    const sug = E.suggest(S, { b, wi, d, di, e });
    const flags = flaggedEntries();
    const r = E.parseReps(e.reps);
    const tgtRpe = e.type === "rpe" ? E.parseRpe(e.value) : E.parseRpe(e.rpe);
    // ciężar startowy w polu
    let kg0 = e.log ? e.log.kg : sug && sug.kg != null ? sug.kg : null;
    if (kg0 == null && !e.log) { const prev = previousLog(c); if (prev) kg0 = prev.kg; }
    const reps0 = e.log && e.log.reps != null ? e.log.reps : r.kind === "fixed" ? r.min : null;
    const rpe0 = e.log ? e.log.rpe : null;
    const rpes = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
    const repChips = r.kind === "range" && r.max - r.min <= 10 ? Array.from({ length: r.max - r.min + 1 }, (_, i) => r.min + i) : null;
    const pl = kg0 ? E.plates(kg0, S.settings.bar) : null;
    const sugHtml = sug && sug.kg != null ? `<div class="sugbox">
        <div class="label">${sug.src === "frozen" ? "Sugestia z dnia zapisu" : "Sugestia"}</div>
        <div><span class="k num">${F(sug.kg, 2)} kg</span></div>
        ${rangeHtml(sug)}
        <div class="small muted">${sug.src === "pct_max" ? `z TM ${F(sug.basis, 2)} kg${sug.refEx && S.exercises[sug.refEx] ? " (" + esc(exName(sug.refEx)) + ")" : ""}` : sug.src === "pct_top" ? `z top seta ${F(sug.basis, 2)} kg` : sug.src === "manual" ? "wpisany ręcznie" : sug.basis ? `z e1RM ${F(sug.basis)} kg${sug.manual ? " (wpisany ręcznie przy ćwiczeniu)" : sug.low ? " (mało pewny — serie z niskim RPE)" : ""}` : sug.src === "kg" ? "ciężar z planu" : ""}</div>
        ${workUpHtml(c, sug)}
      </div>` : sug && sug.note ? `<div class="banner info">Brak sugestii: ${esc(sug.note)}. ${sug.note === "brak TM" ? "Wpisz Training max: zakładka Ćwiczenia → Training max (TM)." : sug.src === "pct_top" ? "Pojawi się po ustaleniu ciężaru top seta (wyżej w tym dniu)." : "Pojawi się po pierwszym zapisanym wyniku z RPE."}</div>` : "";
    const manualKg = e.kgMode === "manual";
    const srcHtml = e.log || (!adv() && !manualKg) ? "" : `<div class="field"><span>Ciężar sugerowany</span>
        <div class="seg" role="group" aria-label="Skąd ciężar sugerowany">
          <button data-act="srcMode" data-v="auto" ${refAttr(b, wi, di, ref.e)} aria-pressed="${!manualKg}">Z planu / e1RM</button>
          <button data-act="srcMode" data-v="manual" ${refAttr(b, wi, di, ref.e)} aria-pressed="${manualKg}">Ręcznie</button></div>
        ${manualKg ? `<input class="input num" id="f-plan" data-change="planKg" ${refAttr(b, wi, di, ref.e)} inputmode="decimal" placeholder="kg, puste = bez sugestii" value="${e.kgPlan != null ? F(e.kgPlan, 2) : ""}">` : ""}</div>`;
    const flag = flags.get(e.id);
    const flagHtml = flag ? `<div class="banner bad"><div>Ten wynik daje e1RM ${F(flag.value)} kg, czyli o ${Math.round(flag.change * 100)}% więcej niż bieżący ${F(flag.before.value)} kg. Do czasu potwierdzenia nie liczy się do sugestii.</div>
      <div class="btn-row"><button class="btn" data-act="confirmEntry" ${refAttr(b, wi, di, ref.e)}>Wynik jest prawdziwy</button></div></div>` : "";
    const prev = previousLog(c);
    const prevHtml = prev ? `<div class="small muted">Poprzednio: ${prev.kgText ? esc(prev.kgText) : F(prev.kg, 2) + " kg"}${prev.reps != null ? ` × ${prev.reps}` : ""}${prev.rpe != null ? ` @ ${F(prev.rpe)}` : ""} (${esc(fmtDate(prev.date))})</div>` : "";
    openSheet(`
      <div><h3>${esc(exName(e.exId))}</h3><div class="sub">${esc(b.name)} · T${wi + 1} · ${esc(d.name)} · <b>${rxText(e)}</b> ${rxSub(e)}</div>${prevHtml}</div>
      ${e.note ? `<div class="banner info">${esc(e.note)}</div>` : ""}
      ${srcHtml}${sugHtml}${flagHtml}
      ${setsHtml(e, kg0, reps0)}
      <div class="field"><span>Ciężar ${perSetMode(e) ? `serii ${setCount(e)} (ostatniej)` : "ostatniej serii"} (kg)</span>
        <div class="stepper"><button data-act="kgStep" data-v="-${S.settings.step}" aria-label="Mniej">−</button>
          <input class="input num" id="f-kg" inputmode="decimal" value="${kg0 != null ? F(kg0, 2) : ""}" placeholder="kg" autofocus>
          <button data-act="kgStep" data-v="${S.settings.step}" aria-label="Więcej">+</button></div>
        <div class="plates" id="plates">${platesHtml(pl)}</div></div>
      <div class="field"><span>Powtórzenia w ostatniej serii${r.kind === "range" ? ` (zakres ${r.min}–${r.max})` : ""}</span>
        ${repChips ? `<div class="chips" id="f-reps-chips">${repChips.map((n) => `<button data-act="repsChip" data-v="${n}" aria-pressed="${reps0 === n}">${n}</button>`).join("")}</div>` : ""}
        <div class="stepper"><button data-act="repsStep" data-v="-1" aria-label="Mniej">−</button>
          <input class="input num" id="f-reps" inputmode="numeric" value="${reps0 ?? ""}" placeholder="powt.">
          <button data-act="repsStep" data-v="1" aria-label="Więcej">+</button></div></div>
      <div class="field"><span>RPE ostatniej serii${tgtRpe ? ` · plan ${F(tgtRpe.min)}${tgtRpe.max !== tgtRpe.min ? "–" + F(tgtRpe.max) : ""}` : ""}</span>
        <div class="chips" id="f-rpe">${rpes.map((v) => `<button data-act="rpeChip" data-v="${v}" aria-pressed="${rpe0 === v}" class="${tgtRpe && v >= tgtRpe.min && v <= tgtRpe.max ? "hint" : ""}">${F(v)}</button>`).join("")}</div></div>
      <label class="field"><span>Notatka</span><textarea class="input" id="f-note" rows="2" placeholder="Jak poszło?">${esc(e.log && e.log.note || "")}</textarea></label>
      ${(S.exercises[e.exId] || {}).bw ? "" : `<label class="check"><input type="checkbox" id="f-skip" ${e.skip ? "checked" : ""}> Nie licz tego wyniku do e1RM (np. słaby dzień, choroba, ból)</label>`}
      <div class="btn-row"><button class="btn primary" data-act="saveLog" ${refAttr(b, wi, di, ref.e)}>Zapisz wynik</button></div>
      <div class="btn-row">${e.log ? `<button class="btn danger" data-act="clearLog" ${refAttr(b, wi, di, ref.e)}>Usuń wynik</button>` : ""}<button class="btn" data-act="editEntry" ${refAttr(b, wi, di, ref.e)}>Edytuj plan</button></div>
    `, {
      replace: !!replace,
      mount(root) {
        $("#f-kg", root).addEventListener("input", () => { const v = parseNum($("#f-kg").value); $("#plates").innerHTML = platesHtml(v ? E.plates(v, S.settings.bar) : null); });
      },
    });
  }
  // ---- zapis każdej serii (opcjonalny): wiersze wcześniejszych serii nad polami ostatniej serii
  const RPE_OPTS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
  const planSets = (e) => { const p = E.parseSets(e.sets); return p.max || p.min || 1; };
  const perSetMode = (e) => (S.settings.perSet && planSets(e) >= 2) || !!(e.log && Array.isArray(e.log.sets) && e.log.sets.length > 1);
  const setCount = (e) => (e.log && Array.isArray(e.log.sets) && e.log.sets.length > 1 ? e.log.sets.length : Math.min(10, planSets(e)));
  function setRowHtml(i, st) {
    return `<div class="setrow"><span class="n">${i + 1}</span>
      <input class="input num s-kg" inputmode="decimal" value="${st.kg != null && st.kg !== "" ? F(st.kg, 2) : ""}" placeholder="kg" aria-label="Seria ${i + 1}: ciężar">
      <span class="x">×</span><input class="input num s-reps" inputmode="numeric" value="${st.reps ?? ""}" placeholder="powt." aria-label="Seria ${i + 1}: powtórzenia">
      <select class="input s-rpe" aria-label="Seria ${i + 1}: RPE"><option value="">RPE</option>${RPE_OPTS.map((v) => `<option value="${v}" ${Number(st.rpe) === v ? "selected" : ""}>${F(v)}</option>`).join("")}</select></div>`;
  }
  function setsHtml(e, kg0, reps0) {
    const can = planSets(e) >= 2 || (e.log && e.log.sets);
    if (!can) return "";
    const toggle = `<button class="btn link" data-act="perSetToggle">${perSetMode(e) ? "Zapisuj tylko ostatnią serię" : "Zapisz każdą serię osobno"}</button>`;
    if (!perSetMode(e)) return `<div class="setlink">${toggle}</div>`;
    const saved = e.log && Array.isArray(e.log.sets) && e.log.sets.length > 1 ? e.log.sets.slice(0, -1) : null;
    const rows = saved || Array.from({ length: setCount(e) - 1 }, () => ({ kg: kg0, reps: reps0, rpe: null }));
    return `<div class="field"><span>Wcześniejsze serie <span class="muted small">(RPE nieobowiązkowe)</span></span>
        <div id="set-rows">${rows.map((st, i) => setRowHtml(i, st)).join("")}</div>
        <div class="setlink"><button class="btn link" data-act="setAdd">+ seria</button><button class="btn link" data-act="setDel">− seria</button>${toggle}</div></div>`;
  }
  function renumberSets() {
    const rows = $$("#set-rows .setrow");
    rows.forEach((r, i) => { r.querySelector(".n").textContent = i + 1; });
    const lab = $("#f-kg") && $("#f-kg").closest(".field").querySelector("span");
    if (lab) lab.textContent = `Ciężar serii ${rows.length + 1} (ostatniej) (kg)`;
  }
  function platesHtml(pl) {
    if (!pl) return "";
    if (!pl.length) return `<span>sam gryf</span>`;
    const cls = { 25: "p25", 20: "p20", 15: "p15", 10: "p10", 5: "p5", 2.5: "p2", 1.25: "p1" };
    return `<span>na stronę:</span>${pl.map((p) => `<span class="plate ${cls[p]}" title="${F(p, 2)} kg">${F(p, 2)}</span>`).join("")}`;
  }
  /** Poprzedni wynik tego ćwiczenia: ta sama pozycja tydzień wcześniej, potem te same powtórzenia, potem dowolny. */
  function previousLog(c) {
    const prevWeek = c.b.weeks[c.wi - 1];
    const same = prevWeek && prevWeek.days[c.di] && prevWeek.days[c.di].entries[c.ei];
    if (same && same.exId === c.e.exId && same.log) return { ...same.log, date: same.log.at || prevWeek.days[c.di].date || "" };
    const before = c.d.date || "9999";
    let bySpec = null, any = null;
    for (const b of S.blocks) b.weeks.forEach((w, wi) => w.days.forEach((d, di) => d.entries.forEach((e) => {
      if (e.exId !== c.e.exId || !e.log || e === c.e) return;
      const date = e.log.at || d.date || "";
      if (date >= before) return;
      const cand = { ...e.log, date };
      if (!any || date > any.date) any = cand;
      if (String(e.reps) === String(c.e.reps) && String(e.sets) === String(c.e.sets) && (!bySpec || date > bySpec.date)) bySpec = cand;
    })));
    return bySpec || any;
  }

  // ---- edycja wpisu w planie
  function exerciseOptions(selected) {
    const order = ["squat", "bench", "deadlift", "other"];
    const counts = usedExercises();
    return order.map((f) => {
      const items = Object.values(S.exercises).filter((x) => x.family === f).sort((a, b) => ((counts.get(b.id) || 0) > 0) - ((counts.get(a.id) || 0) > 0) || a.name.localeCompare(b.name));
      if (!items.length) return "";
      return `<optgroup label="${FAMILY[f]}">${items.map((x) => `<option value="${esc(x.id)}" ${x.id === selected ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</optgroup>`;
    }).join("") + `<option value="__new">+ Nowe ćwiczenie…</option>`;
  }
  let entryCtx = null;
  function sheetEntry(ref, isNew) {
    const c = ctxOf(ref);
    const firstEx = (Object.values(S.exercises).find((x) => x.comp && x.family === "squat") || Object.values(S.exercises)[0] || {}).id;
    const base = isNew ? { exId: firstEx, sets: "3", reps: "5", type: "rpe", value: 7, rpe: null, prog: { m: "rpe_step", step: 0.5 }, note: null } : c.e;
    if (!base || !c.d) return;
    entryCtx = { ref, isNew, c, base, st: { type: base.type || "rpe", prog: (base.prog && base.prog.m) || "none" } };
    drawEntrySheet();
  }
  function collectEntryForm(withValue) {
    const out = {};
    ["e-ex", "e-sets", "e-reps", "e-rpe", "e-note", "e-newname", "e-newfam", "e-ref"].concat(withValue ? ["e-value"] : []).forEach((id) => { const el = $("#" + id); if (el) out[id] = el.value; });
    return out;
  }
  function drawEntrySheet(saved) {
    const { c, base: e, st, isNew, ref } = entryCtx;
    const progOpts = E.progOptions(st.type);
    if (!progOpts.includes(st.prog)) st.prog = progOpts[0];
    const unit = st.prog === "rpe_step" ? "pkt RPE" : st.prog === "pct_step" ? "%" : "kg";
    const valLabel = st.type === "rpe" ? "RPE" : st.type === "kg" ? "Ciężar kg (puste = dobierasz)" : st.type === "pct_top" ? "Ile % mniej niż top set" : "Procent";
    const byComp = (a, b) => (b.comp - a.comp) || a.name.localeCompare(b.name);
    const refOpts = Object.values(S.exercises).map((x) => ({ x, tm: E.baseTm(S, c.b.planId, x.id) })).filter((o) => o.tm).sort((a, b) => byComp(a.x, b.x));
    const refOptsE = Object.values(S.exercises).filter((x) => !x.bw).map((x) => ({ x, cur: E.currentE1rm(S, x.id) })).filter((o) => o.cur).sort((a, b) => byComp(a.x, b.x));
    const stepVal = e.prog && e.prog.m === st.prog ? e.prog.step : st.prog === "rpe_step" ? 0.5 : 2.5;
    const eAttr = refAttr(c.b, c.wi, c.di, isNew ? "" : ref.e);
    openSheet(`
      <div><h3>${isNew ? "Nowe ćwiczenie w planie" : "Edycja planu"}</h3><div class="sub">${esc(c.b.name)} · T${c.wi + 1} · ${esc(c.d.name)}</div></div>
      <label class="field"><span>Ćwiczenie</span><select class="input" id="e-ex" data-change="entryEx">${exerciseOptions(e.exId)}</select></label>
      <div class="field" id="e-new" hidden><span>Nazwa nowego ćwiczenia</span><input class="input" id="e-newname" placeholder="np. Pin Squat">
        <select class="input" id="e-newfam" aria-label="Rodzina">${Object.entries(FAMILY).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
      <div class="row2">
        <label class="field"><span>Serie</span><input class="input" id="e-sets" value="${esc(e.sets || "")}" placeholder="3 lub 2-3"></label>
        <label class="field"><span>Powtórzenia</span><input class="input" id="e-reps" value="${esc(e.reps || "")}" placeholder="5, 8-12, MAX"></label>
      </div>
      <div class="field"><span>Intensywność</span>
        <div class="seg" role="group" aria-label="Typ intensywności">${(adv() ? ["rpe", "pct_e1rm", "pct_max", "pct_top", "kg"] : ["rpe", "kg"].concat(["rpe", "kg"].includes(st.type) ? [] : [st.type])).map((t) => `<button data-act="entryType" data-v="${t}" aria-pressed="${st.type === t}">${TYPE_LABEL[t]}</button>`).join("")}</div></div>
      <div class="row2">
        <label class="field"><span>${valLabel}</span><input class="input" id="e-value" inputmode="decimal" value="${e.value != null && e.type === st.type ? F(e.value, 2) : ""}"></label>
        ${st.type !== "rpe" ? `<label class="field"><span>Docelowe RPE (opcja)</span><input class="input" id="e-rpe" value="${esc(e.rpe || "")}" placeholder="np. 8 lub 8-9"></label>` : "<div></div>"}
      </div>
      ${st.type === "pct_max" ? `<label class="field"><span>TM liczony z</span><select class="input" id="e-ref"><option value="">Tego ćwiczenia</option>${refOpts.map((o) => `<option value="${esc(o.x.id)}" ${e.refEx === o.x.id ? "selected" : ""}>${esc(o.x.name)} · TM ${F(o.tm, 2)} kg</option>`).join("")}</select></label>
        <p class="small muted" style="margin:0">Np. Close Grip Bench jako % TM Competition Bench Press. TM ustawiasz w zakładce Ćwiczenia (przycisk „Training max”) albo: nazwa treningu ▾ → Ustawienia treningu.</p>` : ""}
      ${st.type === "pct_e1rm" ? `<label class="field"><span>e1RM liczony z</span><select class="input" id="e-ref"><option value="">Tego ćwiczenia</option>${refOptsE.map((o) => `<option value="${esc(o.x.id)}" ${e.refEx === o.x.id ? "selected" : ""}>${esc(o.x.name)} · e1RM ${F(o.cur.value)} kg</option>`).join("")}</select></label>` : ""}
      ${st.type === "pct_top" ? `<p class="small muted" style="margin:0">Ciężar = top set tego samego ćwiczenia (wyżej w dniu) pomniejszony o ten procent. Np. 10 = 90% top seta.</p>` : ""}
      
      ${adv() ? "" : `<p class="small muted" style="margin:0">RPE: ciężar podpowie aplikacja z Twoich wyników. Kg: stały ciężar (puste pole = dobierasz sam).</p>`}
      <div class="row2" ${adv() ? "" : "hidden"}>
        <label class="field"><span>Progresja co tydzień</span><select class="input" id="e-prog" data-change="entryProg">${progOpts.map((m) => `<option value="${m}" ${m === st.prog ? "selected" : ""}>${E.PROG_LABEL[m]}</option>`).join("")}</select></label>
        ${st.prog !== "none" ? `<label class="field"><span>Krok (${unit})</span><input class="input" id="e-step" inputmode="decimal" value="${F(stepVal, 2)}"></label>` : "<div></div>"}
      </div>
      ${st.prog === "double" ? `<p class="small muted" style="margin:0">Ustaw zakres powtórzeń (np. 8-12). Ciężar rośnie o krok, gdy ostatnia seria dojdzie do górnej granicy przy RPE nie wyższym niż docelowe.</p>` : ""}
      ${st.prog === "linear" ? `<p class="small muted" style="margin:0">Ciężar rośnie o krok, gdy zrobisz zadane powtórzenia przy RPE nie wyższym niż docelowe.</p>` : ""}
      <label class="field"><span>Notatka do planu</span><textarea class="input" id="e-note" rows="2">${esc(e.note || "")}</textarea></label>
      <div class="btn-row"><button class="btn primary" data-act="saveEntry" ${eAttr}>${isNew ? "Dodaj do planu" : "Zapisz plan"}</button></div>
      ${isNew ? "" : `<div class="btn-row"><button class="btn" data-act="moveEntry" data-dir="-1" ${eAttr}>↑ Wyżej</button><button class="btn" data-act="moveEntry" data-dir="1" ${eAttr}>↓ Niżej</button><button class="btn" data-act="dupEntry" ${eAttr}>Duplikuj</button></div>
      <div class="btn-row"><button class="btn danger" data-act="delEntry" ${eAttr}>Usuń z planu</button></div>`}`, { replace: !!saved });
    if (saved) for (const [id, v] of Object.entries(saved)) { const el = $("#" + id); if (el) el.value = v; }
    toggleNewEx();
  }
  function toggleNewEx() { const sel = $("#e-ex"); const box = $("#e-new"); if (sel && box) box.hidden = sel.value !== "__new"; }
  function slugify(name) { return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || E.uid(); }
  function familyGuess(name) {
    const n = name.toLowerCase();
    if (/squat|przysiad/.test(n) && !/split|bulgar|belt|goblet|hack|front/.test(n)) return "squat";
    if (/bench press|wyciskanie le/.test(n) && !/incline|db|dumbbell/.test(n)) return "bench";
    if (/deadlift|martwy/.test(n) && !/\bdb\b|dumbbell/.test(n)) return "deadlift";
    return "other";
  }
  function saveEntry(ref, isNew) {
    if (!entryCtx) return;
    const st = entryCtx.st;
    const c = ctxOf(ref);
    let exId = $("#e-ex").value;
    if (exId === "__new") {
      const name = $("#e-newname").value.trim();
      if (!name) { toast("Wpisz nazwę nowego ćwiczenia."); return; }
      let id = slugify(name); while (S.exercises[id] && S.exercises[id].name.toLowerCase() !== name.toLowerCase()) id += "-2";
      if (!S.exercises[id]) S.exercises[id] = { id, name, family: $("#e-newfam").value || familyGuess(name), comp: false, max: null, prog: null, bw: false, used: true };
      exId = id;
      Store.touchMeta();
    }
    const value = $("#e-value") ? parseNum($("#e-value").value) : null;
    if (st.type === "rpe" && (value == null || value < 1 || value > 10)) { toast("RPE musi być liczbą od 1 do 10."); return; }
    if ((st.type === "pct_e1rm" || st.type === "pct_max") && (value == null || value <= 0 || value > 120)) { toast("Podaj procent, np. 75."); return; }
    if (st.type === "pct_top" && (value == null || value <= 0 || value >= 100)) { toast("Podaj, o ile % mniej niż top set, np. 10."); return; }
    const progM = $("#e-prog") ? $("#e-prog").value : "none";
    const step = $("#e-step") ? parseNum($("#e-step").value) : 0;
    const entry = isNew ? { id: E.uid(), log: null } : c.e;
    // do pytania o kolejne tygodnie: które to wystąpienie starego ćwiczenia w tym dniu
    const oldEx = isNew ? null : entry.exId;
    const slot = isNew ? -1 : c.d.entries.filter((x) => x.exId === oldEx).indexOf(entry);
    entry.exId = exId;
    entry.sets = $("#e-sets").value.trim() || null;
    entry.reps = $("#e-reps").value.trim() || null;
    entry.type = st.type; entry.value = value;
    entry.rpe = $("#e-rpe") ? ($("#e-rpe").value.trim() || null) : null;
    entry.prog = { m: progM, step: progM === "none" ? 0 : step ?? 0 };
    if ((st.type === "pct_max" || st.type === "pct_e1rm") && $("#e-ref") && $("#e-ref").value && $("#e-ref").value !== exId) entry.refEx = $("#e-ref").value; else delete entry.refEx;
    entry.note = $("#e-note").value.trim() || null;
    if (!entry.log) { delete entry.sug; delete entry.basis; }
    if (isNew) c.d.entries.push(entry);
    S.exercises[exId] && (S.exercises[exId].used = true);
    Store.touchBlock(c.b.id);
    closeSheet();
    toast(isNew ? "Dodano do planu." : "Plan zapisany.");
    if (!isNew && oldEx && oldEx !== exId) askPropagate(c, oldEx, exId, slot);
  }
  // ---- zmiana ćwiczenia: zapytaj, czy zmienić też w kolejnych tygodniach bloku
  let propagateCtx = null;
  function askPropagate(c, oldEx, newEx, slot) {
    const targets = [];
    let logged = 0;
    for (let wi = c.wi + 1; wi < c.b.weeks.length; wi++) {
      const d = c.b.weeks[wi].days[c.di]; if (!d) continue;
      const t = d.entries.filter((x) => x.exId === oldEx)[slot];
      if (!t) continue;
      if (t.log) { logged++; continue; }
      targets.push({ wi, id: t.id });
    }
    if (!targets.length) return;
    propagateCtx = { bId: c.b.id, di: c.di, newEx, targets };
    const weeks = targets.map((t) => "T" + (t.wi + 1)).join(", ");
    openSheet(`<div><h3>Zmienić też w kolejnych tygodniach?</h3><div class="sub">${esc(c.b.name)} · ${esc(c.d.name)}</div></div>
      <p style="margin:0">Zmieniłeś <b>${esc(exName(oldEx))}</b> na <b>${esc(exName(newEx))}</b> w tygodniu ${c.wi + 1}. W tym samym miejscu planu w kolejnych tygodniach (${weeks}) jest nadal ${esc(exName(oldEx))}.</p>
      <p class="small muted" style="margin:0">Zmieni się tylko ćwiczenie. Serie, powtórzenia i intensywność w tamtych tygodniach zostaną, jak są.${logged ? ` Pominę ${logged} ${logged === 1 ? "serię, która ma" : "serie, które mają"} już zapisany wynik.` : ""}</p>
      <div class="btn-row"><button class="btn primary" data-act="applyPropagate">Tak, zmień w ${targets.length} ${targets.length === 1 ? "tygodniu" : "tygodniach"}</button></div>
      <div class="btn-row"><button class="btn" data-act="closeSheet">Nie, tylko ten tydzień</button></div>`);
  }
  function applyPropagate() {
    const pc = propagateCtx; propagateCtx = null; if (!pc) return;
    const b = S.blocks.find((x) => x.id === pc.bId); if (!b) return;
    let n = 0;
    for (const t of pc.targets) {
      const d = b.weeks[t.wi] && b.weeks[t.wi].days[pc.di];
      const e = d && d.entries.find((x) => x.id === t.id);
      if (!e || e.log) continue;
      e.exId = pc.newEx; if (e.refEx === pc.newEx) delete e.refEx; delete e.sug; delete e.basis; n++;
    }
    Store.touchBlock(b.id); closeSheet();
    toast(`Zmieniono w ${n} ${n === 1 ? "tygodniu" : "tygodniach"}.`);
  }

  // ---- ćwiczenie w bibliotece
  function sheetExercise(id) {
    const x = id ? S.exercises[id] : { id: "", name: "", family: "other", max: null, bw: false, comp: false };
    openSheet(`
      <div><h3>${id ? esc(x.name) : "Nowe ćwiczenie"}</h3>${id ? `<div class="sub">Bieżący e1RM: ${(() => { const c = E.analyze(S, id).current; return c ? F(c.value) + " kg" : "–"; })()}</div>` : ""}</div>
      <label class="field"><span>Nazwa</span><input class="input" id="x-name" value="${esc(x.name)}"></label>
      <label class="field"><span>Rodzina (do podsumowań)</span><select class="input" id="x-fam">${Object.entries(FAMILY).map(([k, v]) => `<option value="${k}" ${x.family === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label class="field" ${adv() ? "" : "hidden"}><span>Training max, TM (kg) — domyślny dla serii na % TM</span><input class="input" id="x-max" inputmode="decimal" value="${x.max != null ? F(x.max, 2) : ""}" placeholder="np. 140"></label>
      ${id && adv() ? `<label class="field"><span>Ręczny e1RM (kg) — np. po przerwie</span><input class="input" id="x-e1rm" inputmode="decimal" value="${x.e1rmManual ? F(x.e1rmManual.value, 2) : ""}" placeholder="puste = liczony z wyników">
        <span class="small muted">${x.e1rmManual ? `Wpisany ${esc(fmtDate(x.e1rmManual.date, false))}. ` : ""}Sugestie liczą się z tej wartości do pierwszego nowego wyniku tego ćwiczenia, potem aplikacja wraca do e1RM z wyników.</span></label>` : ""}
      <label class="check"><input type="checkbox" id="x-comp" ${x.comp ? "checked" : ""}> Bój startowy</label>
      <label class="check"><input type="checkbox" id="x-bw" ${x.bw ? "checked" : ""}> Ćwiczenie z masą ciała (bez e1RM; ciężar to obciążenie dodatkowe)</label>
      <div class="btn-row"><button class="btn primary" data-act="saveExercise" data-id="${esc(id || "")}">Zapisz</button></div>
    `);
  }
  function saveExercise(id) {
    const name = $("#x-name").value.trim();
    if (!name) { toast("Wpisz nazwę."); return; }
    let x = id ? S.exercises[id] : null;
    if (!x) {
      let nid = slugify(name); while (S.exercises[nid]) nid += "-2";
      x = S.exercises[nid] = { id: nid, prog: { m: "none", step: 0 }, used: false };
    }
    x.name = name; x.family = $("#x-fam").value; x.max = parseNum($("#x-max").value);
    x.comp = $("#x-comp").checked; x.bw = $("#x-bw").checked;
    if ($("#x-e1rm")) {
      const mv = parseNum($("#x-e1rm").value);
      if (mv != null && mv > 0) { if (!x.e1rmManual || x.e1rmManual.value !== mv) x.e1rmManual = { value: mv, date: today() }; const la = lastLoggedAt(x.id); if (la) x.e1rmManual.after = la; }
      else delete x.e1rmManual;
    }
    Store.touchMeta(); closeSheet(); toast("Zapisano ćwiczenie.");
  }

  // ---- bloki
  function sheetBlocks() {
    const rows = planBlocks().sort(byStartDesc).map((b) => {
      const n = b.weeks.reduce((a, w) => a + w.days.reduce((x, d) => x + d.entries.filter((e) => e.log).length, 0), 0);
      return `<button class="list-row" data-act="pickBlock" data-id="${esc(b.id)}"><div><div class="t">${esc(b.name)}${b.id === ui.blockId ? " · wybrany" : ""}</div><div class="s">${esc(fmtDate(b.start, false))} · ${b.weeks.length} tyg. · ${n} wyników</div></div><span class="muted">›</span></button>`;
    }).join("");
    openSheet(`<div><h3>Bloki</h3><div class="sub">${esc((plan() || {}).name || "")}</div></div><div>${rows || '<p class="muted">Brak bloków.</p>'}</div>
      <div class="btn-row"><button class="btn primary" data-act="newBlock">+ Nowy blok</button>${block() ? `<button class="btn" data-act="blockSettings">Ustawienia bloku</button>` : ""}</div>`);
  }
  function nextMonday(iso) {
    const d = iso ? new Date(iso + "T12:00:00Z") : new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  // ---- nowy trening / nowy blok (wspólny formularz ze szkicem)
  const DAY_OFFSETS = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };
  function draftOptions(selected) {
    const groups = [...S.plans].map((p) => {
      const list = planBlocks(p.id).sort(byStartDesc);
      if (!list.length) return "";
      return `<optgroup label="${esc(p.name)}">${list.map((b) => `<option value="${esc(b.id)}" ${b.id === selected ? "selected" : ""}>${esc(b.name)} · ${esc(fmtDate(b.start, false))}</option>`).join("")}</optgroup>`;
    }).join("");
    return `<option value="" ${!selected ? "selected" : ""}>Czysta karta</option>${groups}`;
  }
  function draftExtra(srcId) {
    const sb = S.blocks.find((b) => b.id === srcId);
    if (!sb) {
      return `<label class="field"><span>Dni treningowe w tygodniu</span><select class="input" id="nb-days">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}" ${n === 3 ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <p class="small muted" style="margin:0">Powstaną puste dni, do których dodasz ćwiczenia. Kolejne tygodnie zbudujesz przyciskiem „+ tydzień”.</p>`;
    }
    const n = sb.weeks.reduce((a, w) => Math.max(a, w.days.reduce((x, d) => x + d.entries.length, 0)), 0);
    return `<label class="field"><span>Który tydzień skopiować</span><select class="input" id="nb-week">${sb.weeks.map((w, i) => `<option value="${i}">Tydzień ${i + 1} · ${w.days.length} dni</option>`).join("")}</select></label>
      <p class="small muted" style="margin:0">Szkic bierze dni, ćwiczenia, serie, powtórzenia, intensywność i metody progresji (do ${n} pozycji). Bez wyników. Wszystko możesz potem zmienić.</p>`;
  }
  function sheetCreate(kind) {
    const isPlan = kind === "plan";
    const latestAll = [...S.blocks].sort(byStartDesc)[0];
    const latestPlan = planBlocks().sort(byStartDesc)[0];
    const ref = isPlan ? latestAll : latestPlan || latestAll;
    const lastDate = ref ? ref.weeks.flatMap((w) => w.days.map((d) => d.date)).filter(Boolean).sort().pop() : null;
    const start = isPlan ? nextMonday(today()) : nextMonday(lastDate || today());
    const src = isPlan ? "" : latestPlan ? latestPlan.id : "";
    const n = planBlocks().length + 1;
    openSheet(`<div><h3>${isPlan ? "Nowy trening" : "Nowy blok"}</h3><div class="sub">${isPlan ? "Osobny plan z własnymi blokami. e1RM ćwiczeń jest wspólny, więc sugestie od razu korzystają z Twojej historii." : `${esc((plan() || {}).name || "")} · sugestie od razu liczą się z aktualnych e1RM.`}</div></div>
      ${isPlan ? `<label class="field"><span>Nazwa treningu</span><input class="input" id="np-name" placeholder="np. Hipertrofia jesień" autofocus></label>` : ""}
      <label class="field"><span>${isPlan ? "Nazwa pierwszego bloku" : "Nazwa bloku"}</span><input class="input" id="nb-name" value="Blok ${isPlan ? 1 : n}"></label>
      <label class="field"><span>Data pierwszego treningu</span><input class="input" id="nb-start" type="date" value="${start}"></label>
      <label class="field"><span>${isPlan ? "Użyć szkicu z innego planu?" : "Na start"}</span><select class="input" id="nb-src" data-change="draftSrc">${draftOptions(src)}</select></label>
      <div id="draft-extra" style="display:grid;gap:12px">${draftExtra(src)}</div>
      <div class="btn-row"><button class="btn primary" data-act="createFromSheet" data-kind="${kind}">${isPlan ? "Utwórz trening" : "Utwórz blok"}</button></div>`);
  }
  function createFromSheet(kind) {
    const isPlan = kind === "plan";
    let planId = ui.planId;
    if (isPlan) {
      const pname = $("#np-name").value.trim();
      if (!pname) { toast("Nazwij trening, np. „Hipertrofia jesień”."); $("#np-name").focus(); return; }
      planId = "p" + E.uid();
      S.plans.push({ id: planId, name: pname, created: today() });
    }
    const start = $("#nb-start").value || today();
    if (isPlan) {
      const srcB = S.blocks.find((b) => b.id === $("#nb-src").value);
      const srcP = srcB && S.plans.find((x) => x.id === srcB.planId);
      if (srcP && srcP.bases) S.plans.find((x) => x.id === planId).bases = { ...srcP.bases };
    }
    const name = $("#nb-name").value.trim() || `Blok ${planBlocks(planId).length + 1}`;
    const sb = S.blocks.find((b) => b.id === $("#nb-src").value);
    let week;
    if (sb) week = E.copyWeek(sb.weeks[+($("#nb-week") ? $("#nb-week").value : 0)] || sb.weeks[0], start);
    else {
      const nd = +($("#nb-days") ? $("#nb-days").value : 1);
      week = { days: (DAY_OFFSETS[nd] || [0]).map((off, i) => ({ id: E.uid(), name: `Dzień ${i + 1}`, date: E.addDays(start, off), entries: [] })) };
    }
    const id = "b" + E.uid();
    S.blocks.push({ id, planId, name, start, weeks: [week] });
    S._order = S.blocks.map((x) => x.id);
    ui.planId = planId; ui.blockId = id; ui.wi = 0;
    Store.touchBlock(id); Store.touchMeta();
    closeSheet(); window.scrollTo(0, 0);
    toast(isPlan ? "Utworzono trening." : "Utworzono blok.");
    if (adv() && usesTm(planId)) sheetBases(planId, true);
  }

  // ---- treningi (plany)
  function sheetPlans() {
    const rows = S.plans.map((p) => {
      const list = planBlocks(p.id);
      const dates = list.map((b) => b.start).filter(Boolean).sort();
      const sub = list.length ? `${list.length} ${list.length === 1 ? "blok" : list.length < 5 ? "bloki" : "bloków"} · od ${fmtDate(dates[0], false)}` : "bez bloków";
      return `<button class="list-row" data-act="pickPlan" data-id="${esc(p.id)}"><div><div class="t">${esc(p.name)}${p.id === ui.planId ? " · wybrany" : ""}</div><div class="s">${esc(sub)}</div></div><span class="muted">›</span></button>`;
    }).join("");
    openSheet(`<div><h3>Treningi</h3><div class="sub">Każdy trening ma własne bloki. Historia e1RM ćwiczeń jest wspólna.</div></div>
      <div>${rows || '<p class="muted">Nie masz jeszcze treningu.</p>'}</div>
      <div class="btn-row"><button class="btn primary" data-act="newPlan">+ Nowy trening</button>${plan() ? `<button class="btn" data-act="planSettings">Ustawienia treningu</button>` : ""}</div>`);
  }
  // ---- Training max (TM) w treningu
  const stepKg = () => (S.settings && S.settings.step) || 2.5;
  const usesTm = (pid) => { const p = S.plans.find((x) => x.id === pid); return !!(p && p.bases && Object.keys(p.bases).length) || planBlocks(pid).some((b) => b.weeks.some((w) => w.days.some((d) => d.entries.some((e) => e.type === "pct_max")))); };
  function baseExercises(pid) {
    const ids = new Set();
    const p = S.plans.find((x) => x.id === pid);
    Object.keys((p && p.bases) || {}).forEach((i) => ids.add(i));
    for (const b of planBlocks(pid)) for (const w of b.weeks) for (const d of w.days) for (const e of d.entries) if (e.type === "pct_max") ids.add(e.refEx || e.exId);
    Object.values(S.exercises).forEach((x) => { if (x.comp) ids.add(x.id); });
    return [...ids].filter((i) => S.exercises[i]).sort((a, b) => (S.exercises[b].comp - S.exercises[a].comp) || S.exercises[a].name.localeCompare(S.exercises[b].name));
  }
  function sheetBases(pid, fresh) {
    const p = S.plans.find((x) => x.id === pid); if (!p) return;
    const rows = baseExercises(pid).map((id) => {
      const x = S.exercises[id];
      const cur = x.bw ? null : E.currentE1rm(S, id);
      const stale = cur && cur.lastDate && daysDiff(cur.lastDate, today()) > 42;
      const pr = bestSingle(id);
      const info = [cur ? `e1RM ${F(cur.value)} kg${cur.lastDate ? " · " + fmtDate(cur.lastDate, false) : ""}${cur.manual ? " (ręczny)" : ""}` : "brak e1RM", pr ? `rekord ${F(pr.kg, 2)} kg` : ""].filter(Boolean).join(" · ");
      const val = E.baseTm(S, pid, id);
      return `<div class="field"><span>${esc(x.name)}</span>
        <input class="input tm-in" data-ex="${esc(id)}" inputmode="decimal" value="${val != null ? F(val, 2) : ""}" placeholder="TM (kg)" aria-label="TM: ${esc(x.name)}">
        <span class="small muted">${esc(info)}${stale ? ` · <b style="color:var(--bad)">ostatni wynik ${daysDiff(cur.lastDate, today())} dni temu — sprawdź TM</b>` : ""}</span></div>`;
    }).join("");
    openSheet(`<div><h3>Training max (TM)</h3><div class="sub">${esc(p.name)}</div></div>
      <p class="small muted" style="margin:0">TM to ciężar bazowy, od którego liczą się serie na % TM w tym treningu. Ustalasz go sam, zwykle to 85–90% rekordu. e1RM obok jest tylko podpowiedzią. Puste pole: bierze się TM zapisany przy ćwiczeniu.</p>
      <div class="btn-row"><button class="btn" data-act="fillTm" data-v="1">Wstaw e1RM</button><button class="btn" data-act="fillTm" data-v="0.9">Wstaw 90% e1RM</button></div>
      ${rows || '<p class="muted">Brak ćwiczeń. Oznacz boje jako „Bój startowy” w zakładce Ćwiczenia.</p>'}
      <div class="btn-row"><button class="btn primary" data-act="saveBases" data-pid="${esc(pid)}">${fresh ? "Zapisz i zacznij" : "Zapisz TM"}</button>${fresh ? `<button class="btn" data-act="closeSheet">Pomiń</button>` : ""}</div>`);
  }
  function sheetPr(exId, kg, pid) {
    const cur = E.baseTm(S, pid, exId);
    const t90 = E.roundTo(kg * 0.9, stepKg());
    openSheet(`<div><h3>Nowy rekord: ${F(kg, 2)} kg</h3><div class="sub">${esc(exName(exId))} · najcięższy single</div></div>
      <p class="small muted" style="margin:0">Rekord sam nic nie zmienia. ${cur ? `Training max (TM) w tym treningu to ${F(cur, 2)} kg. ` : ""}Chcesz ustawić nowy TM?</p>
      <div class="btn-row"><button class="btn primary" data-act="setTm" data-pid="${esc(pid)}" data-ex="${esc(exId)}" data-v="${kg}">TM = ${F(kg, 2)} kg (rekord)</button></div>
      <div class="btn-row"><button class="btn" data-act="setTm" data-pid="${esc(pid)}" data-ex="${esc(exId)}" data-v="${t90}">TM = ${F(t90, 2)} kg (90% rekordu)</button><button class="btn" data-act="closeSheet">Zostaw bez zmian</button></div>`);
  }
  function setTm(pid, exId, v) {
    const p = S.plans.find((x) => x.id === pid); if (!p || !(v > 0)) return;
    p.bases = p.bases || {}; p.bases[exId] = v;
    Store.touchMeta(); closeSheet(); toast(`TM ${exName(exId)}: ${F(v, 2)} kg.`);
  }
  // ---- przesuwanie dat
  function blockFirstDate(b) {
    let m = null;
    for (const w of b.weeks) for (const d of w.days) if (d.date && (!m || d.date < m)) m = d.date;
    return m || b.start || null;
  }
  function planFirstDate(pid = ui.planId) {
    let m = null;
    for (const b of planBlocks(pid)) { const f = blockFirstDate(b); if (f && (!m || f < m)) m = f; }
    return m;
  }
  const daysDiff = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
  function shiftBlockDates(b, delta) {
    if (b.start) b.start = E.addDays(b.start, delta);
    for (const w of b.weeks) for (const d of w.days) {
      if (d.date) d.date = E.addDays(d.date, delta);
      for (const e of d.entries) if (e.log && e.log.at) e.log.at = E.addDays(e.log.at, delta);
    }
  }
  function sheetPlanSettings() {
    const p = plan(); if (!p) return;
    const nb = planBlocks().length;
    openSheet(`<div><h3>${esc(p.name)}</h3></div>
      <label class="field"><span>Nazwa treningu</span><input class="input" id="ps-name" value="${esc(p.name)}"></label>
      <div class="btn-row"><button class="btn primary" data-act="renamePlan">Zapisz nazwę</button></div>
      ${adv() ? `<div class="btn-row"><button class="btn" data-act="bases">Training max (TM)…</button></div>` : ""}
      <div class="field"><span>Przesuń daty całego treningu</span>
        <input class="input" id="ps-start" type="date" value="${planFirstDate() || ""}" aria-label="Nowa data pierwszego dnia">
        <span class="small muted">Wpisz, kiedy naprawdę był pierwszy dzień. Wszystkie bloki, tygodnie i dni (razem z datami zapisanych wyników) przesuną się o tę samą liczbę dni.</span></div>
      <div class="btn-row"><button class="btn" data-act="shiftPlan">Przesuń daty</button></div>
      <div class="banner bad"><div>Usunięcie treningu kasuje ${nb} ${nb === 1 ? "blok" : "bloków"} z planem i wynikami. Najpierw możesz pobrać kopię w zakładce Więcej.</div>
        <div class="btn-row"><button class="btn danger" data-act="deletePlan">Usuń trening na zawsze</button></div></div>`);
  }
  function sheetBlockSettings() {
    const b = block(); if (!b) return;
    openSheet(`<div><h3>${esc(b.name)}</h3></div>
      <label class="field"><span>Nazwa</span><input class="input" id="bs-name" value="${esc(b.name)}"></label>
      <div class="btn-row"><button class="btn primary" data-act="renameBlock">Zapisz nazwę</button></div>
      <div class="field"><span>Przesuń daty bloku</span>
        <input class="input" id="bs-start" type="date" value="${blockFirstDate(b) || ""}" aria-label="Nowa data pierwszego dnia bloku">
        <label class="check"><input type="checkbox" id="bs-after" checked> Przesuń też kolejne bloki tego treningu</label>
        <span class="small muted">Wszystkie dni bloku (i daty zapisanych wyników) przesuną się o tę samą liczbę dni.</span></div>
      <div class="btn-row"><button class="btn" data-act="shiftBlock">Przesuń daty</button></div>
      <div class="banner bad"><div>Usunięcie bloku kasuje jego plan i wszystkie wyniki. Najpierw możesz pobrać kopię w zakładce Więcej.</div>
        <div class="btn-row"><button class="btn danger" data-act="deleteBlock">Usuń blok na zawsze</button></div></div>`);
  }

  // ---- tygodnie i dni
  let weekDraft = null;
  function sheetAddWeek() {
    const b = block(); if (!b || !b.weeks.length) return;
    const last = b.weeks[b.weeks.length - 1];
    const whys = {};
    const week = {
      days: last.days.map((d) => ({
        id: E.uid(), name: d.name, date: E.addDays(d.date, 7),
        entries: d.entries.map((e) => { const r = E.progressEntry(e, S.settings); whys[r.entry.id] = r.why; return r.entry; }),
      })),
    };
    weekDraft = { blockId: b.id, week, removed: new Set() };
    const notLogged = last.days.reduce((a, d) => a + d.entries.filter((e) => !e.log).length, 0);
    const days = week.days.map((d, di) => `<div class="nw-day ${dayClass(di)}"><div class="nw-day-head"><b>${esc(d.name)}</b> <span>${esc(fmtDate(d.date))}</span></div>
      ${d.entries.map((e) => nwRow(e, whys[e.id])).join("") || '<p class="small muted" style="margin:6px 0">Brak ćwiczeń.</p>'}</div>`).join("");
    openSheet(`<div><h3>Tydzień ${b.weeks.length + 1}</h3><div class="sub">Zbudowany z tygodnia ${b.weeks.length} według metod progresji, daty +7 dni. Popraw liczby przed dodaniem albo pomiń ćwiczenie (✕).</div></div>
      ${notLogged ? `<div class="banner warn">W tygodniu ${b.weeks.length} ${notLogged} ${notLogged === 1 ? "wpis nie ma" : "wpisów nie ma"} wyniku. Progresja kg (liniowa, double) zostawi tam ciężar bez zmian.</div>` : ""}
      <div class="nw-list">${days}</div>
      <div class="btn-row"><button class="btn primary" data-act="createWeek">Dodaj tydzień ${b.weeks.length + 1}</button></div>`);
  }
  function nwRow(e, why) {
    const v = e.value;
    const pre = e.type === "rpe" ? "@ RPE" : e.type === "kg" ? "" : "@";
    const unit = e.type === "kg" ? "kg" : e.type === "pct_e1rm" ? "% e1RM" : e.type === "pct_max" ? "% TM" : e.type === "pct_top" ? "% z top seta" : "";
    const changed = why && !/^(zostaje|brak)/.test(why);
    return `<div class="nw-row" id="nw-${esc(e.id)}">
      <div class="nw-name"><span>${esc(exName(e.exId))}</span><button class="icon-btn nw-x" data-act="nwToggle" data-id="${esc(e.id)}" aria-label="Pomiń w tym tygodniu">✕</button></div>
      <div class="nw-fields">
        <input class="input nw-in nw-s" id="nw-${esc(e.id)}-sets" value="${esc(e.sets || "")}" aria-label="Serie">
        <span>×</span>
        <input class="input nw-in nw-r" id="nw-${esc(e.id)}-reps" value="${esc(e.reps || "")}" aria-label="Powtórzenia">
        ${pre ? `<span>${pre}</span>` : ""}
        <input class="input nw-in nw-v" id="nw-${esc(e.id)}-val" inputmode="decimal" value="${v != null ? F(v, 2) : ""}" placeholder="${e.type === "kg" ? "dobierz" : ""}" aria-label="${e.type === "rpe" ? "RPE" : e.type === "kg" ? "Ciężar" : "Procent"}">
        ${unit ? `<span>${unit}</span>` : ""}
      </div>
      <div class="nw-why${changed ? " up" : ""}">${esc(why || "bez zmian")}</div>
    </div>`;
  }
  function createWeek() {
    const b = S.blocks.find((x) => x.id === (weekDraft && weekDraft.blockId));
    if (!b) return;
    const week = weekDraft.week;
    for (const d of week.days) {
      d.entries = d.entries.filter((e) => !weekDraft.removed.has(e.id));
      for (const e of d.entries) {
        const g = (k) => { const el = $(`#nw-${CSS.escape(e.id)}-${k}`); return el ? el.value.trim() : null; };
        const sets = g("sets"), reps = g("reps"), val = g("val");
        if (sets !== null) e.sets = sets || null;
        if (reps !== null) e.reps = reps || null;
        if (val !== null) {
          const n = parseNum(val);
          if (e.type === "rpe") { if (n != null && n >= 1 && n <= 10) e.value = n; }
          else e.value = n;
        }
      }
    }
    b.weeks.push(week);
    ui.wi = b.weeks.length - 1;
    weekDraft = null;
    Store.touchBlock(b.id); closeSheet(); window.scrollTo(0, 0);
    toast(`Dodano tydzień ${b.weeks.length}.`);
  }
  function sheetWeekMenu() {
    const b = block(); if (!b) return;
    openSheet(`<div><h3>Tydzień ${ui.wi + 1}</h3><div class="sub">${esc(b.name)}</div></div>
      <div class="btn-row"><button class="btn" data-act="addDay">+ Dodaj dzień</button><button class="btn" data-act="shareWeek">Obraz tygodnia</button></div>
      ${b.weeks.length > 1 ? `<div class="banner bad"><div>Usunięcie tygodnia kasuje jego plan i wyniki.</div><div class="btn-row"><button class="btn danger" data-act="deleteWeek">Usuń tydzień ${ui.wi + 1}</button></div></div>` : ""}`);
  }
  function sheetDayMenu(ref) {
    const c = ctxOf(ref); if (!c.d) return;
    openSheet(`<div><h3>${esc(c.d.name)}</h3><div class="sub">${esc(c.b.name)} · T${c.wi + 1}</div></div>
      <div class="row2"><label class="field"><span>Nazwa</span><input class="input" id="dm-name" value="${esc(c.d.name)}"></label>
      <label class="field"><span>Data</span><input class="input" id="dm-date" type="date" value="${esc(c.d.date || "")}"></label></div>
      <label class="check"><input type="checkbox" id="dm-all" checked> Zmień nazwę tego dnia we wszystkich tygodniach bloku</label>
      <div class="btn-row"><button class="btn primary" data-act="saveDay" ${refAttr(c.b, c.wi, c.di)}>Zapisz</button><button class="btn" data-act="shareDay" ${refAttr(c.b, c.wi, c.di)}>Obraz dnia</button></div>
      <div class="banner bad"><div>Usunięcie dnia kasuje jego ćwiczenia i wyniki w tym tygodniu.</div><div class="btn-row"><button class="btn danger" data-act="deleteDay" ${refAttr(c.b, c.wi, c.di)}>Usuń dzień</button></div></div>`);
  }

  // ---- kopia zapasowa
  async function exportJson() {
    const data = JSON.stringify({ app: "trening", v: 1, exported: new Date().toISOString(), settings: S.settings, exercises: S.exercises, plans: S.plans, blocks: S.blocks }, null, 1);
    if (await saveFile(`trening-kopia-${today()}.json`, data, "application/json", "Kopia")) {
      try { localStorage.setItem("trening-backup-at", today()); localStorage.removeItem("trening-backup-snooze"); } catch { }
      render();
    }
  }
  // ---- przypomnienie o kopii (tylko wersja z danymi w telefonie)
  const BACKUP_DAYS = 7;
  function backupDue() {
    if (Store.mode === "cloud") return null;
    let last = null, snooze = null;
    try { last = localStorage.getItem("trening-backup-at"); snooze = localStorage.getItem("trening-backup-snooze"); } catch { return null; }
    if (snooze && snooze > today()) return null;
    // pierwszy zapisany wynik: bez wyników nie ma czego chronić
    let first = null;
    for (const b of S.blocks) for (const w of b.weeks) for (const d of w.days) for (const e of d.entries) if (e.log && e.log.at && (!first || e.log.at < first)) first = e.log.at;
    if (!first) return null;
    const since = last || null;
    const days = since ? daysDiff(since, today()) : null;
    if (days != null && days < BACKUP_DAYS) return null;
    return { days };
  }
  function backupBanner() {
    const due = backupDue(); if (!due) return "";
    return `<div class="banner warn"><div><b>Zrób kopię zapasową.</b> ${due.days == null ? "Nie masz jeszcze żadnej kopii." : `Ostatnia kopia: ${due.days} dni temu.`} Dane są tylko w tym telefonie, więc odinstalowanie aplikacji albo wyczyszczenie danych przeglądarki je skasuje.</div>
      <div class="btn-row"><button class="btn primary" data-act="exportJson">Pobierz kopię</button><button class="btn" data-act="backupLater">Przypomnij za 3 dni</button></div></div>`;
  }
  // intensywność jako zwykły tekst (eksport, obrazy)
  function intensityText(e) {
    const v = e.value; let t;
    if (freeRpe(e)) return `@ RPE ${String(e.rpe).replace(".", ",")}`;
    if (e.type === "rpe") t = `@ RPE ${F(v)}`;
    else if (e.type === "pct_e1rm") t = `${F(v)}% e1RM${e.refEx ? " (" + exName(e.refEx) + ")" : ""}`;
    else if (e.type === "pct_max") t = `${F(v)}% TM${e.refEx ? " (" + exName(e.refEx) + ")" : ""}`;
    else if (e.type === "pct_top") t = `−${F(v)}% z top seta`;
    else t = v != null ? (v === 0 ? "masa ciała" : `${F(v, 2)} kg`) : "";
    if (e.type !== "rpe" && e.rpe) t += `${t ? " · " : ""}RPE ${String(e.rpe).replace(".", ",")}`;
    return t;
  }
  // wszystkie zapisane serie jako tekst, np. „100×5, 100×5 @7, 102,5×4 @8”
  function setsText(L) {
    if (!L || !Array.isArray(L.sets) || L.sets.length < 2) return "";
    return L.sets.map((x) => `${x.kg != null ? F(x.kg, 2) : "?"}×${x.reps ?? "?"}${x.rpe != null ? " @" + F(x.rpe) : ""}`).join(", ");
  }
  function logText(e) {
    const L = e.log; if (!L) return null;
    const kg = L.kgText || (L.kg != null && L.kg > 0 ? `${F(L.kg, 2)} kg` : "BW");
    return { kg, rest: `× ${L.reps != null ? L.reps : (e.reps || "?")}${L.rpe != null ? " @ " + F(L.rpe) : ""}` };
  }

  // ---- obraz dnia / tygodnia do udostępnienia (canvas -> PNG)
  let shareCtx = null;
  function sheetShare(kind, ref) {
    const c = kind === "day" ? ctxOf(ref) : { b: block(), wi: ui.wi };
    if (!c.b) return;
    const days = kind === "day" ? [{ d: c.d, di: c.di }] : c.b.weeks[c.wi].days.map((d, di) => ({ d, di }));
    const anyLog = days.some(({ d }) => d.entries.some((e) => e.log));
    shareCtx = { kind, b: c.b, wi: c.wi, days, withLog: anyLog, withNotes: false };
    drawShareSheet();
  }
  function drawShareSheet(replace) {
    const sc = shareCtx;
    openSheet(`<div><h3>${sc.kind === "day" ? "Obraz dnia" : "Obraz tygodnia"}</h3><div class="sub">Do wrzucenia na Discord, Instagram albo forum.</div></div>
      <div class="seg" role="group" aria-label="Co pokazać"><button data-act="shareOpt" data-k="withLog" data-v="0" aria-pressed="${!sc.withLog}">Sam plan</button><button data-act="shareOpt" data-k="withLog" data-v="1" aria-pressed="${sc.withLog}">Plan + wykonanie</button></div>
      <label class="check"><input type="checkbox" id="sh-notes" data-change="shareNotes" ${sc.withNotes ? "checked" : ""}> Pokaż notatki</label>
      <div class="btn-row"><button class="btn primary" data-act="shareSave">Zapisz obraz</button></div>
      <img id="sh-img" alt="Podgląd obrazu" style="width:100%;border-radius:12px;border:1px solid var(--line);display:block">`, { replace: !!replace });
    const cv = renderShare(sc);
    $("#sh-img").src = cv.toDataURL("image/png");
  }
  function renderShare(sc) {
    const cs = getComputedStyle(document.documentElement);
    const v = (n, fb) => (cs.getPropertyValue(n) || "").trim() || fb;
    const col = { bg: v("--bg", "#eef1f5"), sf: v("--surface", "#fff"), ink: v("--ink", "#10141b"), ink2: v("--ink-2", "#3a4250"), mu: v("--muted", "#7a8394"), ac: v("--accent", "#1d4ed8"), line: v("--line", "#dde2ea") };
    const fD = v("--font-display", "Arial Narrow, sans-serif"), fB = v("--font-body", "system-ui, sans-serif");
    const W = 1080, P = 64, plan = S.plans.find((x) => x.id === sc.b.planId);
    const title = sc.kind === "day" ? `${sc.days[0].d.name}` : `${sc.b.name} · Tydzień ${sc.wi + 1}`;
    const kicker = sc.kind === "day" ? `${plan ? plan.name + " · " : ""}${sc.b.name} · T${sc.wi + 1}` : (plan ? plan.name : "");
    const dts = sc.days.map(({ d }) => d.date).filter(Boolean).sort();
    const sub = sc.kind === "day" ? fmtDate(sc.days[0].d.date) : dts.length ? `${fmtDate(dts[0], false)} – ${fmtDate(dts[dts.length - 1], false)}` : "";
    const fit = (ctx, t, w) => { if (ctx.measureText(t).width <= w) return t; while (t.length > 1 && ctx.measureText(t + "…").width > w) t = t.slice(0, -1); return t + "…"; };
    // jeden przebieg rysuje (draw=true) albo tylko mierzy wysokość
    const pass = (ctx, k, draw) => {
      let y = P;
      const font = (w, sz, fam) => { ctx.font = `${w} ${Math.round(sz * k)}px ${fam}`; };
      const text = (t, x, yy, color, align = "left") => { if (draw) { ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(t, x, yy); } };
      font(700, 30, fB); y += 30 * k; text(kicker.toUpperCase(), P, y, col.ac);
      font(800, 84, fD); y += 88 * k; text(fit(ctx, title.toUpperCase(), W - 2 * P), P, y, col.ink);
      if (sub) { font(500, 34, fB); y += 50 * k; text(sub, P, y, col.mu); }
      y += 36 * k;
      for (const { d, di } of sc.days) {
        const dayCol = v(`--d${(di % 7) + 1}`, col.ac);
        if (sc.kind === "week") {
          y += 14 * k;
          if (draw) { ctx.fillStyle = dayCol; ctx.fillRect(P, y, 10 * k, 44 * k); }
          font(800, 44, fD); text(`${d.name}`.toUpperCase(), P + 26 * k, y + 38 * k, col.ink);
          if (d.date) { const w0 = ctx.measureText(`${d.name}`.toUpperCase()).width; font(500, 28, fB); text(fmtDate(d.date), P + 26 * k + w0 + 18 * k, y + 37 * k, col.mu); }
          y += 64 * k;
        }
        const ents = d.entries;
        if (!ents.length) { font(500, 30, fB); y += 40 * k; text("Odpoczynek", P, y, col.mu); }
        for (const e of ents) {
          const L = sc.withLog ? logText(e) : null;
          const rightW = L ? 330 * k : 0;
          if (draw) { ctx.fillStyle = col.line; ctx.fillRect(P, y, W - 2 * P, Math.max(1, 2 * k)); }
          y += 16 * k;
          font(700, 36, fB); y += 38 * k; text(fit(ctx, exName(e.exId), W - 2 * P - rightW - 16 * k), P, y, col.ink);
          if (L) { font(800, 46, fD); text(L.kg, W - P, y + 2 * k, col.ink, "right"); }
          font(500, 30, fB); y += 40 * k;
          const rx = `${e.sets || "?"} × ${e.reps || "?"}${intensityText(e) ? "  " + intensityText(e) : ""}`;
          text(fit(ctx, rx, W - 2 * P - rightW - 16 * k), P, y, col.ink2);
          if (L) { font(500, 30, fB); text(L.rest, W - P, y, col.mu, "right"); }
          const notes = sc.withNotes ? [e.note, e.log && e.log.note].filter(Boolean).join(" · ").replace(/\s+/g, " ") : "";
          if (notes) { font("italic 400", 27, fB); y += 36 * k; text(fit(ctx, notes, W - 2 * P), P, y, col.mu); }
          y += 18 * k;
        }
      }
      y += 30 * k;
      font(600, 26, fB); y += 26 * k; text("Dziennik Siłowy", W - P, y, col.mu, "right");
      return y + P * 0.75;
    };
    const cv = document.createElement("canvas");
    const ctx = cv.getContext("2d");
    // dopasuj skalę tak, by obraz zmieścił się w formacie 4:5 (1080×1350); przy bardzo długim tygodniu obraz się wydłuża
    let k = 1, h = pass(ctx, 1, false);
    // dzień: dopasuj do 4:5; tydzień: pełna wielkość, obraz rośnie w dół (jak długi zrzut ekranu)
    if (sc.kind === "day" && h > 1350) { k = Math.max(0.62, 1350 / h); h = pass(ctx, k, false); }
    cv.width = W; cv.height = Math.max(1350, Math.ceil(h));
    ctx.fillStyle = col.bg; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.textBaseline = "alphabetic";
    pass(ctx, k, true);
    return cv;
  }
  async function shareSave() {
    const sc = shareCtx; if (!sc) return;
    const cv = renderShare(sc);
    const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
    if (!blob) { toast("Nie udało się utworzyć obrazu."); return; }
    const base = sc.kind === "day" ? `${sc.b.name}-t${sc.wi + 1}-${sc.days[0].d.name}` : `${sc.b.name}-tydzien-${sc.wi + 1}`;
    await saveFile(`${slugify(base)}.png`, blob, "image/png", "Obraz");
  }

  // ---- eksport dla trenera (Markdown: czytelny dla człowieka i dla czatu z AI)
  function trainerText(pid, future) {
    const p = S.plans.find((x) => x.id === pid); if (!p) return "";
    const fd = (iso) => iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "";
    const cell = (t) => String(t ?? "").replace(/\|/g, "/").replace(/\n/g, " ");
    const rx = (e) => intensityText(e) || "ciężar dobierany";
    const o = [];
    o.push(`# ${p.name} — plan i wyniki`, ``, `Eksport z aplikacji Dziennik Siłowy, ${fd(today())}.`, ``);
    o.push(`## Jak czytać`,
      `- **Plan**: serie × powtórzenia i intensywność: \`@ RPE x\` (cel RPE ostatniej serii), \`% TM\` (procent Training maxa; w nawiasie ćwiczenie, od którego liczony), \`% e1RM\`, \`−x% z top seta\` (seria zejściowa lżejsza o x% od top seta).`,
      `- **Sugestia**: ciężar wyliczony przez aplikację (z e1RM dla RPE, z TM dla %), zaokrąglony w dół do ${F(S.settings.step || 2.5, 2)} kg.`,
      `- **Wykonanie**: ciężar × powtórzenia @ RPE ostatniej serii. „poza e1RM” = wynik celowo pominięty w liczeniu e1RM (słaby dzień).`,
      `- e1RM z tabeli RPE (Tuchscherer): średnia z ${S.settings.sessions || 2} ostatnich wiarygodnych sesji (RPE ≥ ${F(S.settings.minRpe || 6)}, do ${S.settings.maxReps || 10} powt.). Rekord = najcięższy single.`, ``);
    const comps = Object.values(S.exercises).filter((x) => x.comp && !x.bw).sort((a, b) => a.name.localeCompare(b.name));
    if (comps.length) {
      o.push(`## Boje startowe — stan na dziś`, ``, `| Bój | Bieżący e1RM | Najlepszy e1RM sesji | Training max | Rekord |`, `|---|---|---|---|---|`);
      for (const x of comps) {
        const a = E.analyze(S, x.id), cur = E.currentE1rm(S, x.id), tm = E.baseTm(S, pid, x.id), pr = bestSingle(x.id);
        o.push(`| ${cell(x.name)} | ${cur ? F(cur.value) + " kg" : "—"} | ${a.best ? `${F(a.best.value)} kg (${fd(a.best.date)})` : "—"} | ${tm ? F(tm, 2) + " kg" : "—"} | ${pr ? `${F(pr.kg, 2)} kg (${fd(pr.at)})` : "—"} |`);
      }
      o.push(``);
    }
    const blocks = planBlocks(pid).slice().sort((a, b) => (blockFirstDate(a) || "").localeCompare(blockFirstDate(b) || ""));
    // wszystkie tygodnie po kolei; bez "przyszłych" pokazujemy do ostatniego z wynikami + jeden następny
    let idx = 0, last = -1;
    const flat = blocks.map((b) => b.weeks.map((w, wi) => { const i = idx++; if (w.days.some((d) => d.entries.some((e) => e.log))) last = i; return { w, wi, i }; }));
    blocks.forEach((b, bi) => {
      const weeks = flat[bi].filter((x) => future || x.i <= last + 1);
      if (!weeks.length) return;
      o.push(`## ${b.name}`, ``);
      for (const { w, wi } of weeks) {
        const any = w.days.some((d) => d.entries.some((e) => e.log));
        o.push(`### ${b.name} · Tydzień ${wi + 1}${any ? "" : " (jeszcze nie zrobiony)"}`, ``);
        w.days.forEach((d, di) => {
          o.push(`**${d.name}** · ${fd(d.date)} (data z planu)`, ``, `| Ćwiczenie | Plan | Sugestia | Wykonanie | Notatka |`, `|---|---|---|---|---|`);
          for (const e of d.entries) {
            let sg = null;
            if (!(e.log && e.sug == null)) { try { const x = E.suggest(S, { b, wi, d, di, e }); sg = x && x.kg > 0 ? F(x.kg, 2) + " kg" : null; } catch { sg = null; } }
            const L = e.log;
            const done = L ? `${L.kgText || (L.kg != null && L.kg > 0 ? F(L.kg, 2) + " kg" : "BW")} × ${L.reps != null ? L.reps : (e.reps || "?")}${L.rpe != null ? " @ " + F(L.rpe) : " (bez RPE)"}${e.skip ? " · poza e1RM" : ""}` : "—";
            const note = [e.note ? "plan: " + e.note : "", setsText(L) ? "serie: " + setsText(L) : "", L && L.note ? L.note : ""].filter(Boolean).join(" / ");
            o.push(`| ${cell(exName(e.exId))} | ${cell(`${e.sets || "?"} × ${e.reps || "?"} ${rx(e)}`)} | ${sg || "—"} | ${cell(done)} | ${cell(note)} |`);
          }
          o.push(``);
        });
      }
    });
    return o.join("\n");
  }

  // ---- eksport XLSX (własny zapis pliku: zip bez kompresji + XML arkusza)
  const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zipStore(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    let off = 0;
    const u16 = (v) => [v & 255, (v >>> 8) & 255], u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    for (const f of files) {
      const name = enc.encode(f.name), data = typeof f.data === "string" ? enc.encode(f.data) : f.data, crc = crc32(data);
      const head = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
      parts.push(new Uint8Array(head), name, data);
      central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
      off += head.length + name.length + data.length;
    }
    const cSize = central.reduce((a, x) => a + x.length, 0);
    const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cSize), ...u32(off), ...u16(0)]);
    const all = [...parts, ...central, end], out = new Uint8Array(all.reduce((a, x) => a + x.length, 0));
    let p = 0; for (const x of all) { out.set(x, p); p += x.length; }
    return out;
  }
  const xesc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  const colL = (n) => { let s = ""; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  // kolory jak w arkuszu trenera: mocny pasek dnia + jasne tło kolumny sugestii
  const XL_DAY = ["A4C2F4", "B6D7A8", "EA9999", "FFE599", "B4A7D6", "F9CB9C", "A2C4C9"]; // paski dni jak w arkuszu trenera
  const XL_ROW = ["D9D9D9", "F3F3F3"]; // naprzemienne szarości wierszy ćwiczeń
  // style budowane w locie: spec -> numer stylu (fonty, wypełnienia i ramki bez duplikatów)
  function xlStyleBook() {
    const FONT = { n: '<font><sz val="11"/><name val="Arial"/></font>', b: '<font><b/><sz val="11"/><name val="Arial"/></font>', title: '<font><b/><sz val="16"/><name val="Arial"/></font>', sub: '<font><sz val="10"/><color rgb="FF6B7280"/><name val="Arial"/></font>', white: '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>', i: '<font><i/><sz val="10"/><color rgb="FF555555"/><name val="Arial"/></font>', small: '<font><sz val="10"/><name val="Arial"/></font>' };
    const fonts = [], fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'], borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'], xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>'];
    const fontIdx = {}, fillIdx = {}, borderIdx = {}, xfIdx = {};
    const getFont = (k) => { if (!(k in fontIdx)) { fontIdx[k] = fonts.length; fonts.push(FONT[k]); } return fontIdx[k]; };
    getFont("n");
    const getFill = (hex) => { if (!hex) return 0; if (!(hex in fillIdx)) { fillIdx[hex] = fills.length; fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="FF${hex}"/></patternFill></fill>`); } return fillIdx[hex]; };
    const getBorder = (k) => {
      if (!k) return 0;
      if (!(k in borderIdx)) {
        const left = k.includes("L") ? '<left style="thick"><color rgb="FF262626"/></left>' : "<left/>";
        const right = k.includes("R") ? '<right style="thin"><color rgb="FFA6A6A6"/></right>' : "<right/>";
        const bottom = k.includes("B") ? '<bottom style="thin"><color rgb="FFBFBFBF"/></bottom>' : "<bottom/>";
        borderIdx[k] = borders.length; borders.push(`<border>${left}${right}<top/>${bottom}<diagonal/></border>`);
      }
      return borderIdx[k];
    };
    const style = (sp = {}) => {
      const key = JSON.stringify(sp);
      if (!(key in xfIdx)) {
        const al = [sp.h ? `horizontal="${sp.h}"` : "", 'vertical="center"', sp.wrap ? 'wrapText="1"' : ""].filter(Boolean).join(" ");
        xfIdx[key] = xfs.length;
        xfs.push(`<xf numFmtId="0" fontId="${getFont(sp.font || "n")}" fillId="${getFill(sp.fill)}" borderId="${getBorder(sp.border)}" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment ${al}/></xf>`);
      }
      return xfIdx[key];
    };
    const xml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="${borders.length}">${borders.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="1"><dxf><font><b val="0"/><i/><color rgb="FF9A9A9A"/></font></dxf></dxfs></styleSheet>`;
    return { style, xml };
  }
  // arkusz z listy wierszy: wiersz = {h, cells: [{v, s, f}]}; poza tabelą wszystko ukryte
  function xlSheet(rows, opts) {
    const cell = (c, ri, ci) => {
      if (!c) return "";
      const r = `${colL(ci)}${ri + 1}`, st = c.s ? ` s="${c.s}"` : "";
      if (c.f) return typeof c.v === "string" && c.v !== "" ? `<c r="${r}"${st} t="str"><f>${xesc(c.f)}</f><v>${xesc(c.v)}</v></c>` : `<c r="${r}"${st}><f>${xesc(c.f)}</f>${typeof c.v === "number" ? `<v>${c.v}</v>` : ""}</c>`;
      if (typeof c.v === "number") return `<c r="${r}"${st}><v>${c.v}</v></c>`;
      if (c.v == null || c.v === "") return c.s ? `<c r="${r}"${st}/>` : "";
      return `<c r="${r}"${st} t="inlineStr"><is><t xml:space="preserve">${xesc(c.v)}</t></is></c>`;
    };
    const body = rows.map((row, ri) => `<row r="${ri + 1}" ht="${row.h || 17}" customHeight="1">${row.cells.map((c, ci) => cell(c, ri, ci)).join("")}</row>`).join("");
    const n = opts.widths.length;
    const cols = `<cols>${opts.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}<col min="${n + 1}" max="16384" width="9" hidden="1"/></cols>`;
    const fr = opts.freezeRow || 0, fc = opts.freezeCol || 0;
    const tl = `${colL(fc)}${fr + 1}`;
    const pane = fr || fc ? `<pane${fc ? ` xSplit="${fc}"` : ""}${fr ? ` ySplit="${fr}"` : ""} topLeftCell="${tl}" activePane="${fr && fc ? "bottomRight" : fr ? "bottomLeft" : "topRight"}" state="frozen"/>` : "";
    const views = `<sheetViews><sheetView showGridLines="0" workbookViewId="0"${opts.active ? ' tabSelected="1"' : ""}>${pane}</sheetView></sheetViews>`;
    const merges = opts.merges && opts.merges.length ? `<mergeCells count="${opts.merges.length}">${opts.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
    const cf = opts.cf && opts.cf.length ? opts.cf.map((ref, i) => `<conditionalFormatting sqref="${ref}"><cfRule type="expression" dxfId="0" priority="${i + 1}"><formula>_xlfn.ISFORMULA(${ref.split(":")[0]})</formula></cfRule></conditionalFormatting>`).join("") : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${views}<sheetFormatPr defaultRowHeight="17" zeroHeight="1"/>${cols}<sheetData>${body}</sheetData>${merges}${cf}</worksheet>`;
  }
  function buildXlsx(pid, withF) {
    const p = S.plans.find((x) => x.id === pid);
    const step = S.settings.step || 2.5;
    const fd = (iso) => iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "";
    const blocks = planBlocks(pid).slice().sort((a, b) => (blockFirstDate(a) || "").localeCompare(blockFirstDate(b) || ""));
    const SB = xlStyleBook(), st = SB.style;
    const num = (v) => (/^\d+(\.\d+)?$/.test(String(v ?? "")) ? Number(v) : (v ?? ""));
    // --- zakładka TM
    const tmIds = baseExercises(pid), tmRow = {};
    const tm = [];
    tm.push({ h: 26, cells: [{ v: `${p.name} · Training max (TM)`, s: st({ font: "title" }) }] });
    tm.push({ h: 30, cells: [{ v: withF ? "Zmień TM w kolumnie B, a ciężary liczone z % TM i z top seta w zakładkach bloków przeliczą się same (zaokrąglenie w dół do kroku)." : "Wartości z aplikacji z dnia eksportu.", s: st({ font: "sub", wrap: true }) }] });
    tm.push({ h: 8, cells: [] });
    tm.push({ cells: [{ v: "Krok obciążenia (kg)", s: st({ font: "b", fill: XL_ROW[1], border: "B" }) }, { v: step, s: st({ font: "b", fill: XL_ROW[1], border: "B", h: "center" }) }, { v: "", s: st({ fill: XL_ROW[1], border: "B" }) }, { v: "", s: st({ fill: XL_ROW[1], border: "B" }) }] });
    tm.push({ h: 8, cells: [] });
    tm.push({ h: 20, cells: ["Ćwiczenie", "TM (kg)", "Bieżący e1RM", "Rekord (single)"].map((v, i) => ({ v, s: st({ font: "white", fill: "434343", h: i ? "center" : undefined }) })) });
    tmIds.forEach((id, i) => {
      const cur = S.exercises[id].bw ? null : E.currentE1rm(S, id), pr = bestSingle(id), t = E.baseTm(S, pid, id), fill = XL_ROW[i % 2];
      tm.push({ cells: [{ v: exName(id), s: st({ fill, border: "B" }) }, { v: t != null ? t : "", s: st({ font: "b", fill, border: "B", h: "center" }) }, { v: cur ? Math.round(cur.value * 10) / 10 : "", s: st({ fill, border: "B", h: "center" }) }, { v: pr ? pr.kg : "", s: st({ fill, border: "B", h: "center" }) }] });
      tmRow[id] = tm.length;
    });
    const STEP = "TM!$B$4";
    const sheets = [{ name: "TM", xml: xlSheet(tm, { widths: [38, 12, 14, 16], merges: ["A1:D1", "A2:D2"] }) }];
    // --- zakładki bloków: tygodnie od lewej do prawej, ćwiczenia w wierszach
    // "Ciężar kg": sugestia jako formuła (wyblakła kursywa); wpisany wynik ją zastępuje i robi się pogrubiony
    const WC = ["Plan", "Intensywność", "Ciężar kg", "Powt.", "RPE", "Notatka"];
    const WMIN = [6, 10, 10, 6, 5, 10], WMAX = [11, 30, 14, 9, 6, 34];
    const used = new Set(["TM"]);
    const tlen = (v) => (v == null ? 0 : String(v).length);
    blocks.forEach((b, bIdx) => {
      let name = (b.name || "Blok").replace(/[\[\]:*?\/\\]/g, " ").slice(0, 31).trim() || "Blok";
      while (used.has(name)) name = (name.slice(0, 28) + " " + (used.size + 1)).slice(0, 31);
      used.add(name);
      const nW = b.weeks.length, NC = WC.length, nCols = 1 + nW * NC;
      const c0 = (wi) => 1 + wi * NC; // pierwsza kolumna tygodnia (0-based)
      const rows = [], merges = [], cfCols = new Set();
      const widths = [12, ...Array(nW).fill(0).flatMap(() => WC.map((h) => h.length + 2))];
      const fit = (ci, v, bold) => { widths[ci] = Math.max(widths[ci], Math.ceil(tlen(v) * (bold ? 1.12 : 1.02)) + 2); };
      const full = (cells) => { while (cells.length < nCols) cells.push(null); return cells; };
      const dts = b.weeks.flatMap((w) => w.days.map((d) => d.date)).filter(Boolean).sort();
      rows.push({ h: 26, cells: [{ v: `${p.name} · ${b.name}`, s: st({ font: "title" }) }] });
      rows.push({ cells: [{ v: dts.length ? `${fd(dts[0])} – ${fd(dts[dts.length - 1])}` : "", s: st({ font: "sub" }) }] });
      const wh = full([{ v: "", s: st({ fill: "262626" }) }]), ch = full([{ v: "Ćwiczenie", s: st({ font: "b", fill: "BFBFBF", border: "R" }) }]);
      b.weeks.forEach((w, wi) => {
        const wd = w.days.map((d) => d.date).filter(Boolean).sort();
        for (let k = 0; k < NC; k++) {
          wh[c0(wi) + k] = { v: k ? "" : `TYDZIEŃ ${wi + 1}${wd.length ? "   " + fmtDate(wd[0], false) + " – " + fmtDate(wd[wd.length - 1], false) : ""}`, s: st({ font: "white", fill: "262626", h: "center", border: k ? undefined : "L" }) };
          ch[c0(wi) + k] = { v: WC[k], s: st({ font: "b", fill: "BFBFBF", h: k === 1 ? "right" : k === NC - 1 ? undefined : "center", border: k ? "R" : "LR" }) };
        }
        merges.push(`${colL(c0(wi))}3:${colL(c0(wi) + NC - 1)}3`);
      });
      rows.push({ h: 22, cells: wh }); rows.push({ h: 20, cells: ch });
      const nDays = Math.max(0, ...b.weeks.map((w) => w.days.length));
      for (let di = 0; di < nDays; di++) {
        const dayFill = XL_DAY[di % XL_DAY.length];
        const dn = (b.weeks.find((w) => w.days[di]) || { days: [] }).days[di];
        const band = full([{ v: (dn ? dn.name : `Dzień ${di + 1}`).toUpperCase(), s: st({ font: "b", fill: dayFill, border: "R" }) }]);
        b.weeks.forEach((w, wi) => { const d = w.days[di]; for (let k = 0; k < NC; k++) band[c0(wi) + k] = { v: !k && d && d.date ? fmtDate(d.date) : "", s: st({ font: "b", fill: dayFill, border: k ? undefined : "L" }) }; });
        rows.push({ h: 20, cells: band });
        const nSlots = Math.max(0, ...b.weeks.map((w) => (w.days[di] ? w.days[di].entries.length : 0)));
        const rowOf = b.weeks.map(() => ({}));
        for (let si = 0; si < nSlots; si++) {
          const r = rows.length + 1, fill = XL_ROW[si % 2];
          const names = [];
          b.weeks.forEach((w) => { const e = w.days[di] && w.days[di].entries[si]; if (e && !names.includes(exName(e.exId))) names.push(exName(e.exId)); });
          const exLabel = names.slice(0, 2).join(" / ") + (names.length > 2 ? " / …" : "");
          fit(0, exLabel, true);
          const cells = full([{ v: exLabel, s: st({ font: "b", fill, border: "RB" }) }]);
          b.weeks.forEach((w, wi) => {
            const d = w.days[di], e = d && d.entries[si], col = c0(wi);
            const S0 = (k, sp) => st({ fill, border: k ? "RB" : "LRB", ...sp });
            if (!e) { for (let k = 0; k < NC; k++) cells[col + k] = { v: "", s: S0(k) }; return; }
            rowOf[wi][e.id] = r;
            const L = e.log;
            const KG = colL(col + 2);
            const kgS = S0(2, { font: "b", h: "center" });
            let kgCell;
            if (L) kgCell = { v: L.kgText ? L.kgText : L.kg != null && L.kg > 0 ? Number(L.kg) : "BW", s: kgS };
            else {
              // sugestia: widełki tam, gdzie aplikacja je liczy (RPE), inaczej jeden ciężar
              let x = null; try { x = E.suggest(S, { b, wi, d, di, e }); } catch { x = null; }
              const kg = x && x.kg > 0 ? x.kg : null;
              const range = x && x.lo != null && x.hi != null && x.lo !== x.hi && x.lo > 0 ? `${F(x.lo, 2)}–${F(x.hi, 2)}` : null;
              let f = null, v = null;
              const val = Number(e.value);
              if (withF && e.kgMode !== "manual" && e.type === "pct_max" && val > 0 && tmRow[e.refEx || e.exId]) { f = `QUOTIENT(TM!$B$${tmRow[e.refEx || e.exId]}*${val / 100},${STEP})*${STEP}`; v = kg; }
              else if (withF && e.kgMode !== "manual" && e.type === "pct_top" && val > 0) {
                const i = d.entries.indexOf(e); let top = null;
                for (let k = i - 1; k >= 0; k--) if (d.entries[k].exId === e.exId && d.entries[k].type !== "pct_top") { top = d.entries[k]; break; }
                const t = top && rowOf[wi][top.id];
                if (t) { f = `IF(ISNUMBER(${KG}${t}),QUOTIENT(${KG}${t}*${(100 - val) / 100},${STEP})*${STEP},${kg != null ? kg : '""'})`; v = kg; }
              }
              if (!f && range) { f = `"${range}"`; v = range; }
              else if (!f && kg != null) { f = String(kg); v = kg; }
              kgCell = f ? { f, v: v != null ? v : undefined, s: kgS } : { v: "", s: kgS };
              if (f) cfCols.add(col + 2);
              fit(col + 2, v != null ? (typeof v === "number" ? F(v, 2) : v) : "", false);
            }
            if (L) fit(col + 2, typeof kgCell.v === "number" ? F(kgCell.v, 2) : kgCell.v, true);
            const nm = names.length > 1 ? `${exName(e.exId)}: ` : "";
            const note = [e.note, setsText(L) ? "serie: " + setsText(L) : "", L && L.note ? L.note.replace(/\s+/g, " ") : "", e.skip ? "poza e1RM" : ""].filter(Boolean).join(" · ");
            const plan = `${e.sets || "?"} × ${e.reps || "?"}`, inten = nm + intensityText(e);
            const reps = L ? (L.reps != null ? Number(L.reps) : num(e.reps)) : "", rpe = L && L.rpe != null ? Number(L.rpe) : "";
            cells[col] = { v: plan, s: S0(0, { h: "center" }) }; fit(col, plan);
            cells[col + 1] = { v: inten, s: S0(1, { h: "right" }) }; fit(col + 1, inten);
            cells[col + 2] = kgCell;
            cells[col + 3] = { v: reps, s: S0(3, { h: "center" }) }; fit(col + 3, reps);
            cells[col + 4] = { v: rpe, s: S0(4, { h: "center" }) }; fit(col + 4, rpe);
            cells[col + 5] = { v: note, s: S0(5, { font: "i" }) }; fit(col + 5, note);
          });
          rows.push({ h: 19, cells });
        }
      }
      // szerokości: dopasowane do treści, w rozsądnych granicach
      widths[0] = Math.min(42, Math.max(14, widths[0]));
      for (let ci = 1; ci < nCols; ci++) { const k = (ci - 1) % NC; widths[ci] = Math.min(WMAX[k], Math.max(WMIN[k], widths[ci])); }
      const cf = [...cfCols].map((ci) => `${colL(ci)}5:${colL(ci)}${rows.length}`);
      sheets.push({ name, xml: xlSheet(rows, { widths, freezeRow: 4, freezeCol: 1, merges, active: bIdx === 0, cf }) });
    });
    const xlStylesXml = SB.xml();
    const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="${sheets.length > 1 ? 1 : 0}"/></bookViews><sheets>${sheets.map((x, i) => `<sheet name="${xesc(x.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
    const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((x, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((x, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    return zipStore([{ name: "[Content_Types].xml", data: ct }, { name: "_rels/.rels", data: rels }, { name: "xl/workbook.xml", data: wb }, { name: "xl/_rels/workbook.xml.rels", data: wbRels }, { name: "xl/styles.xml", data: xlStylesXml },
      ...sheets.map((x, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: x.xml }))]);
  }
  async function exportXlsx() {
    const pid = ($("#tx-plan") && $("#tx-plan").value) || ui.planId;
    const p = S.plans.find((x) => x.id === pid); if (!p) return;
    let data;
    try { data = buildXlsx(pid, !$("#xl-formulas") || $("#xl-formulas").checked); } catch (err) { console.error(err); toast("Nie udało się utworzyć arkusza."); return; }
    await saveFile(`${slugify(p.name) || "trening"}-${today()}.xlsx`, data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Arkusz");
  }
  async function exportTrainer(mode) {
    const pid = ($("#tx-plan") && $("#tx-plan").value) || ui.planId;
    const p = S.plans.find((x) => x.id === pid); if (!p) return;
    const text = trainerText(pid, $("#tx-future") && $("#tx-future").checked);
    if (mode === "copy") {
      try { await navigator.clipboard.writeText(text); toast("Skopiowano. Wklej w czacie."); }
      catch { toast("Schowek niedostępny. Użyj „Pobierz plik”."); }
      return;
    }
    await saveFile(`${slugify(p.name) || "trening"}-wyniki-${today()}.md`, text, "text/markdown", "Plik");
  }
  async function saveFile(name, data, mime, label) {
    let dl = null;
    try { dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null; } catch { dl = null; }
    if (dl) {
      try { await dl.save({ filename: name, data }); toast(`${label} gotowy.`); return true; }
      catch (err) { if (!err || err.code !== "declined") toast("Nie udało się zapisać pliku. Spróbuj ponownie."); }
      return false;
    }
    if (!window.claude) {
      // poza Claude: arkusz udostępniania (telefon) albo zwykłe pobranie pliku
      try {
        const file = new File([data], name, { type: mime });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; }
      } catch (err) { if (err && err.name === "AbortError") return false; }
      const url = URL.createObjectURL(new Blob([data], { type: mime }));
      const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(`${label} zapisany.`); return true;
    }
    try { await navigator.clipboard.writeText(data); toast("Pobieranie niedostępne — skopiowałem zawartość do schowka."); return true; }
    catch { toast("Pobieranie i schowek są tu niedostępne."); return false; }
  }
  function importFile(file) {
    const fr = new FileReader();
    fr.onload = () => {
      let data;
      try { data = JSON.parse(fr.result); } catch { toast("To nie jest poprawny plik kopii (JSON)."); return; }
      if (!data || !Array.isArray(data.blocks) || typeof data.exercises !== "object") { toast("W pliku brakuje bloków lub ćwiczeń."); return; }
      pendingImport = data;
      openSheet(`<div><h3>Wczytać kopię?</h3><div class="sub">${(data.plans || []).length || 1} tren., ${data.blocks.length} bloków, ${Object.keys(data.exercises).length} ćwiczeń.</div></div>
        <div class="banner bad"><div>Obecne dane zostaną zastąpione zawartością pliku.</div><div class="btn-row"><button class="btn danger" data-act="confirmImport">Zastąp moje dane</button></div></div>`);
    };
    fr.readAsText(file);
  }
  let pendingImport = null;
  function confirmImport() {
    const data = pendingImport; if (!data) return;
    const oldIds = S.blocks.map((b) => b.id);
    S = E.normalize({ settings: data.settings, exercises: data.exercises, plans: data.plans, blocks: data.blocks });
    S._order = S.blocks.map((b) => b.id);
    if (Store.mode === "cloud") {
      for (const id of oldIds) if (!S.blocks.some((b) => b.id === id)) Store.queue("blocks/" + id, () => null);
      for (const b of S.blocks) Store.touchBlock(b.id);
    }
    Store.touchMeta();
    pendingImport = null; pickDefault(); closeSheet(); toast("Wczytano kopię.");
  }

  // ---------------------------------------------------------------- zdarzenia
  const actions = {
    tab(el) { ui.tab = el.dataset.tab; closeSheet(true); render(); window.scrollTo(0, 0); },
    week(el) { ui.wi = +el.dataset.i; render(); },
    blocks() { sheetBlocks(); },
    pickBlock(el) { selectPlanBlock(el.dataset.id); closeSheet(); window.scrollTo(0, 0); },
    newBlock() { sheetCreate("block"); },
    newPlan() { sheetCreate("plan"); },
    createFromSheet(el) { createFromSheet(el.dataset.kind); },
    plans() { sheetPlans(); },
    pickPlan(el) { ui.planId = el.dataset.id; selectPlanBlock(); closeSheet(); window.scrollTo(0, 0); },
    planSettings() { sheetPlanSettings(); },
    bases() { if (ui.planId) sheetBases(ui.planId, false); },
    closeSheet() { closeSheet(); },
    fillTm(el) {
      const f = parseNum(el.dataset.v) || 1;
      $$(".tm-in").forEach((inp) => { const x = S.exercises[inp.dataset.ex]; const cur = x && !x.bw ? E.currentE1rm(S, inp.dataset.ex) : null; if (cur) inp.value = F(E.roundTo(cur.value * f, stepKg()), 2); });
    },
    saveBases(el) {
      const p = S.plans.find((x) => x.id === el.dataset.pid); if (!p) return;
      p.bases = p.bases || {};
      $$(".tm-in").forEach((inp) => { const v = parseNum(inp.value); if (v != null && v > 0) p.bases[inp.dataset.ex] = v; else delete p.bases[inp.dataset.ex]; });
      Store.touchMeta(); closeSheet(); toast("Zapisano Training max.");
    },
    setTm(el) { setTm(el.dataset.pid, el.dataset.ex, parseNum(el.dataset.v)); },
    renamePlan() { const p = plan(); if (!p) return; p.name = $("#ps-name").value.trim() || p.name; Store.touchMeta(); closeSheet(); },
    deletePlan() {
      const p = plan(); if (!p) return;
      const gone = planBlocks(p.id).map((b) => b.id);
      S.blocks = S.blocks.filter((b) => b.planId !== p.id);
      S.plans = S.plans.filter((x) => x.id !== p.id);
      S._order = S.blocks.map((x) => x.id);
      if (Store.mode === "cloud") for (const id of gone) Store.queue("blocks/" + id, () => null);
      Store.touchMeta(); ui.planId = null; pickDefault(); closeSheet(); toast("Usunięto trening.");
    },
    shiftPlan() {
      const p = plan(); if (!p) return;
      const nv = $("#ps-start").value, old = planFirstDate();
      if (!nv || !old) { toast("Wybierz datę pierwszego dnia."); return; }
      const delta = daysDiff(old, nv);
      if (!delta) { toast("Data jest taka sama, nic nie zmieniono."); return; }
      for (const b of planBlocks()) { shiftBlockDates(b, delta); Store.touchBlock(b.id); }
      closeSheet(); toast(`Przesunięto daty o ${Math.abs(delta)} dni ${delta > 0 ? "do przodu" : "wstecz"}.`);
    },
    shiftBlock() {
      const b = block(); if (!b) return;
      const nv = $("#bs-start").value, old = blockFirstDate(b);
      if (!nv || !old) { toast("Wybierz datę pierwszego dnia."); return; }
      const delta = daysDiff(old, nv);
      if (!delta) { toast("Data jest taka sama, nic nie zmieniono."); return; }
      const list = $("#bs-after").checked ? planBlocks().filter((x) => x.id === b.id || (x.start || "") > (b.start || "")) : [b];
      for (const x of list) { shiftBlockDates(x, delta); Store.touchBlock(x.id); }
      closeSheet(); toast(`Przesunięto daty o ${Math.abs(delta)} dni ${delta > 0 ? "do przodu" : "wstecz"}.`);
    },
    blockSettings() { sheetBlockSettings(); },
    renameBlock() { const b = block(); if (!b) return; b.name = $("#bs-name").value.trim() || b.name; Store.touchBlock(b.id); closeSheet(); },
    deleteBlock() {
      const b = block(); if (!b) return;
      S.blocks = S.blocks.filter((x) => x.id !== b.id); S._order = S.blocks.map((x) => x.id);
      if (Store.mode === "cloud") Store.queue("blocks/" + b.id, () => null);
      Store.touchMeta(); selectPlanBlock(); closeSheet(); toast("Usunięto blok.");
    },
    addWeek() { sheetAddWeek(); },
    createWeek() { createWeek(); },
    nwToggle(el) {
      if (!weekDraft) return;
      const id = el.dataset.id, row = $("#nw-" + CSS.escape(id));
      const off = !weekDraft.removed.has(id);
      if (off) weekDraft.removed.add(id); else weekDraft.removed.delete(id);
      row.classList.toggle("removed", off);
      $$("input", row).forEach((i) => { i.disabled = off; });
      el.textContent = off ? "↺" : "✕";
      el.setAttribute("aria-label", off ? "Przywróć" : "Pomiń w tym tygodniu");
    },
    weekMenu() { sheetWeekMenu(); },
    deleteWeek() { const b = block(); if (!b || b.weeks.length < 2) return; b.weeks.splice(ui.wi, 1); ui.wi = Math.max(0, ui.wi - 1); Store.touchBlock(b.id); closeSheet(); toast("Usunięto tydzień."); },
    addDay() {
      const b = block(); if (!b) return;
      const w = b.weeks[ui.wi];
      const lastDate = w.days.map((d) => d.date).filter(Boolean).sort().pop();
      w.days.push({ id: E.uid(), name: `Dzień ${w.days.length + 1}`, date: lastDate ? E.addDays(lastDate, 1) : today(), entries: [] });
      Store.touchBlock(b.id); closeSheet();
    },
    dayMenu(el) { sheetDayMenu(refFrom(el)); },
    saveDay(el) {
      const c = ctxOf(refFrom(el)); if (!c.d) return;
      const name = $("#dm-name").value.trim() || c.d.name;
      if ($("#dm-all").checked) c.b.weeks.forEach((w) => { if (w.days[c.di] && w.days[c.di].name === c.d.name) w.days[c.di].name = name; });
      c.d.name = name; c.d.date = $("#dm-date").value || c.d.date;
      Store.touchBlock(c.b.id); closeSheet();
    },
    deleteDay(el) { const c = ctxOf(refFrom(el)); if (!c.w) return; c.w.days.splice(c.di, 1); Store.touchBlock(c.b.id); closeSheet(); toast("Usunięto dzień."); },
    addEntry(el) { sheetEntry(refFrom(el), true); },
    log(el) { sheetLog(refFrom(el)); },
    editEntry(el) { const ref = refFrom(el); sheetEntry(ref, false); },
    entryType(el) {
      if (!entryCtx) return;
      const sv = collectEntryForm(false);
      entryCtx.st.type = el.dataset.v;
      drawEntrySheet(sv);
    },
    saveEntry(el) { const ref = refFrom(el); saveEntry(ref, el.dataset.e === ""); },
    moveEntry(el) {
      const ref = refFrom(el); const c = ctxOf(ref); const dir = +el.dataset.dir;
      const j = c.ei + dir; if (j < 0 || j >= c.d.entries.length) return;
      const arr = c.d.entries; [arr[c.ei], arr[j]] = [arr[j], arr[c.ei]];
      Store.touchBlock(c.b.id); closeSheet();
    },
    dupEntry(el) {
      const c = ctxOf(refFrom(el));
      const copy = JSON.parse(JSON.stringify(c.e)); copy.id = E.uid(); copy.log = null; delete copy.sug; delete copy.basis; delete copy.ok;
      c.d.entries.splice(c.ei + 1, 0, copy); Store.touchBlock(c.b.id); closeSheet(); toast("Zduplikowano.");
    },
    delEntry(el) { const c = ctxOf(refFrom(el)); c.d.entries.splice(c.ei, 1); Store.touchBlock(c.b.id); closeSheet(); toast("Usunięto z planu."); },
    srcMode(el) {
      const ref = refFrom(el); const c = ctxOf(ref); if (!c.e || c.e.log) return;
      if (el.dataset.v === "manual") {
        if (c.e.kgMode !== "manual") { const s = E.suggest(S, c); c.e.kgPlan = s && s.kg != null ? s.kg : null; }
        c.e.kgMode = "manual";
      } else { delete c.e.kgMode; delete c.e.kgPlan; }
      Store.touchBlock(c.b.id); render(true); sheetLog(ref, true);
    },
    kgStep(el) { const inp = $("#f-kg"); const v = (parseNum(inp.value) ?? 0) + parseNum(el.dataset.v); inp.value = F(Math.max(0, v), 2); inp.dispatchEvent(new Event("input")); },
    repsStep(el) { const inp = $("#f-reps"); const v = Math.max(0, (parseNum(inp.value) ?? 0) + parseNum(el.dataset.v)); inp.value = v; $$("#f-reps-chips button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.v === v))); },
    repsChip(el) { $("#f-reps").value = el.dataset.v; $$("#f-reps-chips button").forEach((b) => b.setAttribute("aria-pressed", String(b === el))); },
    rpeChip(el) { const on = el.getAttribute("aria-pressed") !== "true"; $$("#f-rpe button").forEach((b) => b.setAttribute("aria-pressed", "false")); el.setAttribute("aria-pressed", String(on)); },
    saveLog(el) {
      const ref = refFrom(el); const c = ctxOf(ref); if (!c.e) return;
      const kg = parseNum($("#f-kg").value);
      const reps = parseNum($("#f-reps").value);
      const rpeBtn = $('#f-rpe button[aria-pressed="true"]');
      const rpe = rpeBtn ? parseNum(rpeBtn.dataset.v) : null;
      const note = $("#f-note").value.trim() || null;
      if (kg == null && rpe == null) { toast("Wpisz ciężar albo wybierz RPE."); return; }
      if ($("#f-plan") && !c.e.log) { const pv = parseNum($("#f-plan").value); c.e.kgPlan = pv != null && pv > 0 ? pv : null; }
      if (!c.e.log) {
        const s = E.suggest(S, c);
        c.e.sug = s && s.kg != null ? s.kg : null;
        c.e.basis = s && s.basis != null ? Math.round(s.basis * 10) / 10 : null;
      }
      const prevKgText = c.e.log && c.e.log.kgText && c.e.log.kg === kg ? c.e.log.kgText : undefined;
      c.e.log = { kg, reps: reps != null ? Math.round(reps) : null, rpe, note, at: c.d.date || today() };
      // wcześniejsze serie (jeśli zapisywane osobno): lista wszystkich serii, ostatnia = pola główne
      if ($("#set-rows")) {
        const rows = $$("#set-rows .setrow").map((r) => ({ kg: parseNum(r.querySelector(".s-kg").value), reps: parseNum(r.querySelector(".s-reps").value), rpe: parseNum(r.querySelector(".s-rpe").value) }))
          .filter((x) => x.kg != null || x.reps != null)
          .map((x) => ({ kg: x.kg, reps: x.reps != null ? Math.round(x.reps) : null, rpe: x.rpe }));
        if (rows.length) c.e.log.sets = [...rows, { kg, reps: c.e.log.reps, rpe }];
      }
      if (prevKgText) c.e.log.kgText = prevKgText;
      delete c.e.ok;
      if ($("#f-skip") && $("#f-skip").checked) c.e.skip = true; else delete c.e.skip;
      Store.touchBlock(c.b.id);
      closeSheet();
      const flag = flaggedEntries().get(c.e.id);
      const noRpe = rpe == null && kg != null && kg > 0 && (c.e.type === "rpe" || c.e.rpe) && !(S.exercises[c.e.exId] || {}).bw;
      const prAsk = kg > 0 && reps === 1 && !(S.exercises[c.e.exId] || {}).bw
        && (c.d.date || today()) >= E.addDays(today(), -45) && (E.baseTm(S, c.b.planId, c.e.exId) || (S.exercises[c.e.exId] || {}).comp)
        && (() => { const pr = bestSingle(c.e.exId, c.e.id); return !pr || kg > pr.kg; })();
      toast(c.e.skip ? "Zapisano. Ten wynik nie liczy się do e1RM." : flag ? `Zapisano. Skok e1RM +${Math.round(flag.change * 100)}% — sprawdź wynik.` : noRpe ? "Zapisano. Bez RPE ten wynik nie liczy się do e1RM." : "Zapisano wynik.");
      if (prAsk && adv()) sheetPr(c.e.exId, kg, c.b.planId);
    },
    clearLog(el) { const c = ctxOf(refFrom(el)); c.e.log = null; delete c.e.skip; delete c.e.sug; delete c.e.basis; delete c.e.ok; Store.touchBlock(c.b.id); closeSheet(); toast("Usunięto wynik."); },
    confirmEntry(el) { const c = ctxOf(refFrom(el)); c.e.ok = true; Store.touchBlock(c.b.id); closeSheet(); toast("Wynik wliczony do e1RM."); },
    confirmSession(el) {
      const id = el.dataset.entry;
      for (const b of S.blocks) for (const w of b.weeks) for (const d of w.days) for (const e of d.entries) if (e.id === id) { e.ok = true; Store.touchBlock(b.id); }
      render(); toast("Wynik wliczony do e1RM.");
    },
    allSess() { ui.allSess = !ui.allSess; render(); },
    editExercise(el) { sheetExercise(el.dataset.id || null); },
    saveExercise(el) { saveExercise(el.dataset.id || null); },
    exportJson() { exportJson(); },
    applyPropagate() { applyPropagate(); },
    resetCalc() { for (const k of CALC_KEYS) S.settings[k] = E.DEFAULT_SETTINGS[k]; Store.touchMeta(); render(); toast("Przywrócono domyślne obliczenia."); },
    uiMode(el) { S.settings.ui = el.dataset.v === "simple" ? "simple" : "advanced"; Store.touchMeta(); render(); toast(adv() ? "Widok zaawansowany." : "Widok prosty."); },
    perSetToggle(el) {
      S.settings.perSet = !S.settings.perSet; Store.touchMeta();
      const btn = $('[data-act="saveLog"]'); if (btn) sheetLog(refFrom(btn), true);
    },
    setAdd() {
      const box = $("#set-rows"); if (!box) return;
      const rows = $$("#set-rows .setrow"), lastRow = rows[rows.length - 1];
      const st = lastRow ? { kg: parseNum(lastRow.querySelector(".s-kg").value), reps: parseNum(lastRow.querySelector(".s-reps").value), rpe: null } : { kg: parseNum($("#f-kg").value), reps: parseNum($("#f-reps").value), rpe: null };
      box.insertAdjacentHTML("beforeend", setRowHtml(rows.length, st)); renumberSets();
    },
    setDel() { const rows = $$("#set-rows .setrow"); if (rows.length) { rows[rows.length - 1].remove(); renumberSets(); } },
    settingBool(el) { S.settings[el.dataset.key] = !!el.checked; Store.touchMeta(); render(); toast("Ustawienie zapisane."); },
    gotoEntry(el) {
      const ref = refFrom(el); const b = S.blocks.find((x) => x.id === ref.b); if (!b) return;
      ui.planId = b.planId; ui.blockId = b.id; ui.wi = ref.w; ui.tab = "train";
      closeSheet(true); render(); window.scrollTo(0, 0);
      sheetLog(ref);
    },
    backupLater() { try { localStorage.setItem("trening-backup-snooze", E.addDays(today(), 3)); } catch { } render(); },
    exportTrainer(el) { exportTrainer(el.dataset.v); },
    exportXlsx() { exportXlsx(); },
    shareWeek() { sheetShare("week"); },
    shareDay(el) { sheetShare("day", refFrom(el)); },
    shareOpt(el) { if (!shareCtx) return; shareCtx[el.dataset.k] = el.dataset.v === "1"; drawShareSheet(true); },
    shareSave() { shareSave(); },
    lookScale(el) { look.scale = parseFloat(el.dataset.v) || 1; applyLook(); render(); },
    lookSkin(el) { look.skin = el.dataset.v; applyLook(); render(); },
    importJson() { $("#f-import").click(); },
    confirmImport() { confirmImport(); },
  };
  const changes = {
    shareNotes(el) { if (!shareCtx) return; shareCtx.withNotes = !!el.checked; drawShareSheet(true); },
    progressEx(el) { ui.ex = el.value; ui.allSess = false; render(); },
    unused(el) { ui.showUnused = el.checked; render(); },
    setting(el) {
      const k = el.dataset.key; let v = parseNum(el.value);
      if (v == null) { render(); return; }
      if (k === "jump") v = v / 100;
      if (k === "sessions" || k === "maxReps") v = Math.max(1, Math.round(v));
      S.settings[k] = v; Store.touchMeta(); render(); toast("Ustawienie zapisane.");
    },
    importFile(el) { if (el.files && el.files[0]) importFile(el.files[0]); el.value = ""; },
    entryEx() { toggleNewEx(); },
    planKg(el) {
      const c = ctxOf(refFrom(el)); if (!c.e || c.e.log) return;
      const old = c.e.kgPlan; const v = parseNum(el.value);
      c.e.kgPlan = v != null && v > 0 ? v : null;
      Store.touchBlock(c.b.id); render(true);
      const f = $("#f-kg");
      if (f && (f.value === "" || parseNum(f.value) === old)) { f.value = c.e.kgPlan != null ? F(c.e.kgPlan, 2) : ""; f.dispatchEvent(new Event("input")); }
    },
    draftSrc(el) { const box = $("#draft-extra"); if (box) box.innerHTML = draftExtra(el.value); },
    entryProg(el) {
      if (!entryCtx) return;
      const sv = collectEntryForm(true);
      entryCtx.st.prog = el.value;
      drawEntrySheet(sv);
    },
  };
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act]");
    if (!el) return;
    const fn = actions[el.dataset.act];
    if (fn) { ev.preventDefault(); fn(el); }
  });
  document.addEventListener("change", (ev) => {
    const el = ev.target.closest("[data-change]");
    if (el && changes[el.dataset.change]) changes[el.dataset.change](el);
  });
  document.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.dataset && el.dataset.input === "search") {
      ui.search = el.value;
      const pos = el.selectionStart;
      render();
      const s = $("#f-search"); if (s) { s.focus(); try { s.setSelectionRange(pos, pos); } catch { } }
    }
  });
  let rz = 0;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (ui.tab === "progress") drawChart(); }, 150); });

  // ---------------------------------------------------------------- start
  try { const u = JSON.parse(localStorage.getItem("trening-ui") || "{}"); if (u.tab) ui.tab = u.tab; if (u.ex) ui.ex = u.ex; if (u.planId) ui.planId = u.planId; if (u.pos && typeof u.pos === "object") ui.pos = u.pos; } catch { }
  render();
  Store.connect();
})();


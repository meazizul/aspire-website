/* ASPIRE website — progressive enhancement only. The page is fully readable
   without JavaScript; this file adds the theme switcher, mobile nav, the
   mechanism animation, the audio lag meter, and the SVG charts. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- theme (Light / Dark / System), Be My Eyes style ---------- */
  const root = document.documentElement;
  const themeBtn = $('#theme-btn');
  const themeMenu = $('#theme-menu');
  function applyTheme(mode, persist) {
    if (mode === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', mode);
    $$('#theme-menu button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.theme === mode)));
    if (persist) { try { localStorage.setItem('aspire-theme', mode); } catch (e) {} }
    document.dispatchEvent(new CustomEvent('themechange'));
  }
  let saved = 'system'; try { saved = localStorage.getItem('aspire-theme') || 'system'; } catch (e) {}
  applyTheme(saved, false);
  if (themeBtn && themeMenu) {
    themeBtn.addEventListener('click', () => {
      const open = themeMenu.classList.toggle('open');
      themeBtn.setAttribute('aria-expanded', String(open));
      if (open) themeMenu.querySelector('button[aria-pressed="true"]')?.focus();
    });
    themeMenu.addEventListener('click', e => { const b = e.target.closest('button[data-theme]'); if (b) { applyTheme(b.dataset.theme, true); themeMenu.classList.remove('open'); themeBtn.setAttribute('aria-expanded', 'false'); themeBtn.focus(); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && themeMenu.classList.contains('open')) { themeMenu.classList.remove('open'); themeBtn.setAttribute('aria-expanded', 'false'); themeBtn.focus(); } });
    document.addEventListener('click', e => { if (!e.target.closest('.theme-menu')) { themeMenu.classList.remove('open'); themeBtn.setAttribute('aria-expanded', 'false'); } });
  }

  /* ---------- mobile nav ---------- */
  const navToggle = $('.nav-toggle'), navLinks = $('#nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => { const open = navLinks.classList.toggle('open'); navToggle.setAttribute('aria-expanded', String(open)); });
    navLinks.addEventListener('click', e => { if (e.target.closest('a')) { navLinks.classList.remove('open'); navToggle.setAttribute('aria-expanded', 'false'); } });
  }
  /* current-section highlight */
  const sections = $$('main section[id]');
  const linkFor = id => $(`#nav-links a[href="#${id}"]`);
  if ('IntersectionObserver' in window && sections.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { $$('#nav-links a').forEach(a => a.removeAttribute('aria-current')); linkFor(en.target.id)?.setAttribute('aria-current', 'true'); } });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(s => io.observe(s));
    const ro = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); ro.unobserve(en.target); } }), { threshold: 0.08 });
    $$('.reveal').forEach(el => ro.observe(el));
  } else { $$('.reveal').forEach(el => el.classList.add('in')); }

  /* ---------- shared timing model (from the rendered audio demo) ---------- */
  const T = window.ASPIRE_DEMO_TIMING || null;
  function behindAt(t) {            // seconds behind live at listener time t
    if (!T) return 0;
    const c = T.curve; if (t <= c[0][0]) return c[0][1];
    for (let i = 1; i < c.length; i++) { if (c[i][0] >= t) { const [t0, b0] = c[i - 1], [t1, b1] = c[i]; const f = (t - t0) / Math.max(1e-6, t1 - t0); return b0 + f * (b1 - b0); } }
    return c[c.length - 1][1];
  }
  function phaseAt(t) {
    if (!T) return 'live';
    const b = behindAt(t);
    if (t < T.inserted_at_s) return 'live';
    if (t < T.inserted_at_s + T.description_len_s) return 'describing';
    return b > 1.0 ? 'catching-up' : 'level';
  }

  /* ---------- mechanism diagram ---------- */
  const mech = $('#mech-svg');
  if (mech && T) {
    const W = 960, H = 290, L = 150, R = 930, yLive = 92, yList = 198, barH = 26;
    const total = Math.max(T.output_len_s, T.original_len_s) + 1;
    const x = t => L + (R - L) * (t / total);
    const ns = 'http://www.w3.org/2000/svg';
    const el = (n, a, parent) => { const e = document.createElementNS(ns, n); for (const k in a) e.setAttribute(k, a[k]); (parent || mech).appendChild(e); return e; };
    mech.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const defs = el('defs', {});
    const pat = el('pattern', { id: 'hatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('rect', { width: 8, height: 8, fill: 'var(--s1)' }, pat);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: 'var(--bg)', 'stroke-width': 3 }, pat);
    // axis ticks every 10 s
    for (let s = 0; s <= total; s += 10) { el('line', { x1: x(s), x2: x(s), y1: 60, y2: 240, stroke: 'var(--grid)' }); el('text', { x: x(s), y: 258, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 12 }).textContent = s + ' s'; }
    // track labels
    const lab = (y, t1, t2) => { el('text', { x: 0, y: y - 2, fill: 'var(--ink)', 'font-size': 13, 'font-weight': 600 }).textContent = t1; el('text', { x: 0, y: y + 14, fill: 'var(--muted)', 'font-size': 11 }).textContent = t2; };
    lab(yLive, 'Live presenter', 'what the room hears'); lab(yList, 'ASPIRE listener', 'what a blind listener hears');
    // live track
    el('rect', { x: x(0), y: yLive - barH / 2, width: x(T.original_len_s) - x(0), height: barH, rx: 4, fill: 'var(--s1)' });
    // slide-change marker
    el('line', { x1: x(T.slide_change_s), x2: x(T.slide_change_s), y1: 40, y2: 236, stroke: 'var(--amber)', 'stroke-width': 2, 'stroke-dasharray': '4 4' });
    el('text', { x: x(T.slide_change_s) + 6, y: 48, fill: 'var(--amber)', 'font-size': 12, 'font-weight': 600 }).textContent = 'Slide changes';
    el('text', { x: x(T.description_ready_s) + 6, y: 64, fill: 'var(--muted)', 'font-size': 11 }).textContent = `description ready (+${T.description_ready_s.toFixed(0)} s)`;
    el('line', { x1: x(T.description_ready_s), x2: x(T.description_ready_s), y1: 56, y2: yLive - barH / 2 - 4, stroke: 'var(--muted)', 'stroke-dasharray': '2 3' });
    // listener track segments from the phase model
    const segs = []; let cur = null; const step = 0.1;
    for (let t = 0; t <= T.output_len_s; t += step) { const p = phaseAt(t); if (!cur || cur.p !== p) { cur = { p, a: t, b: t }; segs.push(cur); } cur.b = t + step; }
    const fillFor = p => p === 'describing' ? 'var(--amber)' : p === 'catching-up' ? 'url(#hatch)' : 'var(--s1)';
    segs.forEach(s => el('rect', { x: x(s.a), y: yList - barH / 2, width: Math.max(1, x(s.b) - x(s.a)), height: barH, rx: 3, fill: fillFor(s.p), class: 'seg seg-' + s.p }));
    const d = segs.find(s => s.p === 'describing'); if (d) { el('text', { x: (x(d.a) + x(d.b)) / 2, y: yList + 4, 'text-anchor': 'middle', fill: 'var(--amber-ink)', 'font-size': 11, 'font-weight': 700 }).textContent = 'description'; }
    const c = segs.find(s => s.p === 'catching-up'); if (c) { el('text', { x: (x(c.a) + x(c.b)) / 2, y: yList + barH / 2 + 16, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 11 }).textContent = 'held speech returned at up to 1.5×, pitch preserved'; }
    // playheads
    const gLive = el('g', { class: 'ph' }); el('circle', { cx: 0, cy: yLive, r: 9, fill: 'var(--bg)', stroke: 'var(--ink)', 'stroke-width': 3 }, gLive);
    const gList = el('g', { class: 'ph' }); el('circle', { cx: 0, cy: yList, r: 9, fill: 'var(--bg)', stroke: 'var(--ink)', 'stroke-width': 3 }, gList);
    const link = el('line', { x1: 0, x2: 0, y1: yLive + 12, y2: yList - 12, stroke: 'var(--ink)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' });
    const gap = el('text', { x: 0, y: (yLive + yList) / 2 + 4, 'text-anchor': 'middle', fill: 'var(--ink)', 'font-size': 12, 'font-weight': 600 });
    const readout = $('#mech-readout'), steps = $$('#mech-steps div');
    const labels = { live: 'level with live', describing: 'describing — speech held', 'catching-up': 'catching up (time-stretch)', level: 'level with live again' };
    function render(t) {
      const b = behindAt(t), p = phaseAt(t), tl = Math.min(T.original_len_s, t + b);
      gList.setAttribute('transform', `translate(${x(t)},0)`); gLive.setAttribute('transform', `translate(${x(tl)},0)`);
      link.setAttribute('x1', x(t)); link.setAttribute('x2', x(tl));
      gap.setAttribute('x', (x(t) + x(tl)) / 2); gap.textContent = b >= 0.3 ? `${b.toFixed(1)} s behind` : '';
      if (readout) readout.textContent = `${t.toFixed(1)} s · ${labels[p]}`;
      steps.forEach(s => s.classList.toggle('active', s.dataset.phase === p || (p === 'level' && s.dataset.phase === 'live')));
    }
    let raf = null, t0 = null, start = 0, playing = false; const SPEED = 2;
    const btn = $('#mech-play');
    function tick(ts) { if (t0 === null) t0 = ts; const t = start + (ts - t0) / 1000 * SPEED; if (t >= T.output_len_s) { render(T.output_len_s); stop(); return; } render(t); raf = requestAnimationFrame(tick); }
    function play() { if (playing) return; playing = true; t0 = null; btn.textContent = 'Pause'; btn.setAttribute('aria-pressed', 'true'); raf = requestAnimationFrame(tick); }
    function stop() { playing = false; if (raf) cancelAnimationFrame(raf); btn.textContent = 'Replay'; btn.setAttribute('aria-pressed', 'false'); start = 0; }
    btn?.addEventListener('click', () => { if (playing) { playing = false; cancelAnimationFrame(raf); start = parseFloat(readout.textContent) || 0; btn.textContent = 'Play'; btn.setAttribute('aria-pressed', 'false'); } else play(); });
    render(reduceMotion ? T.output_len_s : 0);
    if (!reduceMotion && 'IntersectionObserver' in window) { const once = new IntersectionObserver(en => { if (en[0].isIntersecting) { play(); once.disconnect(); } }, { threshold: 0.5 }); once.observe(mech); }
  }

  /* ---------- audio demo: lag meter synced to the "with ASPIRE" player ---------- */
  const withA = $('#audio-with'), lagFill = $('#lag-fill'), lagVal = $('#lag-val'), lagPhase = $('#lag-phase');
  if (withA && T && lagFill) {
    const max = T.max_behind_live_s || 8;
    const labels = { live: 'live', describing: 'description playing, speech held', 'catching-up': 'catching up, pitch preserved', level: 'level with live' };
    const upd = () => { const t = withA.currentTime, b = behindAt(t), p = phaseAt(t); lagFill.style.width = `${Math.min(100, b / max * 100)}%`; lagVal.textContent = `${b.toFixed(1)} s`; lagPhase.textContent = labels[p]; };
    withA.addEventListener('timeupdate', upd); withA.addEventListener('seeked', upd); withA.addEventListener('ended', () => { lagFill.style.width = '0%'; lagVal.textContent = '0.0 s'; lagPhase.textContent = 'level with live'; });
    let r2; withA.addEventListener('play', () => { const loop = () => { upd(); r2 = requestAnimationFrame(loop); }; if (!reduceMotion) loop(); });
    withA.addEventListener('pause', () => cancelAnimationFrame(r2));
    // pause the other players when one starts
    $$('audio').forEach(a => a.addEventListener('play', () => $$('audio').forEach(o => { if (o !== a) o.pause(); })));
  }

  /* ---------- charts: dumbbell (before -> after per item) ---------- */
  function dumbbell(host, spec) {
    const svgHost = $('.chart-svg', host), tableHost = $('.chart-table', host), tip = $('.tip', host);
    const rows = spec.rows, n = rows.length, W = 600, rowH = 84, padT = 20, padB = 36, L = 215, R = 545, H = padT + n * rowH + padB;
    const max = spec.max, x = v => L + (R - L) * (v / max);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', spec.alt);
    const el = (nm, a, p) => { const e = document.createElementNS(ns, nm); for (const k in a) e.setAttribute(k, a[k]); (p || svg).appendChild(e); return e; };
    const grid = el('g', { class: 'grid' }), axis = el('g', { class: 'axis' });
    spec.ticks.forEach(v => { el('line', { x1: x(v), x2: x(v), y1: padT - 6, y2: H - padB + 4 }, grid); el('text', { x: x(v), y: H - padB + 20, 'text-anchor': 'middle' }, axis).textContent = v + spec.unit; });
    rows.forEach((r, i) => {
      const y = padT + i * rowH + rowH / 2;
      const g = el('g', { class: 'row', tabindex: 0, role: 'img', 'aria-label': `${r.label}: ${spec.before} ${r.before}${spec.unit}, ${spec.after} ${r.after}${spec.unit}${r.note ? ', ' + r.note : ''}` });
      el('rect', { class: 'rowbg', x: 0, y: y - rowH / 2 + 2, width: W, height: rowH - 4, rx: 8 }, g);
      el('text', { class: 'ylab', x: 0, y: y - 4 }, g).textContent = r.label;
      if (r.sub) el('text', { class: 'ysub', x: 0, y: y + 15 }, g).textContent = r.sub;
      el('line', { class: 'conn', x1: x(r.before), x2: x(r.after), y1: y, y2: y }, g); if (r.sub) {} 
      el('circle', { class: 'dot', cx: x(r.before), cy: y, r: 9, fill: 'var(--s1-light)' }, g);
      el('circle', { class: 'dot', cx: x(r.after), cy: y, r: 9, fill: 'var(--s1)' }, g);
      const bx = r.before < r.after ? x(r.before) - 12 : x(r.before) + 12, ax = r.before < r.after ? x(r.after) + 12 : x(r.after) - 12;
      el('text', { class: 'dlabel', x: bx, y: y + 4, 'text-anchor': r.before < r.after ? 'end' : 'start' }, g).textContent = r.beforeText || (r.before + spec.unit);
      el('text', { class: 'dlabel', x: ax, y: y + 4, 'text-anchor': r.before < r.after ? 'start' : 'end', 'font-weight': 700 }, g).textContent = r.afterText || (r.after + spec.unit);
      const show = () => { const b = svgHost.getBoundingClientRect(), s = svg.getBoundingClientRect(); const px = s.left - b.left + (x(r.after) / W) * s.width, py = s.top - b.top + (y / H) * s.height; tip.style.left = px + 'px'; tip.style.top = py + 'px'; tip.innerHTML = `<strong>${r.label}</strong><br>${spec.before}: ${r.beforeText || r.before + spec.unit} · ${spec.after}: ${r.afterText || r.after + spec.unit}${r.note ? '<br>' + r.note : ''}`; tip.classList.add('show'); };
      const hide = () => tip.classList.remove('show');
      g.addEventListener('mouseenter', show); g.addEventListener('mouseleave', hide); g.addEventListener('focus', show); g.addEventListener('blur', hide);
    });
    svgHost.appendChild(svg);
    // table view
    const tbl = document.createElement('table');
    tbl.innerHTML = `<caption class="visually-hidden">${spec.alt}</caption><thead><tr><th scope="col">Measure</th><th scope="col" class="num">${spec.before}</th><th scope="col" class="num">${spec.after}</th><th scope="col">Note</th></tr></thead><tbody>${rows.map(r => `<tr><th scope="row">${r.label}${r.sub ? ' <span class="muted small">' + r.sub + '</span>' : ''}</th><td class="num">${r.beforeText || r.before + spec.unit}</td><td class="num">${r.afterText || r.after + spec.unit}</td><td>${r.note || ''}</td></tr>`).join('')}</tbody>`;
    tableHost.appendChild(tbl); tableHost.hidden = true;
    const tg = $$('.chart-toggle button', host);
    tg.forEach(b => b.addEventListener('click', () => { tg.forEach(o => o.setAttribute('aria-pressed', String(o === b))); const table = b.dataset.view === 'table'; tableHost.hidden = !table; svgHost.hidden = table; }));
  }
  const c1 = $('#chart-comprehension'); if (c1) dumbbell(c1, {
    alt: 'Dumbbell chart: share of comprehension questions answered correctly, without and with ASPIRE, across two published studies.',
    unit: '%', max: 100, ticks: [0, 25, 50, 75, 100], before: 'Without ASPIRE', after: 'With ASPIRE',
    rows: [
      { label: 'ASSETS 2026 pilot', sub: 'real-time system · 4 BLV participants · recall', before: 16.7, after: 91.7 },
      { label: 'DIS 2026 study', sub: 'recorded talks · 12 BLV participants · comprehension', before: 50.0, after: 88.9 },
    ]
  });
  const c2 = $('#chart-latency'); if (c2) dumbbell(c2, {
    alt: 'Dumbbell chart: listener delay before and after the July 2026 engineering work, in seconds.',
    unit: ' s', max: 32, ticks: [0, 10, 20, 30], before: 'Before (June 2026)', after: 'After (July 2026)',
    rows: [
      { label: 'Listener delay, median', sub: 'end-to-end, behind live', before: 27.5, beforeText: '25–30 s', after: 4.0, note: 'measured with a real listener connected' },
      { label: 'Listener delay, 95th pct.', sub: 'end-to-end, behind live', before: 30, beforeText: '~30 s', after: 8.7 },
      { label: 'Slide change → spoken', sub: 'stability window + vision + TTS + pause wait', before: 12.4, after: 8.2 },
    ]
  });

  /* ---------- footer year ---------- */
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
})();

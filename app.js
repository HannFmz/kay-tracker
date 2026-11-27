// Kay Pull Tracker: data layer.
// Your log lives in this browser's localStorage; banner facts are fixed below.
(function () {
  const KEY = 'kay-tracker.log.v1';

  // Gathered from game guides on 26 Nov 2026 (Prydwen, GameWith, Game8, PlayStation Store).
  const FACTS = [
    { key: 'pull_cost', value: 500, label: 'Oroberyl per Chartered Headhunting pull' },
    { key: 'spark', value: 120, label: 'Pulls for the guaranteed featured operator (once per banner)' },
    { key: 'banner_end', value: '2026-12-23T11:59:00+08:00', label: 'Kay banner end, Asia server time (UTC+8)' },
    { key: 'pass_daily', value: 200, label: 'Monthly Pass Oroberyl per daily login' },
    { key: 'pass_days', value: 30, label: 'Monthly Pass length in days' },
    { key: 'pass_origeo', value: 12, label: 'Origeometry given on Monthly Pass purchase' },
    { key: 'origeo_rate', value: 75, label: 'Oroberyl per Origeometry' },
    { key: 'reset_hour', value: 4, label: 'Daily reset hour, server time' },
    { key: 'urgent_at', value: 30, label: 'Pulls that unlock 10 free Urgent Recruitment pulls (not counted toward 120)' }
  ];

  const isInt = (n) => Number.isInteger(n) && n >= 0;
  function cleanRow(r) {
    if (!r || typeof r !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(String(r.date))) return null;
    const row = {
      date: String(r.date),
      oroberyl: Number(r.oroberyl), origeometry: Number(r.origeometry || 0),
      permits: Number(r.permits || 0), pulls_done: Number(r.pulls_done),
      pass: r.pass === true || r.pass === 'true'
    };
    return isInt(row.oroberyl) && isInt(row.origeometry) && isInt(row.permits) && isInt(row.pulls_done) ? row : null;
  }

  function readLog() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(v) ? v.map(cleanRow).filter(Boolean) : [];
    } catch (e) { return []; }
  }
  function writeLog(rows) {
    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    localStorage.setItem(KEY, JSON.stringify(rows)); // throws if storage is full or blocked; callers show "not saved"
    schedule();
  }

  window.kayStore = {
    all: readLog,
    put(row) {
      const r = cleanRow(row);
      if (!r) throw new Error('Invalid entry');
      writeLog(readLog().filter((x) => x.date !== r.date).concat(r));
    },
    remove(date) { writeLog(readLog().filter((x) => x.date !== date)); },
    // merges by date; imported rows win. Returns {added, skipped}.
    importRows(list) {
      const map = new Map(readLog().map((r) => [r.date, r]));
      let added = 0, skipped = 0;
      (Array.isArray(list) ? list : []).forEach((x) => {
        const r = cleanRow(x);
        if (r) { map.set(r.date, r); added++; } else skipped++;
      });
      if (added) writeLog([...map.values()]);
      return { added, skipped };
    }
  };

  const calcs = {}, draws = {}, listeners = [];
  let cache = null;
  function rows(id) {
    cache = cache || {};
    if (id in cache) return cache[id];
    let v;
    if (id === 'facts') v = FACTS;
    else if (id === 'log') v = readLog();
    else if (calcs[id]) v = calcs[id].fn(...calcs[id].inputs.map(rows));
    else throw new Error('Unknown source: ' + id);
    cache[id] = v;
    return v;
  }

  window.dash = {
    colors: ['var(--kt-lime)', 'var(--kt-lime-mid)', 'var(--kt-olive)', 'var(--kt-gray)'],
    calc(id, def) { calcs[id] = def; },
    data(id) {
      try { return { status: 'ok', data: rows(id) }; }
      catch (e) { console.error(id, e); return { status: 'error', data: [], message: String(e) }; }
    },
    draw(name, fn) { draws[name] = fn; },
    onData(fn) { listeners.push(fn); }
  };

  function render() {
    queued = false;
    cache = null;
    listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    Object.entries(draws).forEach(([name, fn]) => {
      document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => {
        if (el.closest('[hidden]')) return; // drawn once it is shown
        try { fn(el); } catch (e) { console.error(name, e); }
      });
    });
  }
  let queued = false;
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(render); } }

  let lastW = 0;
  new ResizeObserver(() => {
    const w = document.documentElement.clientWidth;
    if (w !== lastW) { lastW = w; schedule(); }
  }).observe(document.documentElement);
  window.addEventListener('storage', (e) => { if (e.key === KEY) schedule(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); }); // refresh "days left"
  window.addEventListener('DOMContentLoaded', schedule);
})();

dash.calc('history', {
  inputs: ['log', 'facts'],
  title: 'Pulls secured by entry',
  description: 'Each saved entry with its Oroberyl value (Oroberyl + permits × 500 + Origeometry × 75) and pulls done + pulls that value can buy.',
  fn: (log, facts) => {
    const f = Object.fromEntries(facts.map((r) => [r.key, r.value]));
    return log.map((r) => {
      const oroberyl = Number(r.oroberyl) || 0;
      const origeometry = Number(r.origeometry) || 0;
      const permits = Number(r.permits) || 0;
      const pulls_done = Number(r.pulls_done) || 0;
      const exact = pulls_done + permits + (oroberyl + origeometry * f.origeo_rate) / f.pull_cost;
      return {
        date: String(r.date || r.id),
        oroberyl, origeometry, permits, pulls_done,
        eff_oro: oroberyl + permits * f.pull_cost + origeometry * f.origeo_rate,
        pass: r.pass === true || r.pass === 'true' ? 'Yes' : 'No',
        secured: Math.floor(exact),
        secured_exact: Math.round(exact * 100) / 100
      };
    }).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
});

dash.calc('status', {
  inputs: ['history', 'facts'],
  title: 'Where you stand now',
  description: 'From your latest entry: balance, pulls done, Oroberyl still to earn, time left, Monthly Pass income still to come, your free pace, and changes since the entry before.',
  fn: (history, facts) => {
    if (!history || !history.length) return [];
    const f = Object.fromEntries(facts.map((r) => [r.key, r.value]));
    const day = 86400000, hour = 3600000;
    const last = history[history.length - 1];
    const prev = history.length > 1 ? history[history.length - 2] : null;
    const now = Date.now();
    const end = Date.parse(f.banner_end);
    const daysLeft = Math.max(0, (end - now) / day);
    // daily resets (server time UTC+8) still to come before the banner ends
    let next = Math.floor((now + 8 * hour) / day) * day - 8 * hour + f.reset_hour * hour;
    if (next <= now) next += day;
    let resets = 0;
    for (let t = next; t <= end; t += day) resets++;
    const active = last.pass === 'Yes';
    const claims = Math.min(f.pass_days, active ? resets : resets + 1);
    const passIncome = claims * f.pass_daily + (active ? 0 : f.pass_origeo * f.origeo_rate);
    const fixedPulls = last.pulls_done;
    const oroValue = last.eff_oro;
    const needOf = (r) => Math.max(0, (f.spark - r.pulls_done) * f.pull_cost - r.eff_oro);
    const needOro = needOf(last);
    const needOroPass = Math.max(0, needOro - passIncome);
    const perDay = (x) => (x <= 0 ? 0 : daysLeft > 0 ? Math.ceil(x / daysLeft) : null);
    let pace = null;
    if (history.length > 1) {
      let gain = 0, days = 0;
      for (let i = 1; i < history.length; i++) {
        const a = history[i - 1], b = history[i];
        const d = (Date.parse(b.date) - Date.parse(a.date)) / day;
        let g = (b.secured_exact - a.secured_exact) * f.pull_cost;
        if (b.pass === 'Yes') g -= d * f.pass_daily + (a.pass === 'Yes' ? 0 : f.pass_origeo * f.origeo_rate);
        gain += g; days += d;
      }
      if (days > 0) pace = Math.round(gain / days);
    }
    const freeAhead = pace === null ? null : Math.max(0, pace) * daysLeft;
    return [{
      as_of: last.date,
      target: f.spark,
      pulls_done: last.pulls_done,
      oroberyl: last.oroberyl,
      origeometry: last.origeometry,
      permits: last.permits,
      eff_oro: oroValue,
      secured: last.secured,
      entries: history.length,
      pulls_now: Math.floor(oroValue / f.pull_cost),
      need_oro: Math.round(needOro),
      earn_pulls: Math.ceil(needOro / f.pull_cost),
      need_oro_pass: Math.round(needOroPass),
      per_day_free: perDay(needOro),
      per_day_pass: perDay(needOroPass),
      days_left: Math.round(daysLeft * 10) / 10,
      claims_left: claims,
      pass_income: passIncome,
      pass_active: active ? 'Yes' : 'No',
      pace: pace,
      proj_free: pace === null ? null : Math.floor(fixedPulls + (oroValue + freeAhead) / f.pull_cost),
      proj_pass: pace === null ? null : Math.floor(fixedPulls + (oroValue + freeAhead + passIncome) / f.pull_cost),
      prev_date: prev ? prev.date : null,
      pulls_change: prev ? last.pulls_done - prev.pulls_done : null,
      need_change: prev ? Math.round(needOro) - Math.round(needOf(prev)) : null,
      secured_change: prev ? last.secured - prev.secured : null
    }];
  }
});

dash.calc('breakdown', {
  inputs: ['status', 'facts'],
  title: 'Where the 120 pulls come from',
  description: 'The pulls still to reach 120, split into what your balance covers, what the Monthly Pass adds and what is left to earn free.',
  fn: (status, facts) => {
    if (!status || !status.length) return [];
    const s = status[0];
    const f = Object.fromEntries(facts.map((r) => [r.key, r.value]));
    const done = Math.min(s.pulls_done, s.target);
    const left = s.target - done;
    const now = Math.min(s.pulls_now, left);
    const pass = Math.min(Math.floor(s.pass_income / f.pull_cost), left - now);
    const earn = Math.max(0, left - now - pass);
    return [
      { part: 'Done', pulls: done },
      { part: 'Balance covers', pulls: now },
      { part: s.pass_active === 'Yes' ? 'Pass still adds' : 'Pass would add', pulls: pass },
      { part: 'Left to earn', pulls: earn }
    ];
  }
});

(function () {
  const intFmt = d3.format(',');
  const oneDp = d3.format(',.1f');
  const signed = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + intFmt(Math.abs(v));
  const dayFmt = (v) => d3.utcFormat('%-d %b')(new Date(v + 'T00:00:00Z'));
  const fields = ['target', 'per_day_free', 'per_day_pass', 'need_oro', 'earn_pulls', 'eff_oro', 'days_left', 'pulls_done', 'pulls_now', 'pace', 'proj_free', 'proj_pass', 'claims_left', 'pass_income', 'oroberyl', 'origeometry', 'permits', 'secured', 'entries', 'pulls_change', 'need_change', 'secured_change', 'as_of', 'prev_date'];
  fields.forEach((name) => {
    dash.draw(name, (el) => {
      const s = dash.data('status');
      const r = s.status === 'ok' && s.data && s.data[0];
      if (!r) { el.textContent = '—'; return; }
      const v = r[name];
      if (v === null || v === undefined) { el.textContent = '—'; return; }
      el.textContent = name === 'days_left' ? oneDp(v)
        : /_change$/.test(name) ? signed(v)
        : name === 'as_of' || name === 'prev_date' ? dayFmt(v)
        : intFmt(v);
    });
  });

  function setVariants(group, which) {
    document.querySelectorAll('[data-variant^="' + group + '-"]').forEach((e) => {
      e.hidden = e.dataset.variant !== group + '-' + which;
    });
  }

  const swatch = { now: 'var(--kt-lime)', logged: 'var(--kt-lime-mid)', path: 'var(--kt-gray)', l1: 'var(--kt-olive)', l2: 'var(--kt-lime-mid)', l3: 'var(--kt-lime)' };
  document.querySelectorAll('[data-swatch]').forEach((el) => {
    el.style.background = swatch[el.dataset.swatch] || '';
  });

  let dirty = false;
  const form = document.getElementById('log-form');
  if (form) form.addEventListener('input', () => { dirty = true; });

  function todayLocal() { return new Date().toLocaleDateString('en-CA'); }

  dash.onData(() => {
    const s = dash.data('status');
    const r = s.status === 'ok' && s.data && s.data[0];
    let say = 'short';
    if (s.status === 'ok' && !r) say = 'empty';
    else if (r && r.pulls_done >= r.target) say = 'done';
    else if (r && r.need_oro <= 0) say = 'funded';
    setVariants('say', say);
    setVariants('pace', r && r.pace !== null && r.pace !== undefined ? 'yes' : 'no');
    setVariants('pass', r && r.pass_active === 'Yes' ? 'on' : 'off');
    setVariants('delta', r && r.prev_date ? 'yes' : 'no');
    // less Oroberyl still to earn is good
    document.querySelectorAll('#need-pill').forEach((p) => {
      const bad = r && r.need_change > 0;
      p.classList.toggle('kt-bad', !!bad);
      p.classList.toggle('kt-good', !bad);
    });

    if (form && !dirty && !form.contains(document.activeElement)) {
      const h = dash.data('history');
      const last = h.status === 'ok' && h.data && h.data.length ? h.data[h.data.length - 1] : null;
      form.elements.entry_date.value = todayLocal();
      if (last) {
        form.elements.oroberyl.value = last.oroberyl;
        form.elements.origeometry.value = last.origeometry;
        form.elements.permits.value = last.permits;
        form.elements.pulls_done.value = last.pulls_done;
        form.elements.pass.checked = last.pass === 'Yes';
      }
    }
  });

  function showMsg(which) {
    ['saved-msg', 'unsaved', 'invalid'].forEach((id) => {
      document.querySelectorAll('#' + id).forEach((p) => { p.hidden = id !== which; });
    });
  }

  window.ktRemove = function (date) {
    try { kayStore.remove(date); showMsg(''); } catch (e) { showMsg('unsaved'); }
  };

  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const el = form.elements;
    const date = el.entry_date.value;
    const nums = ['oroberyl', 'origeometry', 'permits', 'pulls_done'].map((k) => Number(el[k].value === '' ? 0 : el[k].value));
    const okDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && el.entry_date.validity.valid;
    if (!okDate || nums.some((n) => !Number.isInteger(n) || n < 0) || el.oroberyl.value === '' || el.pulls_done.value === '') { showMsg('invalid'); return; }
    const row = { date: date, oroberyl: nums[0], origeometry: nums[1], permits: nums[2], pulls_done: nums[3], pass: el.pass.checked };
    try {
      kayStore.put(row);
      dirty = false;
      showMsg('saved-msg');
    } catch (err) { showMsg('unsaved'); }
  });
})();

(function () {
  const fmt = d3.format(',');
  const DAY = 86400000;
  const utcDay = (s) => Date.parse(s + 'T00:00:00Z');
  const keyOf = (t) => new Date(t).toISOString().slice(0, 10);
  const dFmt = d3.utcFormat('%-d %b');
  const factsMap = (f) => Object.fromEntries(f.data.map((r) => [r.key, r.value]));
  const note = (el, t) => { const p = document.createElement('p'); p.className = 'kt-sub'; p.textContent = t; el.append(p); };

  // tooltip inside the chart's own box, kept within its edges
  function makeTip(el) {
    const tip = document.createElement('div');
    tip.className = 'kt-tip'; tip.hidden = true; el.append(tip);
    return {
      show(px, py, lines) {
        tip.replaceChildren(...lines.map((l) => { const d = document.createElement('div'); d.textContent = l; return d; }));
        tip.hidden = false;
        tip.style.left = Math.max(0, Math.min(px - tip.offsetWidth / 2, el.clientWidth - tip.offsetWidth)) + 'px';
        tip.style.top = Math.max(0, py - tip.offsetHeight - 10) + 'px';
      },
      hide() { tip.hidden = true; }
    };
  }

  dash.draw('days', (el) => {
    const h = dash.data('history'), s = dash.data('status'), f = dash.data('facts');
    el.replaceChildren();
    if (h.status === 'error' || s.status === 'error' || f.status === 'error') { note(el, "This chart couldn't load."); return; }
    if (h.status !== 'ok' || s.status !== 'ok' || f.status !== 'ok') { el.textContent = '—'; return; }
    const rows = h.data || [];
    const st = s.data && s.data[0];
    if (!rows.length || !st) { note(el, 'Your first entry will appear here.'); return; }
    const facts = factsMap(f);

    const first = utcDay(rows[0].date);
    const endDay = utcDay(String(facts.banner_end).slice(0, 10));
    const last = rows[rows.length - 1];
    const lastD = utcDay(last.date);
    const goal = Math.max(facts.spark, last.secured_exact);
    const byDate = new Map(rows.map((r) => [r.date, r]));
    const days = [];
    for (let t = first; t <= Math.max(endDay, lastD); t += DAY) {
      const key = keyOf(t), r = byDate.get(key);
      if (r) days.push({ t, key, kind: key === last.date ? 'now' : 'logged', v: r.secured_exact, r });
      else if (t > lastD) days.push({ t, key, kind: 'path', v: last.secured_exact + (goal - last.secured_exact) * (t - lastD) / Math.max(DAY, endDay - lastD) });
      else days.push({ t, key, kind: 'gap', v: 0 });
    }

    const W = Math.max(280, el.clientWidth), H = 240;
    const m = { t: 30, r: 8, b: 24, l: 34 };
    const yMax = Math.max(facts.spark * 1.12, d3.max(days, (d) => d.v) * 1.08);
    const y = d3.scaleLinear().domain([0, yMax]).nice(4).range([H - m.b, m.t]);
    const x = d3.scaleBand().domain(days.map((d) => d.key)).range([m.l, W - m.r]).padding(days.length > 20 ? 0.22 : 0.3);
    const bw = x.bandwidth();

    const svg = d3.select(el).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H).attr('height', H)
      .attr('role', 'img').attr('aria-label', 'Pulls secured on each logged day, ' + fmt(last.secured) + ' on ' + dFmt(new Date(lastD)) + ', against a straight path to 120 by 23 December');
    const defs = svg.append('defs');
    defs.append('pattern').attr('id', 'kt-hatch').attr('width', 6).attr('height', 6).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)')
      .call((p) => {
        p.append('rect').attr('width', 6).attr('height', 6).style('fill', '#1e211b');
        p.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6).style('stroke', '#30342c').style('stroke-width', 3);
      });

    const ticks = y.ticks(4);
    svg.append('g').selectAll('line').data(ticks).join('line')
      .attr('x1', m.l).attr('x2', W - m.r).attr('y1', (v) => y(v)).attr('y2', (v) => y(v)).style('stroke', 'var(--kt-grid)');
    svg.append('g').selectAll('text').data(ticks).join('text')
      .attr('x', m.l - 8).attr('y', (v) => y(v) + 4).attr('text-anchor', 'end').text((v) => fmt(v));

    // 120 guarantee line
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(facts.spark)).attr('y2', y(facts.spark))
      .style('stroke', 'var(--kt-muted)').style('stroke-dasharray', '2 4');
    // left by default; right when the latest bar's value pill would sit on it
    const pillLeft = x(last.date) < m.l + 130 && Math.abs(y(last.secured_exact) - y(facts.spark)) < 40;
    svg.append('text').attr('x', pillLeft ? W - m.r - 4 : m.l + 4).attr('y', y(facts.spark) - 6)
      .attr('text-anchor', pillLeft ? 'end' : 'start').text(facts.spark + ' guarantee');

    const r = Math.min(5, bw / 2);
    const bars = days.filter((d) => d.kind !== 'gap');
    svg.append('g').selectAll('rect').data(bars).join('rect')
      .attr('x', (d) => x(d.key)).attr('width', bw)
      .attr('y', (d) => y(d.v)).attr('height', (d) => Math.max(0, y(0) - y(d.v))).attr('rx', r)
      .style('fill', (d) => d.kind === 'now' ? 'var(--kt-lime)' : d.kind === 'logged' ? 'var(--kt-lime-mid)' : 'url(#kt-hatch)');
    // caps on the path bars mark the level needed that day
    svg.append('g').selectAll('rect').data(bars.filter((d) => d.kind === 'path')).join('rect')
      .attr('x', (d) => x(d.key) + bw * 0.15).attr('width', bw * 0.7).attr('y', (d) => y(d.v) - 1).attr('height', 2.5).attr('rx', 1.25)
      .style('fill', 'var(--kt-lime-mid)');

    // pace line, clipped at the top of the chart
    if (st.pace !== null && st.pace !== undefined) {
      const x0 = x(last.date) + bw / 2, y0 = last.secured_exact;
      let x1 = x(keyOf(endDay)) + bw / 2, y1 = st.proj_free;
      if (y1 > y.domain()[1]) { const k = (y.domain()[1] - y0) / (y1 - y0); x1 = x0 + (x1 - x0) * k; y1 = y.domain()[1]; }
      svg.append('line').attr('x1', x0).attr('y1', y(y0)).attr('x2', x1).attr('y2', y(y1))
        .style('stroke', 'var(--kt-lime)').style('stroke-width', 2).style('stroke-dasharray', '4 4');
    }

    // value label above the latest bar
    const lx = x(last.date) + bw / 2, ly = y(last.secured_exact) - 8;
    const lab = svg.append('g');
    const lt = lab.append('text').attr('class', 'kt-pilltext').attr('x', lx).attr('y', ly - 5).attr('text-anchor', 'middle').text(fmt(last.secured));
    const tw = lt.node().getComputedTextLength() + 12;
    lab.insert('rect', 'text').attr('x', lx - tw / 2).attr('y', ly - 18).attr('width', tw).attr('height', 18).attr('rx', 5).style('fill', 'var(--kt-lime)');

    // x labels about once a week
    const step = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor((W - m.l) / 56))));
    const nowIdx = days.findIndex((d) => d.kind === 'now');
    // the latest day always gets a label, so drop regular ones too close to it
    svg.append('g').selectAll('text').data(days.filter((d, i) => d.kind === 'now' || (i % step === 0 && Math.abs(i - nowIdx) >= step))).join('text')
      .attr('x', (d) => x(d.key) + bw / 2).attr('y', H - 6).attr('text-anchor', 'middle')
      .style('fill', (d) => d.kind === 'now' ? 'var(--kt-fg)' : null).style('font-weight', (d) => d.kind === 'now' ? 600 : null)
      .text((d) => dFmt(new Date(d.t)));

    const tip = makeTip(el);
    svg.append('g').selectAll('rect').data(days).join('rect')
      .attr('x', (d) => x(d.key) - x.step() * x.paddingInner() / 2).attr('width', x.step()).attr('y', m.t).attr('height', H - m.b - m.t)
      .style('fill', 'transparent').style('cursor', 'pointer')
      .on('pointerenter click', (ev, d) => {
        const sc = el.clientWidth / W;
        const lines = [dFmt(new Date(d.t))];
        if (d.r) lines.push(fmt(d.r.secured) + ' secured', fmt(d.r.pulls_done) + ' done + ' + fmt(d.r.secured - d.r.pulls_done) + ' affordable');
        else if (d.kind === 'path') lines.push('On the path: ' + fmt(Math.ceil(d.v)) + ' secured');
        else lines.push('No entry');
        tip.show((x(d.key) + bw / 2) * sc, y(Math.max(d.v, 0)) * sc, lines);
      })
      .on('pointerleave', () => tip.hide());
  });

  const partColor = ['var(--kt-lime)', 'var(--kt-lime-mid)', 'var(--kt-olive)', 'var(--kt-gray)'];

  dash.draw('donut', (el) => {
    const b = dash.data('breakdown');
    el.replaceChildren();
    if (b.status === 'error') { note(el, "This chart couldn't load."); return; }
    if (b.status !== 'ok') { el.textContent = '—'; return; }
    const rows = b.data || [];
    if (!rows.length) { note(el, 'Your first entry will appear here.'); return; }
    const S = 150, R = S / 2;
    const total = d3.sum(rows, (r) => r.pulls);
    const arcs = d3.pie().sort(null).value((r) => r.pulls).padAngle(0.025)(rows.map((r, i) => ({ ...r, i })));
    const svg = d3.select(el).append('svg').attr('viewBox', '0 0 ' + S + ' ' + S).attr('height', S)
      .attr('role', 'img').attr('aria-label', rows.map((r) => r.part + ' ' + r.pulls).join(', ') + ' pulls, of ' + total);
    const g = svg.append('g').attr('transform', 'translate(' + R + ',' + R + ')');
    const tip = makeTip(el);
    g.selectAll('path').data(arcs.filter((a) => a.data.pulls > 0)).join('path')
      .attr('d', d3.arc().innerRadius(R * 0.66).outerRadius(R - 2).cornerRadius(3))
      .style('fill', (a) => partColor[a.data.i]).style('cursor', 'pointer')
      .on('pointerenter click', (ev, a) => {
        const c = d3.arc().innerRadius(R * 0.66).outerRadius(R - 2).centroid(a);
        const sc = el.clientWidth / S;
        tip.show((c[0] + R) * sc, (c[1] + R) * sc, [a.data.part, fmt(a.data.pulls) + ' pulls (' + Math.round(a.data.pulls / total * 100) + '%)']);
      })
      .on('pointerleave', () => tip.hide());
    g.append('text').attr('text-anchor', 'middle').attr('y', 4).style('fill', 'var(--kt-fg)').style('font-size', '26px').style('font-weight', 600).text(fmt(total));
    g.append('text').attr('text-anchor', 'middle').attr('y', 22).style('fill', 'var(--kt-muted)').style('font-size', '11px').text('pulls');
  });

  dash.draw('donut_legend', (ul) => {
    const b = dash.data('breakdown');
    ul.replaceChildren();
    if (b.status !== 'ok') return;
    (b.data || []).forEach((r, i) => {
      const li = document.createElement('li');
      const sw = document.createElement('i'); sw.className = 'kt-sw'; sw.style.background = partColor[i];
      const name = document.createElement('span'); name.textContent = r.part;
      const v = document.createElement('b'); v.textContent = fmt(r.pulls);
      v.dataset.source = 'breakdown'; v.dataset.field = 'pulls'; v.dataset.row = String(i);
      li.append(sw, name, v); ul.append(li);
    });
  });

  dash.draw('segs', (el) => {
    const s = dash.data('status');
    const r = s.status === 'ok' && s.data && s.data[0];
    el.replaceChildren();
    const done = r ? r.pulls_done : 0, target = r ? r.target : 120;
    const n = Math.max(1, Math.round(target / 10));
    for (let i = 0; i < n; i++) {
      const seg = document.createElement('i');
      seg.className = 'kt-seg' + (done >= (i + 1) * 10 ? ' kt-full' : done > i * 10 ? ' kt-part' : '');
      el.append(seg);
    }
    el.setAttribute('aria-label', r ? done + ' of ' + target + ' pulls done' : 'No data yet');
  });

  dash.draw('cal', (el) => {
    const h = dash.data('history'), f = dash.data('facts');
    el.replaceChildren();
    if (h.status === 'error' || f.status === 'error') { note(el, "The calendar couldn't load."); return; }
    if (h.status !== 'ok' || f.status !== 'ok') { el.textContent = '—'; return; }
    const rows = h.data || [];
    if (!rows.length) { note(el, 'Your first entry will appear here.'); return; }
    const facts = factsMap(f);
    const endDay = utcDay(String(facts.banner_end).slice(0, 10));
    const first = utcDay(rows[0].date);
    const today = utcDay(new Date().toLocaleDateString('en-CA'));
    const start = first - ((new Date(first).getUTCDay() + 6) % 7) * DAY; // Monday of the first entry's week
    const made = new Map();
    rows.forEach((r, i) => made.set(r.date, i === 0 ? null : r.pulls_done - rows[i - 1].pulls_done));

    ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((d) => {
      const c = document.createElement('span'); c.className = 'kt-dow'; c.textContent = d; el.append(c);
    });
    const tip = makeTip(el);
    for (let wk = start; wk <= endDay; wk += 7 * DAY) {
      const lab = document.createElement('span'); lab.className = 'kt-wk'; lab.textContent = dFmt(new Date(wk)); el.append(lab);
      for (let t = wk; t < wk + 7 * DAY; t += DAY) {
        const key = keyOf(t);
        const cell = document.createElement('span');
        let cls = 'kt-cell', info;
        if (t > endDay) { cls += ' kt-out'; info = 'After the banner'; }
        else if (made.has(key)) {
          const p = made.get(key);
          cls += p === null ? ' kt-l2' : p >= 10 ? ' kt-l3' : p > 0 ? ' kt-l2' : ' kt-l1';
          info = p === null ? 'First entry' : fmt(p) + ' pulls since the last entry';
        } else if (t < today) { cls += ' kt-past'; info = 'No entry'; }
        else info = t === endDay ? 'Banner ends 11:59' : 'Ahead';
        if (t === today) cls += ' kt-today';
        if (t === endDay) cls += ' kt-end';
        cell.className = cls;
        cell.setAttribute('aria-label', dFmt(new Date(t)) + ': ' + info);
        cell.setAttribute('role', 'img');
        cell.addEventListener('pointerenter', () => {
          const b = cell.getBoundingClientRect(), o = el.getBoundingClientRect();
          tip.show(b.left - o.left + b.width / 2, b.top - o.top, [dFmt(new Date(t)) + (t === today ? ' (today)' : ''), info]);
        });
        cell.addEventListener('pointerleave', () => tip.hide());
        el.append(cell);
      }
    }
  });

  dash.draw('rows', (tb) => {
    const h = dash.data('history');
    tb.replaceChildren();
    const msgRow = (text) => {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 9; td.textContent = text; td.style.textAlign = 'left';
      tr.append(td); tb.append(tr);
    };
    if (h.status === 'error') { msgRow("Your entries couldn't load."); return; }
    if (h.status !== 'ok') return;
    const rows = (h.data || []).slice().reverse();
    if (!rows.length) { msgRow('No entries yet. Use the form above.'); return; }
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      tr.dataset.key = r.date;
      [r.date, fmt(r.oroberyl), fmt(r.origeometry), fmt(r.permits), fmt(r.pulls_done), r.pass, fmt(r.eff_oro), fmt(r.secured)].forEach((v) => {
        const td = document.createElement('td'); td.textContent = v; tr.append(td);
      });
      const td = document.createElement('td');
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'kt-btn-small'; btn.textContent = 'Remove';
      btn.onclick = () => {
        if (btn.dataset.armed) { window.ktRemove && window.ktRemove(r.date); }
        else { btn.dataset.armed = '1'; btn.textContent = 'Confirm'; }
      };
      td.append(btn); tr.append(td); tb.append(tr);
    });
  });
})();

// Backup, restore and install
(function () {
  const msg = document.getElementById('backup-msg');
  const say = (text, ok) => { msg.textContent = text; msg.className = 'kt-msg ' + (ok ? 'kt-ok' : 'kt-err'); msg.hidden = false; };

  document.getElementById('export-btn').addEventListener('click', () => {
    const data = { app: 'kay-tracker', version: 1, exported_at: new Date().toISOString(), entries: kayStore.all() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'kay-tracker-backup-' + new Date().toLocaleDateString('en-CA') + '.json';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say('Backup downloaded.', true);
  });

  const input = document.getElementById('import-file');
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const { added, skipped } = kayStore.importRows(Array.isArray(parsed) ? parsed : parsed.entries);
      if (!added) say("That file had no entries this app can read.", false);
      else say('Imported ' + added + (added === 1 ? ' entry' : ' entries') + (skipped ? ', skipped ' + skipped + ' unreadable' : '') + '. Same-date entries were replaced.', true);
    } catch (e) { say("That file couldn't be read as a backup.", false); }
  });

  let prompt = null;
  const btn = document.getElementById('install-btn');
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); prompt = e; btn.hidden = false; });
  btn.addEventListener('click', async () => { if (!prompt) return; prompt.prompt(); await prompt.userChoice; prompt = null; btn.hidden = true; });
  window.addEventListener('appinstalled', () => { btn.hidden = true; });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Offline mode unavailable', e)));
  }
})();

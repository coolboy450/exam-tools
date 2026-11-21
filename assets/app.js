/* เครื่องมือเตรียมสอบเข้า: คำนวณคะแนนถ่วงน้ำหนัก + ตารางอ่านหนังสือ ทำงานบนเครื่องผู้ใช้ทั้งหมด */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('exam-tools:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('exam-tools:' + k, JSON.stringify(v)); } catch { /* private mode: still works, just not saved */ } },
  };
  const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (v == null) continue; if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'value') e.value = v; else e.setAttribute(k, v); }
    for (const kid of kids.flat()) if (kid != null) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return e;
  };
  const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('th-TH', { maximumFractionDigits: d });

  /* ---------- tabs ---------- */
  const tabs = { score: [$('t-score'), $('p-score')], plan: [$('t-plan'), $('p-plan')] };
  function show(name) {
    if (!tabs[name]) name = 'score';
    for (const [k, [b, p]] of Object.entries(tabs)) { b.setAttribute('aria-selected', String(k === name)); p.hidden = k !== name; }
    try { history.replaceState(null, '', '#' + name); } catch { /* file:// */ }
  }
  for (const [k, [b]] of Object.entries(tabs)) b.addEventListener('click', () => show(k));

  /* ---------- score calculator ---------- */
  const DEFAULT_SUBJECTS = [
    { name: 'คณิตศาสตร์', score: '', full: 100, w: 25 },
    { name: 'วิทยาศาสตร์', score: '', full: 100, w: 25 },
    { name: 'ภาษาอังกฤษ', score: '', full: 100, w: 25 },
    { name: 'ภาษาไทย', score: '', full: 100, w: 25 },
  ];
  let subjects = store.get('subjects', null); if (!Array.isArray(subjects) || !subjects.length) subjects = DEFAULT_SUBJECTS.map((s) => ({ ...s }));
  $('target').value = store.get('target', 70);

  function drawRows() {
    const box = $('rows'); box.replaceChildren();
    subjects.forEach((s, i) => {
      const inp = (label, key, type, extra = {}) => el('label', {}, label, el('input', { type, inputmode: type === 'number' ? 'decimal' : null, value: s[key], 'aria-label': `${label} ของ ${s.name || 'วิชาที่ ' + (i + 1)}`, ...extra,
        oninput: (e) => { s[key] = e.target.value; store.set('subjects', subjects); calc(); } }));
      box.append(el('div', { class: 'row' },
        inp('วิชา', 'name', 'text', { placeholder: 'ชื่อวิชา' }), inp('คะแนนที่ได้', 'score', 'number', { min: 0, placeholder: 'ยังไม่ทราบ' }),
        inp('คะแนนเต็ม', 'full', 'number', { min: 1 }), inp('น้ำหนัก', 'w', 'number', { min: 0 }),
        el('button', { type: 'button', class: 'x', 'aria-label': 'ลบวิชา ' + (s.name || i + 1), onclick: () => { subjects.splice(i, 1); store.set('subjects', subjects); drawRows(); calc(); } }, '×')));
    });
  }
  function calc() {
    const out = $('score-out'); const target = num($('target').value); store.set('target', $('target').value);
    const rows = subjects.map((s) => ({ name: s.name || '(ไม่มีชื่อ)', sc: num(s.score), full: num(s.full), w: num(s.w) })).filter((r) => r.w > 0 && r.full > 0);
    if (!rows.length || target == null || target <= 0 || target > 100) { out.replaceChildren(el('p', {}, 'ใส่เป้าหมาย (1–100) และน้ำหนักวิชาอย่างน้อยหนึ่งวิชา')); return; }
    const known = rows.filter((r) => r.sc != null), left = rows.filter((r) => r.sc == null);
    const bad = known.find((r) => r.sc < 0 || r.sc > r.full);
    if (bad) { out.replaceChildren(el('p', { class: 'pill bad' }, `คะแนนวิชา ${bad.name} เกินคะแนนเต็มหรือติดลบ`)); return; }
    const W = rows.reduce((a, r) => a + r.w, 0), Wk = known.reduce((a, r) => a + r.w, 0);
    const got = known.reduce((a, r) => a + (r.sc / r.full) * r.w, 0);        // weighted points earned, in "weight units"
    const need = (target / 100) * W - got;                                    // weight units still needed
    const wl = W - Wk;
    const nodes = [];
    if (!known.length) nodes.push(el('p', {}, `ยังไม่ได้ใส่คะแนนวิชาใดเลย ถ้าจะถึงเป้า ${fmt(target, 0)}% ต้องได้เฉลี่ยทุกวิชา ${fmt(target, 0)}%`));
    else if (!left.length) {
      const pct = (got / W) * 100, ok = pct >= target;
      nodes.push(el('div', { class: 'big' }, fmt(pct) + '%'), el('span', { class: 'pill ' + (ok ? 'ok' : pct >= target - 5 ? 'mid' : 'bad') }, ok ? `ถึงเป้า (+${fmt(pct - target)})` : `ต่ำกว่าเป้า ${fmt(target - pct)} จุด`));
      nodes.push(el('div', { class: 'bar' }, el('i', { style: `width:${Math.min(100, pct)}%` }), el('b', { style: `left:${target}%`, title: 'เป้าหมาย' })));
    } else {
      const so = (got / W) * 100, avg = (need / wl) * 100;
      nodes.push(el('p', {}, 'คะแนนรวมตอนนี้ (นับเฉพาะวิชาที่กรอก รวมกับวิชาที่เหลือเป็น 0): ', el('b', {}, fmt(so) + '%')));
      if (avg <= 0) nodes.push(el('span', { class: 'pill ok' }, 'ถึงเป้าแล้ว ต่อให้วิชาที่เหลือได้ 0'));
      else if (avg > 100) nodes.push(el('span', { class: 'pill bad' }, `เป้านี้เกินเอื้อม ต่อให้วิชาที่เหลือได้เต็มก็ได้แค่ ${fmt(((got + wl) / W) * 100)}%`), el('p', {}, 'ลองลดเป้า หรือเช็กว่าน้ำหนักที่ใส่ตรงกับเกณฑ์จริงไหม'));
      else nodes.push(el('span', { class: 'pill ' + (avg <= 70 ? 'ok' : avg <= 85 ? 'mid' : 'bad') }, `วิชาที่เหลือต้องได้เฉลี่ย ${fmt(avg)}%`), el('p', {}, 'วิชาที่ยังไม่ทราบ: ' + left.map((r) => r.name).join(', ')));
    }
    if (known.length) nodes.push(el('div', { class: 'tbl' }, el('table', {}, el('tr', {}, ['วิชา', 'ได้', 'น้ำหนัก', 'คะแนนถ่วงน้ำหนัก'].map((t) => el('th', {}, t))),
      ...known.map((r) => el('tr', {}, el('td', {}, r.name), el('td', {}, `${fmt(r.sc, 2)}/${fmt(r.full, 0)} (${fmt((r.sc / r.full) * 100)}%)`), el('td', {}, fmt((r.w / W) * 100) + '%'), el('td', {}, fmt((r.sc / r.full) * (r.w / W) * 100, 2)))))));
    out.replaceChildren(...nodes);
  }
  $('add').addEventListener('click', () => { subjects.push({ name: '', score: '', full: 100, w: 25 }); store.set('subjects', subjects); drawRows(); calc(); });
  $('reset-score').addEventListener('click', () => { subjects.forEach((s) => { s.score = ''; }); store.set('subjects', subjects); drawRows(); calc(); });
  $('target').addEventListener('input', calc);

  /* ---------- study planner ---------- */
  const LEVELS = [['3', 'ยังอ่อนมาก (ให้เวลามากสุด)'], ['2', 'พอใช้'], ['1', 'ค่อนข้างแน่นแล้ว']];
  let plan = store.get('plan', null);
  if (!plan || !Array.isArray(plan.subjects)) plan = { subjects: [{ name: 'คณิตศาสตร์', lv: '3' }, { name: 'วิทยาศาสตร์', lv: '2' }, { name: 'ภาษาอังกฤษ', lv: '2' }, { name: 'ภาษาไทย', lv: '1' }] };
  const savePlan = () => store.set('plan', { ...plan, date: $('exam-date').value, hw: $('h-week').value, he: $('h-end').value });
  if (plan.date) $('exam-date').value = plan.date; if (plan.hw) $('h-week').value = plan.hw; if (plan.he) $('h-end').value = plan.he;
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $('exam-date').min = iso(new Date());

  function drawPlanRows() {
    const box = $('plan-rows'); box.replaceChildren();
    plan.subjects.forEach((s, i) => box.append(el('div', { class: 'row plan' },
      el('label', {}, 'วิชา', el('input', { type: 'text', value: s.name, placeholder: 'ชื่อวิชา', oninput: (e) => { s.name = e.target.value; savePlan(); drawPlan(); } })),
      el('label', {}, 'ความมั่นใจ', el('select', { onchange: (e) => { s.lv = e.target.value; savePlan(); drawPlan(); } }, LEVELS.map(([v, t]) => el('option', { value: v, ...(v === s.lv ? { selected: '' } : {}) }, t)))),
      el('button', { type: 'button', class: 'x', 'aria-label': 'ลบวิชา ' + (s.name || i + 1), onclick: () => { plan.subjects.splice(i, 1); savePlan(); drawPlanRows(); drawPlan(); } }, '×'))));
  }
  const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  function drawPlan() {
    const out = $('plan-out'); const hw = num($('h-week').value), he = num($('h-end').value), ds = $('exam-date').value;
    const subs = plan.subjects.filter((s) => s.name.trim());
    if (!ds || hw == null || he == null || hw < 0 || he < 0 || !subs.length) { out.replaceChildren(el('p', {}, 'เลือกวันสอบ ใส่ชั่วโมงอ่าน และมีอย่างน้อยหนึ่งวิชา ตารางจะขึ้นตรงนี้')); return; }
    const today = new Date(); today.setHours(0, 0, 0, 0); const exam = new Date(ds + 'T00:00:00');
    const days = Math.round((exam - today) / 86400000);
    if (days < 1) { out.replaceChildren(el('p', { class: 'pill bad' }, 'วันสอบต้องเป็นวันหลังจากวันนี้')); return; }
    let total = 0; for (let i = 0; i < days; i++) { const d = new Date(today); d.setDate(d.getDate() + i); const wd = d.getDay(); total += (wd === 0 || wd === 6) ? he : hw; }
    const sumW = subs.reduce((a, s) => a + +s.lv, 0);
    // weekly timetable (Mon-Sun): half-hour blocks handed out with smooth weighted round-robin so subjects interleave
    const acc = subs.map(() => 0); const week = [];
    for (let d = 0; d < 7; d++) {
      const hrs = d >= 5 ? he : hw, blocks = Math.round(hrs * 2), got = subs.map(() => 0);
      for (let b = 0; b < blocks; b++) { subs.forEach((s, i) => { acc[i] += +s.lv; }); let m = 0; acc.forEach((a, i) => { if (a > acc[m]) m = i; }); acc[m] -= sumW; got[m]++; }
      week.push(got);
    }
    const nodes = [
      el('div', { class: 'sum' }, el('span', {}, 'เหลือ ', el('b', {}, days + ' วัน'), ` (สอบ ${exam.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })})`), el('span', {}, 'เวลาอ่านรวม ', el('b', {}, '≈ ' + fmt(total, 0) + ' ชม.'))),
      el('div', { class: 'tbl' }, el('table', {}, el('tr', {}, ['วิชา', 'สัดส่วน', 'เวลารวมโดยประมาณ', 'ต่อสัปดาห์'].map((t) => el('th', {}, t))),
        ...subs.map((s, i) => { const wk = week.reduce((a, d) => a + d[i] / 2, 0); return el('tr', {}, el('td', {}, s.name), el('td', {}, fmt((+s.lv / sumW) * 100, 0) + '%'), el('td', {}, fmt((+s.lv / sumW) * total, 0) + ' ชม.'), el('td', {}, fmt(wk) + ' ชม.')); }))),
      el('h2', {}, 'ตารางประจำสัปดาห์'),
      el('div', { class: 'tbl' }, el('table', {}, el('tr', {}, DAYS.map((d) => el('th', {}, d))),
        el('tr', {}, week.map((got, d) => el('td', {}, (d >= 5 ? he : hw) === 0 ? el('span', { class: 'muted' }, 'พัก') : got.map((n, i) => n ? el('div', {}, `${subs[i].name} ${fmt(n / 2)} ชม.`) : null)))))),
    ];
    if (total / days < 0.5) nodes.push(el('p', { class: 'pill mid' }, 'เวลาอ่านเฉลี่ยน้อยกว่าครึ่งชั่วโมงต่อวัน ลองเพิ่มเวลาในวันหยุด'));
    out.replaceChildren(...nodes);
  }
  $('add-plan').addEventListener('click', () => { plan.subjects.push({ name: '', lv: '2' }); savePlan(); drawPlanRows(); });
  for (const id of ['exam-date', 'h-week', 'h-end']) $(id).addEventListener('input', () => { savePlan(); drawPlan(); });
  $('print').addEventListener('click', () => window.print());

  drawRows(); calc(); drawPlanRows(); drawPlan();
  show((location.hash || '').slice(1));
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
})();

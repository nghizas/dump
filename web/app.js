// Dump: tap the circle, type one thought, dump it into the cloud. Process sorts the dump into DO / DEFER / DELEGATE.
// Everything lives in localStorage.
const KEY = 'dump.v1';
const SCHEMA = 2;
const LISTS = ['dump', 'do', 'defer', 'delegate'];
const $ = id => document.getElementById(id);

// Cloud colour per list: [base hue, hue spread]. Processed thoughts keep their list's colour in the DUMP cloud.
const HUES = { dump: [235, 80], do: [135, 30], defer: [30, 18], delegate: [198, 24] };
const EMPTY = {
  dump: 'Your head is clear. Tap the circle to dump a thought.',
  do: 'Nothing to do. Process the dump to fill this.',
  defer: 'Nothing deferred.',
  delegate: 'Nothing delegated.',
};

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
// db.items: [{ id, text, t, list, when? }] oldest first. t is when it was dumped (ISO); list is one of LISTS.
// when = { date: 'YYYY-MM-DD', time: 'HH:MM' | '', mins } is set by scheduling a DEFER item ('' time = all day).
let db = { items: [] };
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (Array.isArray(saved?.items)) db = saved;
} catch {}
for (const it of db.items) if (!LISTS.includes(it.list)) it.list = 'dump'; // items from v1
const save = () => localStorage.setItem(KEY, JSON.stringify(db));
navigator.storage?.persist?.();

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const inList = list => db.items.filter(it => it.list === list);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

let view = 'dump';

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// In-app confirm. Unlike confirm(), the OK tap counts as a fresh gesture, so the share sheet can open after it.
function ask(text, okLabel) {
  return new Promise(resolve => {
    const dlg = $('askDialog');
    $('askText').textContent = text;
    $('askOk').textContent = okLabel;
    const done = v => { dlg.close(); $('askOk').onclick = $('askCancel').onclick = null; resolve(v); };
    $('askOk').onclick = () => done(true);
    $('askCancel').onclick = () => done(false);
    dlg.oncancel = () => done(false);
    dlg.showModal();
  });
}

// Stable pseudo-random number in [0, 1) from a string, so the cloud doesn't reshuffle on every render.
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Cloud
// ---------------------------------------------------------------------------
// DUMP shows every thought as a cloud; the other lists show a checklist.
function render(freshId) {
  const n = view === 'dump' ? db.items.length : inList(view).length;
  const unprocessed = inList('dump').length;
  $('listName').textContent = view.toUpperCase();
  $('count').textContent = n || '';
  $('empty').textContent = EMPTY[view];
  $('empty').hidden = n > 0;
  $('procBtn').disabled = !unprocessed;
  $('procCount').textContent = unprocessed || '';
  document.body.classList.toggle('readonly', view !== 'dump'); // only DUMP can take new thoughts
  $('cloud').hidden = view !== 'dump';
  $('checklist').hidden = view === 'dump';
  if (view === 'dump') renderCloud(freshId);
  else renderChecklist();
}

// Every thought, whatever its list. Newer and shorter ones render bigger and brighter; older ones shrink and fade.
function renderCloud(freshId) {
  const items = db.items;
  const n = items.length;
  const shrink = n > 60 ? 0.7 : n > 30 ? 0.85 : 1;
  const cloud = $('cloud');
  cloud.replaceChildren();
  const shown = items.map((it, i) => ({ it, age: n > 1 ? (n - 1 - i) / (n - 1) : 0 })) // 0 newest … 1 oldest
    .sort((a, b) => hash(a.it.id) - hash(b.it.id));

  for (const { it, age } of shown) {
    const r = hash(it.id + 'x');
    const [hue, spread] = HUES[it.list];
    const lenFactor = Math.max(0.55, 1 - it.text.length / 140);
    const size = Math.round((15 + 26 * (1 - age) * lenFactor + 8 * r) * shrink);
    const el = document.createElement('span');
    el.className = 'thought' + (it.id === freshId ? ' fresh' : '');
    el.textContent = it.text;
    el.style.fontSize = size + 'px';
    el.style.fontWeight = size > 30 ? 700 : size > 22 ? 600 : 500;
    el.style.color = `hsl(${hue + r * spread} ${60 + r * 30}% ${88 - age * 30}%)`;
    el.style.opacity = (1 - age * 0.55).toFixed(2);
    el.style.animationDelay = it.id === freshId ? '0s' : Math.min(r * 0.4, 0.4) + 's';
    cloud.append(el);
  }
}

// Oldest first. DEFER puts unscheduled thoughts on top, then scheduled ones by date. DONE removes the thought for good.
function renderChecklist() {
  const list = $('checklist');
  list.dataset.list = view;
  list.replaceChildren();
  const items = inList(view);
  if (view === 'defer') items.sort((a, b) => (a.when ? 1 : 0) - (b.when ? 1 : 0) || whenKey(a).localeCompare(whenKey(b)));
  for (const it of items) {
    const li = document.createElement('li');
    const txt = document.createElement('div');
    txt.className = 'txt';
    txt.textContent = it.text;
    const time = document.createElement('time');
    time.textContent = stamp(it.t);
    if (view === 'defer') {
      time.className = it.when ? (whenKey(it) < nowKey() ? 'past' : 'set') : 'unset';
      time.textContent = it.when ? whenLabel(it.when) + (time.className === 'past' ? ' · past' : '') : 'Not scheduled';
    }
    txt.append(time);
    const swap = document.createElement('button');
    swap.className = 'swapbtn';
    swap.setAttribute('aria-label', 'Move to another list');
    swap.innerHTML = SWAP_ICON;
    const moveTo = document.createElement('div');
    moveTo.className = 'moveto';
    moveTo.hidden = true;
    for (const to of LISTS.filter(l => l !== 'dump' && l !== view)) {
      const b = document.createElement('button');
      b.dataset.to = to;
      b.textContent = to.toUpperCase();
      b.onclick = () => removeRow(li, () => { it.list = to; toast(`Moved to ${to.toUpperCase()}`); });
      moveTo.append(b);
    }
    swap.onclick = () => {
      moveTo.hidden = !moveTo.hidden;
      swap.classList.toggle('on', !moveTo.hidden);
    };
    const done = document.createElement('button');
    done.className = 'donebtn';
    done.textContent = 'DONE';
    done.onclick = () => removeRow(li, () => { db.items = db.items.filter(x => x.id !== it.id); });
    const row = document.createElement('div');
    row.className = 'row';
    row.append(txt);
    if (view === 'defer') {
      const cal = document.createElement('button');
      cal.className = 'swapbtn calbtn' + (it.when ? '' : ' todo');
      cal.setAttribute('aria-label', 'Schedule in Google Calendar');
      cal.innerHTML = CAL_ICON;
      cal.onclick = () => openSchedule(it);
      row.append(cal);
    }
    row.append(swap, done);
    li.append(row, moveTo);
    list.append(li);
  }
}

// Applies a change that takes the row off this list, then slides it out.
function removeRow(li, change) {
  change();
  save();
  navigator.vibrate?.(8);
  li.classList.add('gone');
  setTimeout(render, 250);
}

const SWAP_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/></svg>';

const CAL_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>';

const stamp = t => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function setView(list) {
  view = list;
  $('scroller').scrollTop = 0;
  render();
}

// ---------------------------------------------------------------------------
// Schedule a DEFER item: pick a time, then hand it to Google Calendar
// ---------------------------------------------------------------------------
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const whenKey = it => it.when ? `${it.when.date}T${it.when.time || '00:00'}` : '';
const nowKey = () => { const d = new Date(); return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

function whenLabel(w) {
  const [y, m, d] = w.date.split('-').map(Number);
  const [hh, mm] = (w.time || '00:00').split(':').map(Number);
  const dt = new Date(y, m - 1, d, hh, mm);
  const day = dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return w.time ? `${day} · ${dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : `${day} · all day`;
}

// Google Calendar's "new event" link: no login or API, the event opens pre-filled and you tap Save.
// Times are local wall-clock times in your time zone (ctz); all-day events end the next day.
function gcalUrl(text, w) {
  const compact = s => s.replace(/[-:]/g, '');
  let dates;
  if (w.time) {
    const [y, m, d] = w.date.split('-').map(Number);
    const [hh, mm] = w.time.split(':').map(Number);
    const end = new Date(y, m - 1, d, hh, mm + w.mins);
    dates = `${compact(w.date)}T${compact(w.time)}00/${compact(ymd(end))}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
  } else {
    const [y, m, d] = w.date.split('-').map(Number);
    dates = `${compact(w.date)}/${compact(ymd(new Date(y, m - 1, d + 1)))}`;
  }
  const q = new URLSearchParams({
    action: 'TEMPLATE', text, dates,
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    details: 'Deferred from Dump',
  });
  return 'https://calendar.google.com/calendar/render?' + q;
}

let scheduling = null;
let schedMins = 30;

function openSchedule(it) {
  scheduling = it;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  $('schedText').textContent = it.text;
  $('schedDate').value = it.when?.date || ymd(tomorrow);
  $('schedTime').value = it.when ? it.when.time || '09:00' : '09:00';
  setMins(it.when ? (it.when.time ? it.when.mins : 0) : 30);
  $('schedDialog').showModal();
}

// 0 = all day.
function setMins(m) {
  schedMins = m;
  for (const b of $('schedDur').children) b.classList.toggle('on', Number(b.dataset.mins) === m);
  $('schedTimeRow').hidden = m === 0;
}

// Saves the time on the item and opens Google Calendar in a new tab (keeps Dump open behind it).
function schedule() {
  if (!$('schedDate').value) return toast('Pick a date');
  const when = { date: $('schedDate').value, time: schedMins ? $('schedTime').value || '09:00' : '', mins: schedMins || 0 };
  window.open(gcalUrl(scheduling.text, when), '_blank');
  scheduling.when = when;
  save();
  $('schedDialog').close();
  render();
}

// ---------------------------------------------------------------------------
// Capture (always lands in the dump)
// ---------------------------------------------------------------------------
function openCapture() {
  $('capture').hidden = false;
  $('capText').value = '';
  $('capDump').disabled = true;
  $('capText').focus(); // must run inside the tap handler or iOS won't raise the keyboard
}

function closeCapture() {
  $('capText').blur();
  $('capture').hidden = true;
}

function dump() {
  const text = $('capText').value.trim().replace(/\s+/g, ' ');
  if (!text) return;
  const item = { id: newId(), text, t: new Date().toISOString(), list: 'dump' };
  db.items.push(item);
  save();
  closeCapture();
  view = 'dump';
  render(item.id);
  navigator.vibrate?.(10);
}

// ---------------------------------------------------------------------------
// List switcher (top left)
// ---------------------------------------------------------------------------
function openLists() {
  for (const b of $('lists').querySelectorAll('button')) {
    b.classList.toggle('on', b.dataset.list === view);
    b.querySelector('span').textContent = inList(b.dataset.list).length || '';
  }
  $('lists').showModal();
}

// ---------------------------------------------------------------------------
// Process: DO / DEFER / DELEGATE / DELETE each thought in the dump, oldest first
// ---------------------------------------------------------------------------
const procCount = () => {
  const n = inList('dump').length;
  $('procLeft').textContent = n ? `${n} left` : '';
  return n;
};

function renderProcess() {
  const list = $('procList');
  list.replaceChildren();
  for (const it of inList('dump')) {
    const li = document.createElement('li');
    const txt = document.createElement('div');
    txt.className = 'txt';
    txt.textContent = it.text;
    const time = document.createElement('time');
    time.textContent = stamp(it.t);
    const acts = document.createElement('div');
    acts.className = 'acts';
    for (const to of ['do', 'defer', 'delegate', 'delete']) {
      const b = document.createElement('button');
      b.dataset.to = to;
      b.textContent = to.toUpperCase();
      b.onclick = () => sortItem(it.id, to, li);
      acts.append(b);
    }
    li.append(txt, time, acts);
    list.append(li);
  }
  if (!procCount()) showProcessDone();
}

function sortItem(id, to, li) {
  if (to === 'delete') db.items = db.items.filter(x => x.id !== id);
  else db.items.find(x => x.id === id).list = to;
  save();
  navigator.vibrate?.(8);
  li.classList.add('gone');
  setTimeout(() => { li.remove(); if (!procCount()) showProcessDone(); }, 250);
}

function showProcessDone() {
  $('procList').innerHTML = '<li class="done">Dump is empty. Nice.</li>';
}

function closeProcess() {
  $('process').hidden = true;
  render();
}

// ---------------------------------------------------------------------------
// Export / restore / clear
// ---------------------------------------------------------------------------
const localDate = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

function downloadJSON(obj) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
  a.download = obj.filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}

// Resolves true if the file was handed off, false if cancelled.
async function shareJSON(obj) {
  const text = JSON.stringify(obj, null, 2);
  for (const type of ['application/json', 'text/plain']) {
    const file = new File([text], obj.filename, { type });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return true; }
      catch (e) { if (e.name === 'AbortError') return false; }
    }
  }
  return downloadJSON(obj);
}

// Only non-empty lists go in the file.
async function exportLists() {
  if (!db.items.length) return toast('Nothing to export');
  const lists = {};
  for (const l of LISTS) {
    const items = inList(l).map(({ id, text, t, when }) => (when ? { id, text, t, when } : { id, text, t }));
    if (items.length) lists[l] = items;
  }
  const obj = { filename: `dump-${localDate()}.json`, app: 'dump', schema: SCHEMA, exportedAt: new Date().toISOString(), lists };
  if (await shareJSON(obj)) toast(`Exported ${plural(db.items.length, 'thought')}`);
}

// Accepts schema 2 ({ lists }) and schema 1 ({ items }, all dump). Thoughts already here are skipped.
async function importFile(file) {
  try {
    const data = JSON.parse(await file.text());
    const incoming = data.lists
      ? Object.entries(data.lists).flatMap(([list, items]) => (LISTS.includes(list) && Array.isArray(items) ? items.map(it => ({ ...it, list })) : []))
      : (Array.isArray(data.items) ? data.items : []).map(it => ({ ...it, list: 'dump' }));
    const have = new Set(db.items.map(i => i.id));
    let added = 0;
    for (const it of incoming) {
      if (!it?.text || have.has(it.id)) continue;
      db.items.push({ id: it.id || newId(), text: String(it.text), t: it.t || new Date().toISOString(), list: it.list, ...(it.when && { when: it.when }) });
      added++;
    }
    db.items.sort((a, b) => a.t.localeCompare(b.t));
    save();
    render();
    toast(`Restored ${plural(added, 'thought')}`);
  } catch {
    toast('Could not read that file');
  }
}

async function clearDump() {
  const n = inList('dump').length;
  if (!n) return toast('No unprocessed thoughts');
  const ok = await ask(`Delete ${plural(n, 'unprocessed thought')}? DO, DEFER and DELEGATE are kept.`, 'Clear');
  if (!ok) return;
  db.items = db.items.filter(it => it.list !== 'dump');
  save();
  render();
  toast('Dump cleared');
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
$('orb').addEventListener('click', openCapture);
$('capCancel').addEventListener('click', closeCapture);
$('capDump').addEventListener('click', dump);
$('capText').addEventListener('input', e => { $('capDump').disabled = !e.target.value.trim(); });
$('capText').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); dump(); }
});

$('listBtn').addEventListener('click', openLists);
$('lists').addEventListener('click', e => {
  const list = e.target.closest('button')?.dataset.list;
  $('lists').close();
  if (list) setView(list);
});

$('menuBtn').addEventListener('click', () => $('menu').showModal());
$('menu').addEventListener('click', e => {
  if (e.target === $('menu')) return $('menu').close(); // tap on backdrop
  const act = e.target.closest('button')?.dataset.act;
  if (!act) return;
  $('menu').close();
  if (act === 'export') exportLists();
  if (act === 'restore') $('importFile').click();
  if (act === 'clear') clearDump();
});
$('importFile').addEventListener('change', e => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ''; });
$('procDone').addEventListener('click', closeProcess);
$('schedDur').addEventListener('click', e => { const m = e.target.closest('button')?.dataset.mins; if (m) setMins(Number(m)); });
$('schedGo').addEventListener('click', schedule);
$('schedCancel').addEventListener('click', () => $('schedDialog').close());
$('procBtn').addEventListener('click', () => { renderProcess(); $('process').hidden = false; });

render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

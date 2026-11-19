import { api, isDemo } from './api.js';

/* ================= constants ================= */
const CATS = {
  out: [['food','อาหาร','#D9A55B'],['transport','เดินทาง','#8FB3C4'],['household','ของใช้','#8C9E62'],['utilities','น้ำไฟ','#E8C66A'],['health','สุขภาพ','#C98B79'],['education','การศึกษา','#7E8FB0'],['travel','เที่ยว','#B9A27A'],['pets','สัตว์เลี้ยง','#A88462'],['gifts','ของขวัญ','#9DB07A'],['fun','บันเทิง','#B3C6CF'],['phone','โทร/เน็ต','#8E9A6C'],['home','ค่าบ้าน','#C2A27E'],['clothes','เสื้อผ้า','#D7C6A6'],['kids','ลูก','#C7A16F'],['other','อื่นๆ','#B8B2A0']],
  in: [['salary','เงินเดือน','#6B7B4B'],['bonus','โบนัส','#D9B24B'],['side','รายได้เสริม','#B98A5A'],['invest','ปันผล/ดอกเบี้ย','#7FA06A']],
};
const CAT = {}; [...CATS.out, ...CATS.in].forEach(c => CAT[c[0]] = { n: c[1], col: c[2], ic: c[0] });
CAT.private = { n: 'ส่วนตัว', col: '#CFC6B4', ic: 'other' };
const TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const THF = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const PLOTS = [[48.3,19.5,29.3,'เนินเขา'],[24.9,42.6,30.3,'ริมทะเลสาบ'],[72.1,38.7,29.3,'ชายป่า'],[26.6,59.9,30.3,'ทุ่งดอกไม้'],[73.9,56.3,33.2,'ริมลำธาร']];
const STYLES = [['cottage','บ้านหลังคาดินเผา'],['thai','เรือนไทย'],['log','บ้านไม้ซุง'],['leaf','บ้านใบไม้'],['mill','บ้านกังหันลม']];
const PROJ_ICONS = ['travel','education','home','gifts','kids','pets','fun','transport','health','clothes'];
const ANN_ICONS = ['transport','health','household','utilities','education','home','phone','pets','other'];
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => (n < 0 ? '-' : '') + '฿' + Math.round(Math.abs(+n || 0)).toLocaleString('en-US');
const num = v => { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };

/* ================= dates ================= */
const iso = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
const today = () => iso(new Date());
const parse = s => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const mKey = s => s.slice(0, 7);
const addMonths = (s, k) => { const d = parse(s); d.setDate(1); d.setMonth(d.getMonth() + k); return iso(d); };
const monthStart = (s = today()) => s.slice(0, 8) + '01';
const monthIdx = s => { const d = parse(s); return d.getFullYear() * 12 + d.getMonth(); };
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const thShort = s => { const d = parse(s); return `${d.getDate()} ${TH[d.getMonth()]} ${String(d.getFullYear() + 543).slice(-2)}`; };
const thMonth = s => { const d = parse(s); return `${TH[d.getMonth()]} ${String(d.getFullYear() + 543).slice(-2)}`; };
const dayLabel = s => { const t = today(); if (s === t) return 'วันนี้'; if (daysBetween(s, t) === 1) return 'เมื่อวาน'; return thShort(s); };

/* ================= state ================= */
const S = {
  session: null, me: null, houses: [], hid: null, B: null, ON: {}, night: false,
  cur: 'loading', back: 'home', projId: null, projBack: 'dash', period: 'month', hFilter: 'all',
  add: {}, op: { mode: 'edit', who: null },
};
let txs = [];   // ascending by date for calculations

/* ================= ui helpers ================= */
function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 2200); }
function busy(on) { $('busy').classList.toggle('on', !!on); }
async function run(fn, errEl) {
  busy(true);
  try { return await fn(); }
  catch (e) { console.error(e); const m = thaiErr(e.message); if (errEl) $(errEl).textContent = m; else toast(m); return undefined; }
  finally { busy(false); }
}
function thaiErr(m = '') {
  if (/Invalid login/i.test(m)) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  if (/Email not confirmed/i.test(m)) return 'กรุณายืนยันอีเมลก่อน (ดูในกล่องจดหมาย)';
  if (/already registered/i.test(m)) return 'อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบ';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ต';
  if (/row-level security|permission/i.test(m)) return 'ไม่มีสิทธิ์ทำรายการนี้';
  if (/rate limit|over_email_send/i.test(m)) return 'ระบบส่งอีเมลเกินจำนวนที่แผนฟรีกำหนด ลองใหม่ในอีก 1 ชั่วโมง';
  if (/at least 6|Password should/i.test(m)) return 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว';
  if (/same_password|different from the old/i.test(m)) return 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม';
  return m || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง';
}
function popup(t, s, next, img = 'img/state_saved.webp') {
  $('popImg').src = img; $('popT').textContent = t; $('popS').textContent = s || '';
  const p = $('pop'); p.classList.add('on');
  setTimeout(() => { p.classList.remove('on'); if (next) go(next); }, 1400);
}

/* ================= derived data ================= */
const M = () => (S.B?.members || []);
const mem = id => M().find(m => m.id === id) || { id, nickname: 'อดีตสมาชิก', avatar: 'dad', role: 'member' };
const WHO = id => esc(mem(id).nickname || 'ไม่มีชื่อ');
const AV = (id, mood = 'smile') => `img/av_${mem(id).avatar}_${mood}.jpg`;
const isOwner = () => mem(S.B?.me).role === 'owner';
const sel = () => M().map(m => m.id).filter(id => S.ON[id]);
const inS = id => !!S.ON[id];
const proj = id => (S.B?.projects || []).find(p => p.id === id);
const OPEN = uid => {
  const o = (S.B?.opening || []).find(x => x.user_id === uid);
  return o ? { as_of: o.as_of, cash: +o.cash, savings: +o.savings, inv_principal: +o.inv_principal, inv_value: +o.inv_value, set: true }
           : { as_of: '0000-01-01', cash: 0, savings: 0, inv_principal: 0, inv_value: 0, set: false };
};
const afterOpen = (t, uid) => t.occurred_on >= OPEN(uid).as_of;

function flows(range, only) {
  const ok = only ? (u => u === only) : inS;
  let inc = 0, out = 0, dep = 0, wd = 0;
  for (const t of txs) {
    if (range && (t.occurred_on < range[0] || t.occurred_on > range[1])) continue;
    const a = +t.amount;
    if (t.type === 'in' && ok(t.user_id)) inc += a;
    else if (t.type === 'out' && ok(t.user_id) && !t.paid_from_project) out += a;
    else if (t.type === 'save') {
      if (t.save_action === 'dep' && ok(t.user_id) && !t.paid_from_project) dep += a;
      if (t.save_action === 'wd' && t.to_user && ok(t.to_user)) wd += a;
    }
  }
  return { inc, out, dep, wd, net: inc - out - dep + wd };
}
function cashOf(uid) {
  const o = OPEN(uid); let c = o.cash;
  for (const t of txs) {
    if (t.occurred_on < o.as_of) continue;
    const a = +t.amount;
    if (t.type === 'in' && t.user_id === uid) c += a;
    else if (t.type === 'out' && t.user_id === uid && !t.paid_from_project) c -= a;
    else if (t.type === 'save') {
      if (t.save_action === 'dep' && t.user_id === uid && !t.paid_from_project) c -= a;
      if (t.save_action === 'wd' && t.to_user === uid) c += a;
    }
  }
  return c;
}
function balOf(uid, upto = '9999-12-31') {
  const o = OPEN(uid); let s = o.savings, p = o.inv_principal, v = o.inv_value, last = o.set ? o.as_of : null;
  for (const t of txs) {
    if (t.type !== 'save' || t.to_user !== uid || t.occurred_on < o.as_of || t.occurred_on > upto) continue;
    const a = +t.amount;
    if (t.save_kind === 'save') s += t.save_action === 'dep' ? a : t.save_action === 'wd' ? -a : 0;
    else {
      if (t.save_action === 'dep') { p += a; v += a; }
      else if (t.save_action === 'wd') { p = Math.max(0, p - a); v = Math.max(0, v - a); }
      else if (t.save_action === 'val') { v = a; last = t.occurred_on; }
    }
  }
  return { s, p, v, last };
}
function projStats(p) {
  const open = +p.opening_amount || 0;
  const contrib = txs.filter(t => t.type === 'save' && t.save_action === 'dep' && t.to_project === p.id);
  const spent = txs.filter(t => t.paid_from_project === p.id).reduce((s, t) => s + +t.amount, 0);
  const byMonth = {}; contrib.forEach(t => byMonth[mKey(t.occurred_on)] = (byMonth[mKey(t.occurred_on)] || 0) + +t.amount);
  const total = open + contrib.reduce((s, t) => s + +t.amount, 0);
  const curI = monthIdx(today()), endI = monthIdx(p.end_month), startI = monthIdx(p.start_month);
  const months = []; let cum = open;
  for (let i = startI; i <= endI; i++) {
    const y = Math.floor(i / 12), m = i % 12, k = `${y}-${String(m + 1).padStart(2, '0')}`;
    const left = endI - i + 1, need = Math.max(0, (p.target - cum) / left), got = byMonth[k] || 0;
    months.push({ i, y, m, need, got, fut: i > curI, cur: i === curI }); cum += got;
  }
  const cm = months.find(x => x.cur) || { need: 0, got: byMonth[mKey(today())] || 0 };
  const monthsLeft = Math.max(0, endI - Math.max(curI, startI) + 1);
  const needNow = monthsLeft ? Math.max(0, (p.target - (total - cm.got)) / monthsLeft) : 0;
  return { contrib, total, spent, months, cm, monthsLeft, needNow, pct: Math.min(100, total / p.target * 100) };
}
const annMonthly = a => +a.amount / (a.unit === 'y' ? a.every * 12 : a.every);

/* ================= navigation ================= */
const INHOUSE = ['home','history','dash','house','proj','annual','opening'];
function go(id) {
  closeSheet();
  if (INHOUSE.includes(id) && !S.B) id = 'island';
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  if (id !== 'add' && id !== 'proj') S.back = INHOUSE.includes(id) ? id : S.back;
  S.cur = id;
  $('nav').style.display = INHOUSE.includes(id) && !(id === 'opening' && S.op.mode === 'onboard') ? 'flex' : 'none';
  document.querySelectorAll('.nav button[data-s]').forEach(b => b.classList.toggle('on', b.dataset.s === id));
  if (id === 'island') { resetZoom(); loadIsland(); }
  render();
  const sc = document.querySelector('#' + id + ' .scroll'); if (sc) sc.scrollTop = 0;
}
function back() { go(S.cur === 'proj' ? S.projBack : S.back || 'home'); }
function render() {
  renderFilters();
  ({ home: renderHome, history: renderHistory, dash: renderDash, proj: renderProj, annual: renderAnnual, house: renderHouse, opening: renderOpening, profile: renderProfile, add: renderWallet })[S.cur]?.();
}
function toggleNight(force) {
  S.night = force ?? !S.night;
  $('phone').classList.toggle('night', S.night); $('island').classList.toggle('night', S.night);
  if (S.cur === 'island') renderSpots();
}

/* ================= auth ================= */
let authMode = 'in';
function setAuthMode(m) {
  authMode = m ?? (authMode === 'in' ? 'up' : 'in');
  $('authTitle').textContent = authMode === 'in' ? 'ยินดีต้อนรับกลับบ้าน' : 'สมัครสมาชิก';
  $('authSub').textContent = authMode === 'in' ? 'เข้าสู่ระบบเพื่อเริ่มจดบันทึก' : 'ใช้อีเมลและตั้งรหัสผ่านอย่างน้อย 6 ตัว';
  $('authBtn').textContent = authMode === 'in' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก';
  $('authSwitchTxt').textContent = authMode === 'in' ? 'ยังไม่มีบัญชี?' : 'มีบัญชีแล้ว?';
  $('authSwitch').textContent = authMode === 'in' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ';
  $('pw').autocomplete = authMode === 'in' ? 'current-password' : 'new-password';
  $('authErr').textContent = '';
}
async function doAuth() {
  const email = $('email').value.trim(), pw = $('pw').value;
  $('authErr').textContent = '';
  if (!email || pw.length < 6) { $('authErr').textContent = 'ใส่อีเมล และรหัสผ่านอย่างน้อย 6 ตัว'; return; }
  if (authMode === 'up') {
    const r = await run(() => api.signUp(email, pw), 'authErr');
    if (r === undefined) return;
    if (!r.session && !isDemo) { $('authErr').textContent = ''; toast('ส่งลิงก์ยืนยันไปที่อีเมลแล้ว กดยืนยันแล้วกลับมาเข้าสู่ระบบ'); setAuthMode('in'); return; }
  } else {
    const r = await run(() => api.signIn(email, pw), 'authErr'); if (r === undefined) return;
  }
  await afterLogin();
}
async function forgot() {
  const email = $('email').value.trim();
  if (!email) { $('authErr').textContent = 'ใส่อีเมลก่อน แล้วกด "ลืมรหัสผ่าน" อีกครั้ง'; return; }
  const r = await run(() => api.resetPw(email), 'authErr');
  if (r !== undefined) toast('ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว');
}
let loginRun = null;
function afterLogin() { if (!loginRun) loginRun = doAfterLogin().finally(() => { loginRun = null; }); return loginRun; }
async function doAfterLogin() {
  S.session = await api.session();
  if (!S.session) { go('welcome'); return; }
  S.me = await run(() => api.profile());
  if (!S.me) { go('login'); return; }
  $('adminBtn').hidden = !S.me.is_admin;
  let code = null; try { code = localStorage.getItem('paaunjai_join'); } catch (e) { }
  if (code) {
    try { localStorage.removeItem('paaunjai_join'); } catch (e) { }
    const hid = await run(() => api.joinHouse(code));
    if (hid) { if (!S.me.nickname) { S.pendingHouse = hid; go('profile'); return; } await enterHouse(hid, true); return; }
  }
  if (!S.me.nickname) { go('profile'); return; }
  const last = localStorage.getItem('paaunjai_last');
  await loadIsland();
  if (last && S.houses.some(h => h.id === last) && S.houses.length === 1) { await enterHouse(last); return; }
  go('island');
}
async function signOut() { await api.signOut(); S.B = null; S.hid = null; S.houses = []; go('welcome'); }

/* ================= profile ================= */
function renderProfile() {
  const av = S.me?.avatar || 'dad';
  document.querySelectorAll('#pick button').forEach(b => { b.classList.toggle('sel', b.dataset.av === av); b.onclick = () => { S.me.avatar = b.dataset.av; renderProfile(); }; });
  if (document.activeElement !== $('nick')) $('nick').value = S.me?.nickname || '';
}
async function saveProfile() {
  const nickname = $('nick').value.trim();
  if (!nickname) { $('profErr').textContent = 'ตั้งชื่อเล่นก่อนนะ'; return; }
  const r = await run(() => api.saveProfile({ nickname, avatar: S.me.avatar || 'dad' }), 'profErr'); if (r === undefined && $('profErr').textContent) return;
  S.me.nickname = nickname;
  if (S.pendingHouse) { const h = S.pendingHouse; S.pendingHouse = null; await enterHouse(h, true); return; }
  if (S.B) { await reload(); }
  go('island');
}

/* ================= island ================= */
async function loadIsland() {
  if (!S.session) return;
  const hs = await run(() => api.myHouses()); if (hs) S.houses = hs;
  $('islAv').src = `img/av_${S.me?.avatar || 'dad'}_smile.jpg`;
  $('islName').textContent = 'เกาะของ ' + (S.me?.nickname || 'ฉัน');
  $('islCount').textContent = `${S.houses.length} บ้าน · ว่าง ${5 - S.houses.length} แปลง`;
  $('islHint').textContent = S.houses.length ? 'แตะบ้านเพื่อเข้า · แตะแปลงว่างเพื่อสร้าง' : 'แตะแปลงว่างเพื่อสร้างบ้านหลังแรก';
  renderSpots();
}
function renderSpots() {
  const box = $('spots'); box.innerHTML = '';
  PLOTS.forEach((p, i) => {
    const h = S.houses.find(x => x.plot === i);
    const el = document.createElement('div'); el.className = 'spot' + (h ? ' house' : '');
    el.style.left = p[0] + '%'; el.style.top = p[1] + '%';
    if (h) {
      el.style.width = (p[2] * 1.18) + '%'; el.style.transform = 'translate(-50%,-80%)';
      el.innerHTML = `<img class="base" src="img/house_${h.style}_day.webp" alt="${esc(h.name)}"><img class="n" src="img/house_${h.style}_night.webp" alt=""><div class="tag" style="top:100%">${esc(h.name)}</div>` +
        (h.today_count > 0 && ['cottage','log','mill'].includes(h.style) ? `<i class="smoke" style="left:64%;top:6%"></i><i class="smoke b" style="left:64%;top:6%"></i><i class="smoke c" style="left:64%;top:6%"></i>` : '');
      el.onclick = e => { e.stopPropagation(); zoomTo(p); sheet('house', h); };
    } else {
      el.style.width = (p[2] * 1.12) + '%';
      el.innerHTML = `<img src="img/plot_day.webp" alt="แปลงว่าง"><img class="n" src="img/plot_night.webp" alt=""><div class="sign">+ สร้างบ้าน</div><div class="tag empty" style="top:96%">ว่าง · ${p[3]}</div>`;
      el.onclick = e => { e.stopPropagation(); zoomTo(p); sheet('build', i); };
    }
    box.appendChild(el);
  });
  [[30,64],[22,57],[36,62],[60,50]].forEach((f, k) => { const ff = document.createElement('i'); ff.className = 'firefly'; ff.style.left = f[0] + '%'; ff.style.top = f[1] + '%'; ff.style.animationDelay = (k * 0.9) + 's'; box.appendChild(ff); });
}
function zoomTo(p) { const w = $('world'); w.style.setProperty('--ox', p[0] + '%'); w.style.setProperty('--oy', p[1] + '%'); w.style.setProperty('--z', 1.35); }
function resetZoom() { $('world').style.setProperty('--z', 1); }

/* ================= house loading ================= */
async function enterHouse(hid, firstTime) {
  const b = await run(() => api.bundle(hid)); if (!b) return;
  S.hid = hid; setBundle(b);
  S.ON = {}; M().forEach(m => S.ON[m.id] = 1);
  try { localStorage.setItem('paaunjai_last', hid); } catch (e) { }
  if (firstTime && !OPEN(S.B.me).set) { openOpening('onboard'); return; }
  go('home');
}
function setBundle(b) {
  S.B = b;
  txs = [...(b.tx || [])].sort((x, y) => (x.occurred_on + x.created_at).localeCompare(y.occurred_on + y.created_at));
  M().forEach(m => { if (S.ON[m.id] === undefined) S.ON[m.id] = 1; });
  document.querySelectorAll('.hname').forEach(e => e.textContent = b.house.name);
}
async function reload() { if (!S.hid) return; const b = await run(() => api.bundle(S.hid)); if (b) setBundle(b); render(); }

/* ================= member filter ================= */
function renderFilters() {
  if (!S.B) return;
  const all = sel().length === M().length;
  const html = `<span class="lbl">ดูของ</span><button class="mfb ${all ? 'on' : ''}" onclick="App.setAll()" style="padding:6px 12px">ทั้งบ้าน</button>` +
    M().map(m => `<button class="mfb ${S.ON[m.id] ? 'on' : ''}" onclick="App.toggleMem('${m.id}')"><img src="${AV(m.id)}" alt="">${WHO(m.id)}</button>`).join('');
  document.querySelectorAll('[data-mf]').forEach(e => e.innerHTML = html);
}
function toggleMem(id) { if (S.ON[id] && sel().length === 1) { toast('ต้องเลือกอย่างน้อย 1 คน'); return; } S.ON[id] = S.ON[id] ? 0 : 1; render(); }
function setAll() { M().forEach(m => S.ON[m.id] = 1); render(); }

/* ================= rows ================= */
function rowHTML(t, showDate) {
  if (t._open) {
    const o = OPEN(t._open);
    return `<div class="row"><img class="av" src="${AV(t._open)}" width="42" height="42" alt=""><div class="t"><b>ยอดยกมาของ ${WHO(t._open)}</b><small>เงินสด ${fmt(o.cash)} · ออม ${fmt(o.savings)} · ลงทุน ${fmt(o.inv_value)}</small></div><span class="lock">ตั้งต้น</span></div>`;
  }
  const d = showDate ? ' · ' + dayLabel(t.occurred_on) : '';
  if (t.type === 'save') {
    const tgt = t.to_project ? 'โปรเจค' + esc(proj(t.to_project)?.name || '') : WHO(t.to_user);
    const kind = t.save_kind === 'inv' ? 'เงินลงทุน' : 'เงินออม';
    const lab = t.paid_from_project ? `จากโปรเจค${esc(proj(t.paid_from_project)?.name || '')} → ${tgt}` : t.save_action === 'wd' ? `ถอน${kind}ของ ${tgt}` : t.save_action === 'val' ? `อัปเดตมูลค่าลงทุนของ ${tgt}` : `${WHO(t.user_id)} → ${tgt}`;
    const sign = t.save_action === 'wd' ? '+' : t.save_action === 'val' ? '' : '→ ';
    return `<div class="row" onclick="App.sheet('tx','${t.id}')"><img class="ic" src="img/ic_${t.save_kind === 'inv' ? 'invest' : 'savings'}.png" alt=""><div class="t"><b>${esc(t.note) || kind}${t.is_private ? '<span class="lock">ส่วนตัว</span>' : ''}</b><small>${lab}${d}</small></div><span class="amt sv">${sign}${fmt(t.amount)}</span></div>`;
  }
  const c = CAT[t.category] || CAT.other;
  return `<div class="row" onclick="App.sheet('tx','${t.id}')"><img class="ic" src="img/ic_${c.ic}.png" alt=""><div class="t"><b>${esc(t.note) || c.n}${t.is_private ? '<span class="lock">ส่วนตัว</span>' : ''}${t.paid_from_project ? '<span class="lock">จากโปรเจค</span>' : ''}${t.receipt_path ? '<span class="lock">ใบเสร็จ</span>' : ''}</b><small>${c.n} · ${WHO(t.user_id)}${d}</small></div><span class="amt ${t.type}">${t.type === 'in' ? '+' : '-'}${fmt(t.amount)}</span></div>`;
}
const visible = t => inS(t.user_id) || (t.type === 'save' && t.to_user && inS(t.to_user));

/* ================= home ================= */
function renderHome() {
  if (!S.B) return;
  const ms = monthStart(), te = today(), c = flows([ms, '9999-12-31']), set = sel();
  $('homeMonth').textContent = THF[parse(te).getMonth()] + ' ' + (parse(te).getFullYear() + 543);
  $('sIn').textContent = fmt(c.inc); $('sOut').textContent = fmt(c.out); $('sSave').textContent = fmt(c.dep);
  const cash = set.reduce((s, u) => s + cashOf(u), 0);
  $('sLeft').textContent = fmt(cash); $('sLeft').style.color = cash < 0 ? '#A0452B' : 'var(--moss2)';
  $('sMonth').textContent = (c.net >= 0 ? '+' : '') + fmt(c.net); $('sMonth').style.color = c.net < 0 ? '#A0452B' : 'var(--moss2)';
  const budget = +S.B.house.monthly_budget || 0, r = budget ? c.out / budget : 0;
  if (budget) {
    $('bUsed').textContent = Math.round(r * 100) + '%' + (set.length < M().length ? ' (เทียบงบทั้งบ้าน)' : '');
    $('bLeft').textContent = r < 1 ? 'เหลือ ' + fmt(budget - c.out) : 'เกิน ' + fmt(c.out - budget);
    $('bBar').style.width = Math.min(100, r * 100) + '%'; $('bBar').style.background = r < .8 ? 'var(--moss)' : r < 1 ? '#D9A55B' : '#B5654A';
  } else {
    $('bUsed').textContent = ''; $('bLeft').innerHTML = '<a class="link" onclick="App.sheet(\'budget\')">ตั้งงบรายเดือน</a>'; $('bBar').style.width = '0';
  }
  const who = set.length === 1 ? set[0] : (M().find(m => mem(m.id).avatar === 'kid')?.id || set[0]);
  const lastBig = txs.filter(t => t.type === 'out' && visible(t)).slice(-1)[0];
  let mood = 'laugh', msg = '<b>เย้!</b> เดือนนี้ยังอยู่ในงบนะ';
  if (!budget) { mood = 'smile'; msg = c.inc || c.out ? `เดือนนี้ใช้ไป <b>${fmt(c.out)}</b>` : '<b>สวัสดี!</b> เริ่มจดรายการแรกกันเลย'; }
  if (budget && r >= 1) { mood = 'tired'; msg = '<b>งอนแล้ว…</b> เดือนนี้ใช้เกินงบไปแล้ว'; }
  else if (budget && r >= .85) { mood = 'tired'; msg = '<b>เหนื่อยจัง</b> งบใกล้หมดแล้ว'; }
  else if (c.net < 0 && c.inc > 0) { mood = 'surprised'; msg = '<b>โอ้โห!</b> เดือนนี้ใช้+ออมเกินรายรับแล้ว'; }
  else if (lastBig && lastBig.occurred_on === te && +lastBig.amount >= 3000) { mood = 'surprised'; msg = `<b>โอ้โห!</b> วันนี้มีรายจ่ายก้อนใหญ่ ${fmt(lastBig.amount)}`; }
  else if (set.length < M().length) { mood = 'smile'; msg = `กำลังดูของ <b>${set.map(WHO).join(', ')}</b>`; }
  $('moodAv').src = AV(who, mood); $('moodText').innerHTML = msg;
  const dues = (S.B.annual || []).filter(a => (!a.owner || inS(a.owner)) && +a.amount > 0).map(a => ({ a, d: daysBetween(te, a.due) })).filter(x => x.d >= 0 && x.d <= 45).sort((x, y) => x.d - y.d);
  $('dueBox').innerHTML = dues.map(({ a, d }) => `<div class="due" onclick="App.go('annual')"><img src="img/ic_${a.icon}.png" alt=""><div class="t"><b>${esc(a.name)} ครบกำหนดใน ${d} วัน</b><small>${fmt(a.amount)} · ${a.owner ? WHO(a.owner) : ''} · ${thShort(a.due)}</small></div><span class="go">›</span></div>`).join('');
  $('projCards').innerHTML = (S.B.projects || []).filter(p => !p.done).map(p => { const s = projStats(p); return `<div class="pcard" onclick="App.openProj('${p.id}')"><div class="h"><img src="img/ic_${p.icon}.png" alt=""><div><b>${esc(p.name)}</b><span class="lbl">${fmt(s.total)} / ${fmt(p.target)}</span></div></div><div class="pbar"><i style="width:${s.pct}%"></i></div><div class="pmeta"><span>${Math.round(s.pct)}%</span><span>เดือนนี้ควรเก็บ ${fmt(Math.max(0, s.needNow - s.cm.got))}</span></div></div>`; }).join('') + `<div class="pcard add" onclick="App.sheet('newproj')"><span style="font-size:28px">+</span>สร้างโปรเจค</div>`;
  const list = [...txs].reverse().filter(visible).slice(0, 6);
  $('recent').innerHTML = list.length ? list.map(t => rowHTML(t, true)).join('') : `<div style="text-align:center;padding:14px 0"><img src="img/state_empty.webp" width="150" alt=""><p class="lbl">ยังไม่มีรายการ กดปุ่ม + เพื่อเริ่มจด</p></div>`;
}

/* ================= add ================= */
function openAdd(o) {
  if (!S.B) return;
  if (INHOUSE.includes(S.cur)) S.back = S.cur === 'opening' ? 'home' : S.cur;
  S.add = { type: o.type || 'out', cat: o.cat || 'food', amt: o.amt ? String(Math.round(o.amt)) : '', kind: o.kind || 'save', act: 'dep', to: o.to || S.B.me, pj: '', file: null };
  go('add');
  $('note').value = o.note || ''; $('priv').classList.remove('on'); $('addErr').textContent = ''; $('txDate').value = today(); $('rcFile').value = ''; $('rcName').textContent = '';
  setType(S.add.type); showAmt();
}
function setType(t) {
  const A = S.add; A.type = t;
  ['out','in','save'].forEach(x => $('seg_' + x).classList.toggle('on', x === t));
  $('saveBox').style.display = t === 'save' ? 'block' : 'none'; $('catBox').style.display = t === 'save' ? 'none' : 'block';
  $('projPayRow').style.display = t === 'out' ? 'flex' : 'none';
  if (t !== 'save') { if (!CATS[t].some(c => c[0] === A.cat)) A.cat = CATS[t][0][0]; renderIcons(); $('amtLbl').textContent = '2 · ใส่จำนวนเงิน'; } else renderSave();
  renderProjPay(); renderWallet();
}
function renderIcons() {
  $('icgrid').innerHTML = CATS[S.add.type].map(c => `<button class="${c[0] === S.add.cat ? 'sel' : ''}" onclick="App.pickCat('${c[0]}')"><img src="img/ic_${c[0]}.png" alt="">${c[1]}</button>`).join('');
  $('amtIc').src = 'img/ic_' + S.add.cat + '.png';
}
function renderProjPay() {
  const ps = (S.B?.projects || []).filter(p => !p.done);
  $('projPay').innerHTML = ps.length ? `<button class="${S.add.pj ? '' : 'on'}" onclick="App.pickPj('')" style="padding:6px 12px">ไม่ใช่</button>` + ps.map(p => `<button class="${S.add.pj === p.id ? 'on' : ''}" onclick="App.pickPj('${p.id}')"><img src="img/ic_${p.icon}.png" alt="">${esc(p.name)}</button>`).join('') : '<span class="lbl">ยังไม่มีโปรเจค</span>';
}
function setKind(k) { const A = S.add; A.kind = k; if (k === 'save' && A.act === 'val') A.act = 'dep'; if ((k === 'inv' || A.act !== 'dep') && String(A.to).startsWith('p:')) A.to = S.B.me; renderSave(); }
function setAct(a) { const A = S.add; A.act = a; if (a !== 'dep' && String(A.to).startsWith('p:')) A.to = S.B.me; renderSave(); }
function renderSave() {
  const A = S.add;
  $('k_save').classList.toggle('on', A.kind === 'save'); $('k_inv').classList.toggle('on', A.kind === 'inv');
  const acts = [['dep','ฝากเข้า'],['wd','ถอนออก']]; if (A.kind === 'inv') acts.push(['val','อัปเดตมูลค่า']);
  $('acts').innerHTML = acts.map(a => `<button class="chip ${A.act === a[0] ? 'on' : ''}" onclick="App.setAct('${a[0]}')">${a[1]}</button>`).join('');
  $('whoLbl').textContent = A.act === 'dep' ? 'ให้ใคร (เงินจะไปอยู่ในส่วนของผู้รับ)' : A.act === 'wd' ? 'ถอนจากของใคร' : 'มูลค่าเงินลงทุนของใคร';
  let opts = M().map(m => `<button class="${A.to === m.id ? 'on' : ''}" onclick="App.pickTo('${m.id}')"><img src="${AV(m.id)}" alt="">${WHO(m.id)}${m.id === S.B.me ? ' (ฉัน)' : ''}</button>`).join('');
  if (A.kind === 'save' && A.act === 'dep') opts += (S.B.projects || []).filter(p => !p.done).map(p => `<button class="${A.to === 'p:' + p.id ? 'on' : ''}" onclick="App.pickTo('p:${p.id}')"><img src="img/ic_${p.icon}.png" alt="">โปรเจค${esc(p.name)}</button>`).join('');
  $('whoBox').innerHTML = opts;
  $('amtIc').src = 'img/ic_' + (A.kind === 'inv' ? 'invest' : 'savings') + '.png';
  $('amtLbl').textContent = A.act === 'val' ? `มูลค่าปัจจุบัน (เดิม ${fmt(balOf(A.to).v)})` : 'จำนวนเงิน';
  renderWallet();
}
function renderWallet() {
  const box = $('wallet'), A = S.add; if (!S.B || A.type !== 'save') { box.style.display = 'none'; return; }
  box.style.display = 'block';
  const a = +A.amt || 0, me = S.B.me; let main, sub = '', warn = '', who = me;
  if (A.act === 'dep') {
    const have = cashOf(me), after = have - a;
    main = `เงินคงเหลือของ ${WHO(me)} <b>${fmt(have)}</b>`;
    sub = a ? `หลังฝากจะเหลือ <b style="color:${after < 0 ? '#A0452B' : 'var(--moss2)'}">${fmt(after)}</b>` : 'เงินที่ฝากจะหักจากยอดนี้';
    if (after < 0) warn = 'ยอดฝากมากกว่าเงินคงเหลือ บันทึกได้ แต่เงินคงเหลือจะติดลบ';
  } else if (A.act === 'wd') {
    who = A.to; const b = balOf(who), have = A.kind === 'save' ? b.s : b.p, c = cashOf(who);
    main = `${A.kind === 'save' ? 'เงินออม' : 'เงินต้นลงทุน'}ของ ${WHO(who)} <b>${fmt(have)}</b>`;
    sub = `ถอนแล้วเข้าเงินคงเหลือของ ${WHO(who)} (ตอนนี้ ${fmt(c)}${a ? ' → ' + fmt(c + a) : ''})`;
  } else {
    who = A.to; const b = balOf(who);
    main = `มูลค่าลงทุนของ ${WHO(who)} ตอนนี้ <b>${fmt(b.v)}</b>`; sub = `เงินต้น ${fmt(b.p)} · อัปเดตมูลค่าไม่กระทบเงินคงเหลือ`;
  }
  box.innerHTML = `<div style="display:flex;align-items:center;gap:10px"><img class="av" src="${AV(who)}" width="40" height="40" alt=""><div style="flex:1;font-size:14px">${main}<br><span class="lbl">${sub}</span></div></div>${warn ? `<p style="font-size:12px;color:#A0452B;margin-top:6px">${warn}</p>` : ''}`;
}
function showAmt() { $('amt').textContent = fmt(+S.add.amt || 0); renderWallet(); }
function key(x) { const A = S.add; if (x === '⌫') A.amt = A.amt.slice(0, -1); else if (A.amt.length < 9) A.amt = (A.amt + x).replace(/^0+/, ''); $('addErr').textContent = ''; showAmt(); }
function pickReceipt(inp) { const f = inp.files?.[0]; if (!f) return; if (f.size > 15e6) { toast('ไฟล์ใหญ่เกินไป'); inp.value = ''; return; } S.add.file = f; $('rcName').textContent = f.name; }
async function saveTx() {
  const A = S.add, a = +A.amt, err = $('addErr');
  if (!a) { err.textContent = 'ใส่จำนวนเงินก่อนนะ'; return; }
  const date = $('txDate').value || today(); if (date > today()) { err.textContent = 'วันที่ต้องไม่เกินวันนี้'; return; }
  const note = $('note').value.trim() || null, is_private = $('priv').classList.contains('on');
  const row = { house_id: S.hid, type: A.type, amount: a, note, occurred_on: date, is_private };
  let sub;
  if (A.type === 'save') {
    Object.assign(row, { save_kind: A.kind, save_action: A.act });
    if (String(A.to).startsWith('p:')) row.to_project = A.to.slice(2); else row.to_user = A.to;
    if (A.act === 'wd') { const b = balOf(A.to), have = A.kind === 'save' ? b.s : b.p; if (a > have) { err.textContent = 'ถอนได้ไม่เกิน ' + fmt(have); return; } }
    const tgt = row.to_project ? 'โปรเจค' + proj(row.to_project).name : mem(row.to_user).nickname;
    sub = A.act === 'dep' ? fmt(a) + ' → ' + tgt : A.act === 'wd' ? 'ถอน ' + fmt(a) + ' จาก ' + tgt : 'มูลค่าใหม่ ' + fmt(a);
  } else {
    row.category = A.cat;
    if (A.type === 'out' && A.pj) row.paid_from_project = A.pj;
    sub = (A.type === 'in' ? '+' : '-') + fmt(a) + ' · ' + CAT[A.cat].n + (row.paid_from_project ? ' (จากโปรเจค)' : '');
  }
  $('saveBtn').disabled = true;
  const done = await run(async () => {
    if (A.file) row.receipt_path = await api.uploadReceipt(S.hid, A.file);
    await api.addTx(row); return true;
  }, 'addErr');
  $('saveBtn').disabled = false;
  if (!done) return;
  await reload();
  popup('บันทึกแล้ว', sub, S.back || 'home');
}

/* ================= history ================= */
function renderHistory() {
  if (!S.B) return;
  const f = [['all','ทั้งหมด'],['out','รายจ่าย'],['in','รายรับ'],['save','ออม/ลงทุน']];
  $('hf').innerHTML = f.map(x => `<button class="chip ${S.hFilter === x[0] ? 'on' : ''}" onclick="App.hf('${x[0]}')">${x[1]}</button>`).join('');
  const q = $('q').value.trim();
  const list = [...txs].reverse().filter(t => visible(t) && (S.hFilter === 'all' || t.type === S.hFilter) && (!q || ((t.note || '') + (t.category ? CAT[t.category]?.n : 'เงินออม เงินลงทุน')).includes(q)));
  const opens = (S.hFilter === 'all' || S.hFilter === 'save') && !q ? sel().filter(u => OPEN(u).set) : [];
  if (!list.length && !opens.length) { $('hlist').innerHTML = `<div style="text-align:center;padding:20px 10px"><img src="img/state_empty.webp" width="200" alt=""><h3 style="margin-top:8px">ยังไม่มีรายการที่ตรงกัน</h3><p class="lbl">ลองค้นหาคำอื่น หรือเพิ่มรายการใหม่</p><button class="btn main" style="margin-top:12px" onclick="App.openAdd({})">เพิ่มรายการ</button></div>`; return; }
  let html = '', last = '';
  const shown = list.slice(0, 300);
  shown.forEach(t => { const d = dayLabel(t.occurred_on); if (d !== last) { if (last) html += '</div>'; html += `<p class="lbl" style="margin:14px 0 4px">${d}</p><div class="card" style="padding:4px 14px">`; last = d; } html += rowHTML(t); });
  if (last) html += '</div>';
  if (list.length > 300) html += `<p class="lbl" style="text-align:center;margin:10px">แสดง 300 รายการล่าสุด · ส่งออก CSV เพื่อดูทั้งหมด</p>`;
  if (opens.length) {
    const groups = {}; opens.forEach(u => (groups[OPEN(u).as_of] ||= []).push(u));
    Object.keys(groups).sort().reverse().forEach(d => { html += `<p class="lbl" style="margin:14px 0 4px">${thShort(d)} · ยอดยกมา</p><div class="card" style="padding:4px 14px">${groups[d].map(u => rowHTML({ _open: u })).join('')}</div>`; });
  }
  $('hlist').innerHTML = html;
}

/* ================= dashboard ================= */
function periodRange() {
  const t = today();
  if (S.period === 'week') { const d = parse(t); d.setDate(d.getDate() - 6); return [iso(d), t]; }
  if (S.period === '3m') return [addMonths(monthStart(t), -2), t];
  if (S.period === 'year') return [t.slice(0, 4) + '-01-01', t];
  return [monthStart(t), t];
}
function renderDash() {
  if (!S.B) return;
  const P = [['week','7 วัน'],['month','เดือนนี้'],['3m','3 เดือน'],['year','ปีนี้']];
  $('per').innerHTML = P.map(p => `<button class="chip ${S.period === p[0] ? 'on' : ''}" onclick="App.setPeriod('${p[0]}')">${p[1]}</button>`).join('');
  const R = periodRange(), set = sel(), c = flows(R);
  const by = {}; txs.filter(t => t.type === 'out' && inS(t.user_id) && !t.paid_from_project && t.occurred_on >= R[0] && t.occurred_on <= R[1]).forEach(t => by[t.category] = (by[t.category] || 0) + +t.amount);
  const arr = Object.entries(by).sort((a, b) => b[1] - a[1]); const top = arr.slice(0, 5); const rest = arr.slice(5).reduce((s, x) => s + x[1], 0); if (rest) top.push(['_rest', rest]);
  const tot = top.reduce((s, x) => s + x[1], 0) || 1; let off = 25, svg = '<circle cx="21" cy="21" r="15.9" fill="none" stroke="#F3ECDA" stroke-width="6"/>';
  const colOf = k => k === '_rest' ? '#B8B2A0' : (CAT[k] || CAT.other).col;
  top.forEach(([k, v]) => { const p = v / tot * 100; svg += `<circle cx="21" cy="21" r="15.9" fill="none" stroke="${colOf(k)}" stroke-width="6" stroke-dasharray="${p.toFixed(2)} ${(100 - p).toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>`; off -= p; });
  svg += `<text x="21" y="20" text-anchor="middle" font-size="3.4" fill="#8B6F50" font-family="Sarabun">รวม</text><text x="21" y="25.5" text-anchor="middle" font-size="4.6" fill="#4A3B2C" font-family="Mali" font-weight="600">${c.out >= 1e5 ? Math.round(c.out / 1000) + 'k' : (c.out / 1000).toFixed(1) + 'k'}</text>`;
  $('donut').innerHTML = svg;
  $('legend').innerHTML = arr.length ? top.map(([k, v]) => `<div><i style="background:${colOf(k)}"></i><span>${k === '_rest' ? 'อื่นๆ' : (CAT[k] || CAT.other).n}</span><b>${Math.round(v / tot * 100)}%</b></div>`).join('') : '<span class="lbl">ยังไม่มีรายจ่ายในช่วงนี้</span>';
  const per = {}; set.forEach(u => per[u] = 0); txs.filter(t => t.type === 'out' && inS(t.user_id) && !t.paid_from_project && t.occurred_on >= R[0] && t.occurred_on <= R[1]).forEach(t => per[t.user_id] += +t.amount);
  const mx = Math.max(1, ...Object.values(per));
  $('mems').innerHTML = set.map(u => `<div class="mem"><img class="av" src="${AV(u)}" width="36" height="36" alt=""><div style="flex:1"><div style="display:flex;justify-content:space-between;font-size:14px"><span>${WHO(u)}</span><b>${fmt(per[u])}</b></div><div class="bar" style="height:8px;margin-top:4px"><i style="width:${per[u] / mx * 100}%"></i></div></div></div>`).join('') + `<div style="display:flex;justify-content:space-between;border-top:1.5px dashed var(--line);padding-top:8px;margin-top:4px"><span>รวม</span><b class="mali">${fmt(c.out)}</b></div>`;
  const budget = +S.B.house.monthly_budget || 0, mOut = flows([monthStart(), '9999-12-31']).out;
  $('overBox').innerHTML = budget && mOut > budget ? `<div class="warn"><img src="img/state_over.webp" alt=""><div><b class="mali">เดือนนี้ใช้เกินงบแล้ว</b><br><span class="lbl">ใช้ไป ${fmt(mOut)} จากงบ ${fmt(budget)}</span></div></div>` : '';
  let ts = 0, tp = 0, tv = 0; const bals = {}; set.forEach(u => { const b = balOf(u); bals[u] = b; ts += b.s; tp += b.p; tv += b.v; });
  $('dSave').textContent = fmt(ts); $('dInv').textContent = fmt(tv);
  const g = tv - tp; $('dInvP').innerHTML = `เงินต้น ${fmt(tp)} ${tp ? `<span class="gain ${g >= 0 ? 'up' : 'dn'}">${g >= 0 ? '+' : ''}${fmt(g)} (${(g / tp * 100).toFixed(1)}%)</span>` : ''}`;
  const smx = Math.max(1, ...set.map(u => bals[u].s + bals[u].v));
  $('svMem').innerHTML = set.map(u => { const b = bals[u], gm = b.v - b.p; return `<div class="mem"><img class="av" src="${AV(u)}" width="36" height="36" alt=""><div style="flex:1"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${WHO(u)}</span><span>ออม <b>${fmt(b.s)}</b> · ลงทุน <b>${fmt(b.v)}</b></span></div><div class="stack" style="margin-top:4px;width:${Math.max(2, (b.s + b.v) / smx * 100)}%"><i style="width:${b.s / (b.s + b.v || 1) * 100}%;background:#8FB3C4"></i><i style="flex:1;background:#8C9E62"></i></div>${b.p ? `<span class="lbl" style="font-size:11px">มูลค่าอัปเดต ${b.last ? thShort(b.last) : '-'} · ${gm >= 0 ? 'กำไร' : 'ขาดทุน'} ${fmt(Math.abs(gm))}</span>` : ''}</div></div>`; }).join('');
  const ends = [5,4,3,2,1,0].map(k => k === 0 ? today() : iso(new Date(parse(addMonths(monthStart(), -k + 1)) - 864e5)));
  const sv = ends.map(e => set.reduce((s, u) => { const b = balOf(u, e); return s + b.s + b.v; }, 0)); const svm = Math.max(1, ...sv);
  $('svTrend').innerHTML = sv.map((v, i) => `<div class="${i === 5 ? 'cur' : ''}"><span>${v >= 1e5 ? Math.round(v / 1000) : (v / 1000).toFixed(1)}k</span><i style="height:${Math.max(2, v / svm * 80)}%;background:${i === 5 ? '#6B9AB3' : '#BCD3DE'}"></i>${TH[parse(ends[i]).getMonth()]}</div>`).join('');
  $('projList').innerHTML = (S.B.projects || []).map(p => { const s = projStats(p); const mine = s.contrib.filter(t => inS(t.user_id)).reduce((x, t) => x + +t.amount, 0); return `<div class="card ${p.done ? 'done' : ''}" style="margin-bottom:10px;cursor:pointer" onclick="App.openProj('${p.id}')"><div class="pcard" style="border:none;padding:0;width:auto"><div class="h"><img src="img/ic_${p.icon}.png" alt=""><div style="flex:1"><b>${esc(p.name)}${p.done ? ' · สำเร็จ' : ''}</b><span class="lbl">เป้า ${fmt(p.target)} · ใช้เงิน ${esc(p.use_label || thMonth(addMonths(p.end_month, 1)))}</span></div><span class="mali" style="font-size:18px">${Math.round(s.pct)}%</span></div><div class="pbar"><i style="width:${s.pct}%"></i></div><div class="pmeta"><span>${set.length < M().length ? set.map(WHO).join(', ') + ' ช่วยออม ' + fmt(mine) : 'สะสม ' + fmt(s.total)}</span><span>${p.done ? '' : 'ควรเก็บเดือนละ ' + fmt(s.needNow)}</span></div></div></div>`; }).join('') || '<p class="lbl" style="margin-bottom:8px">ยังไม่มีโปรเจค กด "+ สร้างโปรเจค" เพื่อเริ่มออมด้วยกัน</p>';
  const ex = [5,4,3,2,1,0].map(k => { const s = addMonths(monthStart(), -k), e = k === 0 ? today() : iso(new Date(parse(addMonths(s, 1)) - 864e5)); return { s, v: flows([s, e]).out }; }); const em = Math.max(1, ...ex.map(x => x.v));
  $('trend').innerHTML = ex.map((x, i) => `<div class="${i === 5 ? 'cur' : ''}"><span>${(x.v / 1000).toFixed(1)}k</span><i style="height:${Math.max(2, x.v / em * 80)}%"></i>${TH[parse(x.s).getMonth()]}</div>`).join('');
}

/* ================= project ================= */
function openProj(id) { if (INHOUSE.includes(S.cur) && S.cur !== 'proj') S.projBack = S.cur; S.projId = id; go('proj'); }
function renderProj() {
  const p = proj(S.projId); if (!p) { $('projBody').innerHTML = '<p class="lbl">ไม่พบโปรเจค</p>'; return; }
  const s = projStats(p), set = sel(), curI = monthIdx(today());
  const win = s.months.filter(x => x.i >= curI - 5 && x.i <= curI + 5);
  const by = {}; M().forEach(m => by[m.id] = 0); s.contrib.forEach(t => by[t.user_id] = (by[t.user_id] || 0) + +t.amount); if (p.opening_owner && +p.opening_amount) by[p.opening_owner] = (by[p.opening_owner] || 0) + +p.opening_amount;
  const bm = Math.max(1, ...set.map(u => by[u] || 0)), mine = set.reduce((t, u) => t + (by[u] || 0), 0);
  const spends = txs.filter(t => t.paid_from_project === p.id);
  $('projBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin:10px 0 12px"><img src="img/ic_${p.icon}.png" width="64" alt=""><div style="flex:1"><h2 style="font-size:22px">${esc(p.name)}${p.done ? ' · สำเร็จ' : ''}</h2><span class="lbl">ใช้เงิน ${esc(p.use_label || thMonth(addMonths(p.end_month, 1)))} · ${p.done ? 'ปิดแล้ว' : 'เหลือเก็บ ' + s.monthsLeft + ' เดือน'}</span></div><button class="chip" onclick="App.sheet('newproj','${p.id}')">แก้ไข</button></div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="big">${fmt(s.total)}</span><span class="lbl">เป้า ${fmt(p.target)}</span></div>
      <div class="pbar" style="height:20px;margin:8px 0 4px"><i style="width:${s.pct}%"></i></div>
      <div class="pmeta"><span><b class="mali" style="font-size:15px;color:var(--ink)">${Math.round(s.pct)}%</b> ของเป้าหมาย</span><span>ขาดอีก ${fmt(Math.max(0, p.target - s.total))}</span></div>
      <div class="pmeta" style="margin-top:6px"><span>รวมยอดยกมา ${fmt(p.opening_amount)}${p.opening_owner ? ' (' + WHO(p.opening_owner) + ')' : ''}</span><a class="link" onclick="App.sheet('newproj','${p.id}')">แก้ยอดยกมา</a></div>
      ${p.done ? '' : `<div class="sum" style="margin:12px 0 0"><div class="i" style="background:#E2ECF1"><span>ควรเก็บเดือนละ</span><b>${fmt(s.needNow)}</b></div><div class="${s.cm.got >= s.needNow ? 'i' : 'e'}"><span>เดือนนี้เก็บแล้ว</span><b>${fmt(s.cm.got)}</b></div></div>`}
    </div>
    <div class="sect"><h3>เก็บได้รายเดือน</h3><span class="lbl">เทียบกับที่ควรเก็บ</span></div>
    <div class="card" style="padding:8px 14px">${win.map(x => { const pct = x.need ? Math.min(100, x.got / x.need * 100) : 100; return `<div class="mon ${x.fut ? 'fut' : pct >= 100 ? 'ok' : 'low'} ${x.cur ? 'cur' : ''}"><span class="m">${TH[x.m]} ${String(x.y + 543).slice(-2)}${x.cur ? ' •' : ''}</span><div class="pbar"><i style="width:${x.fut ? 0 : pct}%"></i></div><span class="v">${x.fut ? 'ควร ' + fmt(x.need) : Math.round(pct) + '% · ' + fmt(x.got)}</span></div>`; }).join('') || '<p class="lbl">-</p>'}
      <p class="note">ยอด "ควรเก็บ" คำนวณใหม่ทุกเดือน เดือนไหนเก็บได้น้อย เดือนถัดไปจะเพิ่มให้อัตโนมัติ</p></div>
    <div class="sect"><h3>ใครช่วยออมเท่าไหร่</h3><span class="lbl">${set.length < M().length ? 'รวมที่เลือก ' + fmt(mine) : ''}</span></div>
    <div class="card" style="padding:6px 14px">${set.map(u => `<div class="mem"><img class="av" src="${AV(u)}" width="36" height="36" alt=""><div style="flex:1"><div style="display:flex;justify-content:space-between;font-size:14px"><span>${WHO(u)}</span><b>${fmt(by[u] || 0)}</b></div><div class="pbar" style="height:8px;margin-top:4px"><i style="width:${(by[u] || 0) / bm * 100}%"></i></div></div></div>`).join('')}${+p.opening_amount && !p.opening_owner ? `<div class="mem"><img src="img/ic_savings.png" width="36" alt=""><div style="flex:1;display:flex;justify-content:space-between;font-size:14px"><span>ยอดยกมา (ไม่ระบุ)</span><b>${fmt(p.opening_amount)}</b></div></div>` : ''}</div>
    <div class="sect"><h3>ใช้จ่ายจากโปรเจค</h3><span class="lbl">ใช้ไป ${fmt(s.spent)} · เหลือ ${fmt(s.total - s.spent)}</span></div>
    <div class="card" style="padding:4px 14px">${spends.length ? [...spends].reverse().map(t => rowHTML(t, true)).join('') : '<p class="lbl" style="padding:10px 0">ยังไม่มีรายจ่ายจากโปรเจคนี้</p>'}</div>
    ${p.done ? '' : `<div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
      <button class="btn main" onclick="App.openAdd({type:'save',kind:'save',to:'p:${p.id}'})">ออมเข้าโปรเจค</button>
      <div class="frow"><button class="btn ghost" onclick="App.sheet('projpay','${p.id}')">จ่ายจากโปรเจค</button><button class="btn ghost" onclick="App.sheet('closeproj','${p.id}')">ปิดโปรเจค</button></div></div>`}`;
}

/* ================= annual ================= */
function renderAnnual() {
  if (!S.B) return;
  const set = sel(), te = today();
  const items = (S.B.annual || []).filter(a => !a.owner || inS(a.owner)).sort((a, b) => a.due.localeCompare(b.due));
  const per = {}; set.forEach(u => per[u] = 0); items.forEach(a => { if (a.owner && per[a.owner] !== undefined) per[a.owner] += annMonthly(a); });
  $('anTotal').textContent = fmt(items.reduce((s, a) => s + annMonthly(a), 0));
  $('anPer').innerHTML = set.map(u => `<div class="row" style="padding:6px 0"><img class="av" src="${AV(u)}" width="32" height="32" alt=""><div class="t"><b style="font-size:14px">${WHO(u)} ควรกันไว้</b></div><span class="amt" style="color:#3F6E8C">${fmt(per[u])}/ด.</span></div>`).join('');
  $('anList').innerHTML = items.map(a => {
    const d = daysBetween(te, a.due), has = +a.amount > 0, soon = has && d >= 0 && d <= 45, late = has && d < 0;
    const freq = a.unit === 'y' ? (a.every === 1 ? 'ทุกปี' : 'ทุก ' + a.every + ' ปี') : 'ทุก ' + a.every + ' เดือน';
    return `<div class="annual ${soon || late ? 'soon' : ''}"><div class="h" onclick="App.sheet('annual','${a.id}')" style="cursor:pointer"><img class="ic" src="img/ic_${a.icon}.png" alt=""><div class="t"><b>${esc(a.name)} ${soon ? `<span class="badge">อีก ${d} วัน</span>` : late ? '<span class="badge">เลยกำหนด</span>' : ''}</b><small>${+a.amount ? fmt(a.amount) : '<span style="color:#A0452B">ยังไม่ใส่จำนวนเงิน</span>'} · ${freq} · ครบ ${thShort(a.due)}</small></div>${a.owner ? `<img class="av" src="${AV(a.owner)}" width="30" height="30" alt="">` : ''}</div>
      <div class="f"><span>กันไว้เดือนละ <b class="mali" style="color:#3F6E8C">${fmt(annMonthly(a))}</b></span><span style="display:flex;gap:6px"><button class="mini" onclick="App.annPaid('${a.id}')">จ่ายแล้ว</button><button class="mini p" onclick="App.annRecord('${a.id}')">บันทึกเป็นรายจ่าย</button></span></div></div>`;
  }).join('') || '<p class="lbl">ไม่มีรายการของคนที่เลือก</p>';
}
function nextDue(a) { const d = parse(a.due); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + (a.unit === 'y' ? a.every * 12 : a.every)); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return iso(d); }
async function annPaid(id) {
  const a = S.B.annual.find(x => x.id === id); const due = nextDue(a);
  const r = await run(() => api.saveAnnual({ id, due })); if (r === undefined) return;
  a.due = due; renderAnnual(); toast(`${a.name} เลื่อนไปครบ ${thShort(due)}`);
}
async function annRecord(id) {
  const a = S.B.annual.find(x => x.id === id);
  const cat = { health: 'health', education: 'education', utilities: 'utilities', household: 'household', home: 'home', phone: 'phone', pets: 'pets' }[a.icon] || (a.icon === 'transport' ? 'transport' : 'other');
  await annPaid(id); openAdd({ type: 'out', cat, amt: +a.amount, note: a.name });
}

/* ================= opening ================= */
function openOpening(mode) { S.op = { mode, who: S.B.me }; go('opening'); }
function openingBack() { go(S.op.mode === 'onboard' ? 'home' : 'house'); }
function renderOpening() {
  if (!S.B) return;
  const canEdit = u => u === S.B.me || isOwner();
  const list = S.op.mode === 'onboard' ? [S.B.me] : M().map(m => m.id);
  if (!list.includes(S.op.who)) S.op.who = S.B.me;
  $('opTitle').textContent = S.op.mode === 'onboard' ? 'ตั้งยอดเงินตั้งต้น' : 'ยอดตั้งต้น (ยอดยกมา)';
  $('opNote').textContent = S.op.mode === 'onboard' ? 'ใส่ยอดที่มีอยู่ตอนนี้ จะได้เห็นเงินคงเหลือจริงตั้งแต่วันแรก' : 'แต่ละคนแก้ของตัวเองได้ เจ้าของบ้านแก้แทนสมาชิกได้';
  $('opWho').innerHTML = list.length > 1 ? list.map(u => `<button class="${S.op.who === u ? 'on' : ''}" onclick="App.opWho('${u}')"><img src="${AV(u)}" alt="">${WHO(u)}</button>`).join('') : '';
  const o = OPEN(S.op.who);
  $('op_date').value = o.set ? o.as_of : monthStart();
  $('op_cash').value = o.set ? o.cash : ''; $('op_save').value = o.set ? o.savings : ''; $('op_inv').value = o.set ? o.inv_principal : ''; $('op_val').value = o.set ? o.inv_value : '';
  const ro = !canEdit(S.op.who); ['op_date','op_cash','op_save','op_inv','op_val'].forEach(i => $(i).disabled = ro);
  $('opErr').textContent = ro ? 'เฉพาะเจ้าตัวหรือเจ้าของบ้านที่แก้ได้' : '';
  $('opSkip').style.display = S.op.mode === 'onboard' ? 'block' : 'none';
}
async function saveOpening() {
  const v = id => num($(id).value);
  if (v('op_inv') && !v('op_val')) { $('opErr').textContent = 'ใส่มูลค่าปัจจุบันของเงินลงทุนด้วยนะ'; return; }
  if ([v('op_save'), v('op_inv'), v('op_val')].some(x => x < 0)) { $('opErr').textContent = 'ยอดออม/ลงทุนต้องไม่ติดลบ'; return; }
  const row = { house_id: S.hid, user_id: S.op.who, as_of: $('op_date').value || monthStart(), cash: v('op_cash'), savings: v('op_save'), inv_principal: v('op_inv'), inv_value: v('op_val') };
  const r = await run(() => api.saveOpening(row), 'opErr'); if (r === undefined && $('opErr').textContent) return;
  await reload();
  if (S.op.mode === 'onboard') popup('ตั้งยอดเรียบร้อย', 'พร้อมเริ่มจดบันทึกแล้ว', 'home'); else toast('บันทึกยอดตั้งต้นของ ' + mem(S.op.who).nickname + ' แล้ว');
}

/* ================= house ================= */
function renderHouse() {
  if (!S.B) return;
  const h = S.B.house, myRole = mem(S.B.me).role;
  $('hsImg').src = `img/house_${h.style}_day.webp`;
  $('hsSub').textContent = `${M().length} สมาชิก · คุณเป็น${myRole === 'owner' ? 'เจ้าของบ้าน' : 'สมาชิก'}`;
  $('hsEdit').style.display = isOwner() ? '' : 'none';
  $('hpCount').textContent = (S.B.projects || []).filter(p => !p.done).length + ' โปรเจคกำลังออม';
  $('hsBudget').textContent = +h.monthly_budget ? fmt(h.monthly_budget) + ' ต่อเดือน' : 'ยังไม่ได้ตั้ง';
  $('hsMembers').innerHTML = M().map(m => `<div class="row"><img class="av" src="${AV(m.id)}" width="42" height="42" alt=""><div class="t"><b>${WHO(m.id)}${m.id === S.B.me ? ' (ฉัน)' : ''}</b><small>${m.role === 'owner' ? 'เจ้าของบ้าน' : 'สมาชิก'}${S.me?.is_admin && m.id === S.B.me ? ' · Admin' : ''}</small></div>${isOwner() && m.id !== S.B.me ? `<button class="mini" onclick="App.sheet('kick','${m.id}')">นำออก</button>` : ''}</div>`).join('');
  $('hsCode').textContent = h.invite_code;
  $('hsEmail').textContent = S.session?.user?.email || '';
  drawQR(inviteLink());
}
const inviteLink = () => location.origin + location.pathname + '?join=' + encodeURIComponent(S.B.house.invite_code);
let qrLib = null;
async function drawQR(text) {
  const box = $('qr');
  try {
    if (!qrLib) { await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js'; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }); qrLib = window.qrcode; }
    const q = qrLib(0, 'M'); q.addData(text); q.make(); box.innerHTML = q.createSvgTag({ cellSize: 3, margin: 2, scalable: true });
    const svg = box.querySelector('svg'); if (svg) { svg.style.width = '110px'; svg.style.height = '110px'; }
  } catch (e) { box.innerHTML = '<span class="lbl" style="font-size:11px;text-align:center;padding:6px">ใช้โค้ดเชิญด้านขวา</span>'; }
}
async function copyInvite() {
  const t = `มาบันทึกรายรับรายจ่ายด้วยกันที่ "${S.B.house.name}" ในแอปป่าอุ่นใจ\n${inviteLink()}\nโค้ดเชิญ: ${S.B.house.invite_code}`;
  try { await navigator.clipboard.writeText(t); toast('คัดลอกลิงก์เชิญแล้ว ส่งให้สมาชิกได้เลย'); } catch (e) { toast('โค้ดเชิญ: ' + S.B.house.invite_code); }
}
function exportCsv() {
  const head = ['วันที่','ประเภท','หมวด','จำนวนเงิน','ผู้บันทึก','ให้/ของ','โปรเจค','จ่ายจากโปรเจค','โน้ต','ส่วนตัว'];
  const typ = t => t.type === 'out' ? 'รายจ่าย' : t.type === 'in' ? 'รายรับ' : (t.save_kind === 'inv' ? 'ลงทุน' : 'ออม') + '-' + ({ dep: 'ฝาก', wd: 'ถอน', val: 'อัปเดตมูลค่า' }[t.save_action]);
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = [...txs].reverse().map(t => [t.occurred_on, typ(t), t.category ? (CAT[t.category] || CAT.other).n : '', t.amount, mem(t.user_id).nickname, t.to_user ? mem(t.to_user).nickname : '', t.to_project ? proj(t.to_project)?.name : '', t.paid_from_project ? proj(t.paid_from_project)?.name : '', t.note, t.is_private ? 'ใช่' : ''].map(q).join(','));
  const blob = new Blob(['﻿' + [head.map(q).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${S.B.house.name}-${today()}.csv`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('ดาวน์โหลดไฟล์แล้ว เปิดด้วย Excel ได้เลย');
}

/* ================= sheets ================= */
function pickOne(sel) { document.querySelectorAll(sel).forEach(x => x.onclick = () => { document.querySelectorAll(sel).forEach(y => y.classList.remove('on')); x.classList.add('on'); }); }
async function sheet(kind, arg) {
  const b = $('sheetBody'); let html = '';
  if (kind === 'house') {
    const h = arg;
    html = `<div style="display:flex;gap:12px;align-items:center"><img src="img/house_${h.style}_${S.night ? 'night' : 'day'}.webp" width="86" alt=""><div style="flex:1"><h2 style="font-size:21px">${esc(h.name)}</h2><span class="lbl">${PLOTS[h.plot][3]} · ${h.members.length} สมาชิก · ${h.role === 'owner' ? 'เจ้าของบ้าน' : 'สมาชิก'}</span>
      <div style="display:flex;margin-top:6px">${h.members.map((m, i) => `<img class="av" src="img/av_${m.avatar}_smile.jpg" width="34" height="34" style="margin-left:${i ? -8 : 0}px" alt="">`).join('')}</div></div></div>
      <div class="sum" style="margin:14px 0"><div class="e"><span>ใช้ไปเดือนนี้</span><b>${fmt(h.month_out)}</b></div><div class="i"><span>บันทึกวันนี้</span><b>${h.today_count ? h.today_count + ' รายการ' : '—'}</b></div></div>
      <button class="btn main" onclick="App.enter('${h.id}')">เข้าบ้าน</button>`;
  } else if (kind === 'build') {
    html = `<h2 style="font-size:21px">สร้างบ้านใหม่ · ${PLOTS[arg][3]}</h2><p class="lbl" style="margin-bottom:12px">ตั้งชื่อ เลือกแบบบ้าน แล้วค่อยเชิญสมาชิก</p>
      <input class="field" id="hn" maxlength="40" placeholder="บ้านริมน้ำ">
      <p style="font-weight:600;margin-top:4px">เลือกแบบบ้าน</p>
      <div class="styles" id="sty">${STYLES.map((s, i) => `<button class="${i ? '' : 'sel'}" data-s="${s[0]}" title="${s[1]}"><img src="img/house_${s[0]}_day.webp" alt="${s[1]}"></button>`).join('')}</div>
      <p class="err" id="hErr"></p><button class="btn main" onclick="App.build(${arg})">สร้างบ้าน</button>`;
  } else if (kind === 'join') {
    html = `<h2 style="font-size:21px">เข้าร่วมบ้าน</h2><p class="lbl" style="margin-bottom:12px">ใส่โค้ดเชิญจากเจ้าของบ้าน หรือเปิดลิงก์เชิญที่ได้รับ</p><input class="field" id="jc" placeholder="SUK-7Q4K" style="text-transform:uppercase;letter-spacing:2px"><p class="err" id="jErr"></p><button class="btn main" onclick="App.join()">เข้าร่วม</button>`;
  } else if (kind === 'newproj') {
    const p = arg ? proj(arg) : null;
    const endDefault = p ? addMonths(p.end_month, 1).slice(0, 7) : addMonths(monthStart(), 7).slice(0, 7);
    html = `<h2 style="font-size:21px">${p ? 'แก้ไขโปรเจค' : 'สร้างโปรเจคออมของบ้าน'}</h2><p class="lbl" style="margin-bottom:12px">ทุกคนในบ้านช่วยกันออมได้</p>
      <input class="field" id="pn" maxlength="40" placeholder="เที่ยวญี่ปุ่น" value="${esc(p?.name || '')}">
      <div style="display:flex;gap:6px;margin-bottom:10px;overflow-x:auto" id="pic">${PROJ_ICONS.map(c => `<button data-c="${c}" class="icpick ${(p?.icon || 'travel') === c ? 'on' : ''}"><img src="img/ic_${c}.png" width="36" alt=""></button>`).join('')}</div>
      <div class="frow"><div><p class="lbl">วงเงินเป้าหมาย</p><input class="field" id="pt" inputmode="decimal" placeholder="120000" value="${p ? +p.target : ''}"></div><div><p class="lbl">เดือนที่จะใช้เงิน</p><input class="field" id="pd" type="month" value="${endDefault}"></div></div>
      <p class="lbl">เก็บไว้แล้ว (ยอดยกมา ถ้ามี)</p><input class="field" id="po" inputmode="decimal" placeholder="0" value="${p && +p.opening_amount ? +p.opening_amount : ''}">
      <p class="lbl">เป็นเงินของใคร (ไม่บังคับ)</p><div class="who" id="pow" style="margin-bottom:12px"><button class="${p?.opening_owner ? '' : 'on'}" data-m="" style="padding:6px 12px">ไม่ระบุ</button>${M().map(m => `<button class="${p?.opening_owner === m.id ? 'on' : ''}" data-m="${m.id}"><img src="${AV(m.id)}" alt="">${WHO(m.id)}</button>`).join('')}</div>
      <div class="guide" style="margin-bottom:12px"><p class="lbl">ควรเก็บเดือนละ</p><p class="big" id="pPrev">฿0</p><p class="note" id="pPrevN">ใส่วงเงินและเดือน ระบบจะเฉลี่ยให้</p></div>
      <p class="err" id="pErr"></p><button class="btn main" onclick="App.saveProj(${p ? `'${p.id}'` : 'null'})">${p ? 'บันทึก' : 'สร้างโปรเจค'}</button>
      ${p ? `<button class="btn ghost" style="margin-top:8px;color:#A0452B" onclick="App.delProj('${p.id}')">ลบโปรเจค</button>` : ''}`;
  } else if (kind === 'projpay') {
    App.sheetNext = arg; closeSheet(); S.add = {}; openAdd({ type: 'out', cat: 'travel' }); S.add.pj = arg; renderProjPay(); return;
  } else if (kind === 'closeproj') {
    const p = proj(arg), s = projStats(p), rem = s.total - s.spent;
    html = `<h2 style="font-size:21px">ปิดโปรเจค "${esc(p.name)}"</h2><p class="lbl" style="margin-bottom:12px">${rem > 0 ? `เงินเหลือในโปรเจค ${fmt(rem)} จะโอนเข้าเงินออมของใคร?` : 'ไม่มีเงินเหลือในโปรเจค'}</p>
      ${rem > 0 ? `<div class="who" id="cpw">${M().map((m, i) => `<button class="${i ? '' : 'on'}" data-m="${m.id}"><img src="${AV(m.id)}" alt="">${WHO(m.id)}</button>`).join('')}</div>` : ''}
      <button class="btn main" style="margin-top:16px" onclick="App.closeProj('${p.id}',${rem})">ปิดโปรเจคเป็น "สำเร็จ"</button>`;
  } else if (kind === 'annual') {
    const a = arg ? S.B.annual.find(x => x.id === arg) : null;
    html = `<h2 style="font-size:21px">${a ? 'แก้ไขรายการ' : 'เพิ่มค่าใช้จ่ายรายปี'}</h2><p class="lbl" style="margin-bottom:12px">ใช้เป็นไกด์เตรียมเงิน ไม่นำไปคำนวณจริง</p>
      <input class="field" id="an" maxlength="60" placeholder="ค่าตรวจสุขภาพประจำปี" value="${esc(a?.name || '')}">
      <div style="display:flex;gap:6px;margin-bottom:10px;overflow-x:auto" id="aic">${ANN_ICONS.map(c => `<button data-c="${c}" class="icpick ${(a?.icon || 'other') === c ? 'on' : ''}"><img src="img/ic_${c}.png" width="36" alt=""></button>`).join('')}</div>
      <p class="lbl">จำนวนเงินต่อครั้ง</p><input class="field" id="aa" inputmode="decimal" placeholder="0" value="${a && +a.amount ? +a.amount : ''}">
      <div class="frow"><div><p class="lbl">จ่ายทุก</p><input class="field" id="ae" inputmode="numeric" value="${a?.every || 1}"></div><div><p class="lbl">หน่วย</p><select class="field" id="au"><option value="y" ${a?.unit !== 'm' ? 'selected' : ''}>ปี</option><option value="m" ${a?.unit === 'm' ? 'selected' : ''}>เดือน</option></select></div></div>
      <p class="lbl">ครบกำหนดครั้งถัดไป</p><input class="field" id="ad" type="date" value="${a?.due || addMonths(monthStart(), 1)}">
      <p class="lbl">ผู้รับผิดชอบ</p><div class="who" id="aw" style="margin-bottom:12px">${M().map(m => `<button class="${(a?.owner || S.B.me) === m.id ? 'on' : ''}" data-m="${m.id}"><img src="${AV(m.id)}" alt="">${WHO(m.id)}</button>`).join('')}</div>
      <p class="err" id="aErr"></p><button class="btn main" onclick="App.saveAnnual(${a ? `'${a.id}'` : 'null'})">${a ? 'บันทึก' : 'เพิ่มรายการ'}</button>
      ${a ? `<button class="btn ghost" style="margin-top:8px;color:#A0452B" onclick="App.delAnnual('${a.id}')">ลบรายการ</button>` : ''}`;
  } else if (kind === 'budget') {
    html = `<h2 style="font-size:21px">งบรายจ่ายต่อเดือน</h2><p class="lbl" style="margin-bottom:12px">ใช้เทียบในหน้าแรก และเปลี่ยนสีหน้าตัวละคร${isOwner() ? '' : ' (เฉพาะเจ้าของบ้านแก้ได้)'}</p>
      <input class="field" id="bg" inputmode="decimal" placeholder="30000" value="${+S.B.house.monthly_budget || ''}" ${isOwner() ? '' : 'disabled'}><p class="err" id="bgErr"></p>${isOwner() ? '<button class="btn main" onclick="App.saveBudget()">บันทึก</button>' : ''}`;
  } else if (kind === 'edithouse') {
    const h = S.B.house;
    html = `<h2 style="font-size:21px">แก้ไขบ้าน</h2><input class="field" id="ehn" maxlength="40" value="${esc(h.name)}" style="margin-top:10px">
      <div class="styles" id="sty">${STYLES.map(s => `<button class="${h.style === s[0] ? 'sel' : ''}" data-s="${s[0]}" title="${s[1]}"><img src="img/house_${s[0]}_day.webp" alt="${s[1]}"></button>`).join('')}</div>
      <p class="err" id="ehErr"></p><button class="btn main" onclick="App.saveHouse()">บันทึก</button>
      <button class="btn ghost" style="margin-top:8px" onclick="App.newCode()">เปลี่ยนโค้ดเชิญใหม่</button>`;
  } else if (kind === 'kick') {
    html = `<h2 style="font-size:21px">นำ ${WHO(arg)} ออกจากบ้าน?</h2><p class="lbl" style="margin:8px 0 14px">รายการที่เคยบันทึกยังอยู่ แต่ ${WHO(arg)} จะเข้าบ้านนี้ไม่ได้อีก (เชิญกลับได้ด้วยโค้ด)</p><button class="btn main" style="background:#B5654A" onclick="App.kick('${arg}')">นำออก</button>`;
  } else if (kind === 'leave') {
    const owners = M().filter(m => m.role === 'owner').length;
    html = `<h2 style="font-size:21px">ออกจาก "${esc(S.B.house.name)}"?</h2><p class="lbl" style="margin:8px 0 14px">${isOwner() && owners === 1 && M().length > 1 ? 'คุณเป็นเจ้าของบ้านคนเดียว ถ้าออก บ้านนี้จะไม่มีเจ้าของ' : 'กลับเข้ามาใหม่ได้ด้วยโค้ดเชิญ'}</p><button class="btn main" style="background:#B5654A" onclick="App.kick('${S.B.me}')">ออกจากบ้าน</button>`;
  } else if (kind === 'adminHouse') {
    const h = ADM.find(x => x.id === arg); if (!h) return;
    const owners = h.members.filter(m => m.role === 'owner').length;
    html = `<div style="display:flex;gap:12px;align-items:center;margin-bottom:6px"><img src="img/house_${h.style}_day.webp" width="70" alt=""><div><h2 style="font-size:21px">${esc(h.name)}</h2><span class="lbl">${h.members.length} สมาชิก · ${h.tx_count} รายการ · ใช้งานล่าสุด ${thShort(String(h.last_activity).slice(0, 10))}</span></div></div>
      <div class="sect" style="margin-top:8px"><h3>สมาชิก</h3></div>
      <div class="card" style="padding:4px 14px">${h.members.map(m => `<div class="row"><img class="av" src="img/av_${m.avatar}_smile.jpg" width="40" height="40" alt=""><div class="t"><b>${esc(m.nickname || 'ไม่มีชื่อ')}${m.id === S.me.id ? ' (ฉัน)' : ''}</b><small>${esc(m.email || '')} · ${m.role === 'owner' ? 'เจ้าของบ้าน' : 'สมาชิก'}</small></div>
        <span style="display:flex;flex-direction:column;gap:4px;align-items:flex-end"><button class="mini" onclick="App.admRole('${h.id}','${m.id}','${m.role === 'owner' ? 'member' : 'owner'}')">${m.role === 'owner' ? 'ปรับเป็นสมาชิก' : 'ตั้งเป็นเจ้าของ'}</button><button class="mini" style="color:#A0452B" onclick="App.admRemove(this,'${h.id}','${m.id}')">นำออก</button></span></div>`).join('') || '<p class="lbl" style="padding:10px 0">ไม่มีสมาชิก</p>'}</div>
      ${owners === 0 && h.members.length ? '<p class="err" style="text-align:left">บ้านนี้ยังไม่มีเจ้าของ ตั้งใครสักคนเป็นเจ้าของบ้าน</p>' : ''}
      <div class="sect"><h3>เพิ่มสมาชิก</h3></div>
      <input class="field" id="admEmail" type="email" placeholder="อีเมลที่สมัครไว้แล้ว เช่น mom@gmail.com">
      <div class="who" id="admRoleSel" style="margin-bottom:8px"><button class="on" data-m="member" style="padding:6px 14px">สมาชิก</button><button data-m="owner" style="padding:6px 14px">เจ้าของบ้าน</button></div>
      <p class="err" id="admErr" style="text-align:left"></p>
      <button class="btn main" onclick="App.admAdd('${h.id}')">เพิ่มเข้าบ้าน</button>
      <p class="note">คนที่ยังไม่เคยสมัคร ให้ส่งลิงก์เชิญจากแท็บ "บ้าน" แทน</p>
      <div class="sect" style="margin-top:20px"><h3 style="color:#A0452B">ลบบ้านนี้</h3></div>
      <div class="card" style="border-color:#F0C9B4;background:#FFF8F4">
        <p style="font-size:13px;line-height:1.6">ลบบ้านพร้อมรายการทั้งหมด ${h.tx_count} รายการ โปรเจค ยอดตั้งต้น ค่าใช้จ่ายรายปี และรูปใบเสร็จ <b>กู้คืนไม่ได้</b> แนะนำให้ส่งออก CSV ก่อน</p>
        <p class="lbl" style="margin-top:8px">พิมพ์ชื่อบ้าน "${esc(h.name)}" เพื่อยืนยัน</p>
        <input class="field" id="admDelName" placeholder="${esc(h.name)}">
        <p class="err" id="admDelErr" style="text-align:left"></p>
        <button class="btn main" style="background:#B5654A" onclick="App.admDelete('${h.id}')">ลบบ้านถาวร</button>
      </div>`;
  } else if (kind === 'newpw') {
    html = `<h2 style="font-size:21px">ตั้งรหัสผ่านใหม่</h2><p class="lbl" style="margin-bottom:12px">อย่างน้อย 6 ตัว</p>
      <input class="field" id="npw" type="password" autocomplete="new-password" placeholder="รหัสผ่านใหม่"><p class="err" id="npwErr"></p>
      <button class="btn main" onclick="App.setPw()">บันทึกรหัสผ่าน</button>`;
  } else if (kind === 'tx') {
    const t = txs.find(x => x.id === arg); if (!t) return;
    const canDel = t.user_id === S.B.me || isOwner();
    html = `<div style="margin-bottom:8px">${rowHTML(t, true).replace(/onclick="[^"]*"/, '')}</div>
      <p class="lbl">บันทึกโดย ${WHO(t.user_id)} · ${thShort(t.occurred_on)}</p>
      <div id="rcBox" style="margin:10px 0"></div>
      ${canDel ? `<button class="btn ghost" style="color:#A0452B" onclick="App.delTx('${t.id}')">ลบรายการนี้</button>` : '<p class="note">ลบได้เฉพาะผู้บันทึกหรือเจ้าของบ้าน</p>'}`;
    if (t.receipt_path) setTimeout(async () => { const u = await run(() => api.receiptUrl(t.receipt_path)); if (u && $('rcBox')) $('rcBox').innerHTML = `<img src="${u}" alt="ใบเสร็จ" style="width:100%;border-radius:14px;border:2px solid var(--line)">`; }, 0);
  }
  b.innerHTML = html;
  if (kind === 'build' || kind === 'edithouse') b.querySelectorAll('#sty button').forEach(x => x.onclick = () => { b.querySelectorAll('#sty button').forEach(y => y.classList.remove('sel')); x.classList.add('sel'); });
  if (kind === 'newproj') {
    pickOne('#pic button'); pickOne('#pow button');
    const prev = () => {
      const t = Math.max(0, num($('pt').value) - num($('po').value)); const pd = $('pd').value;
      if (!pd) return; const end = addMonths(pd + '-01', -1); const left = monthIdx(end) - monthIdx(monthStart()) + 1;
      if (left < 1) { $('pPrev').textContent = '-'; $('pPrevN').textContent = 'เดือนที่จะใช้เงินต้องเป็นเดือนหน้าขึ้นไป'; return; }
      const p = arg ? proj(arg) : null; const saved = p ? projStats(p).total - +p.opening_amount : 0;
      $('pPrev').textContent = fmt(Math.max(0, t - saved) / left); $('pPrevN').textContent = `เก็บอีก ${left} เดือน (ถึง ${thMonth(end)})`; $('pErr').textContent = '';
    };
    ['pt','pd','po'].forEach(id => $(id).oninput = prev); prev();
  }
  if (kind === 'closeproj') pickOne('#cpw button');
  if (kind === 'adminHouse') pickOne('#admRoleSel button');
  if (kind === 'annual') { pickOne('#aic button'); pickOne('#aw button'); }
  $('veil').classList.add('on'); $('sheet').classList.add('on'); $('sheet').scrollTop = 0;
}
function closeSheet() { $('veil').classList.remove('on'); $('sheet').classList.remove('on'); if (S.cur === 'island') resetZoom(); }

/* ================= admin ================= */
let ADM = []; const admOn = {};
async function openAdmin() { if (!S.me?.is_admin) return; go('admin'); await loadAdmin(); }
async function loadAdmin() { const l = await run(() => api.adminOverview()); if (!l) return; ADM = l; l.forEach(h => { if (admOn[h.id] === undefined) admOn[h.id] = 1; }); renderAdmin(); }
function renderAdmin() {
  const te = today();
  $('admSum').textContent = fmt(ADM.filter(h => admOn[h.id]).reduce((s, h) => s + +h.month_out, 0));
  $('admList').innerHTML = ADM.map(h => {
    const idle = daysBetween(String(h.last_activity).slice(0, 10), te);
    return `<div class="card" style="margin-bottom:10px"><div class="row" style="border:none;padding:0">
      <span class="chk ${admOn[h.id] ? 'on' : ''}" onclick="App.admToggle('${h.id}')"></span>
      <img src="img/house_${h.style}_day.webp" width="52" alt="">
      <div class="t"><b>${esc(h.name)} ${idle > 60 ? `<span class="badge">ไม่ได้ใช้งาน ${idle} วัน</span>` : ''}</b><small>${h.members.length} สมาชิก · ${h.tx_count} รายการ · ล่าสุด ${idle === 0 ? 'วันนี้' : idle + ' วันก่อน'}</small>
        <div style="display:flex;margin-top:4px">${h.members.slice(0, 6).map((m, i) => `<img class="av" src="img/av_${m.avatar}_smile.jpg" width="26" height="26" style="margin-left:${i ? -6 : 0}px" alt="">`).join('')}</div></div>
      <span style="display:flex;flex-direction:column;align-items:flex-end;gap:6px"><span class="amt out">${fmt(h.month_out)}</span><button class="mini p" onclick="App.sheet('adminHouse','${h.id}')">จัดการ</button></span></div></div>`;
  }).join('') || '<p class="lbl">ยังไม่มีบ้านในระบบ</p>';
}
async function admAfter(hid, keepSheet) {
  await loadAdmin(); await loadIsland();
  if (S.hid && !S.houses.some(x => x.id === S.hid)) { S.B = null; S.hid = null; }
  else if (S.hid === hid) await reload();
  if (keepSheet && ADM.some(x => x.id === hid)) sheet('adminHouse', hid); else closeSheet();
}
async function admAdd(hid) {
  const email = $('admEmail').value.trim(); if (!/^\S+@\S+\.\S+$/.test(email)) { $('admErr').textContent = 'ใส่อีเมลให้ถูกต้องก่อนนะ'; return; }
  const role = document.querySelector('#admRoleSel .on')?.dataset.m || 'member';
  const r = await run(() => api.adminAddMember(hid, email, role), 'admErr'); if (!r) return;
  toast('เพิ่มสมาชิกแล้ว'); await admAfter(hid, true);
}
async function admRemove(btn, hid, uid) {
  if (!btn.dataset.sure) { btn.dataset.sure = '1'; btn.textContent = 'แตะอีกครั้งเพื่อยืนยัน'; setTimeout(() => { if (btn.isConnected) { delete btn.dataset.sure; btn.textContent = 'นำออก'; } }, 3000); return; }
  const r = await run(() => api.adminRemoveMember(hid, uid).then(() => true)); if (!r) return;
  toast('นำออกแล้ว'); await admAfter(hid, true);
}
async function admRole(hid, uid, role) { const r = await run(() => api.adminSetRole(hid, uid, role).then(() => true)); if (!r) return; toast(role === 'owner' ? 'ตั้งเป็นเจ้าของบ้านแล้ว' : 'ปรับเป็นสมาชิกแล้ว'); await admAfter(hid, true); }
async function admDelete(hid) {
  const h = ADM.find(x => x.id === hid);
  if ($('admDelName').value.trim() !== h.name) { $('admDelErr').textContent = 'ชื่อบ้านไม่ตรง'; return; }
  const r = await run(() => api.adminDeleteHouse(hid).then(() => true), 'admDelErr'); if (!r) return;
  delete admOn[hid]; toast('ลบบ้าน "' + h.name + '" แล้ว'); await admAfter(hid, false);
}

/* ================= sheet actions ================= */
async function build(plot) {
  const name = $('hn').value.trim(); if (!name) { $('hErr').textContent = 'ตั้งชื่อบ้านก่อนนะ'; return; }
  const style = document.querySelector('#sty .sel').dataset.s;
  const hid = await run(() => api.createHouse(name, style, plot), 'hErr'); if (!hid) return;
  closeSheet(); await loadIsland(); await enterHouse(hid, true);
}
async function join() {
  const code = $('jc').value.trim(); if (!code) { $('jErr').textContent = 'ใส่โค้ดเชิญก่อนนะ'; return; }
  const hid = await run(() => api.joinHouse(code), 'jErr'); if (!hid) return;
  closeSheet(); await loadIsland(); await enterHouse(hid, true);
}
async function saveProj(id) {
  const name = $('pn').value.trim(), target = num($('pt').value), pd = $('pd').value, opening_amount = num($('po').value);
  if (!name || !target || !pd) { $('pErr').textContent = 'ใส่ชื่อ วงเงิน และเดือนที่จะใช้เงินให้ครบนะ'; return; }
  const end = addMonths(pd + '-01', -1);
  if (!id && monthIdx(end) < monthIdx(monthStart())) { $('pErr').textContent = 'เดือนที่จะใช้เงินต้องเป็นเดือนหน้าขึ้นไป'; return; }
  const old = id ? proj(id) : null;
  const row = { name, icon: document.querySelector('#pic .on')?.dataset.c || 'travel', target, end_month: end, use_label: thMonth(pd + '-01'), opening_amount, opening_owner: document.querySelector('#pow .on')?.dataset.m || null };
  if (id) row.id = id; else Object.assign(row, { house_id: S.hid, start_month: monthStart() });
  if (old && monthIdx(end) < monthIdx(old.start_month)) { $('pErr').textContent = 'เดือนสิ้นสุดต้องไม่ก่อนเดือนเริ่ม'; return; }
  const pid = await run(() => api.saveProject(row), 'pErr'); if (!pid) return;
  closeSheet(); await reload(); toast(id ? 'บันทึกแล้ว' : 'สร้างโปรเจคแล้ว'); openProj(pid);
}
async function delProj(id) {
  if (txs.some(t => t.to_project === id || t.paid_from_project === id)) { $('pErr').textContent = 'โปรเจคนี้มีรายการแล้ว ใช้ "ปิดโปรเจค" แทนการลบ'; return; }
  const r = await run(() => api.delProject(id).then(() => true), 'pErr'); if (!r) return;
  closeSheet(); await reload(); go('dash'); toast('ลบโปรเจคแล้ว');
}
async function closeProj(id, rem) {
  const to = document.querySelector('#cpw .on')?.dataset.m;
  const r = await run(async () => {
    if (rem > 0 && to) await api.addTx({ house_id: S.hid, type: 'save', save_kind: 'save', save_action: 'dep', amount: rem, to_user: to, paid_from_project: id, note: 'เงินเหลือจากโปรเจค ' + proj(id).name, occurred_on: today() });
    await api.saveProject({ id, done: true }); return true;
  }); if (!r) return;
  closeSheet(); await reload(); popup('โปรเจคสำเร็จ', rem > 0 && to ? fmt(rem) + ' โอนเข้าเงินออมของ ' + mem(to).nickname : ''); renderProj();
}
async function saveAnnual(id) {
  const name = $('an').value.trim(), amount = num($('aa').value), every = Math.round(num($('ae').value)), due = $('ad').value;
  if (!name || !every || every < 1 || !due) { $('aErr').textContent = 'กรอกชื่อ ความถี่ และวันครบกำหนดให้ครบนะ'; return; }
  const row = { name, icon: document.querySelector('#aic .on')?.dataset.c || 'other', amount, every, unit: $('au').value, due, owner: document.querySelector('#aw .on')?.dataset.m || S.B.me };
  if (id) row.id = id; else row.house_id = S.hid;
  const r = await run(() => api.saveAnnual(row), 'aErr'); if (!r) return;
  closeSheet(); await reload(); toast('บันทึกแล้ว');
}
async function delAnnual(id) { const r = await run(() => api.delAnnual(id).then(() => true), 'aErr'); if (!r) return; closeSheet(); await reload(); }
async function saveBudget() { const v = num($('bg').value); if (v < 0) return; const r = await run(() => api.updateHouse(S.hid, { monthly_budget: v }).then(() => true), 'bgErr'); if (!r) return; closeSheet(); await reload(); toast('ตั้งงบแล้ว'); }
async function saveHouse() {
  const name = $('ehn').value.trim(); if (!name) { $('ehErr').textContent = 'ตั้งชื่อบ้านก่อนนะ'; return; }
  const style = document.querySelector('#sty .sel').dataset.s;
  const r = await run(() => api.updateHouse(S.hid, { name, style }).then(() => true), 'ehErr'); if (!r) return; closeSheet(); await reload(); toast('บันทึกแล้ว');
}
async function newCode() {
  const c = Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const r = await run(() => api.updateHouse(S.hid, { invite_code: c }).then(() => true), 'ehErr'); if (!r) return; closeSheet(); await reload(); toast('เปลี่ยนโค้ดเชิญแล้ว โค้ดเดิมใช้ไม่ได้');
}
async function kick(uid) {
  const r = await run(() => api.removeMember(S.hid, uid).then(() => true)); if (!r) return;
  closeSheet();
  if (uid === S.B.me) { S.B = null; S.hid = null; try { localStorage.removeItem('paaunjai_last'); } catch (e) { } go('island'); toast('ออกจากบ้านแล้ว'); }
  else { await reload(); toast('นำออกแล้ว'); }
}
async function delTx(id) { const r = await run(() => api.delTx(id).then(() => true)); if (!r) return; closeSheet(); await reload(); toast('ลบรายการแล้ว'); }

/* ================= init ================= */
window.App = {
  go, back, render, toast, toggleNight, sheet, closeSheet, enter: id => { closeSheet(); enterHouse(id); },
  auth: doAuth, authMode: () => setAuthMode(), forgot, signOut, saveProfile,
  setAll, toggleMem, openAdd, setType, setKind, setAct,
  pickCat: c => { S.add.cat = c; renderIcons(); }, pickPj: id => { S.add.pj = id; renderProjPay(); }, pickTo: id => { S.add.to = id; renderSave(); },
  pickReceipt, saveTx, hf: f => { S.hFilter = f; renderHistory(); }, setPeriod: p => { S.period = p; renderDash(); },
  openProj, openOpening, openingBack, opWho: u => { S.op.who = u; renderOpening(); }, saveOpening,
  annPaid, annRecord, copyInvite, exportCsv,
  build, join, saveProj, delProj, closeProj, saveAnnual, delAnnual, saveBudget, saveHouse, newCode, kick, delTx,
  openAdmin, admToggle: id => { admOn[id] = admOn[id] ? 0 : 1; renderAdmin(); }, admAdd, admRemove, admRole, admDelete,
  setPw: async () => { const v = $('npw').value; if (v.length < 6) { $('npwErr').textContent = 'อย่างน้อย 6 ตัว'; return; } const r = await run(() => api.setPw(v).then(() => true), 'npwErr'); if (r) { closeSheet(); toast('ตั้งรหัสผ่านใหม่แล้ว'); } },
  resetDemo: () => { api.reset?.(); location.reload(); },
};
(function keys() { const k = $('keys'); ['1','2','3','4','5','6','7','8','9','00','0','⌫'].forEach(x => { const b = document.createElement('button'); b.textContent = x; b.onclick = () => key(x); k.appendChild(b); }); })();
(async function init() {
  if (isDemo) $('demoBar').hidden = false;
  const p = new URLSearchParams(location.search);
  if (p.get('join')) { try { localStorage.setItem('paaunjai_join', p.get('join')); } catch (e) { } history.replaceState(null, '', location.pathname + location.hash); }
  const hr = new Date().getHours(); if (hr >= 18 || hr < 6) toggleNight(true);
  setAuthMode('in');
  try {
    await api.onAuth((ev, s) => {
      if (ev === 'PASSWORD_RECOVERY') { S.session = s; afterLogin().then(() => sheet('newpw')); return; }
      if (s && !S.session) { S.session = s; afterLogin(); }
      if (!s && S.session) { S.session = null; S.B = null; S.me = null; go('welcome'); }
    });
    S.session = await api.session();
  } catch (e) { console.error(e); toast(thaiErr(e.message)); }
  if (S.session) await afterLogin(); else go('welcome');
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
})();

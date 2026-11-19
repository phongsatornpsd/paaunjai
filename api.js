import { CONFIG } from './config.js';

export const isDemo = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;

/* ---------- image compression for receipts ---------- */
async function compress(file, max = 1280, q = 0.78) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(ok => c.toBlob(ok, 'image/jpeg', q));
  } finally { URL.revokeObjectURL(url); }
}
const uid4 = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now() + Math.random().toString(16).slice(2));

/* =================================================================
   REAL: Supabase
   ================================================================= */
let sb = null;
async function C() {
  if (!sb) {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return sb;
}
const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
// RLS ไม่แจ้ง error เมื่อไม่มีสิทธิ์ แต่จะไม่มีแถวถูกแก้ — ตรวจตรงนี้
const need = rows => { if (!rows || !rows.length) throw new Error('permission: ไม่มีสิทธิ์ทำรายการนี้'); return rows; };

const real = {
  async session() { return (await (await C()).auth.getSession()).data.session; },
  // ห้ามเรียก Supabase ใน callback ตรงๆ (deadlock) จึงเลื่อนด้วย setTimeout
  async onAuth(cb) { (await C()).auth.onAuthStateChange((e, s) => setTimeout(() => cb(e, s), 0)); },
  async signUp(email, password) {
    const c = await C();
    return ok(await c.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } }));
  },
  async signIn(email, password) { return ok(await (await C()).auth.signInWithPassword({ email, password })); },
  async resetPw(email) { return ok(await (await C()).auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })); },
  async setPw(password) { return ok(await (await C()).auth.updateUser({ password })); },
  async signOut() { await (await C()).auth.signOut(); },
  async profile() {
    const c = await C(); const u = (await c.auth.getUser()).data.user;
    let p = ok(await c.from('profiles').select('*').eq('id', u.id).maybeSingle());
    if (!p) { ok(await c.from('profiles').insert({ id: u.id })); p = ok(await c.from('profiles').select('*').eq('id', u.id).single()); }
    return p;
  },
  async saveProfile(p) {
    const c = await C(); const u = (await c.auth.getUser()).data.user;
    ok(await c.from('profiles').update({ nickname: p.nickname, avatar: p.avatar }).eq('id', u.id));
  },
  async myHouses() { return ok(await (await C()).rpc('my_houses')) || []; },
  async createHouse(name, style, plot) { return ok(await (await C()).rpc('create_house', { p_name: name, p_style: style, p_plot: plot })); },
  async joinHouse(code) { return ok(await (await C()).rpc('join_house', { p_code: code })); },
  async bundle(h) { return ok(await (await C()).rpc('get_house_bundle', { h })); },
  async updateHouse(id, patch) { need(ok(await (await C()).from('houses').update(patch).eq('id', id).select('id'))); },
  async removeMember(h, u) { need(ok(await (await C()).from('house_members').delete().eq('house_id', h).eq('user_id', u).select('user_id'))); },
  async addTx(t) { return ok(await (await C()).from('transactions').insert(t).select('id').single()); },
  async delTx(id) { need(ok(await (await C()).from('transactions').delete().eq('id', id).select('id'))); },
  async saveOpening(o) { ok(await (await C()).from('opening_balances').upsert({ ...o, updated_at: new Date().toISOString() })); },
  async saveProject(p) {
    const c = await C();
    if (p.id) { const { id, ...rest } = p; need(ok(await c.from('projects').update(rest).eq('id', id).select('id'))); return id; }
    return ok(await c.from('projects').insert(p).select('id').single()).id;
  },
  async saveAnnual(a) {
    const c = await C();
    if (a.id) { const { id, ...rest } = a; need(ok(await c.from('annual_items').update(rest).eq('id', id).select('id'))); return id; }
    return ok(await c.from('annual_items').insert(a).select('id').single()).id;
  },
  async delAnnual(id) { need(ok(await (await C()).from('annual_items').delete().eq('id', id).select('id'))); },
  async delProject(id) { need(ok(await (await C()).from('projects').delete().eq('id', id).select('id'))); },
  async adminOverview() { return ok(await (await C()).rpc('admin_overview')) || []; },
  async adminAddMember(h, email, role) { return ok(await (await C()).rpc('admin_add_member', { h, p_email: email, p_role: role })); },
  async adminRemoveMember(h, u) { ok(await (await C()).rpc('admin_remove_member', { h, u })); },
  async adminSetRole(h, u, role) { ok(await (await C()).rpc('admin_set_role', { h, u, p_role: role })); },
  async adminDeleteHouse(h) {
    const c = await C();
    try { // ลบรูปใบเสร็จของบ้านนี้ก่อน
      const files = ok(await c.storage.from('receipts').list(h, { limit: 1000 })) || [];
      if (files.length) ok(await c.storage.from('receipts').remove(files.map(f => `${h}/${f.name}`)));
    } catch (e) { console.warn('receipt cleanup', e); }
    ok(await c.rpc('admin_delete_house', { h }));
  },
  async uploadReceipt(h, file) {
    const c = await C(); const blob = await compress(file); const path = `${h}/${uid4()}.jpg`;
    ok(await c.storage.from('receipts').upload(path, blob, { contentType: 'image/jpeg' }));
    return path;
  },
  async receiptUrl(path) { return ok(await (await C()).storage.from('receipts').createSignedUrl(path, 3600)).signedUrl; },
};

/* =================================================================
   DEMO: เก็บในเครื่อง (localStorage) — ไว้ลองใช้และทดสอบ
   ================================================================= */
const KEY = 'paaunjai_demo_v3';
const iso = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
const dAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const mStart = k => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + k); return iso(d); };

function seed() {
  const U = { dad: 'u-dad', mom: 'u-mom', kid: 'u-kid' };
  const h1 = 'h-1', h2 = 'h-2', jp = 'p-jp', edu = 'p-edu';
  const t = (o) => ({ id: uid4(), is_private: false, created_at: new Date().toISOString(), ...o });
  const tx = [
    t({ house_id: h1, user_id: U.dad, type: 'out', category: 'food', amount: 120, note: 'ก๋วยเตี๋ยวหน้าปากซอย', occurred_on: dAgo(0) }),
    t({ house_id: h1, user_id: U.kid, type: 'save', save_kind: 'save', save_action: 'dep', amount: 500, to_project: jp, note: 'หยอดกระปุกไปญี่ปุ่น', occurred_on: dAgo(0) }),
    t({ house_id: h1, user_id: U.mom, type: 'out', category: 'transport', amount: 60, note: 'วินมอเตอร์ไซค์', occurred_on: dAgo(0) }),
    t({ house_id: h1, user_id: U.mom, type: 'out', category: 'kids', amount: 450, note: 'ของเล่นตัวต่อ', occurred_on: dAgo(1) }),
    t({ house_id: h1, user_id: U.mom, type: 'save', save_kind: 'save', save_action: 'dep', amount: 4000, to_project: jp, occurred_on: dAgo(1) }),
    t({ house_id: h1, user_id: U.dad, type: 'out', category: 'household', amount: 890, note: 'ของใช้ในบ้าน', occurred_on: dAgo(1) }),
    t({ house_id: h1, user_id: U.dad, type: 'out', category: 'utilities', amount: 1840, note: 'ค่าไฟ', occurred_on: dAgo(2) }),
    t({ house_id: h1, user_id: U.mom, type: 'out', category: 'gifts', amount: 1500, note: 'ของขวัญวันเกิด', occurred_on: dAgo(2), is_private: true }),
    t({ house_id: h1, user_id: U.kid, type: 'save', save_kind: 'save', save_action: 'wd', amount: 300, to_user: U.kid, note: 'ถอนไปซื้อหนังสือ', occurred_on: dAgo(3) }),
    t({ house_id: h1, user_id: U.mom, type: 'out', category: 'travel', amount: 3200, note: 'ทริปเขาใหญ่', occurred_on: dAgo(3) }),
    t({ house_id: h1, user_id: U.kid, type: 'out', category: 'education', amount: 2400, note: 'ค่าเรียนว่ายน้ำ', occurred_on: dAgo(3) }),
    t({ house_id: h1, user_id: U.dad, type: 'save', save_kind: 'save', save_action: 'dep', amount: 1000, to_user: U.kid, note: 'ออมให้ลูก', occurred_on: dAgo(5) }),
    t({ house_id: h1, user_id: U.mom, type: 'save', save_kind: 'save', save_action: 'dep', amount: 3000, to_user: U.mom, note: 'ฝากออมทรัพย์', occurred_on: dAgo(6) }),
    t({ house_id: h1, user_id: U.dad, type: 'save', save_kind: 'save', save_action: 'dep', amount: 2000, to_user: U.dad, note: 'ฝากออมทรัพย์', occurred_on: dAgo(6) }),
    t({ house_id: h1, user_id: U.dad, type: 'save', save_kind: 'inv', save_action: 'dep', amount: 5000, to_user: U.mom, note: 'กองทุนรวมให้แม่', occurred_on: dAgo(7) }),
    t({ house_id: h1, user_id: U.dad, type: 'in', category: 'salary', amount: 38000, note: 'เงินเดือน', occurred_on: dAgo(7) }),
    t({ house_id: h1, user_id: U.mom, type: 'in', category: 'side', amount: 7000, note: 'งานออกแบบ', occurred_on: dAgo(7) }),
    t({ house_id: h1, user_id: U.mom, type: 'in', category: 'salary', amount: 25000, note: 'เงินเดือน', occurred_on: dAgo(7) }),
    t({ house_id: h1, user_id: U.dad, type: 'out', category: 'home', amount: 12000, note: 'ค่าเช่าบ้าน', occurred_on: dAgo(8) }),
    t({ house_id: h1, user_id: U.mom, type: 'out', category: 'phone', amount: 899, note: 'ค่าเน็ตบ้าน', occurred_on: dAgo(8) }),
    t({ house_id: h1, user_id: U.dad, type: 'save', save_kind: 'save', save_action: 'dep', amount: 5000, to_project: edu, occurred_on: dAgo(8) }),
  ];
  // เดือนก่อนๆ (ไว้ดูกราฟแนวโน้ม)
  const prev = [[1, 26300], [2, 30800], [3, 22600], [4, 27900], [5, 24100]];
  prev.forEach(([k, v]) => {
    const d = mStart(-k).slice(0, 8) + '15';
    tx.push(t({ house_id: h1, user_id: U.dad, type: 'out', category: 'home', amount: 12000, note: 'ค่าเช่าบ้าน', occurred_on: d }));
    tx.push(t({ house_id: h1, user_id: U.mom, type: 'out', category: 'food', amount: v - 12000, note: 'ค่าอาหารทั้งเดือน', occurred_on: d }));
    tx.push(t({ house_id: h1, user_id: U.dad, type: 'in', category: 'salary', amount: 38000, note: 'เงินเดือน', occurred_on: d }));
    tx.push(t({ house_id: h1, user_id: U.mom, type: 'in', category: 'salary', amount: 25000, note: 'เงินเดือน', occurred_on: d }));
    tx.push(t({ house_id: h1, user_id: U.dad, type: 'save', save_kind: 'save', save_action: 'dep', amount: 4000, to_project: edu, occurred_on: d }));
    tx.push(t({ house_id: h1, user_id: U.mom, type: 'save', save_kind: 'save', save_action: 'dep', amount: 2000, to_project: edu, occurred_on: d }));
    if (k <= 3) tx.push(t({ house_id: h1, user_id: U.dad, type: 'save', save_kind: 'save', save_action: 'dep', amount: [0, 7000, 8000, 10000][k], to_project: jp, occurred_on: d }));
    if (k <= 3) tx.push(t({ house_id: h1, user_id: U.mom, type: 'save', save_kind: 'save', save_action: 'dep', amount: [0, 4000, 5000, 8000][k], to_project: jp, occurred_on: d }));
  });
  const asOf = mStart(-6);
  const ann = (n, ic, amount, every, unit, due, owner) => ({ id: uid4(), house_id: h1, name: n, icon: ic, amount, every, unit, due, owner });
  return {
    me: U.dad,
    profiles: { [U.dad]: { id: U.dad, nickname: 'BOY', avatar: 'dad', is_admin: true, email: 'boy@demo.app' }, [U.mom]: { id: U.mom, nickname: 'แม่', avatar: 'mom', is_admin: false, email: 'mom@demo.app' }, [U.kid]: { id: U.kid, nickname: 'น้องเมษ์', avatar: 'kid', is_admin: false, email: 'kid@demo.app' }, 'u-ya': { id: 'u-ya', nickname: 'คุณยาย', avatar: 'mom', is_admin: false, email: 'yai@demo.app' } },
    houses: { [h1]: { id: h1, name: 'บ้านสุขใจ', style: 'cottage', invite_code: 'SUK-7Q4K', monthly_budget: 32000 }, [h2]: { id: h2, name: 'บ้านพ่อแม่', style: 'thai', invite_code: 'PMA-2B9X', monthly_budget: 20000 } },
    members: [
      { house_id: h1, user_id: U.dad, role: 'owner', plot: 0 }, { house_id: h1, user_id: U.mom, role: 'owner', plot: 0 }, { house_id: h1, user_id: U.kid, role: 'member', plot: 0 },
      { house_id: h2, user_id: U.dad, role: 'owner', plot: 1 }, { house_id: h2, user_id: U.mom, role: 'member', plot: 1 },
    ],
    opening: [
      { house_id: h1, user_id: U.dad, as_of: asOf, cash: 15000, savings: 30000, inv_principal: 60000, inv_value: 64800 },
      { house_id: h1, user_id: U.mom, as_of: asOf, cash: 12000, savings: 35500, inv_principal: 25000, inv_value: 26200 },
      { house_id: h1, user_id: U.kid, as_of: asOf, cash: 4000, savings: 18300, inv_principal: 0, inv_value: 0 },
    ],
    projects: [
      { id: jp, house_id: h1, name: 'เที่ยวญี่ปุ่น', icon: 'travel', target: 120000, start_month: mStart(-3), end_month: mStart(4), use_label: 'ต้นเดือน ' + ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][new Date(mStart(5)).getMonth()], opening_amount: 10000, opening_owner: null, done: false, created_by: U.dad },
      { id: edu, house_id: h1, name: 'ทุนการศึกษาลูก', icon: 'education', target: 300000, start_month: mStart(-6), end_month: mStart(41), use_label: 'ปี 73', opening_amount: 20000, opening_owner: U.dad, done: false, created_by: U.mom },
    ],
    annual: [
      ann('ประกันรถ', 'transport', 18000, 1, 'y', mStart(2).slice(0, 8) + '15', U.dad),
      ann('ประกันชีวิต', 'health', 24000, 1, 'y', mStart(4), U.dad),
      ann('ประกันสุขภาพ', 'health', 15000, 1, 'y', dAgo(-22), U.mom),
      ann('ภาษีรถ (ต่อทะเบียน)', 'transport', 1900, 1, 'y', mStart(2).slice(0, 8) + '15', U.dad),
      ann('เปลี่ยนยางรถ', 'transport', 12000, 3, 'y', mStart(9), U.dad),
      ann('ซ่อมบำรุงรถ', 'household', 4500, 6, 'm', mStart(3), U.dad),
      ann('ล้างแอร์', 'utilities', 1200, 6, 'm', dAgo(-16), U.mom),
      ann('ค่าเทอมลูก', 'education', 35000, 6, 'm', mStart(6), U.mom),
    ],
    tx,
  };
}
let DB = null;
function load() { if (DB) return DB; try { DB = JSON.parse(localStorage.getItem(KEY)); } catch (e) { DB = null; } if (!DB) { DB = seed(); save(); } return DB; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { /* storage อาจใช้ไม่ได้ */ } }
const wait = (v) => new Promise(r => setTimeout(() => r(v), 60));
let demoSession = null;
try { demoSession = sessionStorage.getItem('paaunjai_demo_login') ? { user: { id: 'u-dad' } } : null; } catch (e) { }

const demo = {
  async session() { return demoSession; },
  async onAuth() { },
  async signUp() { demoSession = { user: { id: 'u-dad' } }; try { sessionStorage.setItem('paaunjai_demo_login', '1'); } catch (e) { } return {}; },
  async signIn() { return demo.signUp(); },
  async resetPw() { return wait({}); },
  async setPw() { return wait({}); },
  async signOut() { demoSession = null; try { sessionStorage.removeItem('paaunjai_demo_login'); } catch (e) { } },
  async profile() { return wait({ ...load().profiles[load().me] }); },
  async saveProfile(p) { Object.assign(load().profiles[DB.me], p); save(); return wait(); },
  async myHouses() {
    const db = load(); const today = dAgo(0), ms = mStart(0);
    return wait(db.members.filter(m => m.user_id === db.me).map(m => {
      const h = db.houses[m.house_id];
      return {
        id: h.id, name: h.name, style: h.style, plot: m.plot, role: m.role,
        members: db.members.filter(x => x.house_id === h.id).map(x => ({ id: x.user_id, ...db.profiles[x.user_id] })),
        month_out: db.tx.filter(t => t.house_id === h.id && t.type === 'out' && !t.paid_from_project && t.occurred_on >= ms).reduce((s, t) => s + +t.amount, 0),
        today_count: db.tx.filter(t => t.house_id === h.id && t.occurred_on === today).length,
      };
    }).sort((a, b) => a.plot - b.plot));
  },
  async createHouse(name, style, plot) {
    const db = load(); const mine = db.members.filter(m => m.user_id === db.me);
    if (mine.length >= 5) throw new Error('มีบ้านครบ 5 หลังแล้ว');
    if (mine.some(m => m.plot === plot)) throw new Error('แปลงนี้มีบ้านแล้ว');
    const id = 'h-' + uid4().slice(0, 8);
    db.houses[id] = { id, name, style, invite_code: Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(), monthly_budget: 0 };
    db.members.push({ house_id: id, user_id: db.me, role: 'owner', plot });
    [['ประกันรถ', 'transport', 1, 'y'], ['ประกันชีวิต', 'health', 1, 'y'], ['ประกันสุขภาพ', 'health', 1, 'y'], ['ภาษีรถ (ต่อทะเบียน)', 'transport', 1, 'y'], ['เปลี่ยนยางรถ', 'transport', 3, 'y'], ['ซ่อมบำรุงรถ', 'household', 6, 'm'], ['ล้างแอร์', 'utilities', 6, 'm'], ['ค่าเทอมลูก', 'education', 6, 'm']]
      .forEach(([n, ic, every, unit]) => db.annual.push({ id: uid4(), house_id: id, name: n, icon: ic, amount: 0, every, unit, due: mStart(1), owner: db.me }));
    save(); return wait(id);
  },
  async joinHouse(code) {
    const db = load(); const h = Object.values(db.houses).find(x => x.invite_code === code.trim().toUpperCase());
    if (!h) throw new Error('ไม่พบโค้ดบ้านนี้');
    if (db.members.some(m => m.house_id === h.id && m.user_id === db.me)) return h.id;
    const used = db.members.filter(m => m.user_id === db.me).map(m => m.plot);
    const free = [0, 1, 2, 3, 4].find(p => !used.includes(p)); if (free === undefined) throw new Error('มีบ้านครบ 5 หลังแล้ว');
    db.members.push({ house_id: h.id, user_id: db.me, role: 'member', plot: free }); save(); return wait(h.id);
  },
  async bundle(h) {
    const db = load(); if (!db.members.some(m => m.house_id === h && m.user_id === db.me)) throw new Error('ไม่มีสิทธิ์เข้าบ้านนี้');
    const me = db.me;
    return wait(JSON.parse(JSON.stringify({
      me, house: db.houses[h],
      members: db.members.filter(m => m.house_id === h).map(m => ({ id: m.user_id, nickname: db.profiles[m.user_id].nickname, avatar: db.profiles[m.user_id].avatar, role: m.role })),
      opening: db.opening.filter(o => o.house_id === h), projects: db.projects.filter(p => p.house_id === h),
      annual: db.annual.filter(a => a.house_id === h),
      tx: db.tx.filter(t => t.house_id === h).map(t => (t.is_private && t.user_id !== me) ? { ...t, note: null, receipt_path: null, category: t.type === 'save' ? t.category : 'private' } : t)
        .sort((a, b) => (b.occurred_on + b.created_at).localeCompare(a.occurred_on + a.created_at)),
    })));
  },
  async updateHouse(id, patch) { Object.assign(load().houses[id], patch); save(); return wait(); },
  async removeMember(h, u) { const db = load(); db.members = db.members.filter(m => !(m.house_id === h && m.user_id === u)); save(); return wait(); },
  async addTx(t) { const db = load(); const row = { id: uid4(), user_id: db.me, is_private: false, created_at: new Date().toISOString(), occurred_on: dAgo(0), ...t }; db.tx.push(row); save(); return wait({ id: row.id }); },
  async delTx(id) { const db = load(); db.tx = db.tx.filter(t => t.id !== id); save(); return wait(); },
  async saveOpening(o) { const db = load(); db.opening = db.opening.filter(x => !(x.house_id === o.house_id && x.user_id === o.user_id)); db.opening.push(o); save(); return wait(); },
  async saveProject(p) { const db = load(); if (p.id) { Object.assign(db.projects.find(x => x.id === p.id), p); save(); return wait(p.id); } const id = 'p-' + uid4().slice(0, 8); db.projects.push({ ...p, id, created_by: db.me }); save(); return wait(id); },
  async saveAnnual(a) { const db = load(); if (a.id) { Object.assign(db.annual.find(x => x.id === a.id), a); save(); return wait(a.id); } const id = uid4(); db.annual.push({ ...a, id }); save(); return wait(id); },
  async delProject(id) { const db = load(); db.projects = db.projects.filter(p => p.id !== id); save(); return wait(); },
  async delAnnual(id) { const db = load(); db.annual = db.annual.filter(a => a.id !== id); save(); return wait(); },
  async adminOverview() {
    const db = load(); const ms = mStart(0);
    return wait(JSON.parse(JSON.stringify(Object.values(db.houses).map(h => {
      const tx = db.tx.filter(t => t.house_id === h.id);
      return { id: h.id, name: h.name, style: h.style, created_at: h.created_at || new Date(Date.now() - 200 * 864e5).toISOString(),
        members: db.members.filter(m => m.house_id === h.id).map(m => ({ id: m.user_id, nickname: db.profiles[m.user_id].nickname, avatar: db.profiles[m.user_id].avatar, role: m.role, email: db.profiles[m.user_id].email })),
        tx_count: tx.length, last_activity: tx.reduce((x, t) => t.created_at > x ? t.created_at : x, h.created_at || new Date(Date.now() - 200 * 864e5).toISOString()),
        month_out: tx.filter(t => t.type === 'out' && !t.paid_from_project && t.occurred_on >= ms).reduce((s, t) => s + +t.amount, 0) };
    }))));
  },
  async adminAddMember(h, email, role) {
    const db = load(); const p = Object.values(db.profiles).find(x => (x.email || '').toLowerCase() === email.trim().toLowerCase());
    if (!p) throw new Error('ยังไม่มีผู้ใช้อีเมลนี้ ให้สมัครสมาชิกก่อน');
    if (db.members.some(m => m.house_id === h && m.user_id === p.id)) throw new Error('เป็นสมาชิกบ้านนี้อยู่แล้ว');
    const used = db.members.filter(m => m.user_id === p.id).map(m => m.plot); const free = [0, 1, 2, 3, 4].find(x => !used.includes(x));
    if (free === undefined) throw new Error('ผู้ใช้นี้มีบ้านครบ 5 หลังแล้ว');
    db.members.push({ house_id: h, user_id: p.id, role, plot: free }); save(); return wait(p.id);
  },
  async adminRemoveMember(h, u) { return demo.removeMember(h, u); },
  async adminSetRole(h, u, role) { const db = load(); const m = db.members.find(x => x.house_id === h && x.user_id === u); if (m) m.role = role; save(); return wait(); },
  async adminDeleteHouse(h) { const db = load(); delete db.houses[h]; ['members', 'tx', 'opening', 'projects', 'annual'].forEach(k => db[k] = db[k].filter(x => x.house_id !== h)); save(); return wait(); },
  async uploadReceipt(h, file) { const blob = await compress(file, 900, 0.7); return await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); }); },
  async receiptUrl(path) { return path; },
  reset() { try { localStorage.removeItem(KEY); } catch (e) { } DB = null; },
};

export const api = isDemo ? demo : real;

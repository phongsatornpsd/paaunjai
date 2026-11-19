"use strict";
/* น้องวัตต์ — สมุดชาร์จ EV ของบ้าน
   config.js ว่าง  = โหมดทดลอง (localStorage)
   config.js มีค่า = Supabase (ตาราง ev_*, สิทธิ์อยู่ที่ RLS + RPC ใน schema.sql) */

/* ---------- helpers ---------- */
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid=()=>(crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)}));
const fmt=(n,d=0)=>(isFinite(n)?n:0).toLocaleString('th-TH',{minimumFractionDigits:d,maximumFractionDigits:d});
const baht=(n,d=0)=>'฿'+fmt(n,d);
const numOr=(v,def)=>{const n=parseFloat(v);return isFinite(n)?n:def};
const MON=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseD=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const dLabel=d=>d.getDate()+' '+MON[d.getMonth()];
const dFull=s=>{const d=parseD(s);return d.getDate()+' '+MON[d.getMonth()]+' '+(d.getFullYear()+543)};
const stamp=s=>s.date+' '+(s.time||'00:00');
function toast(msg){const t=$('toast');t.textContent=msg;t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>t.style.display='none',3000)}
function show(name){for(const n of['auth','onboard','app'])$('scr-'+n).classList.toggle('on',n===name)}

/* ---------- cartoon art (original characters) ---------- */
const AV={bear:['หมี','#C9925E'],rabbit:['กระต่าย','#F6F1FA'],cat:['แมว','#FFB870'],frog:['กบ','#8FD694'],chick:['ลูกเจี๊ยบ','#FFE066']};
function avatar(kind,size=34){
  const c=(AV[kind]||AV.bear)[1];
  const ears={bear:'<circle cx="9" cy="10" r="5.5"/><circle cx="31" cy="10" r="5.5"/>',rabbit:'<ellipse cx="13" cy="6" rx="4" ry="9"/><ellipse cx="27" cy="6" rx="4" ry="9"/>',
    cat:'<path d="M6 17 8 3l9 8z"/><path d="M34 17 32 3l-9 8z"/>',frog:'<circle cx="12" cy="10" r="6"/><circle cx="28" cy="10" r="6"/>',chick:'<path d="M20 1c-3 3-2 6 0 8 2-2 3-5 0-8z"/>'}[kind]||'';
  const mouth=kind==='chick'?'<path d="M17 25h6l-3 4z" fill="#F08A24" stroke="#27344F" stroke-width="1.5" stroke-linejoin="round"/>':'<path d="M16 26q4 4 8 0" fill="none" stroke="#27344F" stroke-width="2" stroke-linecap="round"/>';
  return `<svg viewBox="-2 -5 44 44" width="${size}" height="${size}" aria-hidden="true"><g fill="${c}" stroke="#27344F" stroke-width="2" stroke-linejoin="round">${ears}<circle cx="20" cy="22" r="15"/></g><circle cx="14.5" cy="20" r="1.9" fill="#27344F"/><circle cx="25.5" cy="20" r="1.9" fill="#27344F"/><circle cx="11" cy="25" r="2.2" fill="#FF9DAE" opacity=".7"/><circle cx="29" cy="25" r="2.2" fill="#FF9DAE" opacity=".7"/>${mouth}</svg>`;
}
function watt(mood='good',size=84){ // น้องวัตต์: a little battery with a bolt on its tummy
  const eyes={great:'<path d="M27 37q4-5 8 0M45 37q4-5 8 0" fill="none" stroke="#27344F" stroke-width="2.6" stroke-linecap="round"/>',
    sleep:'<path d="M27 38h8M45 38h8" stroke="#27344F" stroke-width="2.6" stroke-linecap="round"/>'}[mood]||'<circle cx="31" cy="37" r="3" fill="#27344F"/><circle cx="49" cy="37" r="3" fill="#27344F"/><circle cx="32" cy="36" r="1" fill="#fff"/><circle cx="50" cy="36" r="1" fill="#fff"/>';
  const mouth={great:'<path d="M33 44q7 9 14 0z" fill="#E4573D" stroke="#27344F" stroke-width="2.2" stroke-linejoin="round"/>',good:'<path d="M34 45q6 6 12 0" fill="none" stroke="#27344F" stroke-width="2.6" stroke-linecap="round"/>',
    meh:'<path d="M35 47h10" stroke="#27344F" stroke-width="2.6" stroke-linecap="round"/>',sad:'<path d="M34 49q6-6 12 0" fill="none" stroke="#27344F" stroke-width="2.6" stroke-linecap="round"/>',
    sleep:'<circle cx="40" cy="47" r="2.4" fill="none" stroke="#27344F" stroke-width="2.2"/>'}[mood];
  const extra=mood==='great'?'<path d="M8 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM72 6l1.5 3.5L77 11l-3.5 1.5L72 16l-1.5-3.5L67 11l3.5-1.5z" fill="#FFD45C" stroke="#27344F" stroke-width="1.6" stroke-linejoin="round"/>'
    :mood==='sad'?'<path d="M60 30c-2 3-3 5 0 6 3-1 2-3 0-6z" fill="#8CC8FF" stroke="#27344F" stroke-width="1.5"/>'
    :mood==='sleep'?'<text x="62" y="18" font-size="13" font-weight="700" fill="#27344F" font-family="Mali,sans-serif">z</text><text x="70" y="10" font-size="9" font-weight="700" fill="#27344F" font-family="Mali,sans-serif">z</text>':'';
  const body=mood==='sad'?'#CFE0EE':mood==='sleep'?'#E7EEF4':'#FFD45C';
  return `<svg class="mascot" viewBox="0 0 80 92" width="${size}" height="${size*92/80}" role="img" aria-label="น้องวัตต์"><g stroke="#27344F" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">
    <rect x="31" y="6" width="18" height="10" rx="3" fill="#fff"/><path d="M17 50q-9 2-9 10M63 50q9 2 9 10M30 82v6M50 82v6" fill="none"/>
    <rect x="16" y="14" width="48" height="68" rx="14" fill="${body}"/><path d="M42 54l-8 12h6l-2 10 9-13h-6z" fill="#fff"/></g>
    <circle cx="25" cy="45" r="3.4" fill="#FF9DAE" opacity=".75"/><circle cx="55" cy="45" r="3.4" fill="#FF9DAE" opacity=".75"/>${eyes}${mouth}${extra}</svg>`;
}

/* ---------- state ---------- */
const CFG=window.EV_CONFIG||{};
const CLOUD=!!(CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY);
const LIB='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
const LS='evfam.v1';
let sb=null,uid=null,loadedAt=0;
const defaults=()=>({fuelName:'แก๊สโซฮอล์ 95',fuelPrice:35,co2Grid:0.45,co2Fuel:2.3,weekStart:1,goalMonth:2000,
  types:[{id:'home',name:'ชาร์จที่บ้าน',price:4.5,loss:10},{id:'tou',name:'บ้าน TOU ช่วงกลางคืน',price:2.7,loss:10},
         {id:'ac',name:'สถานี AC',price:7.5,loss:10},{id:'dc',name:'สถานี DC ชาร์จเร็ว',price:8.5,loss:6}]});
let S={me:null,group:null,members:[],vehicles:[],sessions:[],settings:defaults(),demo:false};
let ui={gran:'month',mode:'cost',veh:'all',histVeh:'all',histWho:'all',editId:null,editVeh:null,obAv:'bear'};

function demoState(empty){
  const st={me:{id:'m1',name:'พ่อ',avatar:'bear'},group:{id:'g1',name:'บ้านตัวอย่าง',code:'WATT24',owner:'m1'},
    members:[{id:'m1',name:'พ่อ',avatar:'bear'},{id:'m2',name:'แม่',avatar:'rabbit'},{id:'m3',name:'พี่ต้น',avatar:'cat'}],
    vehicles:[],sessions:[],settings:defaults(),demo:!empty};
  if(empty){st.members=[st.me];st.group.name='บ้านของฉัน';return st}
  st.settings.goalMonth=2500;
  st.vehicles=[{id:'d1',name:'รถพ่อ SUV 60 kWh',cap:60,soh:100,eff:16,kml:13,fuel:null},{id:'d2',name:'รถแม่ คันเล็ก 45 kWh',cap:45,soh:96,eff:13.5,kml:17,fuel:null}];
  let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const today=new Date(),run={d1:{soc:80,odo:18250},d2:{soc:75,odo:9420}};
  for(let back=150;back>=0;back--)for(const v of st.vehicles){
    if(rnd()>(v.id==='d1'?0.3:0.22))continue;
    const r=rnd(),t=st.settings.types[r<0.55?0:r<0.75?1:r<0.87?2:3],cap=v.cap*v.soh/100,q=run[v.id];
    const from=Math.max(8,Math.round(q.soc-(30+rnd()*38))),to=Math.min(100,Math.round(from+32+rnd()*45));
    q.odo+=Math.round((q.soc-from)*cap/100/(v.eff*(0.9+rnd()*0.24))*100);q.soc=to;
    const who=st.members[v.id==='d1'?(rnd()<0.75?0:2):(rnd()<0.8?1:2)];
    st.sessions.push({id:uuid(),vehicleId:v.id,vehName:v.name,userId:who.id,userName:who.name,date:iso(addDays(today,-back)),time:pad(18+Math.floor(rnd()*5))+':'+pad(Math.floor(rnd()*6)*10),
      from,to,typeId:t.id,typeName:t.name,cap,loss:t.loss,price:t.price,fee:t.id==='dc'&&rnd()>0.6?20:0,kwh:null,paid:null,eff:v.eff,kml:v.kml,
      fuelPrice:Math.round((33.5+rnd()*3)*100)/100,odo:rnd()<0.8?q.odo:null,note:''});
  }
  return st;
}
function saveLocal(){if(CLOUD)return;try{localStorage.setItem(LS,JSON.stringify(S))}catch(e){}}
function loadLocal(){try{const j=JSON.parse(localStorage.getItem(LS)||'null');if(j&&j.group&&Array.isArray(j.sessions)){j.settings={...defaults(),...j.settings};return j}}catch(e){}return null}

/* ---------- Supabase data layer ---------- */
const vRow=v=>({id:v.id,group_id:S.group.id,name:v.name,cap:v.cap,soh:v.soh,eff:v.eff,kml:v.kml,fuel:v.fuel});
const vFrom=r=>({id:r.id,name:r.name,cap:+r.cap,soh:+r.soh,eff:+r.eff,kml:+r.kml,fuel:r.fuel==null?null:+r.fuel});
const sRow=s=>({id:s.id,group_id:S.group.id,vehicle_id:s.vehicleId,veh_name:s.vehName,user_id:s.userId,user_name:s.userName,date:s.date,time:s.time||null,
  soc_from:s.from,soc_to:s.to,type_id:s.typeId,type_name:s.typeName,cap:s.cap,loss:s.loss,price:s.price,fee:s.fee||0,kwh:s.kwh,paid:s.paid,
  eff:s.eff,kml:s.kml,fuel_price:s.fuelPrice,odo:s.odo,note:s.note||''});
const sFrom=r=>({id:r.id,vehicleId:r.vehicle_id,vehName:r.veh_name,userId:r.user_id,userName:r.user_name,date:r.date,time:(r.time||'').slice(0,5),
  from:+r.soc_from,to:+r.soc_to,typeId:r.type_id,typeName:r.type_name,cap:+r.cap,loss:+r.loss,price:+r.price,fee:+r.fee||0,kwh:r.kwh==null?null:+r.kwh,paid:r.paid==null?null:+r.paid,
  eff:+r.eff,kml:+r.kml,fuelPrice:+r.fuel_price,odo:r.odo==null?null:+r.odo,note:r.note||''});
async function q(p){const{data,error}=await p;if(error)throw error;return data}
function errText(e){
  const m=(e&&(e.message||e.error_description))||String(e||'');
  if(/Invalid login/i.test(m))return'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  if(/already registered/i.test(m))return'อีเมลนี้สมัครแล้ว กด "เข้าสู่ระบบ" ได้เลย';
  if(/at least 6|Password should/i.test(m))return'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว';
  if(/rate limit|too many/i.test(m))return'ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่';
  if(/Failed to fetch|NetworkError|Load failed/i.test(m))return'ต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง';
  if(/EV_CODE/.test(m))return'ไม่พบบ้านที่ใช้รหัสนี้';
  if(/EV_HAS_GROUP/.test(m))return'บัญชีนี้อยู่ในบ้านแล้ว';
  if(/EV_OWNER_ONLY/.test(m))return'เฉพาะเจ้าของบ้านทำได้';
  if(/EV_OWNER_STAY/.test(m))return'เจ้าของบ้านออกไม่ได้ ถ้ายังมีสมาชิกคนอื่นอยู่';
  if(/row-level security|permission denied/i.test(m))return'ไม่มีสิทธิ์ทำรายการนี้';
  return'ไม่สำเร็จ: '+m;
}
async function loadCloud(){
  const me=await q(sb.from('ev_members').select('*').eq('user_id',uid).maybeSingle());
  if(!me)return false;
  const gid=me.group_id;
  const[g,ms,vs]=await Promise.all([q(sb.from('ev_groups').select('*').eq('id',gid).single()),
    q(sb.from('ev_members').select('*').eq('group_id',gid).order('joined_at')),q(sb.from('ev_vehicles').select('*').eq('group_id',gid).order('created_at'))]);
  const ss=[];for(let from=0;;from+=1000){const page=await q(sb.from('ev_sessions').select('*').eq('group_id',gid).order('date').range(from,from+999));ss.push(...page);if(page.length<1000)break}
  S={me:{id:uid,name:me.name,avatar:me.avatar},group:{id:g.id,name:g.name,code:g.code,owner:g.owner},
    members:ms.map(m=>({id:m.user_id,name:m.name,avatar:m.avatar})),vehicles:vs.map(vFrom),sessions:ss.map(sFrom),settings:{...defaults(),...(g.settings||{})},demo:false};
  loadedAt=Date.now();return true;
}
// change local state first so the screen answers at once, then write through; on failure reload the truth
async function op(localFn,cloudFn){
  localFn();renderAll();
  if(!CLOUD){saveLocal();return true}
  try{await cloudFn();return true}catch(e){toast(errText(e));try{await loadCloud();renderAll()}catch(_){}return false}
}
const saveSettingsCloud=()=>q(sb.from('ev_groups').update({name:S.group.name,settings:S.settings}).eq('id',S.group.id).select('id')).then(r=>{if(!r.length)throw new Error('permission denied')});

/* ---------- calculation (one place, used everywhere) ---------- */
// Real consumption from odometer readings: between two readings of the same car, the energy used is the
// battery % that dropped between each charge and the next one, so it works even if some charges have no reading.
function linkOdo(all){
  const m=new Map(),by={};
  for(const s of all)(by[s.vehicleId]=by[s.vehicleId]||[]).push(s);
  for(const k in by){const L=by[k].sort((a,b)=>stamp(a).localeCompare(stamp(b)));let last=-1;
    for(let j=0;j<L.length;j++){if(!(L[j].odo>0))continue;
      if(last>=0){let used=0;for(let i=last;i<j;i++)used+=(L[i].to-L[i+1].from)*L[i].cap/100;
        const dist=L[j].odo-L[last].odo,eff=used/dist*100;
        if(dist>0&&used>0&&eff>=5&&eff<=60)for(let i=last+1;i<=j;i++)m.set(L[i].id,{eff,dist,used,since:L[last].date})}
      last=j}}
  return m;
}
let ODO=new Map();
function calc(s,odoMap){
  const st=S.settings,real=(odoMap||ODO).get(s.id)||null,eff=real?real.eff:s.eff;
  const battKwh=s.cap*(s.to-s.from)/100;
  const measured=s.kwh>0;
  const gridKwh=measured?s.kwh:battKwh/(1-s.loss/100);
  const lossKwh=Math.max(0,gridKwh-battKwh);
  const paidGiven=s.paid!=null&&s.paid>=0;
  const evCost=paidGiven?s.paid:gridKwh*s.price+(s.fee||0);
  const km=battKwh/eff*100;
  const litres=km/s.kml;
  const iceCost=litres*s.fuelPrice;
  const saved=iceCost-evCost;
  const co2Ev=gridKwh*st.co2Grid,co2Ice=litres*st.co2Fuel;
  return {battKwh,gridKwh,lossKwh,measured,paidGiven,evCost,km,litres,iceCost,saved,real,eff,
    pct:iceCost>0?saved/iceCost*100:0,evPerKm:km>0?evCost/km:0,icePerKm:km>0?iceCost/km:0,co2Ev,co2Ice,co2Saved:co2Ice-co2Ev};
}
function agg(list){
  const a={n:0,ev:0,ice:0,grid:0,batt:0,km:0,litres:0,co2:0,realN:0};
  for(const s of list){const c=calc(s);a.n++;a.ev+=c.evCost;a.ice+=c.iceCost;a.grid+=c.gridKwh;a.batt+=c.battKwh;a.km+=c.km;a.litres+=c.litres;a.co2+=c.co2Saved;if(c.real)a.realN++}
  a.saved=a.ice-a.ev;a.pct=a.ice>0?a.saved/a.ice*100:0;return a;
}
function stepsHTML(s,odoMap){
  const c=calc(s,odoMap),st=S.settings;
  const L=(a,f,v)=>`<div><span>${a}<em class="num">${f}</em></span><b class="num">${v}</b></div>`;
  return `<div class="steps">`+
  L('พลังงานที่เข้าแบต',`${fmt(s.cap,1)} kWh × (${s.to}% − ${s.from}%)`,fmt(c.battKwh,2)+' kWh')+
  (c.measured?L('ไฟที่ใช้จริงจากตู้/มิเตอร์',`อ่านจากตู้ (สูญเสีย ${fmt(c.lossKwh,2)} kWh)`,fmt(c.gridKwh,2)+' kWh')
             :L('ไฟที่ต้องจ่ายจริง รวมสูญเสีย',`${fmt(c.battKwh,2)} ÷ (1 − ${fmt(s.loss,1)}%) · สูญเสีย ${fmt(c.lossKwh,2)} kWh`,fmt(c.gridKwh,2)+' kWh'))+
  (c.paidGiven?L('ค่าชาร์จ',`ยอดที่จ่ายจริง`,baht(c.evCost,2))
              :L('ค่าชาร์จ',`${fmt(c.gridKwh,2)} kWh × ฿${fmt(s.price,2)}`+(s.fee?` + ค่าบริการ ฿${fmt(s.fee,2)}`:''),baht(c.evCost,2)))+
  (c.real?L('อัตราสิ้นเปลืองจริง จากเลขไมล์',`ใช้ไป ${fmt(c.real.used,1)} kWh ÷ วิ่งจริง ${fmt(c.real.dist)} กม. (ตั้งแต่ ${esc(dFull(c.real.since))})`,fmt(c.eff,1)+' kWh/100 กม.')
         :L('อัตราสิ้นเปลือง (ค่าประมาณ)',s.odo>0?'เทียบกับเลขไมล์ครั้งก่อนไม่ได้ (ยังไม่มีครั้งก่อน หรือตัวเลขผิดปกติ) ใช้ค่าที่ตั้งไว้ของรถ':'ไม่ได้กรอกเลขไมล์ ใช้ค่าที่ตั้งไว้ของรถ',fmt(c.eff,1)+' kWh/100 กม.'))+
  L('ระยะทางที่ไฟรอบนี้วิ่งได้',`${fmt(c.battKwh,2)} kWh ÷ ${fmt(c.eff,1)} kWh/100 กม.`,fmt(c.km,0)+' กม.')+
  L('น้ำมันที่รถน้ำมันต้องใช้',`${fmt(c.km,0)} กม. ÷ ${fmt(s.kml,1)} กม./ลิตร`,fmt(c.litres,2)+' ลิตร')+
  L('ค่าน้ำมันถ้าใช้รถน้ำมัน',`${fmt(c.litres,2)} ลิตร × ฿${fmt(s.fuelPrice,2)} (${esc(st.fuelName)})`,baht(c.iceCost,2))+
  L('ต้นทุนต่อกิโลเมตร',`รถไฟฟ้า เทียบ รถน้ำมัน`,`฿${fmt(c.evPerKm,2)} / ฿${fmt(c.icePerKm,2)}`)+
  L('CO₂ ที่ลดได้',`${fmt(c.co2Ice,1)} กก. − ${fmt(c.co2Ev,1)} กก.`,fmt(c.co2Saved,1)+' กก.')+
  `<div class="total"><span>${c.saved>=0?'ประหยัดได้':'แพงกว่ารถน้ำมัน'}<em class="num">${baht(c.iceCost,2)} − ${baht(c.evCost,2)}</em></span>
   <b class="num" style="color:var(${c.saved>=0?'--good':'--bad'})">${baht(Math.abs(c.saved),2)} (${fmt(Math.abs(c.pct),0)}%)</b></div></div>`;
}

/* ---------- periods and goal ---------- */
function weekStart(d){const ws=+S.settings.weekStart;return addDays(d,-((d.getDay()-ws+7)%7))}
function keyOf(dateStr,g){const d=parseD(dateStr);
  if(g==='day')return dateStr;if(g==='week')return iso(weekStart(d));if(g==='month')return dateStr.slice(0,7);if(g==='year')return dateStr.slice(0,4);return 'all'}
function filtered(){return S.sessions.filter(s=>ui.veh==='all'||s.vehicleId===ui.veh)}
function goalFor(g,list){
  const gm=+S.settings.goalMonth||0;if(!gm)return 0;
  if(g==='day')return gm*12/365;if(g==='week')return gm*12/52;if(g==='month')return gm;if(g==='year')return gm*12;
  if(!list.length)return gm;
  const first=list.reduce((a,s)=>s.date<a?s.date:a,list[0].date);
  return gm*Math.max(1,(Date.now()-parseD(first).getTime())/864e5/30.44);
}
function buckets(g,list){
  const now=new Date(),out=[];
  if(g==='day')for(let i=13;i>=0;i--){const d=addDays(now,-i);out.push({key:iso(d),label:dLabel(d),full:dFull(iso(d))})}
  else if(g==='week')for(let i=11;i>=0;i--){const d=addDays(weekStart(now),-7*i),e=addDays(d,6);out.push({key:iso(d),label:dLabel(d),full:dLabel(d)+' – '+dFull(iso(e))})}
  else if(g==='month')for(let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);out.push({key:d.getFullYear()+'-'+pad(d.getMonth()+1),label:MON[d.getMonth()]+' '+String(d.getFullYear()+543).slice(2),full:MON[d.getMonth()]+' '+(d.getFullYear()+543)})}
  else if(g==='year'){let y0=now.getFullYear();for(const s of list)y0=Math.min(y0,+s.date.slice(0,4));for(let y=y0;y<=now.getFullYear();y++)out.push({key:String(y),label:String(y+543),full:'ปี '+(y+543)})}
  else{
    const names=new Map();for(const s of list)names.set(s.vehicleId,(S.vehicles.find(v=>v.id===s.vehicleId)||{}).name||s.vehName);
    for(const[id,name]of names)out.push({key:id,label:name.length>12?name.slice(0,11)+'…':name,full:name,list:list.filter(s=>s.vehicleId===id)});
    if(names.size>1)out.push({key:'all',label:'รวมทุกคัน',full:'รวมทุกคัน',list});
  }
  for(const b of out){if(!b.list)b.list=list.filter(s=>keyOf(s.date,g)===b.key);b.a=agg(b.list)}
  return out;
}

/* ---------- charts (hand-drawn SVG, one y-scale in baht) ---------- */
function niceStep(span){if(span<=0)return 1;const raw=span/4,p=Math.pow(10,Math.floor(Math.log10(raw)));return[1,2,2.5,5,10].map(m=>m*p).find(s=>s>=raw)}
function tipFor(el){let t=el.querySelector('.tip');if(!t){t=document.createElement('div');t.className='tip';el.appendChild(t)}return t}
function placeTip(el,t,x,y){t.style.display='block';const w=t.offsetWidth,W=el.clientWidth;t.style.left=Math.max(0,Math.min(W-w,x-w/2))+'px';t.style.top=Math.max(0,y-t.offsetHeight-8)+'px'}
function drawBars(el,bs,mode,goal){
  const W=Math.max(280,el.clientWidth||340),H=236,l=48,r=8,t=16,b=30,pw=W-l-r,ph=H-t-b;
  if(!bs.length||bs.every(x=>!x.a.n)){el.innerHTML='<div class="empty">ยังไม่มีการชาร์จในช่วงนี้</div>';return}
  const vals=mode==='goal'?bs.map(x=>x.a.saved):bs.flatMap(x=>[x.a.ev,x.a.ice]);
  const lo=Math.min(0,...vals),hi=Math.max(1,goal||0,...vals),step=niceStep(hi-lo);
  const y0=lo<0?-Math.ceil(-lo/step)*step:0,y1=Math.ceil(hi/step)*step;
  const Y=v=>t+ph-(v-y0)/(y1-y0)*ph,gw=pw/bs.length,bw=Math.max(4,Math.min(mode==='goal'?30:22,mode==='goal'?gw-8:(gw-8)/2));
  let g='';
  for(let v=y0;v<=y1+1e-9;v+=step)g+=`<line x1="${l}" x2="${W-r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${Math.abs(v)<1e-9?'var(--ink)':'var(--hair)'}" stroke-width="1.5"/><text x="${l-6}" y="${Y(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt(v,step<1?1:0)}</text>`;
  const every=Math.ceil(bs.length*46/pw);
  const bar=(x,v,col)=>{if(Math.abs(v)<1e-9)return'';const a=Y(Math.max(v,0)),z=Y(Math.min(v,0)),h=z-a,rr=Math.min(4,h,bw/2);
    return v>0?`<path d="M${x},${z}V${a+rr}a${rr},${rr} 0 0 1 ${rr},${-rr}h${bw-2*rr}a${rr},${rr} 0 0 1 ${rr},${rr}V${z}z" fill="${col}" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round"/>`
               :`<path d="M${x},${a}V${z-rr}a${rr},${rr} 0 0 0 ${rr},${rr}h${bw-2*rr}a${rr},${rr} 0 0 0 ${rr},${-rr}V${a}z" fill="${col}" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round"/>`};
  bs.forEach((x,i)=>{const cx=l+gw*i+gw/2;
    g+=mode==='goal'?bar(cx-bw/2,x.a.saved,x.a.saved>=0?'var(--save)':'var(--bad)'):bar(cx-bw-1.5,x.a.ev,'var(--ev)')+bar(cx+1.5,x.a.ice,'var(--ice)');
    if(i%every===(bs.length-1)%every)g+=`<text x="${cx}" y="${H-10}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(x.label)}</text>`});
  if(mode==='goal'&&goal>0)g+=`<line x1="${l}" x2="${W-r}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="var(--ink)" stroke-width="2" stroke-dasharray="6 5"/><text x="${W-r}" y="${Y(goal)-5}" text-anchor="end" font-size="11.5" font-weight="700" fill="var(--ink)" stroke="var(--surface)" stroke-width="5" stroke-linejoin="round" paint-order="stroke">เป้า ${baht(goal)}</text>`;
  bs.forEach((x,i)=>g+=`<rect data-i="${i}" x="${l+gw*i}" y="${t}" width="${gw}" height="${ph+b}" fill="transparent"/>`);
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${mode==='goal'?'กราฟแท่งยอดประหยัดเทียบเป้าหมาย':'กราฟแท่งเทียบค่าชาร์จกับค่าน้ำมัน'} หน่วยบาท">${g}</svg>`;
  const tip=tipFor(el),svg=el.querySelector('svg');
  const showTip=e=>{const i=e.target.getAttribute&&e.target.getAttribute('data-i');if(i==null){tip.style.display='none';return}
    const x=bs[+i],k=el.clientWidth/W;
    tip.innerHTML=`<b>${esc(x.full)}</b><br>รถไฟฟ้า ${baht(x.a.ev)}<br>รถน้ำมัน ${baht(x.a.ice)}<br>${x.a.saved>=0?'ประหยัด':'แพงกว่า'} ${baht(Math.abs(x.a.saved))}`+(mode==='goal'&&goal>0?`<br>คิดเป็น ${fmt(x.a.saved/goal*100)}% ของเป้า`:'');
    placeTip(el,tip,(l+gw*i+gw/2)*k,Y(Math.max(0,mode==='goal'?x.a.saved:Math.max(x.a.ev,x.a.ice)))*k)};
  svg.addEventListener('pointermove',showTip);svg.addEventListener('pointerdown',showTip);svg.addEventListener('pointerleave',()=>tip.style.display='none');
}
function drawLine(el,list){
  const byDay=new Map();for(const s of list)byDay.set(s.date,(byDay.get(s.date)||0)+calc(s).saved);
  const days=[...byDay.keys()].sort();
  if(days.length<2){el.innerHTML='<div class="empty">บันทึกการชาร์จอย่างน้อย 2 วัน แล้วเส้นสะสมจะขึ้นที่นี่</div>';return}
  let run=0;const pts=days.map(d=>({d,t:parseD(d).getTime(),v:run+=byDay.get(d)}));
  const W=Math.max(280,el.clientWidth||340),H=214,l=48,r=14,t=24,b=28,pw=W-l-r,ph=H-t-b;
  const lo=Math.min(0,...pts.map(p=>p.v)),hi=Math.max(1,...pts.map(p=>p.v)),step=niceStep(hi-lo);
  const y0=lo<0?-Math.ceil(-lo/step)*step:0,y1=Math.ceil(hi/step)*step;
  const t0=pts[0].t,t1=pts[pts.length-1].t,X=tt=>l+(tt-t0)/(t1-t0)*pw,Y=v=>t+ph-(v-y0)/(y1-y0)*ph;
  let g='';
  for(let v=y0;v<=y1+1e-9;v+=step)g+=`<line x1="${l}" x2="${W-r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${Math.abs(v)<1e-9?'var(--ink)':'var(--hair)'}" stroke-width="1.5"/><text x="${l-6}" y="${Y(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt(v)}</text>`;
  const path=pts.map((p,i)=>(i?'L':'M')+X(p.t).toFixed(1)+','+Y(p.v).toFixed(1)).join(''),last=pts[pts.length-1];
  g+=`<path d="${path}L${X(t1)},${Y(0)}L${X(t0)},${Y(0)}z" fill="var(--save)" opacity=".2"/><path d="${path}" fill="none" stroke="var(--save)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
  g+=`<text x="${l}" y="${H-8}" font-size="11" fill="var(--muted)">${esc(dFull(pts[0].d))}</text><text x="${W-r}" y="${H-8}" text-anchor="end" font-size="11" fill="var(--muted)">${esc(dFull(last.d))}</text>`;
  g+=`<line id="xh" x1="0" x2="0" y1="${t}" y2="${t+ph}" stroke="var(--muted)" stroke-width="1" visibility="hidden"/><circle id="xd" r="4.5" fill="var(--save)" stroke="var(--ink)" stroke-width="2" visibility="hidden"/>`;
  g+=`<circle cx="${X(last.t)}" cy="${Y(last.v)}" r="5.5" fill="var(--sun)" stroke="var(--ink)" stroke-width="2.5"/><text x="${W-r}" y="${Math.max(13,Y(last.v)-11)}" text-anchor="end" font-size="13" font-weight="700" fill="var(--ink)">${baht(last.v)}</text>`;
  g+=`<rect x="${l}" y="${t}" width="${pw}" height="${ph}" fill="transparent"/>`;
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟเส้นเงินที่ประหยัดสะสม หน่วยบาท">${g}</svg>`;
  const tip=tipFor(el),svg=el.querySelector('svg'),xh=svg.querySelector('#xh'),xd=svg.querySelector('#xd');
  const hide=()=>{tip.style.display='none';xh.setAttribute('visibility','hidden');xd.setAttribute('visibility','hidden')};
  const showTip=e=>{const rc=svg.getBoundingClientRect(),k=rc.width/W,mx=(e.clientX-rc.left)/k;
    let best=pts[0];for(const p of pts)if(Math.abs(X(p.t)-mx)<Math.abs(X(best.t)-mx))best=p;
    xh.setAttribute('x1',X(best.t));xh.setAttribute('x2',X(best.t));xh.setAttribute('visibility','visible');
    xd.setAttribute('cx',X(best.t));xd.setAttribute('cy',Y(best.v));xd.setAttribute('visibility','visible');
    tip.innerHTML=`<b>${esc(dFull(best.d))}</b><br>ประหยัดสะสม ${baht(best.v)}`;placeTip(el,tip,X(best.t)*k,Y(best.v)*k)};
  svg.addEventListener('pointermove',showTip);svg.addEventListener('pointerdown',showTip);svg.addEventListener('pointerleave',hide);
}

/* ---------- render ---------- */
const GR=[['day','วัน'],['week','สัปดาห์'],['month','เดือน'],['year','ปี'],['all','ทั้งหมด']];
const NOW={day:'วันนี้',week:'สัปดาห์นี้',month:'เดือนนี้',year:'ปีนี้',all:'ตั้งแต่เริ่มบันทึก'};
const isOwner=()=>S.group&&S.me&&S.group.owner===S.me.id;
const memberOf=id=>S.members.find(m=>m.id===id);
function vehOptions(sel,val,withAll){
  const ids=new Map(S.vehicles.map(v=>[v.id,v.name]));
  if(withAll)for(const s of S.sessions)if(!ids.has(s.vehicleId))ids.set(s.vehicleId,s.vehName+' (ลบแล้ว)');
  sel.innerHTML=(withAll?'<option value="all">รถทุกคัน</option>':'')+[...ids].map(([id,n])=>`<option value="${esc(id)}">${esc(n)}</option>`).join('');
  if([...sel.options].some(o=>o.value===val))sel.value=val;
}
function avPick(el,cur,act){el.innerHTML=Object.keys(AV).map(k=>`<button type="button" data-act="${act}" data-av="${k}" aria-pressed="${k===cur}" aria-label="${AV[k][0]}">${avatar(k,44)}</button>`).join('')}
function renderSummary(){
  $('gran').innerHTML=GR.map(([k,n])=>`<button type="button" data-act="gran" data-g="${k}" aria-pressed="${ui.gran===k}">${n}</button>`).join('');
  $('chartMode').innerHTML=[['cost','ค่าใช้จ่าย'],['goal','เทียบเป้า']].map(([k,n])=>`<button type="button" data-act="mode" data-m="${k}" aria-pressed="${ui.mode===k}">${n}</button>`).join('');
  vehOptions($('vehFilter'),ui.veh,true);ui.veh=$('vehFilter').value;
  const list=filtered(),g=ui.gran,nowKey=keyOf(iso(new Date()),g);
  const curList=g==='all'?list:list.filter(s=>keyOf(s.date,g)===nowKey),cur=agg(curList);
  const goal=goalFor(g,list),p=goal>0?cur.saved/goal*100:0;
  const mood=!cur.n?'sleep':cur.saved<0?'sad':goal>0?(p>=100?'great':p>=50?'good':'meh'):'good';
  $('heroMascot').innerHTML=watt(mood,78);
  $('heroLabel').textContent=(cur.saved>=0?'ประหยัดได้ ':'จ่ายแพงกว่ารถน้ำมัน ')+NOW[g];
  const big=$('heroBig');big.textContent=baht(Math.abs(cur.saved));big.className='big num '+(cur.n?(cur.saved>=0?'pos':'neg'):'');
  $('heroNote').textContent=cur.n?`${cur.saved>=0?'ถูกกว่า':'แพงกว่า'}รถน้ำมัน ${fmt(Math.abs(cur.pct),0)}% จากการชาร์จ ${cur.n} ครั้ง`:'ยังไม่มีการชาร์จในช่วงนี้';
  $('goalBox').innerHTML=goal>0?`<div class="row between" style="font-size:13.5px"><b>เป้า${NOW[g]} ${baht(goal)}</b><span class="chip ${p>=100?'good':'plain'} num">${p>=100?'ถึงเป้าแล้ว':'ทำได้'} ${fmt(Math.max(0,p))}%</span></div>
      <div class="goalbar" role="img" aria-label="ความคืบหน้าเทียบเป้า ${fmt(Math.max(0,p))}%"><i class="${p>=100?'over':''}" style="width:${Math.max(0,Math.min(100,p))}%"></i></div>
      <div class="sub num" style="color:var(--ink2)">${p>=100?`เกินเป้า ${baht(cur.saved-goal)} เก่งมาก`:`ขาดอีก ${baht(goal-Math.max(0,cur.saved))} จะถึงเป้า`}</div>`
    :`<div class="sub" style="color:var(--ink2)">ยังไม่ได้ตั้งเป้าหมาย ตั้งได้ที่แท็บ "บ้าน"</div>`;
  const T=(cls,v,lab)=>`<div class="tile ${cls}"><b class="num">${v}</b><span>${lab}</span></div>`;
  $('tiles').innerHTML=T('ev',baht(cur.ev),'ค่าชาร์จที่จ่าย')+T('ice',baht(cur.ice),'ถ้าใช้รถน้ำมัน')+
    T('',fmt(cur.grid,1)+' kWh','ไฟที่ใช้')+T('',fmt(cur.km)+' กม.',cur.n&&cur.realN===cur.n?'ระยะทาง (จากเลขไมล์)':cur.realN?`ระยะทาง (เลขไมล์ ${cur.realN}/${cur.n} ครั้ง)`:'ระยะทาง (ประมาณ)')+
    T('ev','฿'+fmt(cur.km?cur.ev/cur.km:0,2),'ต่อ กม. รถไฟฟ้า')+T('ice','฿'+fmt(cur.km?cur.ice/cur.km:0,2),'ต่อ กม. รถน้ำมัน')+
    T('',fmt(cur.litres,1)+' ลิตร','น้ำมันที่ไม่ต้องเติม')+T('',fmt(cur.co2)+' กก.','CO₂ ที่ลดได้');
  const bs=buckets(g,list),per=g==='all'?0:goal;
  $('barTitle').textContent={day:'รายวัน 14 วันล่าสุด',week:'รายสัปดาห์ 12 สัปดาห์ล่าสุด',month:'รายเดือน 12 เดือนล่าสุด',year:'รายปี',all:'ทั้งหมด แยกตามรถ'}[g]+' (บาท)';
  $('barLegend').innerHTML=ui.mode==='goal'?`<span><i style="background:var(--save)"></i>ยอดที่ประหยัดได้</span>`+(per>0?`<span><i class="dash"></i>เป้าหมายต่อช่วง</span>`:'')
    :`<span><i style="background:var(--ev)"></i>รถไฟฟ้า (จ่ายจริง)</span><span><i style="background:var(--ice)"></i>ถ้าใช้รถน้ำมัน</span>`;
  drawBars($('barChart'),bs,ui.mode,per);
  const rows=bs.filter(b=>b.a.n).reverse();
  $('barTable').innerHTML=rows.length?`<table class="num"><thead><tr><th>ช่วง</th><th>ครั้ง</th><th>kWh</th><th>กม.</th><th>รถไฟฟ้า</th><th>รถน้ำมัน</th><th>ประหยัด</th>${per>0?'<th>% ของเป้า</th>':''}</tr></thead><tbody>`+
    rows.map(b=>`<tr><td>${esc(b.full)}</td><td>${b.a.n}</td><td>${fmt(b.a.grid,1)}</td><td>${fmt(b.a.km)}</td><td>${baht(b.a.ev)}</td><td>${baht(b.a.ice)}</td><td>${baht(b.a.saved)}</td>${per>0?`<td>${fmt(b.a.saved/per*100)}%</td>`:''}</tr>`).join('')+'</tbody></table>':'<div class="empty">ไม่มีข้อมูล</div>';
  drawLine($('lineChart'),list);
  $('whoTitle').textContent='ใครชาร์จบ้าง '+NOW[g];
  const who=new Map();for(const s of curList){const k=s.userId||s.userName;(who.get(k)||who.set(k,[]).get(k)).push(s)}
  $('whoList').innerHTML=who.size?[...who].map(([k,l])=>{const m=memberOf(k),a=agg(l);return{m,a,name:m?m.name:l[0].userName||'ไม่ระบุ'}}).sort((x,y)=>y.a.saved-x.a.saved)
    .map(w=>`<div class="member"><span class="n">${avatar(w.m?w.m.avatar:'bear',32)}<span><b>${esc(w.name)}</b><span class="sub num" style="display:block">${w.a.n} ครั้ง · ${fmt(w.a.grid,1)} kWh</span></span></span><span class="chip ${w.a.saved>=0?'good':'bad'} num">${w.a.saved>=0?'ประหยัด':'แพงกว่า'} ${baht(Math.abs(w.a.saved))}</span></div>`).join('')
    :'<div class="empty">ยังไม่มีการชาร์จในช่วงนี้</div>';
}
function renderHistory(){
  vehOptions($('histVeh'),ui.histVeh,true);ui.histVeh=$('histVeh').value;
  const hw=$('histWho');hw.innerHTML='<option value="all">ทุกคน</option>'+S.members.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
  if([...hw.options].some(o=>o.value===ui.histWho))hw.value=ui.histWho;ui.histWho=hw.value;
  const list=S.sessions.filter(s=>(ui.histVeh==='all'||s.vehicleId===ui.histVeh)&&(ui.histWho==='all'||s.userId===ui.histWho)).sort((a,b)=>stamp(b).localeCompare(stamp(a)));
  if(!list.length){$('histList').innerHTML=`<div class="card" style="align-items:center">${watt('sleep',70)}<div class="empty" style="padding:0">ยังไม่มีประวัติ กดปุ่มสายฟ้าด้านล่างเพื่อบันทึกครั้งแรก</div></div>`;return}
  let h='',cm='';
  for(const s of list){
    const m=s.date.slice(0,7);
    if(m!==cm){cm=m;const a=agg(list.filter(x=>x.date.slice(0,7)===m));const d=parseD(s.date);
      h+=`<div class="monthhead"><b>${MON[d.getMonth()]} ${d.getFullYear()+543}</b><span class="num">${a.n} ครั้ง · จ่าย ${baht(a.ev)} · ประหยัด ${baht(a.saved)}</span></div>`}
    const c=calc(s),name=(S.vehicles.find(v=>v.id===s.vehicleId)||{}).name||s.vehName,mem=memberOf(s.userId);
    h+=`<details class="item"><summary><span class="l">${avatar(mem?mem.avatar:'bear',34)}<span><b>${esc(dFull(s.date))}${s.time?' · '+esc(s.time):''}</b>
      <span class="sub">${esc(name)} · ${esc(s.typeName)}</span><span class="sub num">${s.from}% → ${s.to}% · ${fmt(c.gridKwh,1)} kWh${s.odo>0?' · '+fmt(s.odo)+' กม.':''}</span></span></span>
      <span class="r"><b class="num">${baht(c.evCost)}</b><span class="chip ${c.saved>=0?'good':'bad'} num">${c.saved>=0?'ประหยัด':'แพงกว่า'} ${baht(Math.abs(c.saved))}</span></span></summary>
      <div class="body"><div class="sub">บันทึกโดย ${esc(mem?mem.name:s.userName||'ไม่ระบุ')}${s.note?' · '+esc(s.note):''}</div>${stepsHTML(s)}
      <div class="row"><button class="btn small" data-act="editS" data-id="${esc(s.id)}">แก้ไข</button>
      <button class="btn small danger" data-act="delS" data-id="${esc(s.id)}" data-confirm="ยืนยันลบ">ลบ</button></div></div></details>`;
  }
  $('histList').innerHTML=h;
}
function renderCars(){
  $('carList').innerHTML=S.vehicles.length?S.vehicles.map(v=>{const l=S.sessions.filter(s=>s.vehicleId===v.id),a=agg(l);
    let used=0,dist=0;const seen=new Set();for(const s of l){const r=ODO.get(s.id);if(r&&!seen.has(r.since+r.dist)){seen.add(r.since+r.dist);used+=r.used;dist+=r.dist}}
    return `<div class="card"><div class="row between"><div style="min-width:0"><b style="font-size:16px">${esc(v.name)}</b>
      <div class="sub num">แบต ${fmt(v.cap,1)} kWh${v.soh<100?` · SOH ${v.soh}% (ใช้ได้ ${fmt(v.cap*v.soh/100,1)} kWh)`:''} · ตั้งไว้ ${fmt(v.eff,1)} kWh/100 กม. · เทียบรถ ${fmt(v.kml,1)} กม./ลิตร</div>
      <div class="sub num">${dist>0?`วิ่งจริงจากเลขไมล์ ${fmt(dist)} กม. · สิ้นเปลืองจริงเฉลี่ย ${fmt(used/dist*100,1)} kWh/100 กม.`:'ยังไม่มีเลขไมล์ ใช้ค่าประมาณ'}</div>
      <div class="sub num">ชาร์จ ${a.n} ครั้ง · ประหยัดรวม ${baht(a.saved)}</div></div>
      <div class="row"><button class="btn small" data-act="editV" data-id="${esc(v.id)}">แก้ไข</button>
      <button class="btn small danger" data-act="delV" data-id="${esc(v.id)}" data-confirm="ยืนยันลบรถ">ลบ</button></div></div></div>`}).join('')
    :`<div class="card" style="align-items:center">${watt('meh',70)}<div class="empty" style="padding:0">ยังไม่มีรถ เพิ่มคันแรกด้านล่าง</div></div>`;
}
function renderHome(){
  const st=S.settings,own=isOwner();
  $('roleChip').textContent=own?'เจ้าของบ้าน':'สมาชิก';
  $('c-house').value=S.group.name;$('c-house').disabled=!own;
  $('codeBox').innerHTML=`<div class="sub" style="color:var(--ink2)">รหัสชวนคนในบ้าน</div><div class="row between"><span class="code">${esc(S.group.code)}</span><button class="btn small" data-act="copyCode">คัดลอกรหัส</button></div>
    <div class="sub">${CLOUD?'ให้คนในบ้านสมัครบัญชี แล้วใส่รหัสนี้ตอนตั้งโปรไฟล์':'ในโหมดทดลองรหัสนี้เป็นตัวอย่าง ใช้ได้จริงเมื่อขึ้นเว็บจริง'}</div>`;
  $('memberList').innerHTML=S.members.map(m=>`<div class="member"><span class="n">${avatar(m.avatar,34)}<b>${esc(m.name)}</b>${m.id===S.group.owner?'<span class="chip plain">เจ้าของ</span>':''}${m.id===S.me.id?'<span class="sub">(ฉัน)</span>':''}</span>
    ${own&&m.id!==S.me.id?`<button class="btn small danger" data-act="kick" data-id="${esc(m.id)}" data-confirm="ยืนยันนำออก">นำออก</button>`:''}</div>`).join('');
  $('c-myname').value=S.me.name;avPick($('c-av'),S.me.avatar,'myAv');
  $('c-goal').value=st.goalMonth;const gm=+st.goalMonth||0;
  $('goalPreview').textContent=gm?`เท่ากับวันละ ${baht(gm*12/365)} · สัปดาห์ละ ${baht(gm*12/52)} · ปีละ ${baht(gm*12)}`:'ยังไม่ได้ตั้งเป้า';
  $('c-fuelName').value=st.fuelName;$('c-fuelPrice').value=st.fuelPrice;$('c-co2Grid').value=st.co2Grid;$('c-co2Fuel').value=st.co2Fuel;$('c-weekStart').value=st.weekStart;
  $('typeList').innerHTML=st.types.map((t,i)=>`<div class="typerow">
    <label class="f" style="flex:2 1 150px">ชื่อ<input type="text" id="t-name-${i}" data-t="${i}" data-k="name" value="${esc(t.name)}" maxlength="40"></label>
    <label class="f" style="flex:1 1 80px">บาท/kWh<input type="number" id="t-price-${i}" data-t="${i}" data-k="price" value="${t.price}" min="0" step="0.01" inputmode="decimal"></label>
    <label class="f" style="flex:1 1 80px">สูญเสีย %<input type="number" id="t-loss-${i}" data-t="${i}" data-k="loss" value="${t.loss}" min="0" max="50" step="0.5" inputmode="decimal"></label>
    <button class="btn small danger" type="button" data-act="delType" data-i="${i}" data-confirm="ยืนยัน">ลบ</button></div>`).join('');
  $('importLbl').hidden=CLOUD;$('acctRow').hidden=!CLOUD;
}
function fillTypeSel(){$('f-type').innerHTML=S.settings.types.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}
function applyVeh(){const v=S.vehicles.find(x=>x.id===$('f-veh').value);if(!v)return;$('f-kml').value=v.kml;$('f-eff').value=v.eff;$('f-fuel').value=v.fuel>0?v.fuel:S.settings.fuelPrice;odoHint()}
function applyType(){const t=S.settings.types.find(x=>x.id===$('f-type').value);if(!t)return;$('f-price').value=t.price;$('f-loss').value=t.loss}
function odoHint(){
  const vid=$('f-veh').value,prev=S.sessions.filter(s=>s.vehicleId===vid&&s.odo>0&&s.id!==ui.editId).sort((a,b)=>stamp(b).localeCompare(stamp(a)))[0];
  $('odoHint').textContent=(prev?`ครั้งก่อนกรอกไว้ ${fmt(prev.odo)} กม. (${dFull(prev.date)}) · `:'')+'กรอก = คิดจากระยะที่วิ่งจริง · ไม่กรอก = ประมาณจากอัตราสิ้นเปลืองของรถ';
}
function resetForm(){
  ui.editId=null;$('sForm').reset();vehOptions($('f-veh'),'',false);fillTypeSel();
  const n=new Date();$('f-date').value=iso(n);$('f-time').value=pad(n.getHours())+':'+pad(n.getMinutes());$('f-from').value=20;$('f-to').value=80;
  applyVeh();applyType();$('sFormTitle').textContent='บันทึกการชาร์จ';$('sSubmit').textContent='บันทึกการชาร์จ';$('sCancel').hidden=true;liveCalc();
}
function readForm(){
  const v=S.vehicles.find(x=>x.id===$('f-veh').value),t=S.settings.types.find(x=>x.id===$('f-type').value)||{id:'',name:''};
  const old=ui.editId&&S.sessions.find(s=>s.id===ui.editId);
  if(!v&&!old)return null;
  const kwh=numOr($('f-kwh').value,null),paid=numOr($('f-paid').value,null),odo=numOr($('f-odo').value,null);
  return {id:ui.editId||uuid(),vehicleId:v?v.id:old.vehicleId,vehName:v?v.name:old.vehName,userId:old?old.userId:S.me.id,userName:old?old.userName:S.me.name,
    date:$('f-date').value,time:$('f-time').value,from:numOr($('f-from').value,0),to:numOr($('f-to').value,0),typeId:t.id,typeName:t.name,
    cap:old&&(!v||old.vehicleId===v.id)?old.cap:v.cap*v.soh/100,
    loss:Math.min(50,Math.max(0,numOr($('f-loss').value,0))),price:numOr($('f-price').value,0),fee:numOr($('f-fee').value,0),
    kwh:kwh>0?kwh:null,paid:paid!=null&&paid>=0?paid:null,eff:numOr($('f-eff').value,15),kml:numOr($('f-kml').value,14),
    fuelPrice:numOr($('f-fuel').value,S.settings.fuelPrice),odo:odo>0?odo:null,note:$('f-note').value.trim()};
}
function liveCalc(){
  const box=$('livecalc');
  if(!S.vehicles.length&&!ui.editId){box.innerHTML='<div class="empty">เพิ่มรถก่อนที่แท็บ "รถ" แล้วกลับมาบันทึก</div>';return}
  const s=readForm();const f=Math.max(0,Math.min(100,s?s.from:0)),t=Math.max(0,Math.min(100,s?s.to:0));
  $('battBase').style.width=f+'%';$('battFill').style.left=f+'%';$('battFill').style.width=Math.max(0,t-f)+'%';
  if(!s||!(s.to>s.from)){box.innerHTML='<div class="empty">ใส่ % หลังชาร์จให้มากกว่า % ก่อนชาร์จ</div>';return}
  if(!(s.eff>0&&s.kml>0)){box.innerHTML='<div class="empty">กรอกอัตราสิ้นเปลืองให้ครบ</div>';return}
  box.innerHTML=stepsHTML(s,linkOdo([...S.sessions.filter(x=>x.id!==s.id),s]));
}
function renderAll(){
  if(!S.group)return;
  ODO=linkOdo(S.sessions);
  $('demoBanner').hidden=CLOUD;$('houseName').textContent=S.group.name;
  $('whoami').innerHTML=`<span class="chip plain">${esc(S.me.name)}</span>${avatar(S.me.avatar,38)}`;
  renderSummary();renderHistory();renderCars();renderHome();
  if(!ui.editId)resetForm();
}

/* ---------- routing ---------- */
const VIEWS=['summary','add','history','cars','home'];
function route(){
  const h=(location.hash||'').slice(1),v=VIEWS.includes(h)?h:'summary';
  for(const n of VIEWS)$('v-'+n).classList.toggle('on',n===v);
  document.querySelectorAll('nav.tabs a').forEach(a=>a.getAttribute('href')==='#'+v?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));
  if(v==='summary'&&S.group)renderSummary();
  window.scrollTo(0,0);
}
function go(v){if(location.hash==='#'+v)route();else location.hash=v}

/* ---------- export ---------- */
async function saveFile(name,text,mime){
  if(window.claude&&window.claude.use){ // only when shown as a preview inside Claude
    try{const d=await window.claude.use('downloads');if(d){await d.save({filename:name,data:text});return}}catch(e){if(e&&/declin|cancel/i.test(e.message||''))return}
    $('exportText').value=text;$('exportBox').hidden=false;go('home');toast('คัดลอกข้อความจากกล่องด้านล่างได้เลย');return;
  }
  try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+text],{type:mime}));a.download=name;document.body.appendChild(a);a.click();a.remove()}
  catch(e){$('exportText').value=text;$('exportBox').hidden=false}
}
function csvText(){
  const qq=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const head=['วันที่','เวลา','รถ','คนชาร์จ','ประเภทที่ชาร์จ','จาก%','ถึง%','เลขไมล์','แบตใช้ได้ kWh','เข้าแบต kWh','ไฟที่จ่าย kWh','สูญเสีย %','บาท/kWh','ค่าบริการ','ค่าชาร์จรวม','kWh/100กม. ที่ใช้คิด','ที่มาของระยะทาง','ระยะทาง กม.','กม./ลิตร','ราคาน้ำมัน','ลิตร','ค่าน้ำมันเทียบ','ประหยัด','CO2 ลด กก.','หมายเหตุ'];
  const rows=[...S.sessions].sort((a,b)=>stamp(a).localeCompare(stamp(b))).map(s=>{const c=calc(s);
    return [s.date,s.time,s.vehName,s.userName,s.typeName,s.from,s.to,s.odo??'',s.cap.toFixed(2),c.battKwh.toFixed(2),c.gridKwh.toFixed(2),s.loss,s.price,s.fee||0,c.evCost.toFixed(2),c.eff.toFixed(2),c.real?'เลขไมล์':'ประมาณ',c.km.toFixed(1),s.kml,s.fuelPrice,c.litres.toFixed(2),c.iceCost.toFixed(2),c.saved.toFixed(2),c.co2Saved.toFixed(2),s.note].map(qq).join(',')});
  return head.map(qq).join(',')+'\n'+rows.join('\n');
}

/* ---------- actions ---------- */
let armed=null,busy=false;
async function enter(){
  const{data}=await sb.auth.getSession();
  if(!data.session){$('authMascot').innerHTML=watt('good',96);show('auth');return}
  uid=data.session.user.id;
  try{
    if(await loadCloud()){show('app');renderAll();route()}
    else{avPick($('o-av'),ui.obAv,'obAv');show('onboard')}
  }catch(e){toast(errText(e));$('authMascot').innerHTML=watt('sad',96);show('auth')}
}
async function authDo(kind){
  if(busy)return;const email=$('a-email').value.trim(),password=$('a-pass').value;
  if(!email||password.length<6){toast('กรอกอีเมล และรหัสผ่านอย่างน้อย 6 ตัว');return}
  busy=true;
  try{
    if(kind==='signup'){const{data,error}=await sb.auth.signUp({email,password});if(error)throw error;
      if(!data.session){toast('สมัครแล้ว แต่ระบบยังเปิดยืนยันอีเมลอยู่ แจ้งผู้ดูแลให้ปิด Confirm email');busy=false;return}}
    else{const{error}=await sb.auth.signInWithPassword({email,password});if(error)throw error}
    await enter();
  }catch(e){toast(errText(e))}
  busy=false;
}
async function houseDo(kind){
  if(busy)return;const name=$('o-name').value.trim();
  if(!name){toast('ใส่ชื่อเล่นก่อน');return}
  busy=true;
  try{
    if(kind==='create'){const h=$('o-house').value.trim();if(!h){toast('ตั้งชื่อบ้านก่อน');busy=false;return}
      await q(sb.rpc('ev_create_group',{p_name:h,p_member:name,p_avatar:ui.obAv,p_settings:defaults()}))}
    else{const code=$('o-code').value.trim().toUpperCase();if(code.length!==6){toast('รหัสบ้านมี 6 ตัว');busy=false;return}
      await q(sb.rpc('ev_join_group',{p_code:code,p_member:name,p_avatar:ui.obAv}))}
    await enter();
  }catch(e){toast(errText(e))}
  busy=false;
}
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-act]');if(!b)return;const act=b.dataset.act;
  if(b.dataset.confirm&&armed!==b){ // two-step confirm instead of a browser dialog
    if(armed){armed.textContent=armed.dataset.label}armed=b;b.dataset.label=b.textContent;b.textContent=b.dataset.confirm;
    setTimeout(()=>{if(armed===b){b.textContent=b.dataset.label;armed=null}},3500);return}
  armed=null;
  if(act==='gran'){ui.gran=b.dataset.g;renderSummary()}
  else if(act==='mode'){ui.mode=b.dataset.m;renderSummary()}
  else if(act==='signup')authDo('signup');
  else if(act==='createHouse')houseDo('create');
  else if(act==='joinHouse')houseDo('join');
  else if(act==='obAv'){ui.obAv=b.dataset.av;avPick($('o-av'),ui.obAv,'obAv')}
  else if(act==='logout'){try{await sb.auth.signOut()}catch(_){}S.group=null;$('authMascot').innerHTML=watt('good',96);show('auth')}
  else if(act==='leave'){try{await q(sb.rpc('ev_leave_group'));S.group=null;await enter()}catch(err){toast(errText(err))}}
  else if(act==='kick'){const id=b.dataset.id;op(()=>{S.members=S.members.filter(m=>m.id!==id)},()=>q(sb.rpc('ev_remove_member',{p_user:id})))}
  else if(act==='myAv'){const av=b.dataset.av;op(()=>{S.me.avatar=av;const m=memberOf(S.me.id);if(m)m.avatar=av},()=>q(sb.from('ev_members').update({avatar:av}).eq('user_id',uid)))}
  else if(act==='copyCode'){navigator.clipboard.writeText(S.group.code).then(()=>toast('คัดลอกรหัสแล้ว'),()=>toast('รหัสบ้านคือ '+S.group.code))}
  else if(act==='demoReset'){S=demoState();saveLocal();ui.editId=null;renderAll();go('summary');toast('เริ่มข้อมูลตัวอย่างใหม่แล้ว')}
  else if(act==='demoClear'){S=demoState(true);saveLocal();ui.editId=null;renderAll();go('cars');toast('ล้างแล้ว เริ่มจากเพิ่มรถคันแรก')}
  else if(act==='editS'){const s=S.sessions.find(x=>x.id===b.dataset.id);if(!s)return;ui.editId=s.id;
    vehOptions($('f-veh'),s.vehicleId,false);fillTypeSel();$('f-type').value=s.typeId;
    $('f-date').value=s.date;$('f-time').value=s.time||'';$('f-from').value=s.from;$('f-to').value=s.to;$('f-price').value=s.price;$('f-loss').value=s.loss;
    $('f-fee').value=s.fee||'';$('f-kwh').value=s.kwh??'';$('f-paid').value=s.paid??'';$('f-fuel').value=s.fuelPrice;$('f-kml').value=s.kml;$('f-eff').value=s.eff;$('f-odo').value=s.odo??'';$('f-note').value=s.note||'';
    $('sFormTitle').textContent='แก้ไขการชาร์จ';$('sSubmit').textContent='บันทึกการแก้ไข';$('sCancel').hidden=false;odoHint();liveCalc();go('add')}
  else if(act==='cancelEdit'){resetForm();go('history')}
  else if(act==='delS'){const id=b.dataset.id;if(await op(()=>{S.sessions=S.sessions.filter(x=>x.id!==id)},()=>q(sb.from('ev_sessions').delete().eq('id',id))))toast('ลบแล้ว')}
  else if(act==='editV'){const v=S.vehicles.find(x=>x.id===b.dataset.id);if(!v)return;ui.editVeh=v.id;
    $('v-name').value=v.name;$('v-cap').value=v.cap;$('v-soh').value=v.soh;$('v-eff').value=v.eff;$('v-kml').value=v.kml;$('v-fuel').value=v.fuel||'';
    $('vFormTitle').textContent='แก้ไขรถ';$('vSubmit').textContent='บันทึกการแก้ไข';$('vCancel').hidden=false;$('vForm').scrollIntoView({block:'start'})}
  else if(act==='cancelVeh')resetVeh();
  else if(act==='delV'){const id=b.dataset.id;if(await op(()=>{S.vehicles=S.vehicles.filter(x=>x.id!==id)},()=>q(sb.from('ev_vehicles').delete().eq('id',id))))toast('ลบรถแล้ว ประวัติการชาร์จยังอยู่')}
  else if(act==='addType'){op(()=>{S.settings.types.push({id:uuid().slice(0,8),name:'ประเภทใหม่',price:5,loss:10})},saveSettingsCloud)}
  else if(act==='delType'){if(S.settings.types.length<2){toast('ต้องมีอย่างน้อย 1 ประเภท');return}const i=+b.dataset.i;op(()=>{S.settings.types.splice(i,1)},saveSettingsCloud)}
  else if(act==='csv'){if(!S.sessions.length){toast('ยังไม่มีประวัติให้ส่งออก');return}saveFile('ev-charging-'+iso(new Date())+'.csv',csvText(),'text/csv;charset=utf-8')}
  else if(act==='backup'){saveFile('ev-family-backup-'+iso(new Date())+'.json',JSON.stringify({group:S.group,members:S.members,vehicles:S.vehicles,sessions:S.sessions,settings:S.settings}),'application/json')}
  else if(act==='copyExport'){navigator.clipboard.writeText($('exportText').value).then(()=>toast('คัดลอกแล้ว'),()=>{$('exportText').select();toast('กดค้างที่ข้อความเพื่อคัดลอก')})}
});
$('authForm').addEventListener('submit',e=>{e.preventDefault();authDo('login')});
function resetVeh(){ui.editVeh=null;$('vForm').reset();$('vFormTitle').textContent='เพิ่มรถไฟฟ้า';$('vSubmit').textContent='เพิ่มรถ';$('vCancel').hidden=true}
$('vForm').addEventListener('submit',async e=>{e.preventDefault();
  const v={id:ui.editVeh||uuid(),name:$('v-name').value.trim(),cap:numOr($('v-cap').value,0),soh:Math.min(100,Math.max(50,numOr($('v-soh').value,100))),
    eff:numOr($('v-eff').value,0),kml:numOr($('v-kml').value,0),fuel:numOr($('v-fuel').value,null)};
  if(!v.name||!(v.cap>0&&v.eff>0&&v.kml>0)){toast('กรอกชื่อ ขนาดแบต และอัตราสิ้นเปลืองให้ครบ');return}
  const i=S.vehicles.findIndex(x=>x.id===v.id);resetVeh();
  if(await op(()=>{if(i>=0)S.vehicles[i]=v;else S.vehicles.push(v)},()=>q(sb.from('ev_vehicles').upsert(vRow(v)))))toast(i>=0?'แก้ไขรถแล้ว':'เพิ่มรถแล้ว');
});
$('sForm').addEventListener('submit',async e=>{e.preventDefault();
  if(!S.vehicles.length&&!ui.editId){toast('เพิ่มรถก่อนที่แท็บ "รถ"');go('cars');return}
  const s=readForm();
  if(!s||!s.date){toast('เลือกวันที่');return}
  if(s.from<0||s.to>100||!(s.to>s.from)){toast('% หลังชาร์จต้องมากกว่า % ก่อนชาร์จ และอยู่ระหว่าง 0–100');return}
  if(!(s.eff>0&&s.kml>0&&s.fuelPrice>0)){toast('เปิด "รายละเอียดเพิ่มเติม" แล้วกรอกค่าเทียบรถน้ำมันให้ครบ');return}
  const i=S.sessions.findIndex(x=>x.id===s.id);ui.editId=null;
  const ok=await op(()=>{if(i>=0)S.sessions[i]=s;else S.sessions.push(s)},()=>q(sb.from('ev_sessions').upsert(sRow(s))));
  if(ok){const c=calc(s);toast(`บันทึกแล้ว ${c.saved>=0?'ประหยัด':'แพงกว่า'} ${baht(Math.abs(c.saved))}`);go('history')}
});
$('sForm').addEventListener('input',e=>{if(e.target.id==='f-veh')applyVeh();if(e.target.id==='f-type')applyType();liveCalc()});
$('vehFilter').addEventListener('change',e=>{ui.veh=e.target.value;renderSummary()});
$('histVeh').addEventListener('change',e=>{ui.histVeh=e.target.value;renderHistory()});
$('histWho').addEventListener('change',e=>{ui.histWho=e.target.value;renderHistory()});
$('v-home').addEventListener('change',async e=>{
  const el=e.target,st=S.settings;let fn=null,cloud=saveSettingsCloud;
  if(el.dataset.t!=null){const t=st.types[+el.dataset.t];if(!t)return;const k=el.dataset.k,val=k==='name'?(el.value.trim()||t.name):Math.max(0,numOr(el.value,t[k]));fn=()=>{t[k]=val}}
  else if(el.id==='c-house'){const v=el.value.trim();if(!v)return;fn=()=>{S.group.name=v}}
  else if(el.id==='c-myname'){const v=el.value.trim();if(!v)return;fn=()=>{S.me.name=v;const m=memberOf(S.me.id);if(m)m.name=v};cloud=()=>q(sb.from('ev_members').update({name:v}).eq('user_id',uid))}
  else if(el.id==='c-goal'){const v=Math.max(0,numOr(el.value,0));fn=()=>{st.goalMonth=v}}
  else if(el.id==='c-fuelName'){const v=el.value.trim()||st.fuelName;fn=()=>{st.fuelName=v}}
  else if(el.id==='c-fuelPrice'){const v=Math.max(0,numOr(el.value,st.fuelPrice));fn=()=>{st.fuelPrice=v}}
  else if(el.id==='c-co2Grid'){const v=Math.max(0,numOr(el.value,st.co2Grid));fn=()=>{st.co2Grid=v}}
  else if(el.id==='c-co2Fuel'){const v=Math.max(0,numOr(el.value,st.co2Fuel));fn=()=>{st.co2Fuel=v}}
  else if(el.id==='c-weekStart'){const v=+el.value;fn=()=>{st.weekStart=v}}
  else return;
  if(await op(fn,cloud))toast('บันทึกการตั้งค่าแล้ว');
});
$('importFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f||CLOUD)return;
  try{const j=JSON.parse((await f.text()).replace(/^﻿/,''));
    if(!Array.isArray(j.vehicles)||!Array.isArray(j.sessions))throw 0;
    const base=demoState(true);
    S={...base,group:j.group||base.group,members:Array.isArray(j.members)&&j.members.length?j.members:base.members,vehicles:j.vehicles,sessions:j.sessions,settings:{...defaults(),...j.settings},demo:false};
    S.me=S.members[0];saveLocal();renderAll();toast(`นำเข้าแล้ว ${S.sessions.length} รายการ`)}
  catch(err){toast('ไฟล์นี้ไม่ใช่ไฟล์สำรองของน้องวัตต์')}
  e.target.value='';
});
window.addEventListener('hashchange',route);
let rz=0;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(S.group&&$('v-summary').classList.contains('on'))renderSummary()},150)});
document.addEventListener('visibilitychange',async()=>{ // pick up what the rest of the house logged
  if(!CLOUD||document.hidden||!S.group||ui.editId||ui.editVeh||$('v-add').classList.contains('on')||Date.now()-loadedAt<60000)return;
  try{if(await loadCloud())renderAll()}catch(_){}
});

/* ---------- start ---------- */
(async function boot(){
  if(!CLOUD){S=loadLocal()||demoState();show('app');renderAll();route();return}
  try{
    if(!window.supabase)await new Promise((res,rej)=>{const s=document.createElement('script');s.src=LIB;s.onload=res;s.onerror=()=>rej(new Error('Failed to fetch'));document.head.appendChild(s)});
    sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
    await enter();
  }catch(e){$('authMascot').innerHTML=watt('sad',96);show('auth');toast(errText(e))}
})();

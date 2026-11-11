-- =====================================================================
-- ป่าอุ่นใจ · แอปบันทึกรายรับรายจ่ายครอบครัว
-- วางทั้งไฟล์นี้ใน Supabase → SQL Editor → Run (รันซ้ำได้)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null default '',
  avatar text not null default 'dad' check (avatar in ('dad','mom','kid')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.houses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  style text not null default 'cottage' check (style in ('cottage','thai','log','leaf','mill')),
  invite_code text not null unique default upper(substr(md5(random()::text),1,4)||'-'||substr(md5(random()::text),1,4)),
  monthly_budget numeric(14,2) not null default 0 check (monthly_budget >= 0),
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.house_members (
  house_id uuid not null references public.houses on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  plot smallint not null check (plot between 0 and 4),
  joined_at timestamptz not null default now(),
  primary key (house_id, user_id),
  unique (user_id, plot)
);

create table if not exists public.opening_balances (
  house_id uuid not null references public.houses on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  as_of date not null default current_date,
  cash numeric(14,2) not null default 0,
  savings numeric(14,2) not null default 0 check (savings >= 0),
  inv_principal numeric(14,2) not null default 0 check (inv_principal >= 0),
  inv_value numeric(14,2) not null default 0 check (inv_value >= 0),
  updated_at timestamptz not null default now(),
  primary key (house_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  icon text not null default 'travel',
  target numeric(14,2) not null check (target > 0),
  start_month date not null,
  end_month date not null,            -- เดือนสุดท้ายที่เก็บเงิน (วันที่ 1)
  use_label text,                     -- เช่น "เม.ย. 70"
  opening_amount numeric(14,2) not null default 0 check (opening_amount >= 0),
  opening_owner uuid references auth.users on delete set null,
  done boolean not null default false,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (end_month >= start_month)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses on delete cascade,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  type text not null check (type in ('out','in','save')),
  category text,
  amount numeric(14,2) not null check (amount >= 0 and amount < 1000000000),
  note text check (char_length(note) <= 200),
  occurred_on date not null default current_date,
  is_private boolean not null default false,
  save_kind text check (save_kind in ('save','inv')),
  save_action text check (save_action in ('dep','wd','val')),
  to_user uuid references auth.users on delete set null,
  to_project uuid references public.projects on delete set null,
  paid_from_project uuid references public.projects on delete set null,  -- เงินมาจากโปรเจค
  receipt_path text,
  created_at timestamptz not null default now(),
  check (type <> 'save' or (save_kind is not null and save_action is not null and (to_user is not null or to_project is not null))),
  check (type = 'save' or category is not null)
);
create index if not exists transactions_house_date on public.transactions (house_id, occurred_on desc);

create table if not exists public.annual_items (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  icon text not null default 'other',
  amount numeric(14,2) not null default 0 check (amount >= 0),
  every int not null default 1 check (every between 1 and 120),
  unit text not null default 'y' check (unit in ('m','y')),
  due date not null,
  owner uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- helper functions (security definer = ไม่วนซ้ำกับ RLS) ----------
create or replace function public.is_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from house_members where house_id = h and user_id = auth.uid());
$$;

create or replace function public.is_owner(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from house_members where house_id = h and user_id = auth.uid() and role = 'owner');
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

create or replace function public.member_of(h uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from house_members where house_id = h and user_id = u);
$$;

create or replace function public.bkk_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Bangkok')::date; $$;

-- ---------- auto profile ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.houses enable row level security;
alter table public.house_members enable row level security;
alter table public.opening_balances enable row level security;
alter table public.projects enable row level security;
alter table public.transactions enable row level security;
alter table public.annual_items enable row level security;

-- profiles
drop policy if exists p_profiles_sel on public.profiles;
create policy p_profiles_sel on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_admin() or exists (
    select 1 from house_members a join house_members b on a.house_id = b.house_id
    where a.user_id = auth.uid() and b.user_id = profiles.id));
drop policy if exists p_profiles_ins on public.profiles;
create policy p_profiles_ins on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists p_profiles_upd on public.profiles;
create policy p_profiles_upd on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update on public.profiles from authenticated, anon;
grant insert (id, nickname, avatar) on public.profiles to authenticated;
grant update (nickname, avatar) on public.profiles to authenticated;

-- houses (สร้างผ่าน create_house เท่านั้น)
drop policy if exists p_houses_sel on public.houses;
create policy p_houses_sel on public.houses for select to authenticated using (public.is_member(id));
drop policy if exists p_houses_upd on public.houses;
create policy p_houses_upd on public.houses for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));
drop policy if exists p_houses_del on public.houses;
create policy p_houses_del on public.houses for delete to authenticated using (public.is_owner(id));
revoke insert, update on public.houses from authenticated, anon;
grant update (name, style, monthly_budget, invite_code) on public.houses to authenticated;

-- house_members (เข้าร่วมผ่าน join_house เท่านั้น)
drop policy if exists p_hm_sel on public.house_members;
create policy p_hm_sel on public.house_members for select to authenticated using (public.is_member(house_id));
drop policy if exists p_hm_upd on public.house_members;
create policy p_hm_upd on public.house_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists p_hm_del on public.house_members;
create policy p_hm_del on public.house_members for delete to authenticated using (user_id = auth.uid() or public.is_owner(house_id));
revoke insert, update on public.house_members from authenticated, anon;
grant update (plot) on public.house_members to authenticated;

-- opening balances: แก้ของตัวเอง หรือเจ้าของบ้านแก้แทน
drop policy if exists p_ob_sel on public.opening_balances;
create policy p_ob_sel on public.opening_balances for select to authenticated using (public.is_member(house_id));
drop policy if exists p_ob_ins on public.opening_balances;
create policy p_ob_ins on public.opening_balances for insert to authenticated with check (
  public.member_of(house_id, user_id) and (user_id = auth.uid() or public.is_owner(house_id)));
drop policy if exists p_ob_upd on public.opening_balances;
create policy p_ob_upd on public.opening_balances for update to authenticated
  using (user_id = auth.uid() or public.is_owner(house_id))
  with check (public.member_of(house_id, user_id) and (user_id = auth.uid() or public.is_owner(house_id)));

-- projects: ทุกคนในบ้านสร้าง/แก้ได้
drop policy if exists p_pj_sel on public.projects;
create policy p_pj_sel on public.projects for select to authenticated using (public.is_member(house_id));
drop policy if exists p_pj_ins on public.projects;
create policy p_pj_ins on public.projects for insert to authenticated with check (
  public.is_member(house_id) and (opening_owner is null or public.member_of(house_id, opening_owner)));
drop policy if exists p_pj_upd on public.projects;
create policy p_pj_upd on public.projects for update to authenticated using (public.is_member(house_id))
  with check (public.is_member(house_id) and (opening_owner is null or public.member_of(house_id, opening_owner)));
drop policy if exists p_pj_del on public.projects;
create policy p_pj_del on public.projects for delete to authenticated using (created_by = auth.uid() or public.is_owner(house_id));

-- transactions: อ่านผ่าน get_house_bundle (ซ่อนรายละเอียดรายการส่วนตัวของคนอื่น)
drop policy if exists p_tx_sel on public.transactions;
create policy p_tx_sel on public.transactions for select to authenticated using (
  public.is_member(house_id) and (not is_private or user_id = auth.uid()));
drop policy if exists p_tx_ins on public.transactions;
create policy p_tx_ins on public.transactions for insert to authenticated with check (
  user_id = auth.uid() and public.is_member(house_id)
  and (to_user is null or public.member_of(house_id, to_user))
  and (to_project is null or exists (select 1 from projects p where p.id = to_project and p.house_id = transactions.house_id))
  and (paid_from_project is null or exists (select 1 from projects p where p.id = paid_from_project and p.house_id = transactions.house_id)));
drop policy if exists p_tx_del on public.transactions;
create policy p_tx_del on public.transactions for delete to authenticated using (user_id = auth.uid() or public.is_owner(house_id));

-- annual items
drop policy if exists p_an_all on public.annual_items;
create policy p_an_all on public.annual_items for all to authenticated using (public.is_member(house_id))
  with check (public.is_member(house_id) and (owner is null or public.member_of(house_id, owner)));

-- ---------- RPC ----------
create or replace function public.my_houses() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', h.id, 'name', h.name, 'style', h.style, 'plot', m.plot, 'role', m.role,
    'members', (select jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'avatar', p.avatar) order by mm.joined_at)
                from house_members mm join profiles p on p.id = mm.user_id where mm.house_id = h.id),
    'month_out', (select coalesce(sum(amount), 0) from transactions t where t.house_id = h.id and t.type = 'out'
                  and t.paid_from_project is null and t.occurred_on >= date_trunc('month', bkk_today())),
    'today_count', (select count(*) from transactions t where t.house_id = h.id
                    and (t.created_at at time zone 'Asia/Bangkok')::date = bkk_today())
  ) order by m.plot), '[]'::jsonb)
  from house_members m join houses h on h.id = m.house_id
  where m.user_id = auth.uid();
$$;

create or replace function public.create_house(p_name text, p_style text, p_plot int) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid; d date := (date_trunc('month', bkk_today()) + interval '1 month')::date;
begin
  if auth.uid() is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  if (select count(*) from house_members where user_id = auth.uid()) >= 5 then raise exception 'มีบ้านครบ 5 หลังแล้ว'; end if;
  if exists (select 1 from house_members where user_id = auth.uid() and plot = p_plot) then raise exception 'แปลงนี้มีบ้านแล้ว'; end if;
  insert into houses (name, style, created_by) values (trim(p_name), p_style, auth.uid()) returning id into hid;
  insert into house_members (house_id, user_id, role, plot) values (hid, auth.uid(), 'owner', p_plot);
  insert into annual_items (house_id, name, icon, amount, every, unit, due, owner)
  select hid, n, ic, 0, ev, u, d, auth.uid() from (values
    ('ประกันรถ','transport',1,'y'),('ประกันชีวิต','health',1,'y'),('ประกันสุขภาพ','health',1,'y'),
    ('ภาษีรถ (ต่อทะเบียน)','transport',1,'y'),('เปลี่ยนยางรถ','transport',3,'y'),('ซ่อมบำรุงรถ','household',6,'m'),
    ('ล้างแอร์','utilities',6,'m'),('ค่าเทอมลูก','education',6,'m')) v(n, ic, ev, u);
  return hid;
end $$;

create or replace function public.join_house(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid; freeplot int;
begin
  if auth.uid() is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  select id into hid from houses where invite_code = upper(trim(p_code));
  if hid is null then raise exception 'ไม่พบโค้ดบ้านนี้'; end if;
  if exists (select 1 from house_members where house_id = hid and user_id = auth.uid()) then return hid; end if;
  select min(g) into freeplot from generate_series(0, 4) g
    where g not in (select plot from house_members where user_id = auth.uid());
  if freeplot is null then raise exception 'มีบ้านครบ 5 หลังแล้ว'; end if;
  insert into house_members (house_id, user_id, role, plot) values (hid, auth.uid(), 'member', freeplot);
  return hid;
end $$;

create or replace function public.get_house_bundle(h uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if not exists (select 1 from house_members where house_id = h and user_id = uid) then
    raise exception 'ไม่มีสิทธิ์เข้าบ้านนี้';
  end if;
  return jsonb_build_object(
    'me', uid,
    'house', (select to_jsonb(x) from houses x where x.id = h),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'avatar', p.avatar, 'role', m.role) order by m.joined_at), '[]')
                from house_members m join profiles p on p.id = m.user_id where m.house_id = h),
    'opening', (select coalesce(jsonb_agg(to_jsonb(o)), '[]') from opening_balances o where o.house_id = h),
    'projects', (select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at), '[]') from projects p where p.house_id = h),
    'annual', (select coalesce(jsonb_agg(to_jsonb(a) order by a.due), '[]') from annual_items a where a.house_id = h),
    'tx', (select coalesce(jsonb_agg(jsonb_build_object(
              'id', t.id, 'user_id', t.user_id, 'type', t.type,
              'category', case when t.is_private and t.user_id <> uid and t.type <> 'save' then 'private' else t.category end,
              'amount', t.amount,
              'note', case when t.is_private and t.user_id <> uid then null else t.note end,
              'occurred_on', t.occurred_on, 'is_private', t.is_private,
              'save_kind', t.save_kind, 'save_action', t.save_action, 'to_user', t.to_user,
              'to_project', t.to_project, 'paid_from_project', t.paid_from_project,
              'receipt_path', case when t.is_private and t.user_id <> uid then null else t.receipt_path end,
              'created_at', t.created_at) order by t.occurred_on desc, t.created_at desc), '[]')
           from transactions t where t.house_id = h)
  );
end $$;

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'เฉพาะ Admin'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id', h.id, 'name', h.name, 'style', h.style, 'created_at', h.created_at,
    'members', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'avatar', p.avatar,
                  'role', m.role, 'email', u.email) order by m.joined_at), '[]')
                from house_members m join profiles p on p.id = m.user_id join auth.users u on u.id = m.user_id
                where m.house_id = h.id),
    'tx_count', (select count(*) from transactions t where t.house_id = h.id),
    'last_activity', greatest(h.created_at, (select max(created_at) from transactions t where t.house_id = h.id)),
    'month_out', (select coalesce(sum(amount), 0) from transactions t where t.house_id = h.id and t.type = 'out'
                  and t.paid_from_project is null and t.occurred_on >= date_trunc('month', bkk_today()))
  ) order by h.created_at), '[]') from houses h);
end $$;

-- Admin: เพิ่มสมาชิกด้วยอีเมล (ผู้ใช้ต้องสมัครไว้แล้ว)
create or replace function public.admin_add_member(h uuid, p_email text, p_role text default 'member') returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid; freeplot int;
begin
  if not is_admin() then raise exception 'เฉพาะ Admin'; end if;
  if p_role not in ('owner','member') then raise exception 'บทบาทไม่ถูกต้อง'; end if;
  if not exists (select 1 from houses where id = h) then raise exception 'ไม่พบบ้านนี้'; end if;
  select id into u from auth.users where lower(email) = lower(trim(p_email));
  if u is null then raise exception 'ยังไม่มีผู้ใช้อีเมลนี้ ให้สมัครสมาชิกก่อน'; end if;
  if exists (select 1 from house_members where house_id = h and user_id = u) then raise exception 'เป็นสมาชิกบ้านนี้อยู่แล้ว'; end if;
  select min(g) into freeplot from generate_series(0, 4) g where g not in (select plot from house_members where user_id = u);
  if freeplot is null then raise exception 'ผู้ใช้นี้มีบ้านครบ 5 หลังแล้ว'; end if;
  insert into house_members (house_id, user_id, role, plot) values (h, u, p_role, freeplot);
  return u;
end $$;

-- Admin: นำสมาชิกออก
create or replace function public.admin_remove_member(h uuid, u uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'เฉพาะ Admin'; end if;
  delete from house_members where house_id = h and user_id = u;
end $$;

-- Admin: เปลี่ยนบทบาท (เจ้าของบ้าน / สมาชิก)
create or replace function public.admin_set_role(h uuid, u uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'เฉพาะ Admin'; end if;
  if p_role not in ('owner','member') then raise exception 'บทบาทไม่ถูกต้อง'; end if;
  update house_members set role = p_role where house_id = h and user_id = u;
end $$;

-- Admin: ลบบ้าน (ลบรายการ โปรเจค ยอดตั้งต้น ค่าใช้จ่ายรายปี ของบ้านนี้ทั้งหมด)
create or replace function public.admin_delete_house(h uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'เฉพาะ Admin'; end if;
  delete from houses where id = h;
end $$;

revoke execute on function public.my_houses, public.create_house, public.join_house,
  public.get_house_bundle, public.admin_overview, public.admin_add_member, public.admin_remove_member,
  public.admin_set_role, public.admin_delete_house from public, anon;
grant execute on function public.my_houses, public.create_house, public.join_house,
  public.get_house_bundle, public.admin_overview, public.admin_add_member, public.admin_remove_member,
  public.admin_set_role, public.admin_delete_house to authenticated;

-- ---------- storage: รูปใบเสร็จ (ส่วนตัว) ----------
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
  on conflict (id) do nothing;
drop policy if exists receipts_read on storage.objects;
create policy receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (public.is_admin() or public.is_member(((storage.foldername(name))[1])::uuid)));
drop policy if exists receipts_write on storage.objects;
create policy receipts_write on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists receipts_delete on storage.objects;
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (owner = auth.uid() or public.is_admin()));

-- ---------- ตั้งตัวเองเป็น Admin (รันครั้งเดียวหลังสมัครสมาชิกแล้ว) ----------
-- update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'อีเมลของคุณ');

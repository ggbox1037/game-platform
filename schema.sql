-- 《地下尋金者》資料表與安全政策。在 Supabase 後台 → SQL Editor 貼上整份執行一次即可（可重複執行）。
-- 前置條件：Authentication → Providers → 打開「Allow anonymous sign-ins」（匿名登入）。

create table if not exists public.sk_rooms(
  code text primary key,
  pub jsonb not null,                      -- 公開狀態：地圖、輪次、玩家名單、公開紀錄（絕對不含身分、手牌、未公開的目標）
  version int not null default 0,
  locked_until timestamptz,                -- 伺服器用的房間鎖，避免兩個行動同時處理
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());

-- 座位與身分對照：只有伺服器能讀寫（不開放任何政策）
create table if not exists public.sk_seats(
  code text not null references public.sk_rooms(code) on delete cascade,
  seat int not null,
  uid uuid not null,
  token_hash text not null,                -- 重新連線用的憑證（只存雜湊）
  last_seen timestamptz not null default now(),
  primary key(code,seat),
  unique(code,uid));

-- 每位玩家的祕密：身分、手牌、偷看結果。只有本人（auth.uid()）讀得到
create table if not exists public.sk_secrets(
  code text not null,
  seat int not null,
  uid uuid not null,
  secret jsonb not null,
  primary key(code,seat),
  foreign key(code,seat) references public.sk_seats(code,seat) on delete cascade on update cascade);

-- 牌庫、目標真實內容、沒發出去的身分：只有伺服器能讀寫
create table if not exists public.sk_server(
  code text primary key references public.sk_rooms(code) on delete cascade,
  data jsonb not null);

alter table public.sk_rooms   enable row level security;
alter table public.sk_seats   enable row level security;
alter table public.sk_secrets enable row level security;
alter table public.sk_server  enable row level security;

create or replace function public.sk_member(c text) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.sk_seats where code=c and uid=auth.uid()) $$;

drop policy if exists sk_rooms_read   on public.sk_rooms;
drop policy if exists sk_secrets_read on public.sk_secrets;
create policy sk_rooms_read   on public.sk_rooms   for select to authenticated using (public.sk_member(code));
create policy sk_secrets_read on public.sk_secrets for select to authenticated using (uid = auth.uid());
-- sk_seats、sk_server 沒有任何政策 = 一般玩家完全讀不到；所有寫入都只經過 Edge Function（service role）

revoke all on public.sk_rooms, public.sk_seats, public.sk_secrets, public.sk_server from anon, authenticated;
grant select on public.sk_rooms, public.sk_secrets to authenticated;

-- 即時同步（玩家端用 postgres_changes 收到公開狀態與自己的手牌，RLS 會自動過濾）
do $$ begin
  begin alter publication supabase_realtime add table public.sk_rooms;   exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.sk_secrets; exception when duplicate_object then null; end;
end $$;
alter table public.sk_secrets replica identity full;

-- 清理 12 小時前的舊房間（可選：在 SQL Editor 排程或手動執行）
create or replace function public.sk_cleanup() returns void language sql security definer set search_path=public as $$
  delete from public.sk_rooms where updated_at < now() - interval '12 hours' $$;
revoke all on function public.sk_cleanup() from anon, authenticated;

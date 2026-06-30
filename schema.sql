-- Supabase 프로젝트의 SQL Editor에서 이 내용을 그대로 실행하세요.

create table transactions (
  id uuid primary key,
  type text not null,
  amount numeric not null,
  date date not null,
  category_main text,
  category_sub text,
  payment text,
  memo text,
  is_fixed boolean default false,
  created_at timestamptz default now()
);

create table meta (
  key text primary key,
  value jsonb
);

create table assets (
  id uuid primary key,
  name text not null,
  type text not null,
  balance numeric not null
);

create table asset_snapshots (
  date date primary key,
  total numeric not null
);

-- 부부 둘만 쓰는 용도라 별도 로그인 없이 anon key로 바로 접근하도록 RLS를 열어둡니다.
-- (이 URL과 키를 아는 사람은 누구나 데이터에 접근할 수 있으니 외부에 공유하지 마세요.)
alter table transactions enable row level security;
alter table meta enable row level security;
alter table assets enable row level security;
alter table asset_snapshots enable row level security;

create policy "open access" on transactions for all using (true) with check (true);
create policy "open access" on meta for all using (true) with check (true);
create policy "open access" on assets for all using (true) with check (true);
create policy "open access" on asset_snapshots for all using (true) with check (true);

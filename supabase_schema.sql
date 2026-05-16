-- Run this in your Supabase SQL editor

create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  lat         double precision not null,
  lng         double precision not null,
  type        text not null check (type in ('jam', 'accident', 'closed')),
  location    text not null,
  severity    text not null check (severity in ('low', 'medium', 'high')),
  summary     text,
  votes       integer not null default 1
);

-- Allow anyone to read and insert (no auth for hackathon)
alter table reports enable row level security;

create policy "Public read" on reports for select using (true);
create policy "Public insert" on reports for insert with check (true);
create policy "Public update votes" on reports for update using (true) with check (true);

-- Auto-cleanup: index for filtering by created_at
create index if not exists reports_created_at_idx on reports (created_at desc);

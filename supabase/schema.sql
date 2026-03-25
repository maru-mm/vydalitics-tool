-- ============================================================
-- Vydalitics AI - Supabase Schema
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- Configuration key-value store
create table if not exists app_config (
  key   text primary key,
  value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Trigger to auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger app_config_updated_at
  before update on app_config
  for each row
  execute function update_updated_at();

-- Seed: allowed_folder_ids (empty by default)
insert into app_config (key, value)
values ('allowed_folder_ids', '[]'::jsonb)
on conflict (key) do nothing;

-- Enable Row Level Security
alter table app_config enable row level security;

-- Policy: allow read from service role (API routes use service_role key)
create policy "Service role full access" on app_config
  for all
  using (true)
  with check (true);

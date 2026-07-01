-- Policy to allow public read access to published clinic sites by slug.
-- Execute this in Supabase SQL Editor when row-level security is enabled for the clinicas table.

alter table public.clinicas enable row level security;

create policy "Public select published clinic sites" on public.clinicas
  for select
  using (
    slug IS NOT NULL
    AND slug <> ''
  );

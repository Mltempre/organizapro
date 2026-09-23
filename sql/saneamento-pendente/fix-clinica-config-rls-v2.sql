-- FUTURO FIX - NAO EXECUTAR SEM GO E PRE-FLIGHT SALVO.
-- Substitui SOMENTE as tres policies canonicas conhecidas. Se houver qualquer
-- policy desconhecida, aborta antes de alterar o schema. A view/RPC publica nao
-- e recriada aqui: sua definicao real precisa ser confrontada no pre-flight.

begin;

do $$
declare
  policies_desconhecidas text;
begin
  if to_regclass('public.clinica_config') is null then
    raise exception 'clinica_config ausente';
  end if;

  select string_agg(policyname, ', ' order by policyname)
    into policies_desconhecidas
  from pg_policies
  where schemaname = 'public'
    and tablename = 'clinica_config'
    and policyname not in (
      'clinica_config_select_own',
      'clinica_config_insert_own',
      'clinica_config_update_own'
    );

  if policies_desconhecidas is not null then
    raise exception 'policies desconhecidas em clinica_config: %. Revisao manual obrigatoria', policies_desconhecidas;
  end if;
end $$;

alter table public.clinica_config enable row level security;

drop policy if exists clinica_config_select_own on public.clinica_config;
drop policy if exists clinica_config_insert_own on public.clinica_config;
drop policy if exists clinica_config_update_own on public.clinica_config;

create policy clinica_config_select_own
  on public.clinica_config
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.clinica_usuarios cu
      join public.clinicas c on c.id = cu.clinica_id
      where cu.usuario_id = auth.uid()
        and cu.clinica_id = clinica_config.clinica_id
        and cu.ativo = true
        and c.produto = 'organizapro'
    )
  );

create policy clinica_config_insert_own
  on public.clinica_config
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.clinica_usuarios cu
      join public.clinicas c on c.id = cu.clinica_id
      where cu.usuario_id = auth.uid()
        and cu.clinica_id = clinica_config.clinica_id
        and cu.ativo = true
        and c.produto = 'organizapro'
    )
  );

create policy clinica_config_update_own
  on public.clinica_config
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.clinica_usuarios cu
      join public.clinicas c on c.id = cu.clinica_id
      where cu.usuario_id = auth.uid()
        and cu.clinica_id = clinica_config.clinica_id
        and cu.ativo = true
        and c.produto = 'organizapro'
    )
  )
  with check (
    exists (
      select 1
      from public.clinica_usuarios cu
      join public.clinicas c on c.id = cu.clinica_id
      where cu.usuario_id = auth.uid()
        and cu.clinica_id = clinica_config.clinica_id
        and cu.ativo = true
        and c.produto = 'organizapro'
    )
  );

revoke all on public.clinica_config from anon;
revoke delete on public.clinica_config from authenticated;
grant select, insert, update on public.clinica_config to authenticated;

commit;

-- Rollback futuro: restaurar EXATAMENTE o dump de pg_policies e grants salvo
-- no pre-flight. Nao existe rollback generico seguro para policies desconhecidas.

-- PREPARADA, NÃO EXECUTADA. Depende de origem_captacoes e eventos_dominio existentes.
-- Não cria campanha, conexão OAuth, token nem um segundo sistema de eventos.
begin;
alter table public.origem_captacoes add column if not exists identificadores_ads jsonb;
alter table public.origem_captacoes add constraint origem_identificadores_ads_objeto check (
  identificadores_ads is null or (jsonb_typeof(identificadores_ads) = 'object' and octet_length(identificadores_ads::text) <= 2000)
);
drop policy if exists origem_captacoes_select_own on public.origem_captacoes;
create policy origem_captacoes_select_own on public.origem_captacoes for select to authenticated using (
  exists (select 1 from public.clinica_usuarios u join public.clinicas c on c.id = u.clinica_id
    where u.clinica_id = origem_captacoes.clinica_id and u.usuario_id = auth.uid()
      and u.ativo = true and c.produto = 'organizapro')
);
create or replace function public.validar_paciente_origem_ads_v1() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.paciente_id is not null and not exists (
    select 1 from public.pacientes p where p.id = new.paciente_id and p.clinica_id::text = new.clinica_id::text
  ) then raise exception 'Vínculo de origem fora do negócio'; end if;
  return new;
end;
$$;
revoke all on function public.validar_paciente_origem_ads_v1() from public, anon, authenticated;
create trigger origem_ads_paciente_tenant before insert or update of paciente_id, clinica_id on public.origem_captacoes
for each row execute function public.validar_paciente_origem_ads_v1();
-- Idempotência reutiliza (clinica_id,chave_idempotencia) de eventos_dominio.
commit;

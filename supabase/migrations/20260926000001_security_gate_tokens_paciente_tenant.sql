-- PREPARADA PARA REVISAO. NAO APLICADA AO SUPABASE.
-- Transacional: qualquer falha desfaz todas as alteracoes desta migration.
begin;

-- A revogacao por coluna isolada nao remove privilegios da tabela inteira.
revoke all privileges on table public.clinica_config
  from public, anon, authenticated;

do $$
declare
  todas text;
  permitidas text;
  papel text;
  segredo text;
  privilegio text;
begin
  if (select count(*) from pg_catalog.pg_attribute
      where attrelid = 'public.clinica_config'::regclass
        and attname in ('zapi_token', 'zapi_client_token')
        and attnum > 0 and not attisdropped) <> 2 then
    raise exception 'Colunas Z-API esperadas ausentes; revisar schema';
  end if;

  select string_agg(format('%I', attname), ', ' order by attnum),
         string_agg(format('%I', attname), ', ' order by attnum)
           filter (where attname not in ('zapi_token', 'zapi_client_token'))
    into todas, permitidas
  from pg_catalog.pg_attribute
  where attrelid = 'public.clinica_config'::regclass
    and attnum > 0 and not attisdropped;

  execute format(
    'revoke all privileges (%s) on public.clinica_config from public, anon, authenticated', todas);
  -- Preserva campos de configuracao, inclusive zapi_instance, sujeitos a RLS.
  -- Novas colunas futuras nao recebem estes grants automaticamente.
  execute format(
    'grant select (%1$s), insert (%1$s), update (%1$s) on public.clinica_config to authenticated', permitidas);

  -- Falha fechada se grants herdados ainda permitirem acesso aos segredos.
  foreach papel in array array['anon', 'authenticated'] loop
    foreach segredo in array array['zapi_token', 'zapi_client_token'] loop
      foreach privilegio in array array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] loop
        if pg_catalog.has_column_privilege(papel, 'public.clinica_config', segredo, privilegio) then
          raise exception 'Privilegio residual em credenciais; revisar grants herdados';
        end if;
      end loop;
    end loop;
    if pg_catalog.has_table_privilege(papel, 'public.clinica_config', 'DELETE')
       or pg_catalog.has_table_privilege(papel, 'public.clinica_config', 'TRUNCATE')
       or pg_catalog.has_table_privilege(papel, 'public.clinica_config', 'TRIGGER') then
      raise exception 'Privilegio residual de tabela; revisar grants herdados';
    end if;
  end loop;
end $$;

grant select, insert, update on table public.clinica_config to service_role;

-- Mantem pacientes.clinica_id text. Nenhum dado existente e convertido,
-- apagado ou corrigido. A representacao text e derivada do UUID da filha.
alter table public.cobrancas
  add column clinica_id_paciente_text text
  generated always as (clinica_id::text) stored;
alter table public.tratamentos
  add column clinica_id_paciente_text text
  generated always as (clinica_id::text) stored;

-- Usa a chave unica existente em pacientes(id, clinica_id).
-- MATCH SIMPLE preserva paciente_id NULL; NO ACTION impede orfaos.
alter table public.cobrancas
  add constraint cobrancas_paciente_tenant_fk
  foreign key (paciente_id, clinica_id_paciente_text)
  references public.pacientes (id, clinica_id)
  match simple on update no action on delete no action not valid;
alter table public.tratamentos
  add constraint tratamentos_paciente_tenant_fk
  foreign key (paciente_id, clinica_id_paciente_text)
  references public.pacientes (id, clinica_id)
  match simple on update no action on delete no action not valid;

-- Dados legados invalidos abortam a transacao; nunca sao corrigidos aqui.
alter table public.cobrancas validate constraint cobrancas_paciente_tenant_fk;
alter table public.tratamentos validate constraint tratamentos_paciente_tenant_fk;

-- Nao recria minhas_clinicas_ativas nem site_publico_por_slug_v2.
commit;

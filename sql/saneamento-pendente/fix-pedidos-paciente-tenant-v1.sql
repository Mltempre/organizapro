-- FUTURO FIX - NAO EXECUTAR SEM GO E PRE-FLIGHT SALVO.
-- Acrescenta garantia estrutural para pedidos.paciente_id pertencer ao mesmo
-- tenant de pedidos.clinica_id. Nao corrige dados divergentes silenciosamente.

begin;

do $$
declare
  divergencias bigint;
begin
  if to_regclass('public.pedidos') is null or to_regclass('public.pacientes') is null then
    raise exception 'pedidos/pacientes ausentes';
  end if;

  select count(*) into divergencias
  from public.pedidos pe
  join public.pacientes p on p.id = pe.paciente_id
  where pe.paciente_id is not null
    and p.clinica_id <> pe.clinica_id;

  if divergencias > 0 then
    raise exception '% pedidos possuem paciente de outro tenant; decidir correcao linha a linha antes do DDL', divergencias;
  end if;
end $$;

create unique index if not exists pacientes_id_clinica_id_uidx
  on public.pacientes (id, clinica_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pedidos'::regclass
      and conname = 'pedidos_paciente_tenant_fk'
  ) then
    alter table public.pedidos
      add constraint pedidos_paciente_tenant_fk
      foreign key (paciente_id, clinica_id)
      references public.pacientes (id, clinica_id)
      on delete set null (paciente_id)
      not valid;
  end if;
end $$;

alter table public.pedidos validate constraint pedidos_paciente_tenant_fk;

commit;

-- Rollback futuro. Reabre o risco cross-tenant e por isso exige decisao formal:
-- begin;
-- alter table public.pedidos drop constraint if exists pedidos_paciente_tenant_fk;
-- -- Nao remover pacientes_id_clinica_id_uidx sem verificar outros FKs.
-- commit;

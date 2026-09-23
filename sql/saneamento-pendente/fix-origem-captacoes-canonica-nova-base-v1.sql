-- FUTURO FIX - NAO EXECUTAR SEM GO E PRE-FLIGHT SALVO.
-- Caminho A: somente quando public.origem_captacoes NAO existe.
-- Se a tabela ja existir, o bloco de guarda aborta. A reconciliacao de uma
-- tabela existente depende do resultado do pre-flight e nao pode ser inferida.

begin;

do $$
begin
  if to_regclass('public.origem_captacoes') is not null then
    raise exception 'origem_captacoes ja existe; use o caminho de reconciliacao definido pelo pre-flight';
  end if;
  if to_regclass('public.clinicas') is null or to_regclass('public.pacientes') is null then
    raise exception 'dependencias clinicas/pacientes ausentes';
  end if;
end $$;

-- Necessario para a FK composta que garante paciente e captura no mesmo tenant.
-- id ja e chave primaria; o indice composto acrescenta o contrato referenciavel.
create unique index if not exists pacientes_id_clinica_id_uidx
  on public.pacientes (id, clinica_id);

create table public.origem_captacoes (
  id                uuid primary key default gen_random_uuid(),
  clinica_id        uuid not null references public.clinicas(id) on delete cascade,
  paciente_id       uuid,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content       text,
  gclid             text,
  fbclid            text,
  referrer_host     text,
  classificacao     text not null check (
    classificacao in ('google_ads', 'meta_ads', 'campanha_utm', 'busca_organica', 'referencia', 'direto')
  ),
  codigo_rastreio   text not null,
  capturado_em      timestamptz not null default now(),
  vinculado_em      timestamptz,
  criado_em         timestamptz not null default now(),
  constraint origem_captacoes_paciente_tenant_fk
    foreign key (paciente_id, clinica_id)
    references public.pacientes (id, clinica_id)
    on delete set null (paciente_id),
  constraint origem_captacoes_vinculo_coerente_chk
    check (
      (paciente_id is null and vinculado_em is null)
      or (paciente_id is not null and vinculado_em is not null)
    )
);

create unique index origem_captacoes_clinica_codigo_uidx
  on public.origem_captacoes (clinica_id, codigo_rastreio);
create index origem_captacoes_clinica_idx
  on public.origem_captacoes (clinica_id);
create index origem_captacoes_paciente_idx
  on public.origem_captacoes (paciente_id)
  where paciente_id is not null;

alter table public.origem_captacoes enable row level security;

create policy origem_captacoes_select_own
  on public.origem_captacoes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.clinica_usuarios cu
      join public.clinicas c on c.id = cu.clinica_id
      where cu.usuario_id = auth.uid()
        and cu.clinica_id = origem_captacoes.clinica_id
        and cu.ativo = true
        and c.produto = 'organizapro'
    )
  );

revoke all on public.origem_captacoes from public, anon, authenticated;
grant select on public.origem_captacoes to authenticated;

comment on table public.origem_captacoes is
  'Origem observada e rastreavel por tenant. Escrita somente server-side; paciente vinculado deve pertencer ao mesmo tenant.';

commit;

-- Rollback futuro (somente se a tabela tiver sido criada por este script e
-- antes de receber dados):
-- begin;
-- drop table public.origem_captacoes;
-- -- Nao remover pacientes_id_clinica_id_uidx sem confirmar outros FKs dependentes.
-- commit;

-- Atribuição de Origem — Fase 1 (hardened) — Migration preparada.
--
-- PROPOSTA — NÃO EXECUTAR sem GO explícito. Nenhum SQL rodado contra
-- Supabase nesta missão.
--
-- Origem: já auditada e aprovada em docs/atribuicao-origem-fase1-migration-
-- preparada.md (branch audit/smart-commerce-precheck, Fase 1.1 —
-- hardening de segurança). Portada verbatim para esta convergência
-- canônica — nenhuma mudança de schema/RLS em relação à versão já
-- auditada; só o nome do arquivo e a data foram atualizados.
--
-- Guarda, por clínica, a origem real capturada na entrada pública do site
-- (app/empresa/[slug]) e o vínculo posterior com o paciente que entrar em
-- contato pelo WhatsApp com o código de rastreio correspondente
-- (app/api/chatbot/message/route.ts).

begin;

create table if not exists public.origem_captacoes (
  id                uuid primary key default gen_random_uuid(),
  clinica_id        uuid not null references public.clinicas(id) on delete cascade,
  paciente_id       uuid references public.pacientes(id) on delete set null,

  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content       text,
  gclid             text,
  fbclid            text,
  referrer_host     text,

  classificacao     text not null check (
    classificacao in ('google_ads','meta_ads','campanha_utm','busca_organica','referencia','direto')
  ),

  codigo_rastreio   text not null,
  capturado_em      timestamptz not null default now(),
  vinculado_em      timestamptz,
  created_at        timestamptz not null default now()
);

comment on table public.origem_captacoes is
  'Captura real de origem (UTM/gclid/fbclid/referrer) na entrada do site público por slug. Nunca inferida — ausência é null. Só gravável por service_role — nenhuma policy de INSERT para anon/authenticated. paciente_id só é preenchido pelo webhook, quando um código de rastreio é reconhecido dentro do mesmo tenant.';

-- Único por clínica (não precisa ser globalmente único). NOT NULL na coluna
-- (acima) torna este índice não-parcial.
create unique index if not exists origem_captacoes_codigo_unico
  on public.origem_captacoes (clinica_id, codigo_rastreio);

create index if not exists origem_captacoes_clinica_idx
  on public.origem_captacoes (clinica_id);

create index if not exists origem_captacoes_paciente_idx
  on public.origem_captacoes (paciente_id)
  where paciente_id is not null;

alter table public.origem_captacoes enable row level security;

-- Nenhuma policy de INSERT/UPDATE/DELETE para anon nem authenticated —
-- proposital (Fase 1.1). RLS nega por padrão sem policy; a única escrita
-- real vem de service_role (sempre ignora RLS), chamado só pelo servidor
-- com clinica_id já resolvido de forma confiável (nunca do navegador).

-- SELECT: só a própria clínica, nunca anônimo, nunca outro tenant.
create policy "origem_captacoes_select_own" on public.origem_captacoes
  for select
  to authenticated
  using (
    clinica_id in (select clinica_id from public.clinica_usuarios where usuario_id = auth.uid())
  );

revoke all on public.origem_captacoes from anon, authenticated;
grant select on public.origem_captacoes to authenticated;
-- anon: nenhum GRANT — nem select, nem insert, nem update, nem delete.

commit;

-- ── Rollback ────────────────────────────────────────────────────────────
-- begin;
-- drop table if exists public.origem_captacoes;
-- commit;

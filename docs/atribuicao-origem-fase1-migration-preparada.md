# Atribuição de Origem — Fase 1 — Migration preparada (NÃO EXECUTADA)

Proposta para persistir, por tenant, a origem real capturada por
`lib/atribuicao-origem.ts` + `lib/origem-persistencia.ts`. Propositalmente
**não copiada para `supabase/migrations/`** — mesma razão já documentada em
`docs/google-presenca-reputacao-ads-v1-arquitetura.md` (seção H): evitar que
qualquer ferramenta que varra aquele diretório aplique isto sem um GO
explícito do Capitão.

## Objetivo

Guardar, por clínica, os dados de origem capturados na entrada pública do
site (`app/empresa/[slug]`) e o vínculo posterior com o paciente que entrar
em contato pelo WhatsApp com o código de rastreio correspondente.

## Antes de criar — verificação de estrutura equivalente

Busquei em todas as 8 migrations existentes e em todo o schema inferido do
código por tabelas equivalentes (`origem`, `atribuicao`, `utm`, `campanha`,
`lead_origem`) — **nenhuma existe**. `chatbot_leads` (migrations
`20260624000000/1/3`) guarda o funil de qualificação do chatbot comercial do
próprio OrganizaPro (tenant `TENANT_SDR_ORGANIZAPRO`), um domínio diferente
— não é reaproveitável para origem de lead de clientes finais sem
misturar dois conceitos que devem ficar separados. Tabela nova é
necessária.

## Invariantes

- `clinica_id` sempre obrigatório — isolamento multi-tenant desde a criação.
- Todo campo de origem (UTM/gclid/fbclid/referrer) é **opcional** — a regra
  de ouro de `atribuicao-origem.ts` ("nunca inventa origem") vale também no
  banco: ausência é `null`, nunca uma string vazia ou um valor adivinhado.
- `classificacao` é a única coluna `NOT NULL` do bloco de origem — sempre
  computada por `classificarOrigem()` antes do INSERT, nunca calculada
  depois a partir de dado parcial.
- `paciente_id` é opcional e só é preenchido depois, pelo webhook (Fase D)
  — no momento da captura no site público ainda não existe paciente.
- Tabela nova, sem `ALTER` em `pacientes`/`agendamentos`/`avaliacoes`/
  `clinicas` — zero risco de quebrar registro existente.
- RLS habilitada desde a criação, nunca uma janela sem policy.
- **Fase 1.1 (hardening) — revisão de autoridade de escrita**: a única
  forma de gravar em `origem_captacoes` é `service_role`, chamado a partir
  de `app/empresa/[slug]/page.tsx` (Server Component) e
  `app/api/chatbot/message/route.ts`, nos dois casos com `clinica_id`
  resolvido no servidor (`buscarResumoEmpresa(slug)` / parâmetro já
  validado do webhook) — nunca um valor que o navegador informe
  diretamente. Por isso **não existe nenhuma policy de INSERT para `anon`
  nem para `authenticated`** — RLS nega os dois por padrão, e
  `service_role` sempre ignora RLS. Isto fecha por completo o risco
  identificado na Fase 1: com a versão anterior (INSERT anônimo via RLS),
  qualquer cliente HTTP de posse da chave pública `anon` conseguia gravar
  sob o `clinica_id` de outro tenant sem passar pelo Next.js; com
  `service_role` restrito ao servidor, esse caminho deixa de existir.
- `codigo_rastreio` é `NOT NULL` — todo INSERT desta versão do código
  (Fase C) sempre gera um código antes de gravar, então a coluna nunca
  fica ausente; a restrição de unicidade deixa de ser parcial (ver SQL).

## SQL completo

```sql
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
  'Captura real de origem (UTM/gclid/fbclid/referrer) na entrada do site público por slug. Nunca inferida — ausência é null. Só gravável por service_role (ver Fase 1.1) — nenhuma policy de INSERT para anon/authenticated. paciente_id só é preenchido pelo webhook, quando um código de rastreio é reconhecido dentro do mesmo tenant.';

-- Único por clínica (não precisa ser globalmente único — dois tenants
-- podem gerar o mesmo código por coincidência sem colidir). NOT NULL na
-- coluna (acima) torna este índice não-parcial: toda linha desta versão
-- do código sempre tem código, então a restrição vale sempre, sem exceção
-- — é esta restrição, reforçada pelo Postgres, que garante estruturalmente
-- que um código nunca aponta para duas capturas ao mesmo tempo, na mesma
-- clínica (ver "Idempotência" abaixo para a garantia contra replay do
-- vínculo, que é um mecanismo diferente).
create unique index if not exists origem_captacoes_codigo_unico
  on public.origem_captacoes (clinica_id, codigo_rastreio);

create index if not exists origem_captacoes_clinica_idx
  on public.origem_captacoes (clinica_id);

create index if not exists origem_captacoes_paciente_idx
  on public.origem_captacoes (paciente_id)
  where paciente_id is not null;

alter table public.origem_captacoes enable row level security;

-- Nenhuma policy de INSERT/UPDATE/DELETE para anon nem authenticated —
-- proposital (ver Fase 1.1 acima). RLS nega por padrão sem policy; a
-- única escrita real vem de service_role (Fase C e Fase D), que sempre
-- ignora RLS. Isto elimina o risco anterior de um cliente HTTP arbitrário
-- conseguir gravar sob o clinica_id de outro tenant.

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
```

## Idempotência — garantia estrutural, não só de aplicação

Dois mecanismos distintos, cada um resolvendo um problema diferente:

1. **Colisão de código na captura** (dois INSERTs gerando o mesmo código,
   na mesma clínica): impedida pelo índice único `(clinica_id,
   codigo_rastreio)` acima, agora não-parcial (`codigo_rastreio` é `NOT
   NULL`). Se `gerarCodigoOrigem()` colidir (probabilidade desprezível —
   32^10 combinações), o segundo INSERT falha por violação de constraint;
   `persistirOrigemCaptada` captura o erro e só loga — a captura mais
   recente é descartada, nunca sobrescreve ou corrompe a mais antiga.
2. **Replay do vínculo** (o webhook recebe o mesmo `ref:xxxxx` mais de uma
   vez — reentrega do WhatsApp, ou o cliente reenvia a mesma mensagem): a
   garantia real não é `podeVincularOrigem` (que é só um atalho de
   aplicação para não fazer um UPDATE desnecessário) — é o próprio
   `UPDATE ... WHERE id = ? AND vinculado_em IS NULL` em
   `lib/origem-persistencia.ts`. O Postgres serializa duas UPDATEs
   concorrentes na mesma linha (row lock); a primeira a executar encontra
   `vinculado_em IS NULL`, grava, e libera o lock — a segunda, ao adquirir
   o lock, já encontra `vinculado_em` preenchido e o `WHERE` não casa mais
   nenhuma linha (0 linhas afetadas, sem erro, sem sobrescrita). Isto é
   comparar-e-trocar atômico garantido pelo banco, não uma checagem que a
   aplicação poderia perder numa corrida.

## PRECHECK (read-only, antes de aplicar)

```sql
select count(*) as ja_existe
from information_schema.tables
where table_schema = 'public' and table_name = 'origem_captacoes';
-- esperado: 0

select count(*) as clinicas_reais from public.clinicas;
-- só para confirmar que a tabela de referência do FK existe e tem linhas
```

## POSTCHECK (depois de aplicar, quando autorizado)

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename = 'origem_captacoes';
-- esperado: rowsecurity = true

select policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename = 'origem_captacoes'
order by policyname;
-- esperado: exatamente 1 policy (select_own, roles={authenticated})
-- CRÍTICO: se aparecer qualquer policy de INSERT para anon ou authenticated,
-- a migration foi alterada — não prosseguir, é exatamente o risco da Fase 1.

select has_table_privilege('anon', 'public.origem_captacoes', 'INSERT') as anon_pode_inserir,
       has_table_privilege('anon', 'public.origem_captacoes', 'SELECT') as anon_pode_ler;
-- esperado: false, false (as duas)

select count(*) from public.origem_captacoes;
-- esperado: 0 (tabela nova, nenhum dado ainda)
```

## ROLLBACK documental

```sql
begin;
drop table if exists public.origem_captacoes;
commit;
```

Seguro — tabela nova, sem dado de outro domínio dependendo dela, sem
`ALTER` em tabela existente para reverter.

## Status

**NÃO EXECUTADA.** Todo o código que a usa (`lib/origem-persistencia.ts`,
Fase C em `app/empresa/[slug]`, Fase D em
`app/api/chatbot/message/route.ts`) já está escrito, já usa `service_role`
(nunca `anon`) para a escrita, e é fail-closed: roda hoje sem esta tabela
sem quebrar nada (erro de "relation does not exist" é capturado e só
logado). Quando este GO for dado e a migration rodar, o mesmo código passa
a persistir de verdade, sem nenhuma alteração adicional.

**Revisão de segurança (Fase 1.1)**: a versão anterior deste documento
propunha uma policy de INSERT para `anon`, aceitando o risco documentado de
um cliente HTTP conseguir forjar `clinica_id` de outro tenant. Essa policy
foi **removida**. A tabela agora não concede NENHUM privilégio de escrita
a `anon`/`authenticated` — só `service_role`, chamado exclusivamente pelo
próprio servidor com `clinica_id` já resolvido de forma confiável.

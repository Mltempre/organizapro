# GBP — SQL JÁ APLICADO em produção (não aplicar a partir deste diretório)

> **Status confirmado por preflight SOMENTE LEITURA em 2026-09-25:** a tabela
> `public.google_business_profile_operacoes`, o índice parcial
> `gbp_operacao_em_voo` e as funções `gbp_iniciar_operacao` /
> `gbp_finalizar_operacao` **já existem em produção** (conexões = 0,
> operações = 0, `eventos_dominio` = 868 linhas intactas; verificado por
> REST/OpenAPI com `service_role` e por resolução de assinatura das RPCs).
> **NÃO reaplicar:** o script não é idempotente (`create table`, `create index`
> e `create function` sem `IF NOT EXISTS` → `42P07`/`42723`). Este diretório
> permanece fora do runner de migrations e passa a valer como artefato
> histórico/canônico do contrato.

`gbp-operacoes-v1.sql` é indispensável para reservar uma operação de maneira
atômica entre processos e persistir o resultado junto do evento de domínio.
Um SELECT seguido de INSERT na aplicação não protege contra duas requisições
concorrentes. Este arquivo fica fora de `supabase/migrations`; nenhum runner
deve executá-lo automaticamente. Os demais SQLs pendentes não são alterados.

Antes de eventual aplicação, em fase externa autorizada, conferir o schema
efetivo de `clinicas` e `eventos_dominio`, tipos UUID, colunas do INSERT,
constraints de eventos, grants, RLS e disponibilidade de `gen_random_uuid()`.
Não foi feita conexão a PostgreSQL/Supabase para validar ou aplicar o SQL.
Os testes locais verificam o contrato, com RPC simulada, e invariantes do texto
SQL. Não substituem um teste transacional em banco autorizado.

A tabela e funções são restritas a `service_role`; a aplicação verifica usuário,
vínculo ativo e produto antes de usá-las. Não há policies para acesso client.
Ausência das RPCs gera erro controlado antes de qualquer publicação Google.

## Semântica de retry

- Mesma clínica, tipo e chave com outro recurso/conteúdo: conflito.
- Sucesso já persistido: retorna o resultado, sem nova escrita externa.
- Falha definida: permite retry da mesma chave (exceto nonce OAuth consumido).
- Outra chave durante operação pendente/incerta no mesmo recurso: bloqueada.
- Timeout/5xx após início da escrita, crash ou sucesso externo sem confirmação
  da persistência: conserva pendente/incerto; não existe desbloqueio por TTL.
- OAuth consome seu nonce uma vez. Se falhar, iniciar novo consentimento em
  vez de reutilizar o código. Nenhum Bearer/refresh token é gravado no ledger.

## Reconciliação futura de resultados incertos

Uma operação pendente/incerta precisa de verificação externa autorizada do
recurso Google e do registro local. Só depois de comprovar o resultado é
possível registrar sucesso/evento ou uma falha definida. Nunca liberar uma
nova tentativa apenas pela idade do registro ou pela ausência de resposta do
browser. Não há script de desbloqueio automático nem rotina executada nesta
missão. O objetivo é impedir duplicação onde a API Google não oferece uma
transação conjunta com o banco local.

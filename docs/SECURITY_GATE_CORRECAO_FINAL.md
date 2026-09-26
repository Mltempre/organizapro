# Security Gate — correções locais para revisão

## Escopo

Correções comprovadas: exposição de credenciais Z-API no acesso direto e associação paciente/tenant em cobranças e tratamentos. Inclui no checkpoint as correções locais previamente autorizadas de Configurações/Casa e da resposta de replay de pedidos públicos. Nenhum push, merge, deploy ou aplicação de migration.

## Aplicação

- Configurações usa API autenticada, com vínculo ativo e produto OrganizaPro. A resposta tem allowlist, não inclui os tokens, e retorna somente o indicador `zapi_configurado`. Campos secretos vazios preservam os valores existentes; novas credenciais não são ecoadas.
- Casa lê o indicador seguro. `zapi_instance` permanece disponível como identificador de configuração.
- Cobranças e tratamentos validam `paciente_id` por ID e clínica autorizada antes de qualquer gravação. Tenant UUID é representado como texto canônico para comparação com pacientes. Ausente/null continua aceito; inválido, inexistente e outro tenant são rejeitados. Erro na consulta fecha a operação com 503.
- As rotas de transição atualizam apenas estado/datas/valores permitidos pelo domínio; não aceitam mudança de paciente ou tenant no UPDATE.
- A rota Z-API continua lendo credenciais com service_role e não copia resposta do provedor para o cliente. Teste com provedor simulado, sem WhatsApp real.

## Migration preparada, não executada

`supabase/migrations/20260926000001_security_gate_tokens_paciente_tenant.sql`

- Revoga privilégios de tabela e coluna de PUBLIC, anon e authenticated em clinica_config. Reatribui SELECT/INSERT/UPDATE ao authenticated somente nas colunas existentes diferentes dos dois tokens, sob RLS. Não concede automaticamente futuras colunas. DELETE/TRUNCATE/TRIGGER não são necessários pelos clientes e permanecem revogados.
- Verifica privilégios efetivos dos tokens e aborta se permissões herdadas permanecerem. Preserva explicitamente leitura/escrita server-side por service_role.
- Acrescenta colunas geradas text nas duas tabelas filhas e FKs compostas para pacientes(id, clinica_id), usando a chave única identificada nos metadados. Não modifica os tipos ou valores originais.
- Permite paciente_id NULL. Impede paciente inexistente ou de outro tenant e remoção/alteração do vínculo referenciado com NO ACTION.
- Valida as FKs na mesma transação. Inconsistência legada, chave única ausente, objeto conflitante ou privilégio residual aborta tudo; nenhum registro é apagado/corrigido automaticamente. Aplicação pode exigir locks e deve ser revisada antes do GO.
- A sintaxe e o desenho foram revisados; execução e eficácia real no PostgreSQL permanecem pendentes, pois não foi autorizada aplicação.

## Verificação local

- Regressões específicas de segurança, paciente/tenant, Casa e Z-API: 72 testes aprovados.
- Suíte completa em dois grupos compatíveis: 1.043 aprovados e 5 skips no ambiente Node padrão; 31 aprovados com `--conditions=react-server` nos dois arquivos GBP que exigem o marcador server-only. Total: 1.074 aprovados, zero falhas finais, 5 skips explícitos de integração real com Supabase.
- A configuração inicial do runner produziu falhas de carregamento de server-only; aplicar react-server a toda a suíte também conflitou com testes de interface. A execução final separada resolveu a configuração sem alterar esses testes.
- `npx tsc --noEmit --incremental false`: aprovado.
- `npm run lint`: zero erros, 25 avisos preexistentes fora dos arquivos modificados.
- `npm run build`: aprovado.
- `git diff --check`: aprovado.
- Credenciais sintéticas e provedor simulado: nenhum envio WhatsApp real. A migration não foi executada nem em Supabase nem em banco local; grants e FKs ainda exigem verificação após GO.

## Provas pendentes e estado

As definições de private.minhas_clinicas_ativas() e public.site_publico_por_slug_v2(text,text) não estão versionadas no repositório inspecionado. Não foram reconstruídas. Permanecem pendentes os predicados efetivos dependentes dessas funções, a origem de cada campo do RPC e a prova de ausência de segredos por esse caminho.

A migration protege acesso direto, não atesta funções/views executadas com privilégios do proprietário. O Supabase continua com os privilégios e constraints anteriores até aplicação autorizada. Não há afirmação de segurança global em produção.

Achados anteriores fora deste escopo permanecem registrados no gate original: oráculo de existência no treinamento e substituição de contato no replay de interesse público. Não foram alterados nesta etapa.

Estado: correções locais preparadas; gate global NÃO ENCERRADO, dependente da revisão/aplicação autorizada do SQL, verificação posterior e definições ausentes.

# Security Gate — encerramento documental do escopo corrigido

## Escopo

Correções comprovadas: exposição de credenciais Z-API no acesso direto e associação paciente/tenant em cobranças e tratamentos. Checkpoint local: `8899d14` (`8899d1472fb14b8e0653ec8c9f2cb6dfa0f9901a`). Inclui as correções locais previamente autorizadas de Configurações/Casa e da resposta de replay de pedidos públicos. Migration aplicada e verificação pós-migration aprovada, conforme confirmação explícita do responsável na retomada oficial de 27/09/2026. Nenhum SQL foi reexecutado neste fechamento documental; nenhum push, merge ou deploy foi realizado nesta etapa.

## Aplicação

- Configurações usa API autenticada, com vínculo ativo e produto OrganizaPro. A resposta tem allowlist, não inclui os tokens, e retorna somente o indicador `zapi_configurado`. Campos secretos vazios preservam os valores existentes; novas credenciais não são ecoadas.
- Casa lê o indicador seguro. `zapi_instance` permanece disponível como identificador de configuração.
- Cobranças e tratamentos validam `paciente_id` por ID e clínica autorizada antes de qualquer gravação. Tenant UUID é representado como texto canônico para comparação com pacientes. Ausente/null continua aceito; inválido, inexistente e outro tenant são rejeitados. Erro na consulta fecha a operação com 503.
- As rotas de transição atualizam apenas estado/datas/valores permitidos pelo domínio; não aceitam mudança de paciente ou tenant no UPDATE.
- A rota Z-API continua lendo credenciais com service_role e não copia resposta do provedor para o cliente. Teste com provedor simulado, sem WhatsApp real.

## Migration aplicada e verificação aprovada

`supabase/migrations/20260926000001_security_gate_tokens_paciente_tenant.sql`

- Revoga privilégios de tabela e coluna de PUBLIC, anon e authenticated em clinica_config. Reatribui SELECT/INSERT/UPDATE ao authenticated somente nas colunas existentes diferentes dos dois tokens, sob RLS. Não concede automaticamente futuras colunas. DELETE/TRUNCATE/TRIGGER não são necessários pelos clientes e permanecem revogados.
- Verifica privilégios efetivos dos tokens e aborta se permissões herdadas permanecerem. Preserva explicitamente leitura/escrita server-side por service_role.
- Acrescenta colunas geradas text nas duas tabelas filhas e FKs compostas para pacientes(id, clinica_id), usando a chave única identificada nos metadados. Não modifica os tipos ou valores originais.
- Permite paciente_id NULL. Impede paciente inexistente ou de outro tenant e remoção/alteração do vínculo referenciado com NO ACTION.
- Valida as FKs na mesma transação. Inconsistência legada, chave única ausente, objeto conflitante ou privilégio residual aborta tudo; nenhum registro é apagado/corrigido automaticamente.
- Aplicação no Supabase confirmada com `Success. No rows returned`, transação concluída com COMMIT sem erro. Verificação pós-migration executada e aprovada fora deste chat, conforme confirmação do responsável; não houve nova execução ou inspeção do banco neste fechamento.
- `anon` e `authenticated`: sem SELECT/INSERT/UPDATE em `clinica_config.zapi_token` e `clinica_config.zapi_client_token`.
- `service_role`: acesso necessário preservado.
- `cobrancas_paciente_tenant_fk` e `tratamentos_paciente_tenant_fk`: existentes e validadas (`true`).
- Colunas geradas `clinica_id_paciente_text`: existência confirmada em `cobrancas` e `tratamentos`.

## Verificação local

Resultados históricos associados ao checkpoint; não foram reexecutados neste fechamento e não validam o trabalho posterior não commitado do site Premium em `app/empresa/[slug]/`.

- Regressões específicas de segurança, paciente/tenant, Casa e Z-API: 72 testes aprovados.
- Suíte completa em dois grupos compatíveis: 1.043 aprovados e 5 skips no ambiente Node padrão; 31 aprovados com `--conditions=react-server` nos dois arquivos GBP que exigem o marcador server-only. Total: 1.074 aprovados, zero falhas finais, 5 skips explícitos de integração real com Supabase.
- A configuração inicial do runner produziu falhas de carregamento de server-only; aplicar react-server a toda a suíte também conflitou com testes de interface. A execução final separada resolveu a configuração sem alterar esses testes.
- `npx tsc --noEmit --incremental false`: aprovado.
- `npm run lint`: zero erros, 25 avisos preexistentes fora dos arquivos modificados.
- `npm run build`: aprovado.
- `git diff --check`: aprovado.
- Credenciais sintéticas e provedor simulado: nenhum envio WhatsApp real. A confirmação posterior de aplicação da migration e verificação de privilégios/FKs está registrada acima.

## Provas pendentes e estado

As definições de `private.minhas_clinicas_ativas()` e `public.site_publico_por_slug_v2()` (assinatura referenciada: `text,text`) não estão versionadas no repositório inspecionado. Permanecem explicitamente como lacunas documentais/não comprovadas. Não foram reconstruídas nem alteradas. Permanecem não comprovados os predicados efetivos dependentes dessas funções, a origem de cada campo do RPC e a ausência de segredos por esse caminho.

A migration protege acesso direto, não atesta funções/views executadas com privilégios do proprietário. Sua aplicação e a verificação posterior estão confirmadas no escopo acima. Não há afirmação de segurança global em produção.

Achados anteriores fora deste escopo, conforme `SECURITY-GATE-ORGANIZAPRO-V1.md` e `SECURITY-GATE-ORGANIZAPRO-V1-FINAL.md` do trabalho anterior:

- SG-04 — oráculo de existência no treinamento, classificado como baixo: reprodução local anterior em PUT/DELETE `/api/chatbot/treinamento`, sem sessão, com ID existente retornando 401 e inexistente retornando 404. Não retornou conteúdo e depende de UUID conhecido/candidato. Não há comprovação de correção nos registros consultados; não foi reproduzido novamente neste fechamento.
- SG-06 — substituição de contato no replay de interesse público, classificado como médio: evidência anterior de código em POST `/api/site-publico/interesse`, cujo upsert por `clinica_id,chave_idempotencia` regravava nome, telefone e evidência do novo body. Não retornava PII, somente ID. Não houve reprodução em banco real nem comprovação de correção nos registros consultados. Não confundir com a correção do replay de pedidos públicos incluída no checkpoint.

Esses registros históricos não constituem nova comprovação de risco reproduzível no estado atual nem foram considerados corrigidos ou formalmente aceitos. Nenhuma correção nova foi implementada. Qualquer intervenção exige primeiro demonstrar risco ainda reproduzível e obter novo GO.

Estado: Security Gate do escopo corrigido DOCUMENTALMENTE ENCERRADO, com base no checkpoint, nas verificações locais históricas e na confirmação do responsável sobre a aplicação e aprovação pós-migration. As duas funções permanecem como lacunas documentais e SG-04/SG-06 preservam os limites de evidência acima. Este encerramento não declara o gate global aprovado nem encerra essas pendências. O trabalho posterior do site Premium não integra esta validação.

# Correções locais dos seis P1 — contrato operacional

Base: 14d67a5ea4b68dc3b06f78c29cab4851146ae6a9. Sem SQL novo ou execução externa.

- Webhook sempre exige segredo. WEBHOOK_AUTH_OBSERVE_ONLY não dispensa autenticação. Eventos com efeitos exigem messageId/zaapId real; sem ID retornam 400. Classificação SIM/NÃO/NAO/IGNORAR preservada. Confirmar o campo do provedor na homologação.
- Cron, chatbot, webhook e adaptador comprovam clinicas.produto = organizapro antes dos efeitos do tenant. APIs de aprovação continuam exigindo usuário/vínculo ativo.
- IA resolve vínculo ativo único pelo usuário autenticado, sem aceitar tenant do corpo. Limites: 20.000 caracteres, 2.000 tokens de saída, 20 solicitações por usuário/hora e 100 por tenant/hora. Modelo, prompt de sistema e temperatura preservados. Cota indisponível fecha o gate.
- Adaptador verifica consentimento inclusive para serviço interno. Estado desconhecido conserva o contrato anterior; bloqueado ou erro de leitura impede envio. Cliente humano só pode executar o teste fixo já existente para o telefone salvo do próprio negócio; envio comercial passa pelas rotas de aprovação. Teste limitado a uma operação por hora.
- Chamadores internos fornecem operação derivada no servidor: recurso/dia nas aprovações/lembretes, agendamento na avaliação e ID do evento no webhook/chatbot. Chaves fornecidas pelo browser não burlam a reserva de recurso.
- eventos_dominio é append-only no banco: trigger BEFORE UPDATE/DELETE (schema compartilhado com o ClínicaFlow) rejeita qualquer alteração, inclusive via service role. Toda transição é um INSERT novo com PK determinística; nunca UPDATE/DELETE.
- Reserva: INSERT `seguranca.operacao` (estado `pendente`, ticket, hash do conteúdo) antes do efeito. PK `entidadeIdDeterministico("seguranca.p1", [clinica, chave])` é a exclusão mútua entre processos; a linha da reserva nunca muda depois de gravada.
- Resultado: INSERT `seguranca.operacao_resultado` com `entidade_id` = ID da reserva, PK `entidadeIdDeterministico("seguranca.p1.resultado", [clinica, reserva])`, chave `seguranca-resultado:<reserva>` e payload `{estado, ticket, hash}` (estado `sucesso`, `incerto` ou `rejeitado`). Um único resultado por reserva; em conflito (23505) só é aceito resultado da mesma reserva/ticket/hash/estado.
- Reserva sem resultado, ou com resultado `sucesso`/`incerto`, não permite novo envio. Rejeição comprovada ANTES do efeito, com o mesmo conteúdo, permite retry: nova tentativa por INSERT com PK `seguranca.p1.tentativa` [clinica, chave, n]; a tentativa 0 mantém o ID original (reservas existentes e dedup do webhook). Resposta de erro do provedor e timeout são conservadoramente incertos, não prova de ausência de entrega.
- Falha ao persistir resultado não vira sucesso (adaptador responde 502 sem liberar retry). Não apagar reservas; reconciliação autorizada é um INSERT do resultado no mesmo formato, nunca edição da reserva. Nenhum job de expiração ou reconciliação automática foi criado.
- Logs das quatro superfícies auditadas omitem payloads, textos, leads e erros upstream. Mantêm marcadores operacionais e status; logs persistidos omitem conteúdo da conversa. Registros de negócio/consentimento necessários permanecem separados desses diagnósticos.

## Dependências de preflight real

Homologado em produção em 2026-09-24: eventos_dominio aceita INSERT/SELECT server-side com PK UUID determinística e JSONB consultável; UPDATE é bloqueado pelo trigger append-only, por isso o fluxo não depende de UPDATE. A primeira versão finalizava por UPDATE e respondia 502 após envio entregue; corrigida no commit 37e8473, com a reserva do teste reconciliada por INSERT do resultado. Ciclo real validado: webhook autenticado → chatbot → /api/whatsapp 200 → reserva + resultado `sucesso` correlacionados. Continua pendente certificar remotamente RLS/grants que impeçam usuários/anon de adulterar reservas/cotas/consentimento. Se a persistência falhar, os gates bloqueiam os efeitos.

As reservas não prometem entrega exactly-once; priorizam evitar duplicação e deixam resultado desconhecido pendente de reconciliação. Falha de processo após reserva pode bloquear uma operação que ainda não saiu. Isso requer verificação operacional antes de qualquer retry.

## Evidência local

Regressões em tests/seguranca-seis-p1.test.mjs executam TypeScript real com loader restrito e banco/rede simulados. Cobrem bypass, produto, vínculo/cota, consentimento, aprovações, crons, replay, concorrência, erro de persistência, timeout, retry seguro e logs. Não acessam serviços reais. O fixture (tests/helpers/p1-fixture.mjs) espelha o trigger: UPDATE/DELETE em eventos_dominio falham. tests/seguranca-operacao-append-only.test.mjs cobre reserva, resultado, idempotência, conflito incompatível, bloqueio de duplicidade, retry por nova tentativa e ausência de UPDATE/DELETE. Os sete P2 e SQLs anteriores permanecem fora do escopo.

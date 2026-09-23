# Correções locais dos seis P1 — contrato operacional

Base: 14d67a5ea4b68dc3b06f78c29cab4851146ae6a9. Sem SQL novo ou execução externa.

- Webhook sempre exige segredo. WEBHOOK_AUTH_OBSERVE_ONLY não dispensa autenticação. Eventos com efeitos exigem messageId/zaapId real; sem ID retornam 400. Classificação SIM/NÃO/NAO/IGNORAR preservada. Confirmar o campo do provedor na homologação.
- Cron, chatbot, webhook e adaptador comprovam clinicas.produto = organizapro antes dos efeitos do tenant. APIs de aprovação continuam exigindo usuário/vínculo ativo.
- IA resolve vínculo ativo único pelo usuário autenticado, sem aceitar tenant do corpo. Limites: 20.000 caracteres, 2.000 tokens de saída, 20 solicitações por usuário/hora e 100 por tenant/hora. Modelo, prompt de sistema e temperatura preservados. Cota indisponível fecha o gate.
- Adaptador verifica consentimento inclusive para serviço interno. Estado desconhecido conserva o contrato anterior; bloqueado ou erro de leitura impede envio. Cliente humano só pode executar o teste fixo já existente para o telefone salvo do próprio negócio; envio comercial passa pelas rotas de aprovação. Teste limitado a uma operação por hora.
- Chamadores internos fornecem operação derivada no servidor: recurso/dia nas aprovações/lembretes, agendamento na avaliação e ID do evento no webhook/chatbot. Chaves fornecidas pelo browser não burlam a reserva de recurso.
- Reserva usa PK determinística em eventos_dominio: INSERT antes do efeito e UPDATE condicional por estado/ticket. Pendente/incerto/sucesso não permitem novo envio. Rejeição comprovada ANTES do efeito permite retry por compare-and-swap, com mesmo conteúdo. Resposta de erro do provedor e timeout são conservadoramente incertos, não prova de ausência de entrega.
- Falha ao persistir resultado não vira sucesso. Não apagar reservas para tentar novamente sem reconciliação autorizada. Nenhum job de expiração ou reconciliação automática foi criado.
- Logs das quatro superfícies auditadas omitem payloads, textos, leads e erros upstream. Mantêm marcadores operacionais e status; logs persistidos omitem conteúdo da conversa. Registros de negócio/consentimento necessários permanecem separados desses diagnósticos.

## Dependências de preflight real

Verificar que eventos_dominio possui PK UUID utilizável, tipos/colunas compatíveis, JSONB consultável e INSERT/UPDATE/SELECT server-side permitidos; comprovar que usuários/anon não podem adulterar reservas/cotas/consentimento. Confirmar RLS/grants/constraints instaladas. Nenhuma dessas condições foi certificada remotamente. Se a persistência falhar, os gates novos bloqueiam os efeitos.

As reservas não prometem entrega exactly-once; priorizam evitar duplicação e deixam resultado desconhecido pendente de reconciliação. Falha de processo após reserva pode bloquear uma operação que ainda não saiu. Isso requer verificação operacional antes de qualquer retry.

## Evidência local

Regressões em tests/seguranca-seis-p1.test.mjs executam TypeScript real com loader restrito e banco/rede simulados. Cobrem bypass, produto, vínculo/cota, consentimento, aprovações, crons, replay, concorrência, erro de persistência, timeout, retry seguro e logs. Não acessam serviços reais. Os sete P2 e SQLs anteriores permanecem fora do escopo.

# Gerente Comercial AI V1 — auditoria e coordenação local

Base auditada: `convergencia/final-organizapro-v1`, commit `1f4a030`.
Implementação isolada na branch `feature/gerente-comercial-ai-v1`.
Entrada: menu Inteligência → Copiloto, seção **Gerente Comercial AI** (`/copiloto#gerente-comercial`).

## EXISTE × FALTA

| Peça | Evidência no código existente | Lacuna / decisão desta V1 |
|---|---|---|
| Diretor Digital | `lib/ia-comercial.ts`, `app/components/DiretorDigitalCard.tsx` | Narração sobre sinais pronta; preservada, sem novo Diretor. |
| Central/Radar | `lib/recomendacoes.ts`, `lib/oportunidades-clientes.ts` | Detectam sinais e agrupam clientes. Preservados. |
| PMA / prioridades | `lib/nucleo-inteligente.ts`: `organizarSinaisCanonicos`, `gerarEstadoComercialCanonico`; consumo em `app/dashboard/page.tsx` | Ordem e deduplicação prontas; coordenador usa a mesma função. Nenhum score novo. |
| Sinal canônico | `SinalCanonico` no núcleo | Já contém motivo, evidência, ação, entidade, contexto, destino e destinoAcao. O Copiloto ignorava destinoAcao; corrigido. |
| Receita Perdida | `lib/receita-perdida.ts`: `agregarReceitaPerdida` | Valor existia separado dos sinais. Agora associado por origem + ID, nunca por nome/telefone. Sem soma nova. |
| Agenda Autônoma | `lib/agenda-autonoma.ts`, `app/agenda-autonoma/page.tsx` | Regra de reagendamento estava duplicada no Copiloto; substituída pela função existente. Casos existentes fornecem o destino operacional. |
| Orçamentos | `lib/motor-orcamentos.ts`, `app/orcamentos/page.tsx`, `app/api/orcamentos` | Reutilizados via Radar, Receita Perdida e destino operacional. |
| Oportunidade → Orçamento | `app/oportunidades/page.tsx`, `app/api/oportunidades/[id]/gerar-orcamento/route.ts` | Fluxo real disponível. Gerente encaminha à superfície existente. Canal/confiança fixos no Copiloto foram substituídos pelos campos da API. |
| Cobranças / Cobrador | `lib/motor-cobranca.ts`, `app/cobrancas/page.tsx`, `app/api/cobrancas/[id]/tentativa/route.ts` | Dono do fluxo preservado; o Gerente não cria tentativa nem envia cobrança. |
| Tratamentos | `lib/motor-tratamento.ts`, `app/tratamentos/page.tsx` | Sinal existente e valor estimado reutilizados. Estimativa rotulada explicitamente. |
| Follow-up | `lib/follow-up-comercial.ts`, `app/api/follow-up/tentativa/route.ts` | Fluxo governado existente, com revalidação e idempotência. Usado por destinoAcao. A tela não afirma que todo caso ainda não recebeu tentativa. |
| eventos_dominio | Rotas de tentativa/transição existentes; `app/api/follow-up/tentativa/route.ts` consulta chave diária e registra evento | Gerente é projeção de leitura; registro continua no módulo executor. Nenhuma tabela, evento ou persistência paralela. |
| Smart Commerce | Composição em `lib/oportunidades-clientes.ts`, motores de domínio e `tests/smart-commerce-canonico.test.mjs` | Contratos existentes consumidos. Núcleo, Radar, Diretor, Dashboard, APIs e migrations intocados. |
| Estados de carregamento | Copiloto já possuía loading/error/empty/success | Faltava considerar erros de clientes/agenda, impedir falso vazio e limpar snapshot anterior. Corrigido; falha da verificação de reagendamento bloqueia a recomendação. |

## Arquitetura reutilizada

APIs autenticadas e consultas existentes com `clinica_id` → Radar + adaptadores → sinais canônicos → `gerarEstadoComercialCanonico` → projeção `coordenarGerenteComercial` → seção existente do Copiloto.

A projeção cruza os itens da Receita Perdida e os casos da Agenda Autônoma já calculados. Não faz I/O, não decide elegibilidade, não modifica entradas e não registra ações. O vínculo econômico usa `(origem do sinal, entidadeId)`, impedindo que cobranças/orçamentos de mesmo cliente ou IDs coincidentes em domínios distintos sejam confundidos.

Cada item responde: atenção/prioridade, motivo/evidência, próxima ação, cliente/referência, impacto monetário conhecido ou impacto comercial sem valor informado, e destino da ação existente. `destinoAcao` tem precedência; consulta do domínio fica como botão separado apenas quando diferente.

Não há novo total monetário. Ausência, número inválido ou negativo não viram estimativa; zero válido permanece zero. Valor de tratamento mantém a identificação de estimativa e nunca é chamado de receita confirmada.

## Arquivos desta entrega

- `lib/gerente-comercial.ts`: projeção pura dos contratos existentes.
- `app/copiloto/page.tsx`: integração, proveniência real, delegação à Agenda e estados de falha.
- `tests/gerente-comercial.test.mjs`: nove testes de comportamento e integração de origem/destino.
- `docs/gerente-comercial-ai-v1.md`: auditoria, escopo e limites.

## Validação local

TypeScript completo: `node node_modules/typescript/bin/tsc --noEmit --incremental false`.

Build isolado dos módulos puros: `node node_modules/typescript/bin/tsc lib/gerente-comercial.ts lib/ia-comercial.ts lib/agenda-autonoma.ts lib/receita-perdida.ts lib/follow-up-comercial.ts --outDir ../gerente-test-build --module commonjs --target es2020 --esModuleInterop --skipLibCheck --strict`.

Definir `CONVERGENCIA_BUILD_DIR` como caminho absoluto desse build e executar `node --test` sobre:

- `tests/gerente-comercial.test.mjs`
- `tests/cerebro-comercial-canonico-v1.test.mjs`
- `tests/p1-2-gerente-comercial-copiloto.test.mjs`
- `tests/receita-perdida.test.mjs`
- `tests/agenda-autonoma.test.mjs`
- `tests/follow-up-comercial.test.mjs`
- `tests/smart-commerce-canonico.test.mjs`

Resultado: 100 testes aprovados, zero falhas. Inclui motores reais em memória, prioridade/deduplicação, isolamento de associação econômica por domínio/ID, destino governado, proveniência, ausência de valor, zero e Agenda Autônoma. Testes de wiring verificam o código da tela; não são testes de navegador autenticado.

Lint direcionado: `node node_modules/eslint/bin/eslint.js app/copiloto/page.tsx lib/gerente-comercial.ts`. A primeira execução identificou `prefer-const`, corrigido antes do checkpoint. Verificação final: lint e TypeScript completos sem erros; repetição das sete suítes com 100/100 aprovados; `git diff --check` sem erros de whitespace.

## Pendências e limites reais

- Homologação visual e ponta a ponta autenticada não executada: esta missão não acessou Supabase, OAuth ou WhatsApp reais. Build de produção não foi usado como substituto dessa homologação.
- Destinos preservam os contratos atuais: abrem listas operacionais, sem promessa de pré-seleção por ID. A referência e o cliente ficam visíveis no Gerente. Deep links exigem coordenação com os donos das telas.
- Recorte herdado do Copiloto: clientes sem próximo compromisso limitados a 20; cancelamentos a 50 nos últimos 30 dias; demais limites pertencem às APIs existentes. A V1 informa prioridades dos dados carregados, não cobertura global de toda a base.
- O Radar preserva um sinal principal por cliente e sua deduplicação existente. O Gerente não expande sinais secundários nem recalcula prioridade.
- Acompanhamentos exibem necessidades detectadas; o Gerente não reconstrói histórico de tentativas. Revalidação e bloqueio de duplicidade em `eventos_dominio` continuam no executor existente.
- A seção administrativa antiga de atrasos filtra datas anteriores em uma consulta restrita a hoje; esse achado não foi expandido para mudança de escopo de agenda nesta missão.
- Integração com alterações simultâneas do CAPITÃO deverá ocorrer depois. Esta branch parte do checkpoint local auditado; não importa nem modifica seu trabalho em andamento.

## Restrições respeitadas

Somente operações locais de arquivos, Git e testes. Sem push, merge remoto, deploy, migration, consulta a Supabase real, OAuth, envio WhatsApp ou alteração de segredos. Dependências locais preexistentes reutilizadas por junction; nenhuma instalação ou cópia de `.env`.

# Dashboard/Casa final — entrega local

Data: 23/09/2026. Branch: `feature/casa-final-v1`. Base: `0700ae9`.

A Casa autenticada passou a mostrar prioridades, dinheiro, agenda e comercial/presença em quatro seções. Reutiliza os motores e dados existentes. Não adiciona funcionalidade comercial, integração externa ou migration.

## 1. Inventário anterior e decisão

O inventário corresponde ao Dashboard da base deste checkout, não a todas as branches ainda não integradas. “Funciona” abaixo significa ligação encontrada no código; não significa homologação externa.

| Elemento anterior | Fonte e funcionamento encontrado | Destino/ação | Duplicação, valor e decisão |
|---|---|---|---|
| Boas-vindas | `WelcomeModal`: checklist fixo e controle de exibição no localStorage; não comprova implantação | Fechar modal | REMOVER DA CASA: progresso ilustrativo sem informação operacional |
| Cabeçalho, pulso, ocupação | Configuração, agenda e `gerarInsights`; saudação com personalização desativada | Sem CTA próprio | SIMPLIFICAR: nome registrado, data em São Paulo e orientação curta; retirar pulso genérico |
| Novo cliente/agendamento | Botões rápidos; consumidores de `novo=1` nas páginas de destino | `/clientes?novo=1`, `/agendamentos?novo=1` | MANTER: ações reais de cadastro |
| Atalhos Orçamentos/Reputação | Navegação para módulos existentes | `/orcamentos`, `/reputacao` | FUNDIR nas seções correspondentes |
| Atalhos WhatsApp/Relatórios | Rótulos apontavam para chatbot e métricas | `/chatbot`, `/metricas` | REMOVER DA CASA: não são prioridades executivas; páginas preservadas |
| Onboarding | Configuração, existência de clientes/agendamentos e localStorage; verificação de credenciais não comprova WhatsApp operacional | `/configuracoes`, `/clientes`, `/agendamentos`; recolher/fechar | SIMPLIFICAR: aviso de cadastro de contato incompleto e atalhos de criação |
| Recursos incluídos | Lista constante, sem consulta de disponibilidade operacional | Nenhuma ação | REMOVER DA CASA: decorativo |
| Consultoria do dia | `gerarIdeia`: regras e sugestões genéricas, incluindo tempo/impacto sem medição | Clientes, configuração ou agenda | REMOVER DA CASA: compete com prioridades reais |
| Diretor/Missão do Dia/PMA | `gerarEstadoComercialCanonico`, narrativa de `ia-comercial`, três sinais e contagem por prioridade | Destinos dos sinais | FUNDIR: recomendação, motivo, evidência e ação na lista única; nomes da arquitetura deixam a Casa |
| Faixa Oportunidades | Quantidade produzida pelo Radar | `/copiloto` | FUNDIR: repetia Radar e Diretor; manter acesso ao acompanhamento |
| Faixa Orçamentos parados | Todos os orçamentos apresentados, não apenas os efetivamente parados | `/orcamentos` | CORRIGIR: “aguardando resposta”; risco continua usando predicado do motor |
| Faixa A receber | Contagem de cobranças abertas, apesar do rótulo financeiro | `/cobrancas` | CORRIGIR/FUNDIR: valor monetário identificado como cobranças |
| Faixa Agenda hoje/Avaliações aguardando | Agenda e solicitações ainda sem resposta | `/agendamentos`, `/reputacao` | FUNDIR em Agenda e Comercial/presença |
| Radar resumido | `gerarOportunidadesClientes`, três oportunidades e resumo | Destinos por domínio; ver todas em `/copiloto` | FUNDIR: sinais já presentes na projeção canônica |
| Central completa | `gerarCentralOportunidades`, adaptadores e estado canônico | Destinos de cada recomendação | FUNDIR: três prioridades iniciais e demais recolhidas, sem repetir o topo |
| Dinheiro/Caixa | `calcularIndicadoresCobranca`: recebido, aberto, atraso e recuperado | `/cobrancas` | SIMPLIFICAR: recebido/aberto/atraso; profundidade em Financeiro; recuperado continua no módulo existente |
| OrganizaPro trabalhando | `/api/atividade-recente`, `eventos_dominio`, contagens por tipo | Sem ação operacional por registro | REMOVER DA CASA: atividade técnica ocupa espaço; API e componente preservados |
| Agenda futura, lembretes e objetivos antigos | Já não eram renderizados no Dashboard da base | Agenda pela navegação existente | Não ressuscitados; parte dos dados continua alimentando recomendações |
| Navegação lateral persistente | `AdminShellFrame` no layout compartilhado | Rotas dos módulos | MANTER; não reescrever o mecanismo já existente |

## 2. Capacidades reais e limites da base

- Central/Radar, PMA e Diretor: `lib/recomendacoes.ts`, `lib/oportunidades-clientes.ts`, `lib/nucleo-inteligente.ts`, `lib/ia-comercial.ts`. Reutilizados os adaptadores e a ordenação; nenhuma regra comercial duplicada.
- Smart Commerce: sinais de demanda, orçamento, cobrança, tratamento, pedido e recompra já alimentam a Casa. Não foi criado outro motor.
- Receita Perdida: `lib/receita-perdida.ts`; agregado com os mesmos registros carregados, sem consulta adicional. Valores separados por origem, sem somar categorias potencialmente sobrepostas e sem transformar risco em receita.
- Agenda Autônoma: clientes sem próximo compromisso e cancelamentos sem reagendamento permanecem nos sinais existentes.
- Orçamentos, tratamentos, cobranças e pedidos: APIs existentes; Financeiro, Previsor e Linha Econômica têm páginas/motores próprios.
- Pesquisa de Preços, Google Presença e Reputação: capacidades existentes mantidas nos respectivos módulos. Avaliações na Casa são solicitações sem resposta; não representam a nota pública ou prova de conexão do Google.
- Gerente Comercial e Ads/Atribuição: checkpoints separados constam no histórico da missão anterior; não estão incorporados nesta base. Não houve integração nem alegação de homologação Meta/Google.
- Memória/proveniência/auditoria: preservadas como camadas internas, sem novo card. Funcionário Digital não recebeu módulo artificial. Revenue Hub não foi ressuscitado.
- Contador IA: nenhum arquivo alterado. Esta branch parte de `0700ae9`; o checkpoint posterior do Contador deve ser conciliado no gate de integração autorizado, fora desta missão.
- Site, chatbot/WhatsApp e métricas continuam disponíveis na navegação existente. Nenhum card foi adicionado só para representar o nome de um módulo.

## 3. Duplicações eliminadas e estrutura final

Diretor, Radar e Central repetiam fatos derivados dos mesmos registros. A Casa usa uma única lista ordenada pelo motor canônico: três prioridades visíveis e as restantes em uma expansão. O Copiloto não cobre toda a Central, por isso o link é “Acompanhar clientes”, e não “Ver todas as prioridades”.

Estrutura final:

1. Nome da empresa e data; Novo cliente e Novo agendamento.
2. Precisa da sua atenção: motivo, evidência, contexto do cliente, próxima ação e destino.
3. Dinheiro: recebido no mês, a receber e atraso das cobranças; valores em risco por categoria; acesso ao Financeiro, Receita Perdida e Previsor.
4. Agenda de hoje: três registros, confirmação e acesso ao histórico pendente.
5. Comercial e presença: orçamentos aguardando resposta, pedidos, interesses recebidos, avaliações solicitadas e acesso ao Google.

Agenda e Comercial/presença ficam lado a lado em desktop e empilhados em mobile. O rodapé só solicita completar o cadastro quando os dados de contato estão incompletos.

## 4. Bugs corrigidos

- Falhas HTTP, rede e contratos de lista inválidos não viram zero ou ausência de oportunidades.
- Erros das consultas diretas e da verificação de reagendamentos impedem o resumo enganoso.
- Falta de tenant mostra falha explícita sem consultar dados de negócio. Falta de usuário/sessão redireciona para login.
- “Tentar novamente” recarrega e limpa o erro após recuperação.
- A ação de prioridade usa `destinoAcao` quando existe, respeitando o fluxo de acompanhamento recomendado.
- Orçamentos apresentados não são todos chamados de parados. Os valores em risco usam o predicado existente de Receita Perdida.
- “A receber” apresenta dinheiro, não quantidade de registros. A UI informa que atraso já integra o aberto.
- Cancelamentos e faltas não aparecem como compromissos ativos do dia.
- Data do cabeçalho usa o mesmo fuso de São Paulo das consultas.

## 5. Botões e destinos

| Controle | Destino/comportamento validado localmente |
|---|---|
| Novo cliente / Novo agendamento | `novo=1`, com consumidores existentes que abrem os modais reais |
| Acompanhar clientes | `/copiloto` |
| Ação por prioridade | `destinoAcao` tem precedência; fallback para `destino`; sem botão se não há destino |
| Outras prioridades | Elemento HTML `details/summary`; expansão/recolhimento comprovados na QA local |
| Abrir financeiro / cobranças no vazio | `/financeiro`, `/cobrancas` |
| Valores em risco / previsão | `/receita-perdida`, `/previsor-faturamento` |
| Abrir agenda / pendências anteriores | `/agendamentos`, `/agendamentos?filtro=historico` |
| Orçamentos / Pedidos / Interesses | `/orcamentos`, `/pedidos`, `/oportunidades` |
| Avaliações / Google | `/reputacao`, `/google-presenca` |
| Completar dados | `/configuracoes` |
| Tentar novamente | Callback real de carregamento; falha seguida de sucesso testada |

Os links usam `next/link`; o shell persistente não foi modificado. Verificação de rota e consumidores no código não equivale a teste ponta a ponta autenticado de cada módulo, que permanece para homologação.

## 6. Testes e evidências

- 237 testes selecionados aprovados, zero falhas, zero ignorados. Incluem 33 testes comportamentais novos da Casa e regressões de navegação, tenant, prioridades canônicas, Agenda Autônoma, Receita Perdida e Financeiro.
- TypeScript completo: `tsc --noEmit --incremental false`, aprovado.
- ESLint dos arquivos alterados de TSX e testes, aprovado. A exceção local de `no-require-imports` nos dois arquivos CommonJS documenta o harness que transpila TSX sem build da aplicação.
- `git diff --check`, aprovado.
- QA visual local em 1440, 375 e 320 px; largura de rolagem igual à viewport, sem overflow horizontal. Estado vazio em 375 px e expansão/recolhimento verificados. Capturas desktop/mobile inspecionadas visualmente.
- Capturas usam fixtures explicitamente identificadas como teste, apenas no harness local; nenhum mock é servido pela Casa autenticada. A QA renderiza o conteúdo da Casa fora do shell real. Não comprova layout autenticado completo, hidratação Next ou integrações externas.
- Houve dois erros intermediários de execução por ausência de `CONVERGENCIA_BUILD_DIR`; o diretório foi compilado, a variável configurada e a bateria final passou.
- Nenhum build pesado de produção ou instalação de dependências.

## 7. Arquivos do checkpoint

- `app/dashboard/page.tsx`: carga com erro explícito e composição dos motores na apresentação final.
- `app/components/CasaDashboard.tsx`: conteúdo executivo autenticado.
- `app/components/CasaDashboard.module.css`: apresentação responsiva e foco visível.
- `tests/casa-final.test.cjs`: comportamento, erros, tenant, valores e ações.
- `tests/helpers/casa-harness.cjs`: transporte isolado e execução local da página/motores.
- `tests/dashboard-casa-premium.test.mjs`, `tests/convergencia-amarelos-orfaos.test.mjs`, `tests/correcao-ultima-milha-v2.test.mjs`: expectativas de apresentação atualizadas, preservando cobertura das capacidades.
- `docs/casa-final-v1-entrega.md`: este relatório.

## 8. Pendências e limites reais

- Integração com as demais branches e homologação autenticada completa ainda necessárias; nenhuma promessa de produto inteiro finalizado.
- A indisponibilidade de qualquer fonte comercial bloqueia todo o resumo. Decisão conservadora para evitar apresentar valores parciais como completos.
- Limites de amostragem preexistentes continuam: até 20 pendências históricas/clientes sem próximo compromisso e 50 cancelamentos recentes. A Casa não é um inventário ilimitado de todos os registros.
- Alguns destinos canônicos abrem a lista do módulo em vez de um registro específico; foram respeitados os contratos existentes, sem inventar filtros sem consumidor.
- Valores recebidos se restringem às cobranças registradas; não são uma afirmação sobre toda a receita da empresa.
- A demonstração conserva `DashboardView` e sua apresentação anterior. A Casa autenticada recebe somente fontes autenticadas e usa `CasaDashboard`. A divergência visual da demo é uma pendência de apresentação fora do escopo.
- Contador IA e checkpoints Gerente Comercial/Ads não foram integrados nem alterados.
- Sem push, merge remoto, deploy, migration, Supabase real, WhatsApp real, OAuth ou alteração de segredos.

## 9. Checkpoint

O SHA e o status final são registrados no relatório de saída após o commit, evitando referência circular no arquivo versionado. Commit restrito aos nove arquivos acima.

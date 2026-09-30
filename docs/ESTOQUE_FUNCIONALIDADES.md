# Estoque técnico de funcionalidades — OrganizaPro

Mapa do que **já existe no código** mas **não faz parte da experiência atual do
cliente** (Visão Geral real, menu e fluxos ativos). Serve para não perder o que
foi construído. Estoque não é feature: nada aqui está ativo por causa deste
documento, e nada foi movido, apagado ou religado para produzi-lo.

- Base do inventário: commit `be6df9e` (branch `convergencia/final-organizapro-v1`).
- Método: importações reais no código (`app/`, `lib/`), rotas do menu
  (`app/components/AdminShellFrame.tsx`) e chamadas de API a partir das telas.
- A Visão Geral real (`/dashboard`) renderiza **somente** `CasaDashboard`.
  `DashboardView` é importado por ela e por `app/dashboard/page.tsx` apenas
  como **tipo** (`import type`); quem o renderiza é `/dashboard-demo`.

## Legenda de estado

| Estado | Significado |
|---|---|
| **DEMO** | Renderizado hoje apenas em `/dashboard-demo` (dados fictícios, fora do menu). |
| **CÓDIGO SEM USO** | Existe e compila, mas nenhuma tela/rota o importa ou chama. |
| **PARCIAL** | Backend/rota pronto, mas sem tela que o use, ou superfície retirada do menu por não estar pronta para demonstração. |
| **PRONTO (fora do menu)** | Tela + API + testes, funcional, apenas fora do menu. |

## Resumo

| # | Item | Estado | Onde está preservado |
|---|---|---|---|
| 1 | Painel Executivo (DashboardView) | DEMO | `app/components/DashboardView.tsx` |
| 2 | Diretor Digital · Missão do Dia (bloco B) | DEMO | `app/components/MissaoDoDiaCard.tsx` |
| 3 | Faixa Executiva | DEMO | `app/components/FaixaExecutiva.tsx` |
| 4 | Radar de Oportunidades | DEMO | `app/components/RadarDeOportunidades.tsx` |
| 5 | Central de Oportunidades | DEMO | `app/components/CentralDeOportunidades.tsx` |
| 6 | Dinheiro / Caixa (card) | DEMO | `app/components/DinheiroCard.tsx` |
| 7 | OrganizaPro trabalhando | DEMO (card) + PARCIAL (API) | `app/components/OrganizaProTrabalhandoCard.tsx`, `app/api/atividade-recente/route.ts`, `lib/organizapro-trabalhando.ts` |
| 8 | Onboarding (checklist) e Boas-vindas | DEMO | `app/components/onboarding/*` |
| 9 | Motor de IA Comercial (narrativa/recomendações consultivas) | DEMO | `lib/ia-comercial.ts` |
| 10 | Cenário de demonstração | DEMO | `lib/dados-demonstracao.ts`, `app/dashboard-demo/page.tsx` |
| 11 | Diretor Digital · "O que fazer agora" (card) | CÓDIGO SEM USO | `app/components/DiretorDigitalCard.tsx` |
| 12 | Indicadores Executivos | CÓDIGO SEM USO | `app/components/IndicadoresExecutivos.tsx` |
| 13 | Próxima Melhor Ação ("Agora / O que precisa de você") | CÓDIGO SEM USO | `app/components/ProximaMelhorAcao.tsx` + `gerarProximasAcoes` em `DashboardView.tsx` |
| 14 | Resumo IA (frase de ocupação do dia) | CÓDIGO SEM USO | `gerarResumoIA` em `app/components/DashboardView.tsx` |
| 15 | IA Universal (Camada 1 + módulos por segmento) | CÓDIGO SEM USO | `lib/ia-universal/*` |
| 16 | Google Presença · locais, métricas e posts | PARCIAL | `app/api/google-business-profile/{locations,metricas,posts}/route.ts` |
| 17 | Consentimento WhatsApp manual (API) | PARCIAL | `app/api/whatsapp/consentimento/route.ts` |
| 18 | NotaFácil | PARCIAL (fora do menu) | `app/notafacil/`, `app/api/notafacil/`, `lib/notafacil-inteligente.ts` |
| 19 | Fechamento Contábil | PRONTO (fora do menu) | `app/fechamento-contabil/`, `app/api/fechamento/**`, `lib/fechamento-*.ts` |

**Total: 19 itens.**

## Detalhe por item

### 1. Painel Executivo (DashboardView) — DEMO
- **Faz:** superfície completa da antiga Casa (saudação, Diretor Digital, Faixa
  Executiva, Radar, Central, Dinheiro, OrganizaPro trabalhando, onboarding).
- **Dependências:** itens 2–8; helpers `gerarIdeia`, `gerarInsights`,
  `gerarSaudacaoCard` (usados pela demo).
- **Uso hoje:** só `/dashboard-demo` (título "Painel Executivo — Demonstração").
- **Recuperar:** renderizar `DashboardView` com as mesmas props que a demo monta,
  alimentadas pelos dados reais que `app/dashboard/page.tsx` já carrega.
- **Risco:** reintroduz as duplicidades eliminadas no `be6df9e` (mesmo fato em
  Missão do Dia, Radar e Central). Não religar sem revisar isso.

### 2. Diretor Digital · Missão do Dia — DEMO
- **Faz:** narrativa + top 3 sinais canônicos + contagem por prioridade.
- **Dependências:** `lib/nucleo-inteligente.ts` (`gerarEstadoComercialCanonico`),
  `lib/ia-comercial.ts` (narrativa), `estilos-prioridade`.
- **Uso hoje:** só via `DashboardView` (demo).
- **Recuperar:** passar `missaoDoDia` (já calculada em `app/dashboard/page.tsx`)
  e uma narrativa de `gerarNarrativaDiretor`.
- **Risco:** mesmo conteúdo de "Precisa da sua atenção" (Visão Geral real) e do
  Gerente Comercial — seria a mesma lista com outro nome.

### 3. Faixa Executiva — DEMO
- **Faz:** faixa de contagens (oportunidades, orçamentos parados, cobranças
  abertas, compromissos hoje, avaliações), "—" quando não há dado.
- **Dependências:** números já calculados; `estilos-prioridade`.
- **Uso hoje:** só via `DashboardView` (demo). Absorveu o antigo item 12.
- **Recuperar:** passar as contagens que a página real já tem.
- **Risco:** repete números já mostrados nos blocos Agenda/Comercial da Casa.

### 4. Radar de Oportunidades — DEMO
- **Faz:** um card por cliente com o motivo principal (antes chamado "Agenda
  Autônoma de Receita").
- **Dependências:** `lib/oportunidades-clientes.ts` (`gerarOportunidadesClientes`).
- **Uso hoje:** só via `DashboardView` (demo). O motor é usado de verdade pela
  Visão Geral, Gerente e Agenda Autônoma.
- **Recuperar:** passar a lista `oportunidadesClientes` já calculada na página real.
- **Risco:** mesma lista que alimenta "Precisa da sua atenção" (filtrada a
  itens com cliente).

### 5. Central de Oportunidades — DEMO
- **Faz:** todas as ações agrupadas por urgência (alta/média/baixa).
- **Dependências:** `lib/recomendacoes.ts` / estado canônico
  (`adaptarCentralCanonicaParaLegado`).
- **Uso hoje:** só via `DashboardView` (demo).
- **Recuperar:** passar `estadoComercial.central` da página real.
- **Risco:** é o quadro completo que o Gerente Comercial (`/copiloto`) já mostra.

### 6. Dinheiro / Caixa (card) — DEMO
- **Faz:** indicadores de cobrança (`calcularIndicadoresCobranca`).
- **Uso hoje:** só via `DashboardView` (demo). A Visão Geral real tem sua própria
  seção Dinheiro em `CasaDashboard`, com o mesmo motor.
- **Recuperar:** não necessário enquanto a seção da Casa existir.
- **Risco:** duplicaria a seção Dinheiro da Casa.

### 7. OrganizaPro trabalhando — DEMO (card) + PARCIAL (API)
- **Faz:** contagem real das ações executadas pelo sistema nos últimos 7 dias, a
  partir de `eventos_dominio` (sem ROI inventado).
- **Dependências:** `lib/organizapro-trabalhando.ts`; API autenticada
  `GET /api/atividade-recente` (`autorizarUsuarioNaClinica`, fail-closed).
- **Uso hoje:** card só na demo; a API não é chamada por nenhuma tela (a Casa
  real tem teste garantindo que não a chama).
- **Recuperar:** buscar `/api/atividade-recente?clinica_id=` e passar os itens ao card.
- **Risco:** nenhum conhecido; teste `tests/organizapro-trabalhando*`.

### 8. Onboarding (checklist) e Boas-vindas — DEMO
- **Faz:** checklist de primeiros passos (empresa, WhatsApp, cliente,
  compromisso) com barra de progresso; modal de boas-vindas.
- **Onde:** `app/components/onboarding/OnboardingCard.tsx`, `ChecklistItem.tsx`,
  `ProgressBar.tsx`, `WelcomeModal.tsx`.
- **Uso hoje:** só via `DashboardView`. A Casa real mostra apenas o aviso
  "cadastro incompleto".
- **Recuperar:** renderizar `OnboardingCard` com o objeto `onboarding` que a
  página real já monta.
- **Risco:** sobrepõe o aviso de cadastro da Casa e a recomendação "perfil incompleto".

### 9. Motor de IA Comercial — DEMO
- **Faz:** `gerarNarrativaDiretor`, `gerarRecomendacoesConsultivas`,
  `gerarMensagemDadosInsuficientes` — regras determinísticas, sem IA generativa.
- **Uso hoje:** `app/dashboard-demo/page.tsx` e o card sem uso do item 11.
  Referenciado em testes do Gerente Comercial.
- **Recuperar:** importar as funções; entrada é o contexto do negócio já calculado.
- **Risco:** o nome "IA" exige cuidado comercial (não é modelo generativo).

### 10. Cenário de demonstração — DEMO
- **Faz:** dados fictícios coerentes para `/dashboard-demo`.
- **Uso hoje:** só a demo (fora do menu, com shell; `ROTAS_COM_SHELL`).
- **Recuperar:** já acessível em `/dashboard-demo`.
- **Risco:** nenhum para o produto real (não lê nem grava dados de negócio).

### 11. Diretor Digital · "O que fazer agora" — CÓDIGO SEM USO
- **Faz:** apresenta narrativa + recomendações consultivas do item 9.
- **Uso hoje:** nenhum import.
- **Recuperar:** importar e passar `gerarNarrativaDiretor` +
  `gerarRecomendacoesConsultivas`.
- **Risco:** mesma função do item 2 (substituído por ele).

### 12. Indicadores Executivos — CÓDIGO SEM USO
- **Faz:** segunda faixa de números do dia.
- **Uso hoje:** nenhum; foi absorvido pela Faixa Executiva (item 3), conforme o
  próprio comentário do componente.
- **Recuperar:** preferir o item 3.
- **Risco:** duplicaria o item 3.

### 13. Próxima Melhor Ação — CÓDIGO SEM USO
- **Faz:** card em destaque + até 4 ações ("Agora / O que precisa de você").
- **Uso hoje:** o componente não é renderizado; só o tipo `AcaoPrioritaria` é
  importado por `DashboardView`. `gerarProximasAcoes` é definido e exportado,
  mas não é chamado.
- **Recuperar:** chamar `gerarProximasAcoes` e renderizar o componente.
- **Risco:** mesma função de "Precisa da sua atenção" / Missão do Dia.

### 14. Resumo IA — CÓDIGO SEM USO
- **Faz:** frase de ocupação do dia (`gerarResumoIA` em `DashboardView.tsx`).
- **Uso hoje:** definido e exportado, nunca chamado.
- **Recuperar:** chamar com `{ ocupacaoPct, horariosVagosHoje, pendentes }`.
- **Risco:** o nome sugere IA generativa; é texto determinístico.

### 15. IA Universal — CÓDIGO SEM USO
- **Faz:** Camada 1 universal + módulos por segmento para o chatbot
  (`camada1-universal.ts`, `modulos-segmento.ts`, `tipos.ts`, `index.ts`).
- **Uso hoje:** só importações internas da pasta; `index.ts` não é importado
  por nenhuma tela/rota. O chatbot (`app/api/chatbot/message/route.ts`) apenas
  cita a pasta em comentários ("nunca os substitui nesta fase").
- **Documentação:** `docs/ia-universal-organizapro-v1-arquitetura.md` e
  `docs/ia-universal-segmento-*.md`.
- **Recuperar:** plugar no motor do chatbot — exige missão própria na pista
  WhatsApp/Chatbot (homologada; não mexer sem GO).
- **Risco:** alto se ligado sem homologação (muda respostas reais do WhatsApp).
  Sem testes próprios.

### 16. Google Presença · locais, métricas e posts — PARCIAL
- **Faz:** `GET locations`, `GET metricas`, `POST posts` via
  `lib/google-business-profile-handlers.ts` (mesma autorização por negócio).
- **Uso hoje:** a tela `/google-presenca` usa status, avaliações, rascunho,
  publicação e OAuth; nenhuma tela chama estas três rotas.
- **Recuperar:** adicionar as chamadas na tela de Google Presença.
- **Risco:** depende de conexão Google ativa e das cotas da API do Google
  (há teste de diagnóstico 429). Testes: `tests/google-business-profile*`.

### 17. Consentimento WhatsApp manual (API) — PARCIAL
- **Faz:** consultar/definir consentimento de envio por contato
  (`GET`/`POST /api/whatsapp/consentimento`, autenticado).
- **Uso hoje:** nenhuma tela chama; o opt-out automático é gravado pelo webhook.
- **Recuperar:** tela de contato com o status de consentimento.
- **Risco:** pista WhatsApp homologada — não mexer sem GO.

### 18. NotaFácil — PARCIAL (fora do menu)
- **Faz:** tela `/notafacil` + `GET /api/notafacil` + `lib/notafacil-inteligente.ts`.
- **Uso hoje:** rota com shell (`navForaDoMenuPreVenda`), fora do menu. O
  comentário do menu registra: "superfícies reais, mas ainda sem dados/fluxo
  prontos para demonstração".
- **Recuperar:** mover o item de `navForaDoMenuPreVenda` para `navGrupos` em
  `AdminShellFrame.tsx`.
- **Risco:** exposição comercial antes de o fluxo estar pronto. Testes:
  `tests/notafacil-inteligente*`.

### 19. Fechamento Contábil — PRONTO (fora do menu)
- **Faz:** checklist de documentos por competência, upload, confirmação,
  exceções, tipos de documento e cobrança associada.
- **Uso hoje:** fora do menu (`navForaDoMenuPreVenda`), mas acessível pelo card
  "Fechamento contábil" da Visão Geral quando o negócio tem a vertical
  configurada. APIs autenticadas por negócio (provado no teste A↔B).
- **Recuperar:** mesmo procedimento do item 18.
- **Risco:** vertical específica (contabilidade); testes
  `tests/fechamento-contabil*`.

## Nomes que NÃO existem no código

Não são funcionalidades em estoque — não há componente, rota nem texto
visível com estes nomes: **Foco do Dia**, **Próximos 7 dias**, **Lembretes**
(os três saíram da demo, conforme comentário em `app/dashboard-demo/page.tsx`),
**Objetivos**, **Motor de Prioridades**, **Diretor Geral**.

## Regras para usar este estoque

1. Religar um item é uma missão própria: GO, testes e revisão de duplicidade
   com a Visão Geral atual (`CasaDashboard`) e o Gerente Comercial.
2. Itens das pistas WhatsApp/Chatbot (15, 17) só com GO dessa pista.
3. Não apagar itens deste estoque sem decisão explícita; se algo for removido,
   atualizar este documento no mesmo commit.

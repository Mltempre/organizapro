# Ads Meta/Google + Atribuição V1 — entrega local

## Estado e base

V1 local de captura, vínculo e relatório de atribuição concluída para homologação. Integrações oficiais Meta Ads/Google Ads estão **preparadas por contrato**, não conectadas nem implementadas como adaptadores de rede. Não existe compra de mídia, publicação ou envio externo de conversão nesta entrega.

Branch isolada: `feature/ads-atribuicao-v1`, criada de `6bc2fd5` (Gerente Comercial), sobre a convergência `1f4a030`. O trabalho simultâneo do CAPITÃO não foi importado nem alterado.

## 1. EXISTE × FALTA antes da implementação

| Peça auditada | EXISTE | FALTA encontrado / tratamento |
|---|---|---|
| Google Ads / Meta Ads | `lib/atribuicao-origem.ts`: UTM, GCLID, FBCLID, classificação, CAC/ROAS null-safe | Não havia conector oficial nem contrato explícito de conexão/conversão. Criados contratos internos, sem OAuth/rede. |
| Campanha / anúncio | `utm_campaign`, `utm_content` na captura | Relatório anterior agrupava apenas classificação. Agora exibe campanha/anúncio e guarda IDs opcionais; não deduz ID a partir do nome. |
| Lead / origem | Captura server-side no site e `lib/origem-persistencia.ts` | Visita era confundível com lead. Agora captura e contato vinculado são contagens diferentes. |
| origem_captacoes | Tabela já proposta em `20260920000002_origem_captacoes_atribuicao_v1.sql`, vínculo por código com paciente | Reutilizada. Só adicionada coluna JSON de identificadores e endurecimento de leitura/vínculo de paciente. |
| eventos_dominio | Eventos e chave única `(clinica_id,chave_idempotencia)` já canônicos | Novo tipo `atribuicao.vinculo` dentro da estrutura existente; nenhuma tabela paralela de eventos. |
| Atribuição | `832faf6` criou relatório/tela/API P1.3 | Soma anterior por paciente não provava qual pagamento pertencia à campanha e podia contar novamente a mesma receita por captura. Substituída na tela por vínculo por entidade/pagamento. |
| Google Business Profile / Presença | Domínio próprio, contratos e UI existentes | Intocado. GBP não virou Google Ads. |
| Conversão / resultado econômico | `lib/linha-economica.ts` reconhece pagamentos e trilha oportunidade→orçamento→tratamento→cobrança | Relatório agora enriquece essa trilha com origem; não cria outro reconhecedor de receita. |
| Oportunidades | Interesse público e vínculo real `orcamento_vinculado_id` | Código de origem ainda não acompanhava formulário de interesse. Agora registra vínculo após sucesso da criação. |
| Clientes / agenda | `pacientes`, `agendamentos`; `paciente_vinculado_id` e `agendamento_vinculado_id` na oportunidade | FKs existentes são aproveitadas quando preenchidas. Na ausência, não usa nome/telefone para inferir vínculo; operador pode registrar evidência explícita. |
| Pedidos | Pedido público e painel já existentes | Código de origem agora acompanha formulário, criação e replay; pagamento continua reconhecido pelo motor existente. |
| Orçamentos / tratamentos | FKs e estados reais | Consumidos sem modificação. Aprovação/valor estimado não viram receita. |
| Receita Perdida / Diretor / Radar / PMA | Motores existentes | Auditados, preservados. Dinheiro em risco não é receita de campanha. |
| Painel | `/atribuicao` já tinha navegação em Inteligência | Mesma superfície ampliada; nenhum dashboard novo, nenhuma alteração estética da Casa. |

## 2–4. Reuso, construção e fluxo

1. A entrada pública já resolvia o tenant por slug e produto literal `organizapro`, capturava UTM/GCLID/FBCLID e emitia código de rastreio. Essa estrutura foi preservada.
2. A captura aceita opcionalmente `campaign_id` (fallback `utm_id`), `ad_id`, `adset_id`, `gbraid`, `wbraid`. Textos limitados; nenhum token de plataforma é capturado.
3. O código já entregue ao SiteEmpresaClient agora é repassado aos formulários de pedido e interesse, sem mudar seu layout. A chave de tentativa fica estável em retry do mesmo conteúdo.
4. Depois de criar ou recuperar a entidade, o servidor procura o código **no mesmo tenant** e registra `atribuicao.vinculo` em `eventos_dominio`. Falha de atribuição não desfaz pedido/interesse.
5. A rota autenticada `/api/atribuicao/vinculos` permite registrar evidência verificável para cliente, oportunidade, agendamento, orçamento, pedido ou cobrança. Autoria e método são definidos pelo servidor; as duas referências precisam pertencer ao tenant autorizado. Não se aceita receita informada pelo browser.
6. Replays usam a mesma chave por entidade. A mesma origem retorna sucesso; tentativa de sobrescrever por outra origem retorna 409. Evidência e autoria originais permanecem.
7. O relatório segue somente FKs reais da oportunidade para orçamento, cliente e agenda; a trilha econômica existente leva orçamento→tratamento→cobrança. Pedido pago requer vínculo explícito próprio.
8. `/atribuicao` apresenta plataforma/origem, campanha/anúncio, capturas, leads, clientes, oportunidades, orçamentos, pedidos, agenda, conversões, receita e registros sem atribuição. Exibe também a trilha de cada pagamento e as evidências registradas.

O caminho WhatsApp→código→paciente existente permanece. Vínculo apenas com cliente **não transmite atribuição para toda sua receita**. Quando não há FK/vínculo até uma operação comercial, a V1 conserva a lacuna como não atribuída.

## 5–6. Estado real por plataforma

| Plataforma | Operacional localmente | Preparado / pendente |
|---|---|---|
| Meta Ads | Captura de marcações, campanha/anúncio, associação explícita e receita rastreável no relatório | Contrato de conexão/adaptador; conexão oficial permanece `nao_configurada`. Sem importação de custos, Insights ou envio de conversão. |
| Google Ads | Mesmo fluxo; GCLID e UTMs existentes, IDs opcionais e preservação de GBRAID/WBRAID | Contrato de conexão/adaptador; conexão oficial permanece `nao_configurada`. Sem OAuth, importação de custos ou upload de conversões. |

FBCLID isolado não classifica mídia paga. UTMs explícitos de mídia paga podem identificar a plataforma declarada; não autenticam o clique perante ela. GCLID conflitante com indicação Meta permanece incerto. Identificadores desconhecidos/ausentes não são inventados. GBRAID/WBRAID ficam preservados para integração futura, sem interpretação adicional não homologada.

`lib/ads-contratos.ts` define conexão (estado, conta, referência opaca de credencial servidor), identificadores e contrato de conversão/adaptador. Não há implementação de transporte para APIs oficiais. Não há token, segredo ou referência de credencial na resposta ao browser.

## 7. Receita sem atribuição inventada

- Reconhecimento de receita delegado a `gerarLinhaEconomica`: cobrança paga com valor/data, ou pedido pago com confirmação. Valores de orçamento e tratamento não são somados.
- Cada terminal `(tipo,id)` entra uma vez. Eventos repetidos e capturas repetidas não multiplicam dinheiro.
- Uma única origem precisa ser rastreável na entidade/trilha. Origens ou identificadores de plataforma conflitantes ficam não atribuídos; não há palpite first-touch/last-touch.
- Pagamento anterior à captura ou com data inválida não é atribuído. Captura sem qualquer evidência de origem também não recebe receita atribuída.
- Valor inválido não vira zero nem estimativa; zero registrado permanece zero.
- Vínculo declarado pelo operador é exibido como declaração, distinto do código retornado no site. Ambos demonstram rastreabilidade registrada, **não causalidade do anúncio** nem confirmação da plataforma.
- CAC/ROAS ficam ausentes, pois não há gasto de mídia comprovado integrado.
- A assinatura legada `agregarAtribuicao` foi preservada para compatibilidade de contagens, mas não retorna receita por paciente; a tela utiliza o relatório por pagamento.

## 8. Arquivos alterados

Aplicação e contratos:

- `app/api/atribuicao/route.ts`
- `app/api/atribuicao/vinculos/route.ts`
- `app/api/site-publico/interesse/route.ts`
- `app/api/site-publico/pedidos/route.ts`
- `app/atribuicao/page.tsx`
- `app/empresa/[slug]/page.tsx`
- `app/empresa/[slug]/SiteEmpresaClient.tsx`
- `app/empresa/[slug]/_components/InteressePublico.tsx`
- `app/empresa/[slug]/_components/PedidoPublico.tsx`
- `lib/ads-contratos.ts`
- `lib/atribuicao-dados.ts`
- `lib/atribuicao-vinculos.ts`
- `lib/atribuicao-origem.ts`
- `lib/atribuicao-relatorio.ts`
- `lib/origem-persistencia.ts`

Testes, SQL e documentação:

- `tests/ads-atribuicao.test.mjs`
- `tests/ads-atribuicao-rotas.test.mjs`
- `tests/ads-atribuicao-ui.test.mjs`
- `tests/atribuicao-origem.test.mjs`
- `tests/interesse-publico.test.mjs`
- `tests/p1-3-atribuicao-resultado.test.mjs`
- `supabase/migrations/20260923000003_ads_atribuicao_v1.sql`
- `docs/ads-atribuicao-v1-entrega.md`

Nenhuma alteração em motores comerciais, Linha Econômica, núcleo inteligente, Dashboard/Casa, GBP ou menu.

## 9. Migration preparada

`20260923000003_ads_atribuicao_v1.sql` — **NÃO EXECUTADA**.

Estende a tabela de origem com `identificadores_ads`, limite de tamanho/objeto JSON; restringe SELECT a vínculo ativo e produto OrganizaPro; valida que paciente e captura pertencem ao mesmo tenant. O schema local foi conferido: paciente.clinica_id legado é texto, origem.clinica_id é UUID; o trigger compara os tipos explicitamente.

Pré-requisitos: versão canônica de `origem_captacoes` e infraestrutura existente de `eventos_dominio` com sua chave única, além das tabelas comerciais/Pedidos. Os scripts antigos alternativos de criação de origem não devem ser executados cumulativamente sem revisão. A migration incremental não cria nem duplica essas tabelas.

## 10. Validação

- TypeScript completo com `--noEmit --incremental false`: aprovado.
- Lint dos arquivos TypeScript/TSX tocados: aprovado, sem erros.
- 150 testes selecionados: 150 aprovados, zero falhas/ignorados. Incluem os três testes de renderização React da tela e regressões de origem, resultado econômico, wiring GBP, pedido/interesse público, Smart Commerce e Gerente Comercial.
- Novos testes executam funções reais com banco em memória: tenant cruzado, replay, conflito, falha de persistência, ausência de origem, paginação e falha de fonte. Rotas reais são carregadas com autenticação e serviços substituídos antes da execução; nenhum cliente externo real é criado.
- Testes de UI renderizam o TSX real em memória nos estados loading/erro/vazio/sucesso e verificam o escape de texto. Não equivalem a navegação autenticada nem homologação visual de navegador.
- Verificação do diff: sem erros de whitespace; arquivos centrais preservados por comparação com a base.
- Sem build Next de produção: evitado para preservar espaço em C:. Reutilizado node_modules existente por junction; nenhum pacote instalado nem arquivo de ambiente copiado.

Build de testes: compilar módulos e duas rotas com TypeScript CommonJS em diretório externo ao checkout, definindo `CONVERGENCIA_BUILD_DIR` e `SMART_COMMERCE_BUILD_DIR` para sua pasta `lib`. Executar as suítes `ads-atribuicao*`, `atribuicao-origem`, `p1-3-atribuicao-resultado`, `presenca-reputacao-atribuicao-wiring`, `pedido-publico`, `interesse-publico`, `linha-economica`, `smart-commerce-canonico` e `gerente-comercial`.

## 11–12. Limitações e homologação posterior

- Homologar SQL/RLS e fluxos autenticados em ambiente autorizado; esta missão não confirmou nem alterou o banco real.
- Implementar e homologar os adaptadores oficiais, OAuth, armazenamento protegido de credenciais, permissões/consentimento, custos e mapeamento da versão oficial de conversões antes de conectar contas ou enviar dados. O contrato local não simula essa integração.
- Dados legados sem evidência permanecem não atribuídos. Não foi feito backfill por telefone/nome. FKs dormentes de cliente/agenda não são preenchidas artificialmente.
- Atribuição pública é best-effort: falha não bloqueia pedido/interesse; retry pode concluir o vínculo quando a origem existe. Captura perdida não pode ser reconstruída por suposição.
- Relatório pagina em lotes de 500, com guarda de 10 mil linhas por fonte. Se atingir a guarda ou falhar qualquer fonte, recusa apresentar totais parciais. Não oferece recorte temporal configurável nesta V1; exibe o histórico carregado.
- Não resolve registros econômicos duplicados manualmente com IDs diferentes entre domínios: falta uma identidade global de pagamento para provar que são o mesmo fato. O relatório não inventa essa identidade.
- Vínculo explícito é imutável na V1. Correções/revogação de evidência e atribuição multitoque são evoluções posteriores; conflitos não recebem distribuição automática.
- A classificação da plataforma é baseada em marcação capturada e declarada. Nenhuma campanha ou clique foi verificado junto a Meta/Google.

## 13–15. Checkpoint e ações externas

Branch: `feature/ads-atribuicao-v1`. SHA e git status pós-commit constam do relatório de entrega em outputs.

Nenhum push, merge remoto, deploy, migration executada, acesso ao Supabase real, OAuth, conta Ads, publicação, envio de conversão, gasto de mídia ou alteração de segredo. Somente trabalho local.

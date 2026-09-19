# E-commerce IA V1 — evolução da infraestrutura existente (pré-migration)

Status: **PROPOSTA — nenhuma migration executada, nenhum SQL rodado contra
Supabase, nenhum pagamento real processado, nenhum WhatsApp real
enviado.** Construído sobre o checkpoint `a1ca6d3` (branch
`audit/smart-commerce-precheck`), a partir da auditoria de existência e
convergência da sessão anterior (fonte de verdade desta missão).

Regra central respeitada: **nada foi reconstruído.** Todo componente
listado abaixo como "reutilizado" já existia, sem alteração de
comportamento até o preço/pedido serem explicitamente usados.

---

## 0. O que a auditoria já provou (não repetido aqui)

- `clinica_servicos` + `app/site/servicos/page.tsx` + `Servicos.tsx` já são
  um catálogo público funcional, sem preço.
- `app/api/upload/route.ts` já é genérico e tenant-scoped.
- `pacientes` já serve como comprador.
- Lifecycle Orçamento→Venda→Pagamento→Receita e Cobrador AI já resolvem a
  disciplina financeira (`docs/orcamento-venda-receita-v1-arquitetura.md`,
  `docs/financeiro-inteligente-cobrador-ai-v1-arquitetura.md`).
- Radar/Central/Próxima Melhor Ação/Diretor Digital já são multi-origem por
  design.
- Zero e-commerce histórico neste repositório (confirmado por
  `git log --all`).

## 1. Catálogo / Preço — evolução mínima de `clinica_servicos`

**Decisão**: adicionar `preco_centavos` à tabela existente, **nunca**
criar uma segunda tabela de "produtos". Um "produto comercial" e um
"serviço" são o mesmo conceito de catálogo neste produto — a distinção que
importa de verdade é ter preço ou não, não o nome da linha.

```sql
-- PROPOSTA — auditoria apenas, NÃO EXECUTAR sem GO explícito.
ALTER TABLE clinica_servicos
  ADD COLUMN IF NOT EXISTS preco_centavos INTEGER
    CHECK (preco_centavos IS NULL OR preco_centavos > 0);
```

- **Nunca `numeric`/`float`** — inteiro em centavos, mesma convenção de
  `orcamentos.valor_centavos`/`cobrancas.valor_centavos`.
- **Nullable** — um item sem preço público continua válido e continua
  aparecendo no site (nunca escondido por falta de preço).
- **`clinicas.produto` (literal `'organizapro'`/`'clinicaflow'`, distingue
  produto de SaaS) e "produto comercial" de catálogo são conceitos
  completamente diferentes, mesma palavra.** Por isso este documento evita
  a palavra "produto" para a entidade nova sempre que ambígua, e a
  migration não introduz nenhuma coluna chamada `produto` em
  `clinica_servicos` — só `preco_centavos`.

**Impacto**: aditivo, uma coluna nullable numa tabela que já tem RLS e uso
real. **Rollback**: `ALTER TABLE clinica_servicos DROP COLUMN preco_centavos;`

## 2. Pedidos — domínio mínimo, convergente, não duplicado

`pedido` **não é** `orcamento` disfarçado — nasce de um item de catálogo
já precificado, sem negociação nem validade (orçamento negocia e pode
expirar; pedido só confirma/cancela). São entidades irmãs do mesmo domínio
econômico, nunca a mesma tabela; convergem no que produzem (receita
comprovada), não na estrutura interna.

```sql
-- PROPOSTA — auditoria apenas, NÃO EXECUTAR sem GO explícito.
CREATE TABLE IF NOT EXISTS pedidos (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id              UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  paciente_id             UUID REFERENCES pacientes(id) ON DELETE SET NULL,
  servico_id              UUID REFERENCES clinica_servicos(id) ON DELETE SET NULL,
  nome_cliente            TEXT NOT NULL,
  telefone                TEXT,
  valor_centavos          INTEGER NOT NULL CHECK (valor_centavos > 0),
  status                  TEXT NOT NULL DEFAULT 'criado' CHECK (status IN
                            ('criado','confirmado','aguardando_confirmacao_pagamento','pago','cancelado')),
  origem                  TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','site_publico')),
  -- 'chatbot_ia' NUNCA é um valor válido aqui — mesma regra de
  -- `orcamentos.origem` (seção 4 daquele documento): um pedido só nasce de
  -- ação estruturada e deliberada (registro manual do lojista, ou uma
  -- submissão de formulário público real — nunca inferido de texto livre
  -- de conversa).
  pagamento_informado_em  TIMESTAMPTZ,
  pagamento_confirmado_em TIMESTAMPTZ,  -- única evidência aceita como receita comprovada deste pedido
  criado_por              UUID,
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key         TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_idempotency_key_uidx
  ON pedidos (clinica_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS pedidos_clinica_status_idx ON pedidos (clinica_id, status);

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pedidos_select" ON pedidos FOR SELECT USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "pedidos_insert" ON pedidos FOR INSERT WITH CHECK (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "pedidos_update" ON pedidos FOR UPDATE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
-- Sem policy de DELETE — fail-closed nativo (mesmo padrão já documentado
-- em docs/orcamento-venda-receita-v1-arquitetura.md seção 7).
```

### 2.1 State machine (`lib/pedido-state-machine.ts` — construído, testado)

```
criado ──▶ confirmado ──▶ aguardando_confirmacao_pagamento ──▶ pago   (terminal)
  │             │                    │                          ▲
  │             │                    └──────────────────────────┘ (pagamento_confirmado direto)
  │             │                    └──▶ confirmado (confirmacao_rejeitada)
  └─────────────┴────────────────────────────────────────────▶ cancelado (terminal)
```

- `criado`: registrado, aguardando confirmação do lojista.
- `confirmado`: lojista aceitou — compromisso real, ainda sem pagamento.
- `aguardando_confirmacao_pagamento`: **cliente informou pagamento — nunca
  confirmado só por isso** (item central da missão, seção 3).
- `pago`: terminal, só por evidência real.
- `cancelado`: terminal.

Único ponto de mutação: `aplicarEvento(pedido, evento)` — determinístico,
mesmo padrão de `lib/cobranca-state-machine.ts`. Cinco eventos:
`confirmar_pedido`, `cliente_informou_pagamento`, `confirmacao_rejeitada`,
`pagamento_confirmado`, `cancelar_pedido`. Estado terminal nunca é
reaberto (checado no topo da função, antes do switch — mesma defesa
usada em orçamentos e cobranças).

### 2.2 Preço — sempre calculado pelo servidor

```ts
function capturarValorPedido(item: ItemCatalogo, quantidade: number): number | null {
  if (item.precoCentavos === null) return null;
  if (!Number.isInteger(quantidade) || quantidade <= 0) return null;
  return item.precoCentavos * quantidade;
}

function valorFoiManipulado(valorRecebidoCentavos: number, item: ItemCatalogo, quantidade: number): boolean {
  const valorReal = capturarValorPedido(item, quantidade);
  return valorReal === null || valorReal !== valorRecebidoCentavos;
}
```

Uma futura rota de criação de pedido **rejeita a requisição inteira**
quando `valorFoiManipulado` for `true` — nunca "corrige" silenciosamente
um valor divergente. O preço nunca é aceito do cliente; é sempre recalculado
a partir do `preco_centavos` real do item no momento da criação.

### 2.3 Isolamento de tenant (defesa em profundidade)

```ts
function pertenceAoMesmoTenant(clinicaIdDoPedido: string, clinicaIdDoItem: string): boolean {
  return clinicaIdDoPedido === clinicaIdDoItem;
}
```

Uma futura rota valida isto **além** da RLS — mesmo princípio já
estabelecido em `docs/orcamento-venda-receita-v1-arquitetura.md` seção
7.1: RLS nunca é a única defesa contra referência cross-tenant.

### 2.4 Idempotência

`podeCriarPedido(idempotencyKey, pedidosExistentes)` — mesmo padrão de
`idempotency_key` já usado em `orcamentos`/`cobrancas`: chave gerada por
quem chama, índice único parcial no banco, `null` sempre libera (dedup
fica a cargo do chamador quando não fornecida).

## 3. Pagamento — disciplina do Cobrador AI, sem gateway próprio

**Decisão de convergência**: `pedidos` **não** cria uma segunda tabela de
evidência de pagamento. Para V1, a evidência vive diretamente em
`pedidos.pagamento_informado_em`/`pagamento_confirmado_em` — simples,
suficiente, e com a MESMA regra que `pagamentos`/Cobrador AI já
estabeleceu: **"cliente disse que pagou" nunca vira "confirmado" sozinho.**
Uma futura unificação num único razão de pagamentos do produto inteiro
(convergindo `pedidos` e `cobrancas`/`orcamentos` numa só tabela de
evidência) é uma evolução legítima de V2, registrada aqui como nota, não
executada — evita retrofitar o desenho já aprovado do Cobrador AI
(`pagamentos.cobranca_id NOT NULL`) sem necessidade real agora.

- **Link de pagamento**: quando o lojista já usa um link de pagamento
  próprio (Mercado Pago, PagSeguro, PIX copia-e-cola etc.), o campo é
  configurado manualmente pelo lojista — mesmo padrão já em produção de
  `clinica_config.link_google` (colado, nunca gerado pelo sistema). **Não
  desenhado como coluna nesta migration** por não haver ainda uma decisão
  de produto sobre onde esse link vive (por item, por pedido, ou global da
  clínica) — fica como próximo gate, não bloqueia o V1 (pedido pode ser
  combinado por WhatsApp sem link nenhum).
- **Pagamento informado**: evento `cliente_informou_pagamento` →
  `aguardando_confirmacao_pagamento`. Nunca soma como receita.
- **Pagamento confirmado**: só por reconciliação humana nesta fase (mesmo
  estágio de maturidade do Cobrador AI hoje) — evento
  `pagamento_confirmado`, grava `pagamento_confirmado_em`. **É a única
  linha que pode entrar em qualquer soma de "receita comprovada".**

## 4. Smart Commerce — três sinais novos, motor reaproveitado

Nenhum motor novo. Os três sinais entram pela MESMA
`gerarOportunidadesClientes` (`lib/oportunidades-clientes.ts`), com três
novos campos opcionais em `EntradaOportunidades`:

| Sinal | Tipo de dado | Fonte real (quando existir) | Prioridade |
|---|---|---|---|
| `pedido_nao_concluido` | **CONFIRMADO** (pedido é registro estruturado) | `pedidos` com `status IN ('criado','confirmado')` há N dias | alta |
| `recompra_possivel` | **CONFIRMADO** | cliente com `pedidos.status='pago'` no passado, sem pedido novo recente | media |
| `interesse_sem_pedido` | **HEURÍSTICO** (mesma limitação de `interesse_sem_compra` — `chatbot_logs` não estrutura tópico) | conversa classificada por quem chama a partir do texto real | baixa |

Só sinais sustentáveis por dado real do domínio foram implementados —
nenhum "carrinho abandonado" genérico foi inventado sem uma fonte real por
trás.

**Prioridade interna** (`PESO_TIPO`/`TIER`): `pedido_nao_concluido` logo
após o bloco de orçamento (mesma natureza — negociação em aberto, fonte
diferente); `recompra_possivel` junto de `sem_proximo_compromisso`
(reativação); `interesse_sem_pedido` no fim, com os demais heurísticos.
**Mesma ressalva já registrada para `cobranca_vencida`**: esta é uma
prioridade inicial de produto, não uma verdade objetiva provada.

## 5. Inteligência — Radar/Central/NBA/Diretor Digital, sem motor novo

- `lib/oportunidades-clientes.ts`: 3 campos opcionais novos (seção 4).
- `lib/nucleo-inteligente.ts`: `TIPOS_PEDIDO` (evidência "histórico real de
  pedidos"), `interesse_sem_pedido` adicionado a `TIPOS_HEURISTICOS`, TIER
  atualizado.
- `lib/ia-comercial.ts`: 3 novos ramos no Diretor Digital, reaproveitando
  categorias já existentes (`cancelamento_confirmacao`, `retorno_cliente`)
  — **nenhuma categoria nova, nenhuma alteração em `DiretorDigitalCard.tsx`**.
- `RadarDeOportunidades.tsx`, `CentralDeOportunidades.tsx`,
  `ProximaMelhorAcao.tsx`, `DiretorDigitalCard.tsx`: **zero alteração** —
  já são genéricos o suficiente para renderizar qualquer `SinalCanonico`.

## 6. Site Premium — catálogo público evoluído, não recriado

### 6.1 Público (`/empresa/[slug]`) — construído, seguro, somente leitura

- `app/empresa/[slug]/_lib/types.ts`: `DBServico.preco_centavos?: number |
  null` — mesmo padrão já usado por `DBFaq` para uma coluna que ainda não
  existe (comentário próprio, tipo pronto para dado real).
- `app/empresa/[slug]/_components/Servicos.tsx`: exibe o preço junto ao
  nome quando presente (`formatarPreco`, nunca `float`); item sem preço
  continua exibido normalmente. CTA WhatsApp muda de "Perguntar sobre este
  serviço" para "Pedir este item" quando há preço, e a mensagem
  pré-preenchida passa a incluir o valor — **mesmo link `wa.me`, mesmo
  fluxo manual, nenhum envio automático, nenhuma escrita nova**.
- **Seguro antes da migration**: a consulta já usa `select("*")` — sem a
  coluna, o campo simplesmente não vem no objeto (`undefined`), tratado
  identicamente a "sem preço" (`!= null` cobre os dois casos). Zero risco
  para o site público hoje.

### 6.2 Admin (`app/site/servicos/page.tsx`) — evoluído com persistência isolada

- Campo de preço adicionado ao formulário (texto em reais, vírgula
  decimal — `parsePrecoParaCentavos`/`formatarCentavosParaInput`).
- **Decisão de segurança deliberada**: o salvamento do preço é uma
  chamada Supabase **separada e isolada** (`salvarPreco`) do salvamento
  principal (nome/descrição/ícone/imagem/ordem, que permanece
  **byte-a-byte idêntico** ao que já está em produção). Antes da migration
  rodar, `preco_centavos` não existe na tabela — essa segunda chamada
  falha sozinha, exibindo um aviso não-bloqueante ("funcionalidade em
  ativação"), **nunca impede nem reverte** o salvamento do serviço em si.
  Depois da migration, a mesma chamada passa a funcionar sem nenhuma
  mudança de código adicional.

## 7. Segurança / Multitenant — requisitos mapeados

| Requisito | Como é atendido |
|---|---|
| Tenant isolation | RLS (seção 2) + `pertenceAoMesmoTenant` em código (seção 2.3) |
| Auth fail-closed | Futura rota de criação de pedido segue o contrato já fechado em `docs/orcamento-venda-receita-v1-arquitetura.md` seção 7.1 (`autorizarUsuarioNaClinica`, nunca `clinica_id` do corpo/query) |
| Preço calculado/validado pelo servidor | `capturarValorPedido`/`valorFoiManipulado` (seção 2.2) — testado |
| Idempotência | `idempotency_key` + índice único parcial + `podeCriarPedido` (seção 2.4) |
| Nenhuma receita sem evidência | `pagamento_confirmado_em` só setado por evento explícito de confirmação real — nunca por "informou" |
| WhatsApp real | **Não enviado nesta missão** — CTA público só monta o link, humano decide enviar |

## 8. Escopo deliberadamente fora do V1

ERP completo, NF-e/fiscal, logística/frete, múltiplos depósitos,
marketplace, fulfillment, gateway de pagamento próprio, estoque (não
modelado — nenhuma coluna de quantidade em `clinica_servicos`), variações
de produto (tamanho/cor), busca/filtro de catálogo, unificação de
`pagamentos` entre pedidos/cobranças/orçamentos (nota da seção 3).

## 9. O que fica para o próximo gate (não construído nesta sessão)

Por decisão de escopo (não por bloqueio técnico), esta sessão entrega o
**backend completo e testado** (state machine, tipos, integração com os
motores de inteligência) e a **evolução segura do catálogo público e do
seu admin de preço** — mas **não constrói**:

1. Uma rota de API para criar pedidos (`/api/pedidos`), com todo o
   contrato de segurança da seção 7 implementado em código de rota real —
   depende da migration da seção 2 existir para ser testável de ponta a
   ponta.
2. Uma UI admin dedicada para listar/gerenciar pedidos (mirando o mesmo
   padrão de `app/site/servicos/page.tsx`).
3. Um formulário público de "fazer pedido" no site — V1 mantém o fluxo
   inteiramente manual via WhatsApp (lojista registra o pedido depois de
   receber a mensagem), mesmo estágio de maturidade que o fluxo de
   avaliações tinha antes da automação.

Estas três peças reutilizam 100% do backend já entregue aqui — nenhuma
delas exige nova arquitetura, só nova UI/rota sobre o que já existe.

## 10. Testes / gates de validação executados

- **229/229 testes** — 195 já existentes (blocos anteriores, intactos) +
  34 novos (23 `pedido-state-machine` + 11 de integração/regressão em
  `oportunidades-clientes.smart-commerce.test.mjs`).
- `npx tsc --noEmit` — limpo, projeto inteiro.
- `npx eslint` nos arquivos novos/tocados — 0 erros, 3 warnings
  pré-existentes de `<img>` (não introduzidos nesta sessão).
- `npx next build` — build de produção completo, todas as rotas
  registradas corretamente, incluindo `/site/servicos` e `/empresa/[slug]`.
- `git diff --check` — ver saída ao final da entrega.

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

**Atualização pós-auditoria de segurança (seção 11)**: a proposta também
passa a incluir uma constraint `UNIQUE (id, clinica_id)` na mesma tabela —
necessária para o gate de integridade cross-tenant descrito na seção 11.3.
Custo: verificação única na criação (tabela pequena, por tenant), sem
reescrita de dados existentes (`id` já é PK, portanto já único sozinho —
a constraint composta nunca pode falhar por dado já existente).

```sql
-- PROPOSTA — auditoria apenas, NÃO EXECUTAR sem GO explícito.
ALTER TABLE clinica_servicos
  ADD CONSTRAINT clinica_servicos_id_clinica_id_uidx UNIQUE (id, clinica_id);
```

## 2. Pedidos — domínio mínimo, convergente, não duplicado

`pedido` **não é** `orcamento` disfarçado — nasce de um item de catálogo
já precificado, sem negociação nem validade (orçamento negocia e pode
expirar; pedido só confirma/cancela). São entidades irmãs do mesmo domínio
econômico, nunca a mesma tabela; convergem no que produzem (receita
comprovada), não na estrutura interna.

**Versão canônica corrigida na auditoria de segurança (seção 11) — a
versão original desta seção está preservada, riscada conceitualmente, na
seção 11.1; esta é a que deve ser revisada/aprovada:**

```sql
-- PROPOSTA — auditoria apenas, NÃO EXECUTAR sem GO explícito.
CREATE TABLE IF NOT EXISTS pedidos (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id              UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  paciente_id             UUID REFERENCES pacientes(id) ON DELETE SET NULL,
  servico_id              UUID REFERENCES clinica_servicos(id) ON DELETE SET NULL,
  -- Snapshot do que foi pedido NO MOMENTO da criação — nunca recalculado.
  -- Mesmo princípio de `orcamentos.descricao` (seção 3 daquele
  -- documento): garante que o pedido continue legível mesmo se o item de
  -- catálogo for editado ou apagado depois (servico_id vira NULL, mas a
  -- descrição do que foi vendido não se perde).
  descricao               TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS pedidos_clinica_status_idx  ON pedidos (clinica_id, status);
CREATE INDEX IF NOT EXISTS pedidos_servico_idx          ON pedidos (servico_id);
CREATE INDEX IF NOT EXISTS pedidos_paciente_idx         ON pedidos (paciente_id);

-- Integridade cross-tenant de `servico_id` (seção 11.3): uma FK
-- simples em `servico_id` só garante que o item existe em algum lugar,
-- NUNCA que pertence à MESMA `clinica_id` do pedido. Uma FK composta
-- `(servico_id, clinica_id) REFERENCES clinica_servicos(id, clinica_id)`
-- resolveria isso, mas exigiria `ON DELETE SET NULL` sobre a tupla
-- inteira — o que tentaria zerar também `clinica_id` (NOT NULL) e
-- quebraria qualquer DELETE em clinica_servicos. `ON DELETE SET NULL
-- (coluna)` (só a coluna certa) existe a partir do Postgres 15, e a
-- versão real do Postgres deste projeto Supabase NÃO PÔDE ser confirmada
-- nesta auditoria (sem acesso de leitura à instância real — ver seção
-- 11.4). Por isso a defesa aqui é um TRIGGER, portátil em qualquer versão:
CREATE OR REPLACE FUNCTION pedidos_valida_tenant_do_servico()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.servico_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM clinica_servicos
    WHERE id = NEW.servico_id AND clinica_id = NEW.clinica_id
  ) THEN
    RAISE EXCEPTION 'servico_id % nao pertence a clinica_id %', NEW.servico_id, NEW.clinica_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pedidos_valida_tenant_do_servico_trg
  BEFORE INSERT OR UPDATE OF servico_id, clinica_id ON pedidos
  FOR EACH ROW EXECUTE FUNCTION pedidos_valida_tenant_do_servico();

-- Mantém `atualizado_em` real a cada UPDATE — a versão original não tinha
-- nenhum mecanismo para isso (a coluna existiria, mas nunca mudaria
-- sozinha; ficaria a cargo da aplicação lembrar de setá-la em toda
-- escrita, o que é frágil). Trigger genérico, sem estado, reaproveitável.
CREATE OR REPLACE FUNCTION pedidos_atualiza_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pedidos_atualiza_timestamp_trg
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION pedidos_atualiza_timestamp();

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- SELECT/INSERT/UPDATE seguem o padrão já usado por clinica_servicos/
-- clinica_config, com DUAS diferenças deliberadas em relação ao padrão-base
-- (ver seção 11.2/11.3 — por que endurecer especificamente aqui):
-- (a) `AND ativo = true` — este endurecimento NÃO existe em nenhuma RLS
--     hoje em produção neste projeto (confirmado por auditoria de todas
--     as migrations reais); é adicionado aqui porque `pedidos` lida com
--     dinheiro, e um vínculo desativado (funcionário que saiu, por
--     exemplo) não deveria conseguir ler/criar/alterar pedidos mesmo que
--     a linha em `clinica_usuarios` não tenha sido apagada.
-- (b) UPDATE com `WITH CHECK` explícito (não implícito) — mesmo padrão
--     já corrigido, depois de um incidente real confirmado por teste
--     direto com dois tenants, em
--     supabase/migrations/20260713000002_fix_clinica_config_rls.sql
--     (`clinica_config` permitia sequestro de linha para outro tenant via
--     UPDATE antes dessa correção). Tecnicamente o Postgres reusa USING
--     como WITH CHECK quando este é omitido — mas a lição real já registrada
--     neste repositório é: nunca depender do comportamento implícito numa
--     tabela que guarda dado sensível.
CREATE POLICY "pedidos_select" ON pedidos FOR SELECT USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid() AND ativo = true));
CREATE POLICY "pedidos_insert" ON pedidos FOR INSERT WITH CHECK (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid() AND ativo = true));
CREATE POLICY "pedidos_update" ON pedidos FOR UPDATE
  USING (clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid() AND ativo = true))
  WITH CHECK (clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid() AND ativo = true));
-- Sem policy de DELETE — fail-closed nativo (mesmo padrão já documentado
-- em docs/orcamento-venda-receita-v1-arquitetura.md seção 7).
-- Sem policy de leitura pública (diferente de clinica_servicos) — pedido
-- é dado interno, nunca exposto a `anon`.
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

## 11. Auditoria de segurança SQL pré-staging (gate — nenhum SQL executado)

**Classificação: B — SEGURA COM CORREÇÕES.** As correções já foram
incorporadas às seções 1 e 2 acima (versão canônica); nada foi executado.
Nenhuma correção encontrada é do tipo "RLS ausente" (a proposta original
já era fail-closed por padrão) — todas são endurecimentos de integridade e
consistência com lições já aprendidas neste repositório.

### 11.1 Método — limitação explícita desta auditoria

Sem acesso de leitura à instância real de staging/produção nesta sessão
(nenhuma credencial/MCP de Supabase disponível). A verificação de
compatibilidade foi feita pelos únicos meios read-only disponíveis:
`supabase/migrations/*.sql` (DDL real, versionado) e inferência a partir
do código (`.select()`/`.insert()`/`.update()` já em produção). Onde isso
não foi suficiente para confirmar um fato do schema real, está marcado
explicitamente abaixo como **NÃO VERIFICADO** — nunca assumido.

### 11.2 `clinica_servicos.preco_centavos` — achados

| Item auditado | Resultado |
|---|---|
| Tipo `INTEGER`, nunca `numeric`/`float` | ✅ Confirmado — mesma convenção de `orcamentos.valor_centavos`/`cobrancas.valor_centavos` |
| Nullable | ✅ Correto — item sem preço continua válido |
| `CHECK` contra preço negativo/zero | ✅ `IS NULL OR > 0` — bloqueia os dois |
| Compatibilidade com registros existentes | ✅ `ADD COLUMN` sem `NOT NULL`/`DEFAULT` não reescreve linhas nem tabela — operação O(1), sem lock prolongado mesmo com dados reais |
| Impacto no Site Premium atual | ✅ Confirmado seguro — `select("*")` já usado em `SiteEmpresaClient.tsx`/`app/site/servicos/page.tsx`; ausência da coluna vira `undefined`, tratado como "sem preço" |
| Confusão com `clinicas.produto` | ✅ Nenhuma coluna nova chamada `produto`; nomenclatura verificada |
| Idempotência do `ALTER` | ⚠️ `ADD COLUMN IF NOT EXISTS ... CHECK (...)` é seguro para rodar 2x, mas se a coluna já existir (criada manualmente sem o CHECK), o `IF NOT EXISTS` pula a cláusula inteira e o CHECK não seria adicionado numa re-execução — risco baixo, só relevante se alguém intervier manualmente antes desta migration rodar |

**Correção aplicada**: `UNIQUE (id, clinica_id)` adicionada — pré-requisito
do gate de integridade da seção 11.3 (`pedidos.servico_id`). Custo
verificado: zero risco de falha (uma PK já é única sozinha).

### 11.3 `pedidos` — achados

| Item auditado | Resultado |
|---|---|
| PK | ✅ `id UUID DEFAULT gen_random_uuid()` — mesma função usada em TODAS as migrations reais deste repo (confirmado por grep em `supabase/migrations/*.sql`), nenhum risco de `uuid_generate_v4()`/extensão diferente |
| `clinica_id` + `ON DELETE CASCADE` | ✅ Consistente com `orcamentos`/`cobrancas` propostos |
| `paciente_id` (comprador) | ⚠️ FK simples para `pacientes(id)` — **não garante** que o paciente pertence à mesma `clinica_id`. **NÃO CORRIGIDO** nesta revisão: `pacientes` não é criada por nenhuma migration deste repositório (tabela legada/pré-existente — confirmado, `grep` não encontra `CREATE TABLE.*pacientes`), então não há como propor com segurança um `UNIQUE(id, clinica_id)` nela sem ver o schema real. **Mesma limitação já presente, sem correção, nas propostas anteriores de `orcamentos`/`cobrancas`** — não é uma regressão introduzida aqui, mas continua pendente. Marcado **NÃO VERIFICADO / gate real**. |
| `servico_id` (item) | 🔧 **Corrigido** — FK simples original não impedia referência cross-tenant (severidade real: integridade de dado, não vazamento de confidencialidade, já que `clinica_servicos` já é publicamente legível — `SELECT USING (true)`, confirmado em `supabase/migrations/20260625000002_site_modules.sql:119`). Trigger `pedidos_valida_tenant_do_servico` adicionado (seção 2). |
| `descricao` (o que foi pedido) | 🔧 **Adicionado** — ausente na proposta original. Sem isso, um pedido cujo `servico_id` mais tarde vira `NULL` (item apagado) perderia todo registro do que foi vendido — quebra de auditabilidade financeira. Mesmo princípio de `orcamentos.descricao`. |
| `valor_centavos NOT NULL CHECK > 0` | ✅ Correto e consistente com `capturarValorPedido`/`valorFoiManipulado` (`lib/pedido-state-machine.ts`) — item sem preço no catálogo literalmente não pode virar pedido com valor, por design (mesma trava em código e em banco) |
| `status` + `CHECK` | ✅ Os 5 valores conferem exatamente com `PedidoStatus` em `lib/pedido-state-machine.ts` — comparação literal feita, sem divergência |
| `origem` + `CHECK` | ✅ `chatbot_ia` corretamente excluído, mesma disciplina de `orcamentos.origem` |
| Timestamps | 🔧 `atualizado_em` não tinha nenhum mecanismo de atualização automática (ficaria congelado na criação, a não ser que a aplicação lembrasse de setá-lo manualmente em toda escrita). Trigger `pedidos_atualiza_timestamp` adicionado. |
| Idempotência | ✅ `idempotency_key` + índice único parcial — mesmo padrão já em `orcamentos`/`cobrancas`. `podeCriarPedido` (código) reforça a mesma regra antes de qualquer INSERT. |
| Índices | 🔧 Adicionados `pedidos_servico_idx`/`pedidos_paciente_idx` (ausentes na proposta original) — sem eles, qualquer consulta futura por item ou por comprador faria table scan. Não crítico para segurança, mas corrigido por completude ("índices" foi item explícito do escopo desta auditoria). |
| Consistência com `pedido-state-machine.ts` | ✅ Confirmada linha a linha (status, eventos, transições) |
| Segunda fonte de verdade para receita | ⚠️ Ver seção 11.5 — aceito para V1, não corrigido, com nota explícita |

### 11.4 RLS — prova conceitual tenant A/B (CRÍTICO)

Provado por leitura das policies (não testado contra staging real —
plano de teste real na seção 11.6):

| Cenário exigido pela missão | Como a policy corrigida garante |
|---|---|
| Tenant A vê seus pedidos | `pedidos_select`: `clinica_id IN (subquery de auth.uid())` — A só aparece nesse conjunto para o próprio A |
| Tenant A cria somente dentro de A | `pedidos_insert` (`WITH CHECK`) — insere só se `clinica_id` da NOVA linha estiver no conjunto de clínicas de A |
| Tenant A altera somente A | `pedidos_update` com `USING` E `WITH CHECK` explícitos (idênticos) — impede tanto alvo quanto destino fora do conjunto de A |
| Tenant B não lê A | Mesmo raciocínio da linha 1, com B no lugar de A — conjuntos disjuntos |
| Tenant B não escreve/atualiza A | Mesmo raciocínio das linhas 2/3 |
| Tenant B não forja `clinica_id=A` | `auth.uid()` vem do JWT verificado pelo PostgREST, nunca do corpo da requisição — B não consegue fazer sua própria sessão "virar" A |
| Anon não obtém pedidos privados | Nenhuma policy com `USING (true)` existe em `pedidos` (diferente, de propósito, de `clinica_servicos`) — RLS ativo sem policy = nega por padrão |
| Service role só onde necessário | **Atenção explícita**: a service role do Supabase **ignora RLS por completo** (é assim que `SUPABASE_SERVICE_ROLE_KEY` funciona hoje em `app/api/cron/*`, `app/api/whatsapp`, etc.). RLS aqui é a defesa **primária** para acesso direto do navegador (mesmo padrão já usado por `app/site/servicos/page.tsx`, que chama `supabase.from(...)` direto do cliente); para uma futura rota `/api/pedidos` com service role, a defesa primária passa a ser o contrato de aplicação já fechado em `docs/orcamento-venda-receita-v1-arquitetura.md` seção 7.1 — RLS vira secundária, não a única checagem, exatamente como já demonstrado ali. |

**Achado adicional**: nenhuma RLS real deste projeto (auditado em TODAS as
migrations existentes) verifica `clinica_usuarios.ativo` — só o código de
aplicação (`lib/auth-clinica.ts:48`) faz essa checagem. A proposta
corrigida adiciona `AND ativo = true` às três policies de `pedidos` como
endurecimento **específico** desta tabela (lida com dinheiro), não como
correção de uma regressão — o padrão-base do resto do projeto permanece
como está, fora do escopo desta migration.

### 11.5 Segurança econômica

| Requisito da missão | Onde é garantido |
|---|---|
| Cliente não define preço final livremente | `capturarValorPedido` — sempre a partir de `clinica_servicos.preco_centavos` real |
| Preço validado/calculado no servidor | `valorFoiManipulado` — testado (`tests/pedido-state-machine.test.mjs`) |
| Pagamento informado ≠ confirmado | `aguardando_confirmacao_pagamento` como estado obrigatório intermediário — testado |
| Pago só com evidência adequada | `pagamento_confirmado_em` só setado pelo evento `pagamento_confirmado`, nunca por `cliente_informou_pagamento` |
| Cancelamento determinístico | `aplicarEvento` — testado, sem ambiguidade |
| Nenhuma receita fabricada | Confirmado — nenhum caminho de código soma `pagamento_informado_em` como receita |
| Nenhuma alteração cross-tenant | RLS (11.4) + trigger de `servico_id` (11.3) — duas camadas |
| Proteção contra replay/duplicação | `idempotency_key` + índice único parcial + `podeCriarPedido` |

**Nota sobre "nenhuma segunda fonte de verdade para receita"**: a decisão
de manter `pagamento_confirmado_em` diretamente em `pedidos` (em vez de
reaproveitar a tabela `pagamentos` do Cobrador AI, ligada a `cobranca_id`)
significa, na prática, que "receita comprovada total" do negócio exige
somar DUAS fontes (`pedidos.pagamento_confirmado_em IS NOT NULL` +
`pagamentos` via cobranças/orçamentos) — não é estritamente uma única
fonte. Isto já estava documentado como decisão consciente na seção 3
original; esta auditoria não encontrou motivo para revertê-la (unificar
agora exigiria retrofitar o desenho já aprovado do Cobrador AI, arriscado
sem necessidade real comprovada), mas reforça: **qualquer relatório futuro
de "receita total" precisa somar as duas fontes explicitamente — nunca
tratar uma como completa sozinha.**

### 11.6 Plano de prova tenant A/B (para quando houver staging real)

Mesmo método já usado no incidente real deste repositório
(`20260713000002_fix_clinica_config_rls.sql`, comentário de abertura):

1. Criar dois tenants descartáveis em staging (`clinica_teste_a`,
   `clinica_teste_b`), cada um com um usuário autenticado próprio.
2. Como usuário de A: criar um `pedido` em `clinica_id=A` — confirmar
   sucesso.
3. Como usuário de A: tentar `INSERT`/`UPDATE` forçando `clinica_id=B` —
   confirmar rejeição pela policy.
4. Como usuário de B: tentar `SELECT` nos pedidos de A — confirmar 0
   linhas retornadas.
5. Como usuário de A: criar um `pedido` com `servico_id` pertencente a B —
   confirmar rejeição pelo trigger (`RAISE EXCEPTION`).
6. Sem sessão (anon): tentar `SELECT`/`INSERT` em `pedidos` — confirmar
   rejeição total.
7. Remover os dois tenants de teste ao final (mesma disciplina do
   incidente original).

### 11.7 Plano de rollback / recuperação

```sql
-- Reversão completa, ordem inversa de dependência:
DROP TRIGGER IF EXISTS pedidos_atualiza_timestamp_trg ON pedidos;
DROP FUNCTION IF EXISTS pedidos_atualiza_timestamp();
DROP TRIGGER IF EXISTS pedidos_valida_tenant_do_servico_trg ON pedidos;
DROP FUNCTION IF EXISTS pedidos_valida_tenant_do_servico();
DROP TABLE IF EXISTS pedidos;
ALTER TABLE clinica_servicos DROP CONSTRAINT IF EXISTS clinica_servicos_id_clinica_id_uidx;
ALTER TABLE clinica_servicos DROP COLUMN IF EXISTS preco_centavos;
```

Nenhuma tabela pré-existente (`clinicas`, `pacientes`, `clinica_usuarios`)
é alterada por esta migration — o rollback nunca toca dado que já existia
antes dela.

### 11.8 Confirmação explícita

**ZERO SQL EXECUTADO. ZERO MIGRATION EXECUTADA. ZERO PRODUCTION TOCADA.**
Toda a revisão desta seção foi feita por leitura de arquivo — nenhum
comando `psql`/`supabase db` /cliente Postgres foi invocado nesta sessão.

## 12. Precheck adicional — `pedidos.paciente_id` × `pacientes` (achado novo, gate)

Investigação de acompanhamento, ainda 100% read-only (git + código — sem
acesso a nenhuma instância real de Supabase nesta sessão; ver seção 11.1
para o motivo). **Não altera nenhuma SQL desta proposta** — documenta por
que a lacuna de `paciente_id` (já registrada na seção 11.3) é mais séria
do que "dado ausente", e por que não deve ser fechada por suposição.

### 12.1 O que foi confirmado

- **`pacientes` continua sem nenhuma DDL neste repositório** —
  `git log --all` não encontra nenhum commit, em nenhuma branch, que crie
  ou altere essa tabela. Confirma a mesma limitação já registrada na
  seção 11.3, agora verificada de novo, explicitamente, para esta missão.
- **`pacientes` tem uma coluna `user_id`, além de `clinica_id`** —
  evidenciado por dois pontos reais de código:
  - `scripts/criar-conta-comercial-demo.mjs:161-166`: insere
    `pacientes` com `clinica_id` **e** `user_id` lado a lado.
  - `app/clientes/page.tsx:253-263`: todo `salvar()` (criação **e**
    edição) grava `user_id: user?.id` no payload, sempre sobrescrevendo
    para o usuário logado no momento.
- **Nenhum código de aplicação lê/filtra `pacientes` por `user_id`** — a
  busca em todo o repositório pelas leituras de `pacientes` (`app/clientes`,
  `app/agendamentos`, `app/dashboard`, `app/metricas`,
  `app/api/raio-x`) mostra que **todas** filtram exclusivamente por
  `clinica_id`. Isso confirma que a APLICAÇÃO já trata `clinica_id` como a
  chave de tenant real — `user_id` parece vestigial (talvez só "última
  edição por").

### 12.2 Por que isso é um gate, não só uma lacuna de dado

Isso NÃO prova o que a **RLS real** de `pacientes` verifica no banco — só
prova o que a aplicação faz. E existe precedente direto, real, e já
documentado NESTE MESMO REPOSITÓRIO de uma tabela com esse EXATO padrão
híbrido (`user_id` + `clinica_id`) cuja RLS original era insuficiente:
`clinica_config` (mesma dupla de colunas — `app/configuracoes/page.tsx`
usa `onConflict: 'user_id'` no upsert) teve, confirmado por teste direto
com dois tenants, uma vulnerabilidade real de cross-tenant UPDATE, corrigida
em `supabase/migrations/20260713000002_fix_clinica_config_rls.sql`
precisamente por essa migração de modelo "só `user_id`" para
"`clinica_id IN (SELECT ... FROM clinica_usuarios ...)`".

Não há, nesta sessão, nenhuma forma de confirmar se `pacientes` já passou
pela mesma correção que `clinica_config` passou, ou se ainda carrega o
modelo antigo (ou algum modelo intermediário/inconsistente). Propor uma FK
composta ou um trigger de validação de tenant para
`pedidos.paciente_id → pacientes`, como foi feito para `servico_id` na
seção 11.3, exigiria **adivinhar** o nome/tipo exato da PK, se `clinica_id`
nela é de fato `UUID`, se aceita `NULL`, e sobretudo qual RLS real está
ativa — qualquer suposição errada nesse ponto seria pior do que deixar o
gate explicitamente aberto.

### 12.3 Classificação para este ponto específico

**C — existe incerteza estrutural real sobre `pacientes` (não apenas
ausência de dado, mas evidência concreta de um padrão de risco já
materializado nesta mesma base de código, numa tabela irmã). STOP.**

Isso não muda a classificação geral **B** da seção 11 para o restante da
migration (`clinica_servicos`, `pedidos`, `servico_id`, RLS) — essas partes
seguem corrigidas e prontas para revisão. O que fica bloqueado,
especificamente, é qualquer garantia de banco (FK composta ou trigger)
para `pedido.clinica_id = paciente.clinica_id`. **Recomendação**: antes de
aprovar a migration de `pedidos` para staging, rodar na `pacientes` real a
mesma auditoria de RLS já feita para `clinica_config` (teste direto com
dois tenants descartáveis, mesmo método da seção 11.6) — e, se ela
encontrar o mesmo problema, tratar como uma correção de segurança
independente, prioritária, antes ou junto da migration de `pedidos`.

Até essa confirmação existir, a única defesa que PODE ser afirmada com
confiança para `paciente_id` é a de aplicação: qualquer futura rota
`/api/pedidos` deve sempre filtrar `.eq('clinica_id', ...)` explicitamente
em toda leitura/escrita que envolva `paciente_id` — mesma disciplina de
defesa em profundidade já estabelecida em
`docs/orcamento-venda-receita-v1-arquitetura.md` seção 7.1 — mesmo que a
RLS real de `pacientes` já esteja correta.

### 12.4 Confirmação explícita

**ZERO SQL EXECUTADO (leitura ou escrita). ZERO MIGRATION EXECUTADA. ZERO
CONEXÃO A STAGING/PRODUCTION REAL NESTA SESSÃO.** Nenhuma credencial
encontrada em `.env.local` foi usada — decisão tomada em conjunto com o
Capitão para não conectar a nenhuma instância real sem confirmação
explícita de que a URL correspondia a staging, não produção.

## 13. Gate de Isolamento de Clientes (`pacientes`) — resultado formal

**RESULTADO: AMARELO — STOP.** Missão dedicada a provar isolamento de
tenant em `pacientes` via teste real em STAGING com dois tenants
autenticados. Precheck (Fase 1) não conseguiu identificar com segurança
qual projeto Supabase é staging — condição de parada já prevista
explicitamente na própria missão ("Se não for possível identificar com
segurança o projeto STAGING ou os tenants de teste, STOP").

### 13.1 Por que o precheck falhou (evidência)

- Este worktree tem **um único** arquivo de ambiente: `.env.local`. Não
  existe `.env.staging`, `.env.production`, nem `.env.example` para
  comparar contra.
- Busca por "staging" em toda a árvore do repositório (código, docs,
  config) só encontra a palavra dentro deste próprio documento — nenhuma
  referência a um segundo projeto Supabase, nenhum alias de ambiente, nenhum
  ponteiro que diferencie staging de produção.
- Sem essa diferenciação, usar as credenciais de `.env.local` para
  qualquer teste — mesmo somente leitura — arriscaria tocar produção sob a
  aparência de "staging". Isso é exatamente o cenário que a missão instruiu
  a nunca assumir.

### 13.2 O que PÔDE ser confirmado nesta sessão (estático, sem conexão)

- **Policies/RPCs/APIs que hoje protegem `pacientes` — mapeamento de
  código completo**: nenhuma função RPC toca `pacientes` (`grep` por
  `.rpc(` em todo o repositório não retorna nenhuma relacionada); todo
  acesso é direto via `supabase.from('pacientes')`, sempre com
  `.eq('clinica_id', ...)` explícito no código (`app/clientes/page.tsx`,
  `app/agendamentos/page.tsx`, `app/dashboard/page.tsx`,
  `app/metricas/page.tsx`, `app/api/raio-x/route.ts`) — essa é a única
  camada de proteção **confirmável** nesta sessão. A RLS real do banco
  continua não verificável (seção 12).
- Reconfirmado: nenhuma migration deste repositório cria/altera
  `pacientes` (as duas únicas ocorrências da palavra em arquivos `.sql`
  são a coluna não-relacionada `pacientes_mes`, de `chatbot_leads` — uma
  tabela completamente diferente, de captação comercial do próprio SaaS).

### 13.3 O que NÃO pôde ser provado

Todos os 8 itens pedidos pela missão (Tenant A só vê os próprios, Tenant B
só vê os próprios, A não lê B, B não lê A, A não altera/exclui/insere em
B, futuro `paciente_id` de A não pode apontar para cliente de B, service
role não é evidência válida, quais policies protegem `pacientes`) — os 7
primeiros **dependem de execução real contra staging**, que não pôde
começar por falta do precheck (13.1). O item 8 (mapeamento de código) foi
respondido o quanto possível na seção 13.2, mas fica incompleto sem ver a
RLS real.

**Nenhuma segurança foi assumida.** O gate de Clientes → E-commerce IA V1
permanece **bloqueado**, não aprovado nem reprovado — apenas não testável
com os meios disponíveis nesta sessão.

### 13.4 Caminho para destravar (ação humana necessária)

1. Confirmar explicitamente (fora deste chat, sem colar a chave) se
   `NEXT_PUBLIC_SUPABASE_URL` de `.env.local` deste worktree é staging —
   ou apontar um projeto/URL de staging distinto, com dois usuários de
   teste já provisionados (Tenant A e Tenant B), se existir.
2. Com essa confirmação, uma sessão futura pode executar exatamente o
   plano de prova já documentado na seção 11.6 (mesmo método do incidente
   real de `clinica_config`): dois tenants descartáveis, sessão
   autenticada real (nunca service role como evidência), tentativas de
   leitura/escrita cross-tenant, remoção ao final.
3. Até lá, a migration de `pedidos` (seção 2) permanece no gate já
   registrado na seção 12 — nenhuma execução recomendada.

### 13.5 Confirmação explícita

**ZERO Production. ZERO migration. ZERO deploy. ZERO push. ZERO merge.
ZERO conexão a qualquer instância real de Supabase nesta sessão.**

# Orçamento → Venda → Receita — Arquitetura V1 (proposta para auditoria)

Status: **PROPOSTA — nenhuma migration executada, nenhum SQL rodado contra Supabase.**
Este documento é o desenho técnico pedido antes de qualquer schema. Ver
`lib/oportunidades-clientes.ts`, `lib/nucleo-inteligente.ts`, `lib/ia-comercial.ts`
para a cadeia existente que este domínio se conecta (Sinal Canônico → Radar/
Central → Próxima Melhor Ação → Missão do Dia → Diretor Digital) — nada aqui
cria um motor novo; tudo é dado novo alimentando o motor que já existe.

## 0. Por que este documento existe

A auditoria anterior (ver histórico desta sessão) confirmou: não existe hoje
nenhuma tabela `orcamentos`/`propostas`/`vendas`/`pagamentos`/`cobrancas` no
schema real do OrganizaPro, e o único campo monetário existente
(`agendamentos.valor`) não tem nenhum caminho de escrita em nenhuma tela ou
rota — é uma coluna morta. "Orçamento que Fecha", "Cobrador AI" e "Receita
Perdida AI" não existem como código ou schema em lugar nenhum do repositório.
Este documento desenha, para aprovação, como esses três conceitos comerciais
podem nascer como **views/sinais diferentes sobre o MESMO domínio**, em vez
de três tabelas/motores paralelos.

## 1. `clinica_id`: nome legado, não renomear

Confirmado por auditoria: `clinica_id` é a chave de tenant usada em TODAS as
tabelas do schema (`agendamentos`, `pacientes`, `chatbot_logs`,
`clinica_config`, `avaliacoes`, `whatsapp_logs`, etc.), inclusive para
tenants que não são clínicas — o produto atende barbearia, academia, oficina
mecânica, imobiliária, restaurante, advocacia, psicologia, contabilidade,
pet shop, fisioterapia, estética (ver `docs/ia-universal-segmento-*.md`), e a
própria tabela `clinicas` tem uma coluna `produto` para diferenciar
segmentos/produtos internos. `clinica_id` é resíduo estrutural de quando o
produto era só para clínicas — hoje é, de fato, `tenant_id`.

**Decisão**: qualquer tabela nova deste domínio usa `clinica_id` como FK de
isolamento de tenant, sem exceção e sem apelido. Renomear seria uma mudança
cosmética que tocaria toda tabela existente, todo RLS policy, toda rota — 
risco alto, benefício zero, e explicitamente fora do que foi pedido.

## 2. Duas arquiteturas — comparação explícita

### A) Estender `agendamentos` com estado comercial

Adicionar `orcamento_status`, `valor` (já existe, mas morto), `enviado_em`
etc. diretamente em `agendamentos`.

**Onde quebra semanticamente:**
- `agendamentos` exige `data`/`hora` reais (validação atual do formulário:
  "Data é obrigatória", "Horário é obrigatório" —
  [app/agendamentos/page.tsx:301-302](../app/agendamentos/page.tsx#L301-L302)).
  Um orçamento, por definição, existe **antes** de qualquer horário marcado
  — forçar uma linha de agendamento a existir para representar um orçamento
  significa fabricar uma data/hora falsa, que passa a poluir toda consulta
  de agenda (`horariosVagosHoje`, `compromissosHoje`, o PDF do dia) a menos
  que alguém lembre de filtrar essas linhas em todo lugar — um bug latente
  esperando acontecer, do mesmo tipo que os commits recentes de segurança
  deste repositório mostram que a equipe já teve que caçar antes.
- `agendamentos.status` é uma máquina de estados sobre **comparecimento**
  (agendado/confirmado/faltou/concluido/cancelado/reagendar). Orçamento é
  uma máquina de estados sobre **negociação** (enviado/aceito/recusado/
  expirado), que acontece ANTES de qualquer comparecimento existir.
  Sobrepor as duas no mesmo campo `status` obriga a tocar toda leitura de
  `.status` já espalhada em 10+ arquivos (`!["cancelado","faltou"].includes(status)`
  aparece em pelo menos 4 lugares hoje) — alto risco de regressão silenciosa.
- Cardinalidade errada: um orçamento pode nunca virar agendamento, pode virar
  mais de um (várias sessões a partir de um único orçamento aceito), ou o
  cliente pode pedir dois orçamentos concorrentes para a mesma necessidade.
  1 linha = 1 conceito só funciona se os dois conceitos forem sempre 1:1, e
  não são.
- Pagamento parcial/total é naturalmente 1:N contra um **negócio fechado**,
  não contra uma **visita agendada**. Encaixar isso em `agendamentos`
  agrava o problema anterior.

### B) Domínio próprio mínimo: `orcamentos` (+ `orcamento_pagamentos` no futuro)

Tabela nova, com FK opcional para `pacientes` e para `agendamentos` (quando
o orçamento vira, de fato, um compromisso real).

**Por que resolve os problemas acima:**
- Representa o ciclo de vida real: orçamento existe de forma independente;
  `agendamento_id` nullable expressa "este orçamento virou este compromisso"
  sem forçar nenhuma linha falsa em `agendamentos`.
- Máquina de estados isolada — mudar o vocabulário de orçamento nunca
  arrisca quebrar nenhum dos 10+ lugares que já leem `agendamentos.status`.
- Cardinalidade correta desde o início: 1 orçamento → 0 ou 1 agendamento
  (hoje); 1 orçamento → 0..N pagamentos (quando essa tabela existir).
- Converge naturalmente os três conceitos comerciais futuros como **leituras
  diferentes da mesma tabela** (seção 5) — nenhum motor paralelo.

**Custo**: uma tabela nova agora (e potencialmente uma segunda, mais tarde,
só quando houver fonte real de pagamento). Mais linhas de RLS/policy para
manter. Isso é o preço da semântica correta — o pedido explícito foi não
escolher pela menor quantidade de código.

### Recomendação

**Opção B.** A diferença não é estética: Opção A cria uma dívida técnica
garantida (sobrecarga de `status`, poluição de consultas de agenda,
cardinalidade forçada) que precisaria ser desfeita mais tarde — exatamente o
tipo de "duplicação futura" que o pedido original instruiu a evitar. Opção B
custa uma tabela a mais hoje e paga isso integralmente em clareza e
ausência de retrabalho.

## 3. Entidades

### 3.1 `orcamentos` (núcleo do domínio)

| Campo               | Tipo          | Nullable | Observação |
|---------------------|---------------|----------|------------|
| `id`                 | uuid pk       | não | `gen_random_uuid()` |
| `clinica_id`         | uuid fk       | não | isola por tenant — mesmo padrão de toda tabela existente |
| `paciente_id`        | uuid fk `pacientes(id)` | sim | nem todo orçamento tem cliente já cadastrado (lead novo) |
| `agendamento_id`     | uuid fk `agendamentos(id)` | sim | setado só quando o orçamento vira um compromisso real |
| `nome_cliente`       | text          | não | mesmo padrão de `agendamentos.paciente_nome` — não força FK obrigatória |
| `telefone`           | text          | sim | |
| `descricao`          | text          | não | o que foi orçado, texto literal de quem criou — nunca inferido |
| `valor_centavos`     | integer       | sim | **nunca `numeric`/`float` para dinheiro** — evita erro de arredondamento; `null` = valor não informado, nunca 0 fantasioso |
| `status`             | text check (`criado`,`enviado`,`aceito`,`recusado`,`expirado`) | não | default `'criado'` |
| `origem`             | text check (`manual`,`importacao`) | não | **nunca `chatbot_ia`** — ver seção 4 |
| `criado_por`         | uuid          | não | `auth.uid()` de quem registrou — evidência/auditoria |
| `criado_em`          | timestamptz   | não | default `now()` |
| `enviado_em`         | timestamptz   | sim | setado na transição `criado → enviado` |
| `respondido_em`      | timestamptz   | sim | setado em `aceito`/`recusado` |
| `validade_ate`       | date          | sim | define quando um `enviado` vira `expirado`; `null` = sem prazo definido |
| `status_atualizado_em` | timestamptz | não | default `now()`, atualizado em toda transição — usado para idempotência (seção 6) |
| `idempotency_key`    | text          | sim | ver seção 6 |

Índice único parcial: `UNIQUE (clinica_id, idempotency_key) WHERE idempotency_key IS NOT NULL`.

### 3.2 `orcamento_pagamentos` (fase futura — só quando houver fonte real de pagamento)

Não criada nesta fase. Desenhada aqui para provar que o modelo comporta o
requisito sem redesenho:

| Campo             | Tipo        | Nullable | Observação |
|-------------------|-------------|----------|------------|
| `id`               | uuid pk     | não | |
| `clinica_id`       | uuid fk     | não | denormalizado (mesmo padrão de RLS direta já usado em todas as tabelas — nunca via join) |
| `orcamento_id`     | uuid fk `orcamentos(id)` | não | |
| `valor_centavos`   | integer     | não | |
| `pago_em`          | timestamptz | não | |
| `metodo`           | text        | sim | pix, cartao, dinheiro etc. — texto livre nesta fase |
| `origem`           | text check (`manual`,`gateway`) | não | `gateway` só quando existir integração real (nenhuma existe hoje) |
| `criado_por`        | uuid        | não | |

## 4. Origem/evidência do dado — e por que `chatbot_ia` nunca cria/fecha orçamento

`orcamentos.origem` só aceita `manual` ou `importacao` — **nunca**
`chatbot_ia`. Isso é deliberado: o chatbot (`app/api/chatbot/message/route.ts`)
já hoje produz sinais heurísticos (`interesse_sem_compra`,
`demanda_nao_atendida`) precisamente porque `chatbot_logs` não persiste
intenção estruturada, só texto. Se o chatbot pudesse criar um `orcamento`
com `valor` e `status='aceito'` a partir de uma conversa, o sistema estaria
inferindo venda de WhatsApp — exatamente o que este bloco foi instruído a
nunca fazer. Um orçamento só nasce e só muda de estado por ação humana
explícita (ou importação em lote, auditável, também de origem humana).

Isso também define a evidência do Sinal Canônico: como o dado é sempre
estruturado e confirmado (nunca inferido de texto livre), a evidência usa a
mesma linguagem "confirmada" já usada para `cancelamento_sem_reagendamento`
("Identificado no histórico real de...") — nunca a linguagem heurística
usada para os sinais de chatbot.

## 5. Convergência: um domínio, três leituras

| Conceito comercial   | O que realmente é, neste modelo |
|-----------------------|----------------------------------|
| **Orçamento que Fecha** | Sinal por cliente: `orcamentos` com `status IN ('enviado')` sem resposta há N dias, ou `status='aceito'` sem `agendamento_id` — feito de **follow-up**, mesmo formato de `OportunidadeCliente` já usado hoje. |
| **Cobrador AI**        | Mesmo `orcamentos.status='aceito'`, agora cruzado com `orcamento_pagamentos` (fase futura): soma paga < `valor_centavos` após prazo → sinal de cobrança. Sem tabela de pagamento real, este sinal **não pode existir** — não há o que inventar aqui. |
| **Receita Perdida AI**  | Não é um sinal por cliente — é um **agregado real** (`status IN ('recusado','expirado')` numa janela, somando `valor_centavos`), no mesmo formato que `lib/recomendacoes.ts` já usa para a Central de Oportunidades hoje (contagens reais, nunca estimativas). |

Nenhum dos três precisa de tabela ou motor próprio — todos leem `orcamentos`
(e, no futuro, `orcamento_pagamentos`) de ângulos diferentes.

## 6. Idempotência

Duplo-clique em "Enviar orçamento" não pode criar duas linhas. Dois
mecanismos, complementares:
- **UI**: mesmo padrão de trava síncrona já usado em
  [app/agendamentos/page.tsx:295-298](../app/agendamentos/page.tsx#L295-L298)
  (`salvandoRef.current`) — primeira linha de defesa, mas não protege contra
  retry de rede.
- **Banco**: `idempotency_key` opcional + índice único parcial por
  `(clinica_id, idempotency_key)`. Quem grava (hoje, um formulário; no
  futuro, uma eventual importação em lote) gera a chave; quando ausente
  (`null`), nenhuma restrição extra se aplica — não força todo caminho de
  escrita a inventar uma chave que não precisa.

Transições de estado (`enviado→aceito`, etc.) são idempotentes por
natureza: um `UPDATE ... WHERE id = ? AND status = 'enviado'` só aplica uma
vez; reenviar o mesmo clique não duplica nem regride estado.

## 7. RLS / isolamento por `clinica_id`

Mesmo padrão de toda tabela existente (ver `clinica_servicos` em
`supabase/migrations/20260625000002_site_modules.sql:114-125`):

```sql
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orc_select" ON orcamentos FOR SELECT USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "orc_insert" ON orcamentos FOR INSERT WITH CHECK (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "orc_update" ON orcamentos FOR UPDATE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
```

Sem policy de leitura pública (diferente de `clinica_servicos`, que é lido
pelo site público) — orçamento é dado interno, nunca exposto em
`/empresa/[slug]`.

## 8. Receita prevista vs. orçamento aceito vs. receita comprovada

Três conceitos que este domínio precisa manter **sempre distintos** na UI e
no código — nunca o mesmo rótulo:

1. **Receita prevista**: soma de `valor_centavos` de orçamentos
   `status IN ('enviado')` dentro da validade. É dinheiro **potencial**,
   nada foi decidido pelo cliente ainda. Rótulo obrigatório: "previsão"
   (mesmo vocabulário já usado em `lib/recomendacoes.ts` e no PDF de
   agendamentos hoje — `receitaPrevista`).
2. **Orçamento aceito**: cliente confirmou (`status='aceito'`,
   `respondido_em` setado). É um **fechamento comercial real** — pode ser
   chamado de "venda fechada" — mas **não é dinheiro no caixa**. Não vira
   `orcamento_pagamentos` automaticamente.
3. **Receita comprovada**: soma de `orcamento_pagamentos.valor_centavos`
   (fase futura). É a **única** coisa que este sistema pode chamar de
   "receita" sem qualificador. Sem registro de pagamento real, a palavra
   "receita" nunca aparece desqualificada em nenhuma tela — só "prevista".

`status='aceito'` e "pago" são campos **desacoplados de propósito**: pago
parcial = `sum(pagamentos) < valor_centavos`; pago total =
`sum(pagamentos) >= valor_centavos`. Ambos são **calculados**, nunca um
booleano redundante gravado em `orcamentos` — evita uma segunda fonte de
verdade que pode dessincronizar.

## 9. Eventos/sinais produzidos e integração com os motores existentes

Nenhum motor novo. Extensão do MESMO `TipoSinal` já usado por
`lib/oportunidades-clientes.ts`:

- `orcamento_sem_resposta` — orçamento `enviado`, sem `aceito`/`recusado`,
  N dias depois (ou já vencida a `validade_ate`). Prioridade `alta`
  (dinheiro real parado — mesmo peso de `cancelamento_sem_reagendamento`).
- `orcamento_aceito_sem_agendamento` (desenhado aqui, **não implementado
  nesta fase** — evitar arquitetura prematura antes da migration) —
  `status='aceito'` e `agendamento_id IS NULL`. Prioridade `alta` (negócio
  fechado que ainda não virou operação real).
- Sinal de cobrança (Cobrador AI) e o agregado de Receita Perdida — ambos
  descritos na seção 5, não implementáveis sem `orcamento_pagamentos` real.

Esses sinais entram pela MESMA função `gerarOportunidadesClientes` (novo
campo opcional `orcamentosSemResposta?: OrcamentoSemResposta[]` em
`EntradaOportunidades`), herdando automaticamente tudo que já existe:
dedup por telefone, `adaptarOportunidadesClientes` → Sinal Canônico →
`organizarSinaisCanonicos` → Próxima Melhor Ação → Missão do Dia →
`gerarRecomendacoesConsultivas` (Diretor Digital) — exatamente como
`interesse_sem_compra`/`demanda_nao_atendida` já provaram no bloco anterior.
Zero motor novo, zero tabela de sinal paralela.

## 10. Caminho mínimo de UI (descrito, não construído nesta fase)

Fora de escopo deste worktree ("Dashboard visual" bloqueado por instrução
direta) — descrito só para provar que o schema é utilizável, não
especulativo:

1. Formulário simples (nome/telefone com autocomplete contra `pacientes`,
   descrição, valor, validade) → grava `status='enviado'`, `enviado_em=now()`.
2. Duas ações no registro: "Marcar como aceito" / "Marcar como recusado"
   (sempre humano, nunca automático) → `status` + `respondido_em`.
3. Atalho "Criar agendamento" a partir de um orçamento aceito, que pré-
   preenche o formulário de agendamento já existente e seta
   `orcamentos.agendamento_id` após a criação — link, não fusão de tabelas.
4. (Fase futura) mini-formulário "Registrar pagamento" → insere em
   `orcamento_pagamentos`.

## 11. Migration proposta — NÃO EXECUTADA

Arquivo de auditoria apenas. Não copiado para `supabase/migrations/`
propositalmente, para não ser aplicada automaticamente por nenhuma
ferramenta que varra aquele diretório. Requer novo GO explícito antes de
rodar contra Supabase.

```sql
-- PROPOSTA — auditoria apenas, NÃO EXECUTAR sem GO explícito.

CREATE TABLE IF NOT EXISTS orcamentos (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id            UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  paciente_id           UUID REFERENCES pacientes(id) ON DELETE SET NULL,
  agendamento_id        UUID REFERENCES agendamentos(id) ON DELETE SET NULL,
  nome_cliente          TEXT NOT NULL,
  telefone              TEXT,
  descricao             TEXT NOT NULL,
  valor_centavos        INTEGER,
  status                TEXT NOT NULL DEFAULT 'criado'
                          CHECK (status IN ('criado','enviado','aceito','recusado','expirado')),
  origem                TEXT NOT NULL CHECK (origem IN ('manual','importacao')),
  criado_por            UUID,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enviado_em            TIMESTAMPTZ,
  respondido_em         TIMESTAMPTZ,
  validade_ate          DATE,
  status_atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key       TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS orcamentos_idempotency_key_uidx
  ON orcamentos (clinica_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS orcamentos_clinica_status_idx
  ON orcamentos (clinica_id, status);

ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orc_select" ON orcamentos;
DROP POLICY IF EXISTS "orc_insert" ON orcamentos;
DROP POLICY IF EXISTS "orc_update" ON orcamentos;
CREATE POLICY "orc_select" ON orcamentos FOR SELECT USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "orc_insert" ON orcamentos FOR INSERT WITH CHECK (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "orc_update" ON orcamentos FOR UPDATE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));

-- orcamento_pagamentos: NÃO incluída nesta migration — só quando houver
-- fonte real de pagamento (gateway ou processo manual aprovado). Desenhada
-- na seção 3.2 deste documento só para provar que o modelo comporta o
-- requisito sem redesenho.
```

**Impacto**: aditivo, tabela nova, nenhuma coluna existente tocada. Zero
risco para dado já existente.

**Rollback**: `DROP TABLE IF EXISTS orcamentos;` — sem efeito em nenhuma
outra tabela (FKs são `ON DELETE SET NULL`/`CASCADE` só a partir de
`orcamentos`, nunca na direção contrária).

**Verificação pendente antes de executar** (não confirmável sem acesso ao
Supabase real): tipo exato hoje de `agendamentos.valor` (provavelmente
`numeric`/`float`, nunca usado por nenhuma escrita) — se este domínio for
implementado, `agendamentos.valor` deveria provavelmente ser aposentado em
favor de `orcamentos.valor_centavos` + o vínculo `agendamento_id`, para não
manter duas fontes de "valor" divergentes. Decisão de produto, não técnica
— fica registrada aqui, não decidida por este documento.

**Testes previstos quando a migration for aprovada e executada**: mesmo
padrão de `tests/oportunidades-clientes.smart-commerce.test.mjs` — dedup,
prioridade, evidência, e não-regressão dos sinais já existentes — mais
testes de RLS (usuário de uma `clinica_id` não pode ler/gravar orçamento de
outra) seguindo o padrão já auditado nos commits `fix(security):` recentes
deste repositório.

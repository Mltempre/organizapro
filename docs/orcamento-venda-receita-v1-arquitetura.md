# Orçamento → Venda → Receita — Arquitetura V1.1 (plano executável, pré-migration)

Status: **PROPOSTA — nenhuma migration executada, nenhum SQL rodado contra Supabase.**
Este documento é o desenho técnico pedido antes de qualquer schema. Ver
`lib/oportunidades-clientes.ts`, `lib/nucleo-inteligente.ts`, `lib/ia-comercial.ts`,
`lib/orcamentos-state-machine.ts` para a cadeia existente e a state machine
pura que este domínio já tem pronta (Sinal Canônico → Radar/Central →
Próxima Melhor Ação → Missão do Dia → Diretor Digital) — nada aqui cria um
motor novo; tudo é dado novo alimentando o motor que já existe.

**V1.1 (fecha o desenho pré-migration)**: decisão B confirmada (domínio
próprio, não estender `agendamentos`); state machine implementada e testada
em código puro (`lib/orcamentos-state-machine.ts`, 18 testes); o sinal único
`orcamento_sem_resposta` da V1 virou 4 sinais distintos
(`orcamento_sem_resposta`, `orcamento_expirando`, `orcamento_expirado`,
`orcamento_aceito_sem_agendamento`) já implementados e testados (41 testes
novos no total nesta revisão); `orcamento_aceito_sem_pagamento` e
`pagamento_parcial_pendente` (Cobrador AI) permanecem desenhados, não
implementados — dependem de `orcamento_pagamentos`, fora desta migration;
seção 7.1 fecha o padrão fail-closed de aplicação (nunca confiar em
`clinica_id` do cliente — mesmo contrato de `lib/auth-clinica.ts`) que toda
rota `/api/orcamentos/*` futura precisa seguir, além da RLS de banco já
desenhada.

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
| `validade_ate`       | date          | sim | referência para o SINAL de vencimento (seção 3.3 — nunca escreve `status='expirado'` sozinho); `null` = sem prazo definido |
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

### 3.3 Criação real do orçamento (item 1)

- **Onde o usuário cria**: tela nova (seção 10 — não construída nesta fase).
- **Campos mínimos obrigatórios no formulário**: `nome_cliente` (ou seleção
  de um `paciente_id` existente — autocomplete), `descricao` (texto livre do
  que foi orçado). Tudo o mais é opcional no formulário: `telefone`,
  `valor_centavos`, `validade_ate`.
- **Relação com cliente**: `paciente_id` nullable — se o autocomplete casar
  com um paciente existente, vincula; se não, o orçamento nasce só com
  `nome_cliente`/`telefone` (mesmo padrão de `agendamentos.paciente_nome`
  hoje, que também não força cadastro prévio).
- **Relação opcional com agendamento**: `agendamento_id` começa sempre
  `NULL`. Só é setado depois, quando (a) o orçamento já está `aceito` e
  (b) um agendamento real é criado a partir dele (atalho da seção 10, item 3).
  Nunca setado na criação.
- **Valor**: `valor_centavos`, opcional. Ausente = `NULL`, nunca `0`.
- **Validade**: `validade_ate`, opcional (data). Ausente = sem prazo — os
  sinais `orcamento_expirando`/`orcamento_expirado` simplesmente nunca
  disparam para esse registro (ver `lib/orcamentos-state-machine.ts`).
- **Observações/descrição**: campo `descricao`, único campo de texto livre
  obrigatório — é o que ancora "o que foi orçado" sem inventar categoria.
- **Estado inicial**: `status='criado'` ao salvar o formulário, ANTES de
  qualquer envio. A ação "Enviar orçamento" (mesmo formulário ou botão
  separado) é o que transiciona `criado → enviado` e grava `enviado_em`.
  Isso separa "eu rascunhei um orçamento" de "eu efetivamente mandei para o
  cliente" — dois fatos diferentes, duas evidências diferentes.

### 3.4 Ciclo comercial: do fluxo de negócio ao `status` (item 2)

O fluxo descrito na missão (`criado → enviado → aguardando resposta →
follow-up → aceito/recusado/expirado`) mistura **estados** (persistidos em
`status`) com **atividade** (ações/sinais que não mudam estado nenhum).
Mapeamento explícito, para não haver ambiguidade na hora de construir:

| Termo do fluxo de negócio | É um `status` gravado? | O que realmente é |
|---|---|---|
| orçamento criado | Sim — `status='criado'` | estado inicial (seção 3.3) |
| enviado | Sim — `status='enviado'` | `enviado_em` setado |
| aguardando resposta | **Não** — é só outro nome para `status='enviado'` | não existe como valor separado |
| follow-up | **Não é status, é ação** | contato humano repetido enquanto `status='enviado'` — não muda o registro; é o que os sinais `orcamento_sem_resposta`/`orcamento_expirando` sugerem fazer (`acaoSugerida`) |
| aceito | Sim — `status='aceito'` | `respondido_em` setado — ver seção 5 (venda) |
| recusado | Sim — `status='recusado'` | `respondido_em` setado, terminal |
| expirado | Sim, mas só como **ação humana de encerramento** (`status='expirado'`, gravado explicitamente ao arquivar) — a pergunta "isso está funcionalmente vencido?" nunca depende dessa gravação | ver `orcamentoExpirado()` em `lib/orcamentos-state-machine.ts` — sempre recalculado ao vivo a partir de `validade_ate`, nunca lido de uma coluna |

State machine formal (implementada e testada em
`lib/orcamentos-state-machine.ts`, `TRANSICOES_VALIDAS`):

```
criado ──────▶ enviado ──────▶ aceito    (terminal)
                   │──────────▶ recusado  (terminal)
                   └──────────▶ expirado  (terminal — só por ação humana de encerramento)
```

`criado` nunca pula direto para `aceito`/`recusado`/`expirado` (testado:
"criado NAO pode pular direto..."). Nenhum estado terminal permite nova
transição nesta fase — reabertura é decisão de produto fora de escopo.

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

| Conceito comercial   | O que realmente é, neste modelo | Status desta revisão |
|-----------------------|----------------------------------|---|
| **Orçamento que Fecha** | 4 sinais por cliente, todos sobre `orcamentos` `status IN ('enviado')`/`'aceito'`: `orcamento_sem_resposta`, `orcamento_expirando`, `orcamento_expirado` (os três, mutuamente exclusivos — seção 8), e `orcamento_aceito_sem_agendamento`. Mesmo formato de `OportunidadeCliente` já usado hoje. | **Implementado** (código puro, `lib/oportunidades-clientes.ts`) |
| **Cobrador AI**        | `orcamentos.status='aceito'` cruzado com `orcamento_pagamentos` (fase futura): soma paga < `valor_centavos` após prazo → `orcamento_aceito_sem_pagamento`/`pagamento_parcial_pendente`. Sem tabela de pagamento real, estes sinais **não podem existir** — não há o que inventar aqui. | **Desenhado, não implementado** (seção 8) |
| **Receita Perdida AI**  | Agregado real (não um sinal por cliente): soma de `valor_centavos` de orçamentos `status='recusado'` OU funcionalmente vencidos (`orcamentoExpirado(...)` — nunca um filtro `status='expirado'` puro, porque a maioria dos vencidos nunca tem essa transição gravada — ver seção 3.4) numa janela, mesmo formato que `lib/recomendacoes.ts` já usa hoje (contagens reais, nunca estimativas). | **Desenhado, não implementado** — é um agregado (`lib/recomendacoes.ts`), não um sinal por cliente (`lib/oportunidades-clientes.ts`); implementar exigiria tocar `gerarCentralOportunidades`, fora do escopo de "código puro/tipos" pedido nesta rodada |

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

Sem policy de `DELETE`: **intencional, não esquecimento**. `ENABLE ROW
LEVEL SECURITY` sem uma policy para uma operação nega essa operação por
padrão (fail-closed nativo do Postgres) — como este domínio nunca apaga um
orçamento (estados terminais são `aceito`/`recusado`/`expirado`, nunca
"removido"; ver seção 3.4), a ausência da policy de DELETE é a forma
correta de impedir a operação inteira no banco, em vez de escrever uma
policy `USING (false)` redundante.

### 7.1 Fail-closed em camada de aplicação — RLS nunca é a única defesa

RLS no banco é a última linha, não a única. O padrão já homologado neste
repositório (`lib/auth-clinica.ts`, criado na auditoria de
`fix(security): harden OrganizaPro chatbot tenant authorization`, commit
`0df176b`) é: **nunca confiar em `clinica_id` vindo do corpo/query da
requisição**. Qualquer rota `/api/orcamentos/*` futura precisa seguir o
mesmo contrato, sem exceção:

1. `clinica_id` nunca é lido de `req.body`/`req.query` para decidir
   autorização — só como valor a comparar contra o que o servidor já
   resolveu.
2. `auth.uid()` vem do bearer token (`Authorization` header), nunca de
   input do cliente — mesmo helper `autorizarUsuarioNaClinica(req, clinicaId)`.
3. Confirma vínculo ativo em `clinica_usuarios` (`usuario_id = auth.uid()`,
   `clinica_id = <resolvido>`, `ativo = true`) antes de qualquer leitura ou
   escrita — a mesma consulta que a policy de RLS replica, verificada duas
   vezes de propósito (defesa em profundidade, mesmo racional do commit
   `55e8a9d` — `.eq('clinica_id', clinicaId)` explícito em toda query de
   update/delete, nunca dependendo só da policy estar correta).
4. Falha de autenticação/vínculo retorna 401/403 genérico — nunca distingue
   "clínica não existe" de "sem permissão" (mesmo cuidado já aplicado em
   `lib/auth-clinica.ts` para não vazar enumeração de tenant).
5. Toda query Supabase contra `orcamentos` (client-side ou em rota server)
   inclui `.eq('clinica_id', clinicaId)` explícito, mesmo sabendo que a RLS
   já filtraria — a policy é a rede de segurança, não a única checagem;
   se um dia uma policy for removida/quebrada por engano, a query
   continua correta sozinha.

Nenhuma rota de orçamento é webhook-shaped (diferente de
`app/api/chatbot/message`, que usa `CHATBOT_INTERNAL_SECRET` por não ter
sessão de usuário) — todo acesso a `orcamentos` parte de um usuário
autenticado da clínica, então o padrão de `autorizarUsuarioNaClinica` cobre
100% da superfície deste domínio, sem necessidade de um segredo interno
separado.

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

## 9. Sinais econômicos — fonte, evidência, prioridade, dedup, encerramento, idempotência, limites

Nenhum motor novo. Extensão do MESMO `TipoSinal` já usado por
`lib/oportunidades-clientes.ts`. Os 4 primeiros estão **implementados e
testados** (código puro, zero dependência de banco); os 2 últimos (Cobrador
AI) estão **desenhados, não implementados** — dependem de
`orcamento_pagamentos`, fora desta migration.

### 9.1 `orcamento_sem_resposta` — implementado

- **Fonte real**: `orcamentos` com `status='enviado'`, `validade_ate` nula
  ou ainda distante (>3 dias — `orcamentoExpirando`/`orcamentoExpirado`
  retornam `false` para os dois).
- **Evidência**: "Identificado no histórico real de orçamentos, {tempo}." —
  nunca linguagem heurística (é dado confirmado — seção 4).
- **Prioridade**: `alta`. Tier interno (`PESO_TIPO`): depois de
  `orcamento_expirando`/`orcamento_expirado`/`orcamento_aceito_sem_agendamento`
  — é o menos urgente dos quatro (sem pressão de prazo).
- **Deduplicação**: por telefone/chave, mesmo mecanismo (`registrar(...)`)
  de todos os outros sinais — um cliente com múltiplos sinais vira 1 card,
  o de maior prioridade em destaque.
- **Encerramento**: para de aparecer quando quem chama para de incluir esse
  orçamento na lista (porque o `status` real mudou para `aceito`/`recusado`,
  ou porque `orcamentoExpirando`/`orcamentoExpirado` passa a ser `true` e o
  registro migra para o outro sinal). Nunca o motor decide isso sozinho.
- **Idempotência**: função pura e determinística — mesmo input sempre
  produz o mesmo sinal; nenhuma escrita acontece aqui (idempotência de
  *criação* do orçamento é uma preocupação de banco, seção 6, não deste
  motor de leitura).
- **O que NÃO pode ser inferido**: probabilidade de fechar, motivo da não-
  resposta, ou um valor quando `valor_centavos` é `null` (o texto omite o
  trecho de valor, nunca assume R$ 0).

### 9.2 `orcamento_expirando` — implementado

- **Fonte real**: mesma tabela, `status='enviado'` e `validade_ate - hoje`
  entre 0 e 3 dias (`orcamentoExpirando`, janela nomeada, ajustável).
- **Evidência**: mesma frase confirmada da seção 4.
- **Prioridade**: `alta`; tier acima de `orcamento_sem_resposta`, abaixo de
  `orcamento_expirado`/`orcamento_aceito_sem_agendamento`.
- **Deduplicação**: idêntica à 9.1.
- **Encerramento**: migra para `orcamento_expirado` quando a data vira (sem
  nenhuma escrita — recalculado a cada carregamento), ou desaparece se
  `status` mudar para `aceito`/`recusado`.
- **Idempotência**: idêntica à 9.1 — puro, sem escrita.
- **O que NÃO pode ser inferido**: que o cliente vai deixar vencer — o
  sinal só descreve a janela de tempo, nunca uma previsão de comportamento.

### 9.3 `orcamento_expirado` — implementado

- **Fonte real**: `status='enviado'` e `validade_ate < hoje`
  (`orcamentoExpirado`) — **nunca** um filtro `status='expirado'` (essa
  transição só existe se um humano arquivar explicitamente — seção 3.4).
- **Evidência**: mesma frase confirmada; nunca "perdido" ou "cancelado" —
  só relata o fato de vencimento, sem presumir o resultado da negociação.
- **Prioridade**: `alta`; tier logo abaixo de
  `orcamento_aceito_sem_agendamento`, acima de `orcamento_expirando`.
- **Deduplicação**: idêntica à 9.1.
- **Encerramento**: desaparece quando `status` muda para
  `aceito`/`recusado`/`expirado` (arquivado). Continua aparecendo
  indefinidamente enquanto ninguém decide — por design: vencer não fecha a
  oportunidade sozinho.
- **Idempotência**: idêntica à 9.1.
- **O que NÃO pode ser inferido**: que o cliente recusou — vencimento de
  prazo e recusa são fatos diferentes; só o segundo é `status='recusado'`.

### 9.4 `orcamento_aceito_sem_agendamento` — implementado

- **Fonte real**: `orcamentos` com `status='aceito'` e `agendamento_id IS NULL`.
- **Evidência**: mesma frase confirmada; texto nunca menciona pagamento
  (aceite ≠ pagamento, testado explicitamente).
- **Prioridade**: `alta`; tier mais alto dos quatro (negócio já fechado,
  maior valor esperado de ação imediata).
- **Deduplicação**: idêntica aos demais.
- **Encerramento**: desaparece quando `agendamento_id` é setado (atalho da
  seção 10, item 3) — nunca por qualquer outro motivo automático.
- **Idempotência**: idêntica aos demais.
- **O que NÃO pode ser inferido**: nunca soma isso como receita nem como
  "pago" — é só fechamento comercial (seção 8, ponto 2).

### 9.5 `orcamento_aceito_sem_pagamento` — desenhado, NÃO implementado

- **Fonte real (quando existir)**: `orcamentos.status='aceito'` cruzado com
  `sum(orcamento_pagamentos.valor_centavos) < orcamentos.valor_centavos`,
  depois de um prazo de carência (a definir — decisão de produto).
- **Bloqueio**: `orcamento_pagamentos` não existe nesta migration. Sem essa
  tabela, este sinal não tem fonte — implementá-lo agora exigiria simular
  pagamento, exatamente o que foi proibido ("não fabricar receita
  comprovada sem evidência de pagamento").
- **O que NUNCA poderá ser inferido, mesmo depois de implementado**: que o
  cliente não vai pagar (inadimplência) — o sinal só pode relatar o fato
  aritmético "aceito, ainda sem pagamento registrado", nunca uma predição.

### 9.6 `pagamento_parcial_pendente` — desenhado, NÃO implementado

- **Fonte real (quando existir)**: `calcularStatusPagamento(...) === "parcial"`
  (já implementado em `lib/orcamentos-state-machine.ts` — puramente
  aritmético, pronto para o dia em que `orcamento_pagamentos` existir).
- **Bloqueio**: idêntico à 9.5.
- **O que NUNCA poderá ser inferido**: quando o restante será pago, ou
  "risco de calote" — só o fato aritmético `sum(pagamentos) < valor_centavos`.

### 9.7 Integração com os motores existentes

Os 4 sinais implementados entram pela MESMA função
`gerarOportunidadesClientes` (dois campos opcionais em
`EntradaOportunidades`: `orcamentosEnviados?: OrcamentoEnviado[]` e
`orcamentosAceitosSemAgendamento?: OrcamentoAceitoSemAgendamento[]`),
herdando automaticamente tudo que já existe: dedup por telefone,
`adaptarOportunidadesClientes` → Sinal Canônico → `organizarSinaisCanonicos`
→ Próxima Melhor Ação → Missão do Dia → `gerarRecomendacoesConsultivas`
(Diretor Digital) — exatamente como `interesse_sem_compra`/
`demanda_nao_atendida` já provaram no bloco anterior. Zero motor novo, zero
tabela de sinal paralela.

`gerarRecomendacoesConsultivas` (Diretor Digital) já tem os 4 ramos
correspondentes, reaproveitando a categoria `cancelamento_confirmacao`
existente — nenhuma categoria nova, nenhuma alteração em
`DiretorDigitalCard.tsx` nem em qualquer componente visual.

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

# Financeiro Inteligente — Cobrador AI V1 (pré-migration)

Status: **PROPOSTA — nenhuma migration executada, nenhum SQL rodado contra
Supabase, nenhum WhatsApp real disparado, nenhuma cobrança real criada.**
Construído sobre o checkpoint `5b97951` (branch `audit/smart-commerce-precheck`).

Regra central respeitada: **não é um ERP, não é um sistema contábil.** Só a
capacidade operacional que faltava — COBRANÇA → ACOMPANHAMENTO → PAGAMENTO
→ RESULTADO — como parte do mesmo Financeiro Inteligente que já inclui
Orçamento → Venda → Receita (`docs/orcamento-venda-receita-v1-arquitetura.md`).

---

## A. O que já existia e foi reutilizado

Auditoria curta (arquivos já conhecidos de sessões anteriores neste mesmo
branch, revalidados nesta sessão):

| Peça | Classe | Reutilização nesta missão |
|---|---|---|
| `lib/orcamentos-state-machine.ts` | **A** | `calcularStatusPagamento` (tri-estado `nao_pago`/`parcial`/`pago`, null-safe) é o precedente direto do princípio "nunca fabrica receita" aplicado aqui. `orcamentos.status='aceito'` é a origem mais natural de uma cobrança. |
| `docs/orcamento-venda-receita-v1-arquitetura.md` | **A** | Define `receita prevista` / `orçamento aceito` / `receita comprovada` como três conceitos que nunca podem ser confundidos (seção 8) — mesma disciplina exigida aqui para `pagamento_informado` vs. `pagamento_confirmado`. A tabela `orcamento_pagamentos` que aquele documento desenhava (seção 3.2/9.5/9.6) **converge** nesta migration como `pagamentos` (seção J.2) — não é recriada, é a mesma peça, evoluída para se ligar a `cobranca_id` em vez de diretamente a `orcamento_id`. |
| `lib/oportunidades-clientes.ts`, `lib/nucleo-inteligente.ts`, `lib/ia-comercial.ts` | **A** | Radar/Central/Diretor Digital — reutilizados via um único sinal novo adicionado (`cobranca_vencida`), nenhum motor paralelo criado (seção F). |
| `lib/auth-clinica.ts` | **A** | Padrão de autorização fail-closed (`autorizarUsuarioNaClinica`) — referenciado como contrato obrigatório para qualquer rota futura de cobrança (seção J.3). |
| `app/api/whatsapp/route.ts` | **A** | Infraestrutura de envio já existe (`INTERNAL_SERVICE_SECRET` para chamada serviço-a-serviço) — referenciada como ponto de integração futuro, **não chamada nesta sessão** (proibido enviar WhatsApp real). |
| `lib/motor-reputacao.ts` (bloco anterior) | **A** | Precedente direto de "nunca fabricar confirmação que o sistema não tem como dar" (clique ≠ resposta) — mesmo princípio aplicado aqui (pagamento informado ≠ confirmado). |

## B. Lacuna real encontrada

Nenhuma tabela, rota ou lib de cobrança/contas a receber/inadimplência
existe hoje no OrganizaPro (confirmado por busca textual no repositório
inteiro por `cobranc`, `contas a receber`, `inadimpl`, `vencimento` —
único achado foram os próprios arquivos do bloco de orçamento, que já
previam o Cobrador AI como trabalho futuro e explicitamente fora daquele
escopo). `agendamentos.valor` continua sendo uma coluna morta (nenhuma
tela escreve nela). **Não há nenhum caminho hoje, em produção, para saber
se um cliente que aceitou um orçamento efetivamente pagou.**

## C. Arquitetura canônica do Cobrador AI

Ciclo canônico (persistido em `cobrancas.status`) + atividades/exceções
(eventos, nunca um status paralelo — mesmo princípio de separação já usado
em `docs/orcamento-venda-receita-v1-arquitetura.md` seção 3.4):

```
COBRANÇA CRIADA
  │
  ▼
A_VENCER ──────────────▶ VENCIDA
  │                         │
  │                         ├──▶ AGUARDANDO_CONFIRMACAO  (cliente informou pagamento)
  │                         ├──▶ PROMESSA_PAUSADA          (cliente prometeu pagar até uma data)
  │                         ├──▶ EM_NEGOCIACAO             (contestação — só humano decide)
  │                         └──▶ PAUSADA                    (pausa manual)
  │
  └────────────────────────────────────────────────▶ PAGA        (terminal — evidência real)
                                                       CANCELADA  (terminal — decisão humana)
```

"AÇÃO DE COBRANÇA", "RESPOSTA DO CLIENTE" e "ACOMPANHAMENTO" (linguagem da
missão) não são `status` — são **eventos** (`cobranca_acoes`,
`EventoCobranca`) que o motor processa através da função única
`aplicarEvento`. Isso evita o mesmo erro que o documento de orçamento já
identificou e evitou: misturar "estado persistido" com "atividade que não
muda o registro".

## D. State machine

`lib/cobranca-state-machine.ts` — código puro, testado, determinístico.

- **Estados** (`CobrancaStatus`): `a_vencer`, `vencida`,
  `aguardando_confirmacao`, `promessa_pausada`, `em_negociacao`, `pausada`,
  `paga` (terminal), `cancelada` (terminal).
- **Grafo de transições** (`TRANSICOES_VALIDAS`/`podeTransicionar`):
  generoso de propósito (a realidade comercial é confusa — um cliente pode
  contestar no meio de uma promessa, pagar durante uma negociação), mas
  nunca permite reabrir um estado terminal.
- **Único ponto de mutação de estado**: `aplicarEvento(cobranca, evento,
  hoje)`. Nove eventos reconhecidos (`tempo_passou`,
  `cliente_informou_pagamento`, `cliente_prometeu_pagamento`,
  `cliente_contestou`, `pagamento_confirmado`, `confirmacao_rejeitada`,
  `pausa_manual`, `retomada_manual`, `cancelamento_manual`). Determinístico:
  mesmo evento + mesma cobrança + mesma data sempre produz o mesmo
  resultado — **nenhum LLM participa desta função**.
- **Guardas de segurança**: `precisaIntervencaoHumana` (contestação e
  limite de tentativas sempre exigem humano — nunca insiste sozinho para
  sempre), `estaPausada` (pausa manual sempre pausa; **toda** promessa
  pausa — com data, enquanto ela estiver vigente; sem data, indefinidamente
  até intervenção humana — corrigido na auditoria pós-construção, ressalva
  B.1: a versão original só pausava promessa com data, deixando uma
  promessa sem data classificada como "não pausada"), `cooldownExpirado`,
  `dentroDoHorarioPermitido`, `podeGerarAcaoAutomatica` (gate único que
  reúne todas as guardas — terminal, pausa, intervenção humana, cooldown,
  horário, opt-out — seguro isoladamente, sem depender da ordem de
  chamada de `decidirExecucao`).
- **Deduplicação**: `podeCriarCobranca` — no máximo uma cobrança ativa
  (não-terminal) por orçamento. `chaveIdempotenciaAcao` — chave
  determinística `(cobrancaId, tipoAcao, dia)`, mesmo padrão de
  `idempotency_key` já usado em `orcamentos`.
- **Receita recuperada**: `classificarComoReceitaRecuperada` — ver seção I.

`lib/motor-cobranca.ts` — orquestração sobre a state machine:

- `classificarRespostaCliente(texto, hoje)`: classificação **determinística
  por regex** (nunca LLM) em `informou_pagamento` / `prometeu_pagamento` /
  `contestou` / `sem_classificacao`. Contestação tem precedência sobre
  pagamento/promessa quando os padrões colidem. Extrai data prometida só
  quando explícita no texto (`DD/MM[/AAAA]`) — nunca adivinha "sexta" ou
  "semana que vem".
- `tipoProximaAcao(cobranca, hoje, janelaLembreteDias)`: decide **qual**
  ação cabe (`lembrete_antecipado` / `aviso_vencida` /
  `cobranca_promessa_expirada`), nunca decide **se** deve executar.
- `gerarMensagemCobranca`: templates fixos e determinísticos (nunca
  gerados por LLM sem revisão) para as 6 intenções da missão — nunca
  inventa desconto ou prazo que ninguém combinou.
- `decidirExecucao`: o motor de autonomia (seção G).

## E. Código construído

| Arquivo | O que é | Testes |
|---|---|---|
| `lib/cobranca-state-machine.ts` | Estados, transições, guardas, dedup, idempotência, receita recuperada | 33 |
| `lib/motor-cobranca.ts` | Classificação de resposta, próxima ação, mensagens, motor de autonomia | 23 |
| `lib/oportunidades-clientes.ts` (estendido) | Novo sinal `cobranca_vencida` — maior prioridade interna do motor | 6 novos testes de integração |
| `lib/nucleo-inteligente.ts` (estendido) | `TIPOS_COBRANCA`, evidência própria ("histórico real de cobranças"), TIER atualizado | cobertos pelos testes acima |
| `lib/ia-comercial.ts` (estendido) | Recomendação consultiva para `cobranca_vencida` — nunca usa "inadimplente" | coberto pelos testes acima |
| `docs/financeiro-inteligente-cobrador-ai-v1-arquitetura.md` | Este documento | — |
| `tests/cobranca-state-machine.test.mjs`, `tests/motor-cobranca.test.mjs` | Suítes node:test contra o build real | 56 testes novos |
| `tests/oportunidades-clientes.smart-commerce.test.mjs` (estendido) | Regressão + integração do novo sinal | 6 testes novos |
| `tests/README-TESTES.md` | Atualizado com os 2 novos módulos | — |

**Nota de unidade monetária (fronteira deliberada entre camadas)**: os
tipos de `lib/oportunidades-clientes.ts` (incluindo `CobrancaVencida.valor`)
usam **reais** (mesma convenção de `OrcamentoEnviado.valor` já existente
naquele arquivo); `lib/cobranca-state-machine.ts`/`lib/motor-cobranca.ts`
usam **centavos** (`valorCentavos`, mesma convenção de
`orcamentos.valor_centavos`/`calcularStatusPagamento`). A conversão
acontece na borda, em quem monta a entrada do Radar a partir de uma
`Cobranca` real — nunca dentro de nenhum dos dois motores.

## F. Integração com Smart Commerce/Radar/Central/lifecycle

Nenhuma Central nova. O sinal `cobranca_vencida` entra pela MESMA
`gerarOportunidadesClientes` (novo campo opcional `cobrancasVencidas?:
CobrancaVencida[]`), herdando automaticamente dedup por telefone,
`adaptarOportunidadesClientes` → Sinal Canônico → `organizarSinaisCanonicos`
→ Próxima Melhor Ação → Missão do Dia → `gerarRecomendacoesConsultivas`
(Diretor Digital) — exatamente o padrão já provado por
`orcamento_aceito_sem_agendamento` e pelos sinais heurísticos anteriores.

**Prioridade interna**: `cobranca_vencida` é o `PESO_TIPO`/`TIER` **0/1** —
o mais alto de todo o motor, inclusive acima de
`cancelamento_sem_reagendamento`. **Auditoria pós-construção (ressalva
B.2)**: esta é uma **prioridade inicial de produto**, não uma verdade
objetiva provada — a ordenação é só por tipo de sinal, sem pesar valor,
dias de atraso ou risco de perda do relacionamento; uma cobrança pequena
vencida hoje desloca, sem distinção, um cancelamento sem reagendamento de
valor muito maior. Mantida sem alteração nesta V1 por decisão explícita do
REI após a auditoria — deverá evoluir para priorização
econômica/contextual quando houver valores, atraso e demais evidências
confiáveis disponíveis a este motor.

Fluxo completo, como a missão pediu como exemplo:

```
cobranca vencida (lib/cobranca-state-machine.ts: estaVencida)
  → sinal "cobranca_vencida" (lib/oportunidades-clientes.ts)
  → Sinal Canônico (lib/nucleo-inteligente.ts)
  → Radar / Central de Oportunidades / Próxima Melhor Ação / Missão do Dia
  → Cobrador AI decide executar ou sugerir (lib/motor-cobranca.ts: decidirExecucao)
  → (quando pago) pagamento_confirmado → cobranca "paga"
  → lifecycle econômico / Financeiro Inteligente / prova de resultado
```

Nenhum motor duplicado: `gerarOportunidadesClientes`,
`organizarSinaisCanonicos` e `gerarRecomendacoesConsultivas` continuam
sendo os únicos pontos de priorização e apresentação em todo o produto.

## G. Modelo de autonomia

Três modos (`ModoAutonomia`), implementados em `decidirExecucao`
(`lib/motor-cobranca.ts`):

- **`sugerir`**: sempre prepara a ação (tipo + mensagem) e devolve
  `requerAprovacao: true` — humano decide se envia.
- **`aprovar`**: mesmo contrato de retorno que `sugerir` neste motor puro
  (`requerAprovacao: true`) — a diferença entre os dois modos é de
  **processo/UI** (ex.: fila de aprovação explícita vs. sugestão solta),
  não de dado; ambos nunca executam sozinhos.
- **`automatico`**: só retorna `requerAprovacao: false` (executa sozinho)
  quando **todas** as guardas de `podeGerarAcaoAutomatica` passam
  (não-terminal, não-pausada, sem necessidade de intervenção humana,
  cooldown expirado, dentro do horário permitido, sem opt-out). **Fail-
  closed por construção**: qualquer guarda não satisfeita rebaixa para
  `requerAprovacao: true` — o motor nunca descarta silenciosamente uma
  ação necessária, só evita executá-la sozinho fora das regras.

Nenhum dos três modos jamais dispara um envio real nesta sessão —
`decidirExecucao` só **prepara** a ação (`AcaoPreparada`); quem chama
(rota futura) decide se e quando efetivamente chama `/api/whatsapp`.

## H. Regra de pagamento confirmado

Espelha exatamente a disciplina de
`docs/orcamento-venda-receita-v1-arquitetura.md` seção 8 (receita prevista
≠ orçamento aceito ≠ receita comprovada), aplicada ao ciclo de cobrança:

1. **"Cliente disse que pagou"** (`cliente_informou_pagamento`) → estado
   `aguardando_confirmacao`. **Nunca** transiciona direto para `paga`.
   `tipoProximaAcao` retorna `null` nesse estado — o motor nunca gera nova
   cobrança automática enquanto aguarda confirmação (não faz sentido
   cobrar alguém que acabou de dizer que pagou, nem assumir que pagou
   antes de checar).
2. **Confirmação real** (`pagamento_confirmado`) — só deve ser emitido por
   quem tem evidência real (reconciliação manual por um operador humano
   hoje; eventualmente um webhook de gateway de pagamento, gate externo
   fora de escopo aqui) → único caminho para `paga`, o único estado que
   representa "receita comprovada" neste domínio.
3. **Alegação rejeitada** (`confirmacao_rejeitada`) — só válida a partir
   de `aguardando_confirmacao`; volta a cobrar (`vencida`/`a_vencer`
   conforme o vencimento real).
4. `precisaIntervencaoHumana` marca `aguardando_confirmacao` como
   exigindo humano **sempre** — confirmar evidência de pagamento nunca é
   uma decisão automática, mesmo no modo `automatico`.

## I. Regra de receita recuperada

Conservadora e auditável, exatamente como a missão pediu — nunca chama
qualquer pagamento de "receita recuperada" por padrão. **Contrato
endurecido na auditoria pós-construção (ressalva B.3)**: a função não
recebe mais um contador pré-filtrado — recebe a evidência bruta e faz ela
mesma a verificação, para que um chamador futuro não consiga produzir um
falso positivo só por calcular mal um número antes de chamar:

```ts
type EvidenciaAcaoCobranca = {
  statusExecucao: "pendente" | "aprovada" | "executada" | "rejeitada";
  executadoEm: string | null; // só relevante quando statusExecucao === "executada"
};

type EvidenciaRecuperacao = {
  esteveVencida: boolean;
  pagamentoConfirmadoEm: string | null; // null = pagamento não confirmado (inclui "só informado")
  acoes: EvidenciaAcaoCobranca[];
};

function classificarComoReceitaRecuperada(evidencia: EvidenciaRecuperacao): boolean {
  if (!evidencia.esteveVencida) return false;
  if (evidencia.pagamentoConfirmadoEm === null) return false;
  return evidencia.acoes.some(acao =>
    acao.statusExecucao === "executada" &&
    acao.executadoEm !== null &&
    acao.executadoEm < evidencia.pagamentoConfirmadoEm!
  );
}
```

Só é "recuperada" quando **as quatro condições** são verdadeiras,
verificadas pela própria função a partir de dado bruto, nunca de um
resumo que o chamador já entregou pronto:
1. A cobrança esteve, em algum momento real, em estado `vencida`.
2. O pagamento foi **confirmado** (`pagamentoConfirmadoEm` não-nulo —
   "cliente informou que pagou" nunca preenche este campo).
3. Existe pelo menos uma ação com `statusExecucao === "executada"` —
   `pendente`, `aprovada` e `rejeitada` nunca contam, mesmo que
   `executadoEm` venha preenchido por engano.
4. O `executadoEm` dessa ação é anterior a `pagamentoConfirmadoEm`.

Pagamento espontâneo (sem cobrança vencida), pagamento ainda não
confirmado, ou toda ação executada depois do pagamento (ou nunca
executada de fato) é classificado só como **"pagamento recebido"** —
nunca "recuperado". Sem essa evidência de causalidade, o sistema nunca
infere que sua própria automação foi a causa do pagamento.

## J. Schema / migration preparada — NÃO EXECUTADA

Como nos dois blocos anteriores, **não copiada para
`supabase/migrations/`** — fica só neste documento. Requer novo GO
explícito.

### J.1 `cobrancas` — núcleo do domínio

```sql
-- PROPOSTA — auditoria apenas, NÃO EXECUTAR sem GO explícito.
CREATE TABLE IF NOT EXISTS cobrancas (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id        UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  orcamento_id      UUID REFERENCES orcamentos(id) ON DELETE SET NULL,
  nome_cliente      TEXT NOT NULL,
  telefone          TEXT,
  descricao         TEXT NOT NULL,
  valor_centavos    INTEGER NOT NULL CHECK (valor_centavos > 0),
  vencimento        DATE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'a_vencer' CHECK (status IN
                      ('a_vencer','vencida','aguardando_confirmacao','promessa_pausada','em_negociacao','pausada','paga','cancelada')),
  promessa_data     DATE,
  cliente_opt_out   BOOLEAN NOT NULL DEFAULT FALSE,
  tentativas        INTEGER NOT NULL DEFAULT 0,
  ultima_acao_em    TIMESTAMPTZ,
  criado_por        UUID,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key   TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS cobrancas_idempotency_key_uidx
  ON cobrancas (clinica_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
-- No máximo uma cobrança ATIVA por orçamento (dedup real, não só em código):
CREATE UNIQUE INDEX IF NOT EXISTS cobrancas_orcamento_ativa_uidx
  ON cobrancas (orcamento_id)
  WHERE orcamento_id IS NOT NULL AND status NOT IN ('paga','cancelada');
CREATE INDEX IF NOT EXISTS cobrancas_clinica_status_idx ON cobrancas (clinica_id, status);
```

### J.2 `cobranca_acoes` — trilha de auditoria de cada decisão

```sql
CREATE TABLE IF NOT EXISTS cobranca_acoes (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cobranca_id       UUID NOT NULL REFERENCES cobrancas(id) ON DELETE CASCADE,
  clinica_id        UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  tipo_acao         TEXT NOT NULL CHECK (tipo_acao IN
                      ('lembrete_antecipado','aviso_vencida','cobranca_promessa_expirada')),
  modo_autonomia    TEXT NOT NULL CHECK (modo_autonomia IN ('sugerir','aprovar','automatico')),
  canal             TEXT NOT NULL DEFAULT 'whatsapp',
  mensagem_texto    TEXT NOT NULL,
  status_execucao   TEXT NOT NULL DEFAULT 'pendente' CHECK (status_execucao IN
                      ('pendente','aprovada','executada','rejeitada')),
  motivo            TEXT NOT NULL,  -- evidência da decisão (ver seção D — nunca "porque a IA achou")
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executado_em      TIMESTAMPTZ,
  aprovado_por      UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS cobranca_acoes_idempotencia_uidx
  ON cobranca_acoes (cobranca_id, tipo_acao, (executado_em::date))
  WHERE executado_em IS NOT NULL;
CREATE INDEX IF NOT EXISTS cobranca_acoes_cobranca_idx ON cobranca_acoes (cobranca_id, criado_em);
```

### J.3 `promessas_pagamento` — histórico completo de promessas

```sql
CREATE TABLE IF NOT EXISTS promessas_pagamento (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cobranca_id     UUID NOT NULL REFERENCES cobrancas(id) ON DELETE CASCADE,
  clinica_id      UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  data_prometida  DATE,               -- nullable: promessa sem data explícita (ver lib/motor-cobranca.ts)
  origem_texto    TEXT,               -- a mensagem real que gerou a promessa — nunca resumida/reescrita
  criada_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cumprida        BOOLEAN,            -- null = ainda não se sabe; nunca inferido antes de um evento real
  cumprida_em     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS promessas_pagamento_cobranca_idx ON promessas_pagamento (cobranca_id);
```

### J.4 `pagamentos` — única fonte de evidência de pagamento (converge `orcamento_pagamentos`)

```sql
CREATE TABLE IF NOT EXISTS pagamentos (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cobranca_id     UUID NOT NULL REFERENCES cobrancas(id) ON DELETE CASCADE,
  clinica_id      UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  valor_centavos  INTEGER NOT NULL CHECK (valor_centavos > 0),
  pago_em         TIMESTAMPTZ NOT NULL,
  metodo          TEXT,               -- pix, cartao, dinheiro etc. — texto livre nesta fase
  origem          TEXT NOT NULL CHECK (origem IN ('manual','gateway')), -- 'gateway' só quando existir integração real (nenhuma existe hoje)
  confirmado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- sempre setado: esta tabela SÓ guarda evidência já confirmada
  confirmado_por  UUID NOT NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pagamentos_cobranca_idx ON pagamentos (cobranca_id);
```

**Nota de convergência**: esta tabela substitui, na prática, a
`orcamento_pagamentos` desenhada em
`docs/orcamento-venda-receita-v1-arquitetura.md` seção 3.2/9.5/9.6 — mesma
função (única fonte de "receita comprovada"), ligada a `cobranca_id` em
vez de diretamente a `orcamento_id` (uma cobrança já carrega o
`orcamento_id` quando existe um). Evita duas tabelas paralelas de
evidência de pagamento no mesmo produto.

### J.5 RLS fail-closed — mesmo contrato já estabelecido

```sql
ALTER TABLE cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobranca_acoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promessas_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cobrancas_select" ON cobrancas FOR SELECT USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "cobrancas_insert" ON cobrancas FOR INSERT WITH CHECK (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "cobrancas_update" ON cobrancas FOR UPDATE USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
-- Mesmas três policies (select/insert/update) em cobranca_acoes e
-- promessas_pagamento — omitidas aqui por repetição.

-- `pagamentos`: SELECT/INSERT normais, mas SEM policy de UPDATE — um
-- registro de pagamento confirmado é imutável por design (corrigir um
-- lançamento errado é um novo registro + auditoria, nunca um UPDATE
-- silencioso sobre "receita comprovada").
CREATE POLICY "pagamentos_select" ON pagamentos FOR SELECT USING (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));
CREATE POLICY "pagamentos_insert" ON pagamentos FOR INSERT WITH CHECK (
  clinica_id IN (SELECT clinica_id FROM clinica_usuarios WHERE usuario_id = auth.uid()));

-- Nenhuma tabela tem policy de DELETE — fail-closed nativo do Postgres
-- (ausência de policy nega a operação inteira), mesmo padrão já
-- documentado em docs/orcamento-venda-receita-v1-arquitetura.md seção 7.
```

Qualquer rota `/api/cobrancas/*` futura segue **exatamente** o contrato de
aplicação já fechado naquele mesmo documento, seção 7.1: nunca confiar em
`clinica_id` do corpo/query, `auth.uid()` sempre via
`autorizarUsuarioNaClinica`, `.eq('clinica_id', ...)` explícito em toda
query como defesa em profundidade.

**Impacto**: aditivo — 4 tabelas novas, nenhuma coluna existente tocada,
nenhuma linha de `orcamentos`/`agendamentos` afetada. **Rollback**:
`DROP TABLE IF EXISTS pagamentos, promessas_pagamento, cobranca_acoes, cobrancas;`
(ordem inversa de dependência).

## K. Testes / gates de validação executados

- **181/181 testes** (`node --test`) — 125 já existentes (blocos
  anteriores, intactos, confirmando não-regressão) + 56 novos do Cobrador
  AI (33 `cobranca-state-machine` + 23 `motor-cobranca`) + 6 novos de
  integração/regressão em `oportunidades-clientes.smart-commerce.test.mjs`.
- Casos obrigatórios da missão, todos cobertos: cobrança a vencer,
  vencimento, tentativa idempotente, cooldown, pagamento informado ≠
  confirmado, promessa pausa cobrança, contestação exige humano, pagamento
  confirmado encerra, não cobrar pago, cancelamento, limite de tentativas,
  receita recuperada conservadora, regressão dos motores existentes.
  (Tenant isolation: não há lógica cross-tenant dentro destes motores
  puros — cada chamada já opera sobre dados de uma única `clinica_id`
  resolvida por quem chama; o isolamento real fica nas policies de RLS —
  seção J.5 — e no contrato de aplicação de
  `docs/orcamento-venda-receita-v1-arquitetura.md` seção 7.1, ambos
  reafirmados aqui, não teste de unidade sobre função pura.)
- `npx tsc --noEmit` — limpo, projeto inteiro.
- `npx eslint` nos arquivos novos/tocados — limpo.
- `next build` — **não aplicável nesta sessão**: nenhum arquivo em `app/`
  foi tocado (só `lib/`, `tests/`, `docs/`).
- `git diff --check` — ver saída ao final da entrega.

## Próximo gate objetivo

1. Auditoria do REI sobre este bloco.
2. Aprovar e executar a migration (seção J) — só depois, construir
   `/api/cobrancas/*` seguindo o contrato fail-closed já estabelecido, e
   uma superfície de UI mínima (a receber / vencido / ações necessárias /
   promessas / aguardando confirmação / pago / recuperado comprovadamente
   — só com dado real, zero número demonstrativo).
3. Ligar `decidirExecucao` a um cron real (mesmo padrão de
   `app/api/cron/avaliacoes/route.ts`) — só depois da migration, nunca
   antes, para não gerar `cobranca_acoes` órfãs de um schema que não existe.
4. Gate externo (fora de escopo indefinidamente, até decisão do REI):
   integração com gateway de pagamento real, para `pagamentos.origem =
   'gateway'` deixar de ser hipotético.

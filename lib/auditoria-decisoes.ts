// ── Auditoria das Decisões da IA V1 ──────────────────────────────────────
// Responde: "por que o OrganizaPro recomendou/decidiu isso, com quais
// dados, e o que aconteceu depois?" Domínio puro (sem DB/HTTP) — menor
// camada necessária, não observabilidade genérica.
//
// ── Precheck ──────────────────────────────────────────────────────────
// A) Motores determinísticos: lib/oportunidades-clientes.ts (Radar),
//    lib/nucleo-inteligente.ts, lib/recomendacoes.ts, lib/follow-up-
//    comercial.ts, lib/motor-cobranca.ts (elegivelParaTentativaCobranca),
//    lib/agenda-autonoma.ts, lib/receita-perdida.ts, lib/previsor-
//    faturamento.ts, lib/linha-economica.ts, lib/memoria-proveniencia.ts
//    — todos regra pura, zero chamada a modelo.
// B) Só apresentam informação (nunca decidem): Dashboard, Cliente 360.
// C) Usam IA generativa real: app/api/ia/route.ts (Conteúdo IA, OpenAI).
//    lib/ia-comercial.ts, apesar do nome, já documenta no próprio
//    cabeçalho: "Camada 1 — templates determinísticos... Nenhuma
//    chamada a IA generativa" — narrativa é 100% regra, não modelo.
// D) Já deixa evidência: eventos_dominio para transições de status
//    (orcamento./tratamento./cobranca./pedido.) e para tentativas
//    (cobranca.tentativa, followup.tentativa) — mas SÓ o que aconteceu
//    COM a entidade depois, nunca POR QUE uma recomendação apareceu.
// E) Lacuna real: nenhum registro estruturado de "este motor recomendou
//    isso, com estes sinais reais" no momento em que a decisão é
//    confirmada — por isso esta missão.
//
// ── Princípio: evidência, nunca raciocínio ──────────────────────────────
// NUNCA registra chain-of-thought, prompt interno ou "como o modelo
// pensou" — só o FATO estruturado que já existia antes da recomendação
// (o mesmo sinal/dado que o motor determinístico já usou) e a decisão
// resultante (um código curto de ação, nunca um parágrafo). A narrativa
// apresentada ao usuário (texto de mensagem, explicação em prosa) NUNCA
// é tratada como fonte — é sempre derivada de um sinaisUtilizados real,
// nunca o contrário.
//
// ── Reaproveitamento de eventos_dominio (provado suficiente) ────────────
// Mesmo padrão já usado 4 vezes nesta sessão (Cobrador Digital, Follow-
// up Comercial, Memória com Proveniência): clinica_id, tipo (texto
// livre), entidade_tipo, entidade_id, chave_idempotencia (única),
// payload (jsonb, mantido mínimo e estruturado — nunca um depósito de
// texto livre), criado_em. Zero coluna nova, zero migration.
//
// ── Distinto de Memória com Proveniência ────────────────────────────────
// Memória responde "o que sabemos e de onde". Auditoria responde "qual
// decisão foi produzida a partir de quais evidências". Nunca a mesma
// estrutura: uma decisão auditada pode citar uma memória como um dos
// sinais de entrada (referência, nunca duplicação), mas o registro em
// si é sempre sobre a DECISÃO, não sobre o FATO subjacente.

export type MotorConhecido =
  | "radar" | "nucleo-inteligente" | "recomendacoes" | "follow-up-comercial"
  | "cobrador-digital" | "agenda-autonoma" | "receita-perdida" | "previsor-faturamento"
  | "linha-economica" | "memoria-proveniencia" | "fechamento-contabil";

const MOTORES_CONHECIDOS: readonly MotorConhecido[] = [
  "radar", "nucleo-inteligente", "recomendacoes", "follow-up-comercial",
  "cobrador-digital", "agenda-autonoma", "receita-perdida", "previsor-faturamento",
  "linha-economica", "memoria-proveniencia", "fechamento-contabil",
];

export type SinalUtilizado = {
  campo: string; // nome do campo/predicado real usado (ex.: "status", "dias_atraso")
  valor: string | number | boolean | null; // valor real observado, nunca inferido
};

export type EvidenciaDecisao = {
  clinicaId: string;
  motor: MotorConhecido;
  versaoRegra?: string; // opcional, quando disponível (ex.: "follow-up-comercial-v1")
  tipoDecisao: string; // código curto (ex.: "orcamento_parado"), nunca uma frase
  entidadeTipo: string;
  entidadeId: string;
  clienteId: string | null; // paciente_id ou telefone normalizado, quando disponível
  sinaisUtilizados: SinalUtilizado[]; // dados estruturados reais — nunca vazio, nunca texto livre
  decisao: string; // código curto da recomendação/ação (ex.: "registrar_contato"), nunca a narrativa/mensagem
  observadoEm: string; // timestamptz ISO — quando os sinais foram observados
};

export type ResultadoValidacaoEvidencia = { valido: true } | { valido: false; motivo: string };

/**
 * Fail-closed: sem motor conhecido, sem entidade real, sem ao menos um
 * sinal estruturado real, ou sem uma decisão codificada, a decisão
 * NUNCA é registrada como auditável.
 */
export function validarEvidenciaDecisao(evidencia: EvidenciaDecisao): ResultadoValidacaoEvidencia {
  if (!MOTORES_CONHECIDOS.includes(evidencia.motor)) return { valido: false, motivo: "motor desconhecido — nunca audita decisão de origem não identificada" };
  if (!evidencia.entidadeId || !evidencia.entidadeId.trim()) return { valido: false, motivo: "entidade real ausente" };
  if (!evidencia.sinaisUtilizados || evidencia.sinaisUtilizados.length === 0) return { valido: false, motivo: "sem sinal/fato estruturado real — nunca audita decisão sem evidência" };
  if (!evidencia.decisao || !evidencia.decisao.trim()) return { valido: false, motivo: "decisão/recomendação ausente" };
  if (!evidencia.tipoDecisao || !evidencia.tipoDecisao.trim()) return { valido: false, motivo: "tipo de decisão ausente" };
  return { valido: true };
}

export type RegistroAuditoriaPreparado = {
  chaveIdempotencia: string;
  tipoEvento: "auditoria.decisao";
  entidadeTipo: string;
  entidadeId: string;
  payload: {
    motor: MotorConhecido;
    versao_regra: string | null;
    tipo_decisao: string;
    cliente_id: string | null;
    sinais_utilizados: SinalUtilizado[];
    decisao: string;
    observado_em: string;
  };
};

/**
 * Prepara o registro de auditoria (payload mínimo estruturado + chave
 * de idempotência determinística), pronto para eventos_dominio — nunca
 * persiste nada aqui. Retorna null quando a evidência é insuficiente —
 * fail-closed, nunca fabrica uma decisão auditável sem prova real.
 */
export function prepararRegistroAuditoria(evidencia: EvidenciaDecisao): RegistroAuditoriaPreparado | null {
  const validacao = validarEvidenciaDecisao(evidencia);
  if (!validacao.valido) return null;

  // Determinística: a MESMA decisão (mesma entidade + tipo + momento
  // observado) nunca duplica por duplo clique/retry — mesmo padrão já
  // usado em Cobrador/Follow-up/Memória.
  const chaveIdempotencia = `${evidencia.entidadeId}:auditoria.decisao:${evidencia.tipoDecisao}:${evidencia.observadoEm}`;

  return {
    chaveIdempotencia,
    tipoEvento: "auditoria.decisao",
    entidadeTipo: evidencia.entidadeTipo,
    entidadeId: evidencia.entidadeId,
    payload: {
      motor: evidencia.motor,
      versao_regra: evidencia.versaoRegra ?? null,
      tipo_decisao: evidencia.tipoDecisao,
      cliente_id: evidencia.clienteId,
      sinais_utilizados: evidencia.sinaisUtilizados,
      decisao: evidencia.decisao,
      observado_em: evidencia.observadoEm,
    },
  };
}

// ── Resultado posterior — sequência, nunca causalidade ──────────────────

export type ResultadoPosterior = {
  clinicaId: string;
  decisaoOrigemChave: string; // chaveIdempotencia da decisão original (referência, nunca duplica payload)
  entidadeTipo: string;
  entidadeId: string;
  fatoObservado: string; // código curto do fato real observado depois (ex.: "orcamento_aprovado", "cobranca_paga")
  observadoEm: string;
};

export type RegistroResultadoPreparado = {
  chaveIdempotencia: string;
  tipoEvento: "auditoria.resultado_posterior";
  entidadeTipo: string;
  entidadeId: string;
  payload: {
    decisao_origem_chave: string;
    fato_observado: string;
    observado_em: string;
    prova_causalidade: false; // sempre false — sequência prova rastreabilidade, nunca causa. Ver lib/linha-economica.ts para autoridade financeira real.
  };
};

/**
 * Prepara o vínculo entre uma decisão e um fato posterior REAL (mesma
 * entidade). NUNCA afirma causalidade — o campo prova_causalidade é
 * sempre `false`, documentando explicitamente que isto é só sequência/
 * rastreabilidade. Nunca usado para atribuir receita: lib/linha-
 * economica.ts continua sendo a única autoridade financeira do produto.
 */
export function prepararVinculoResultado(resultado: ResultadoPosterior): RegistroResultadoPreparado | null {
  if (!resultado.decisaoOrigemChave || !resultado.decisaoOrigemChave.trim()) return null; // sem decisão de origem real, nunca vincula
  if (!resultado.entidadeId || !resultado.entidadeId.trim()) return null;
  if (!resultado.fatoObservado || !resultado.fatoObservado.trim()) return null;

  const chaveIdempotencia = `${resultado.entidadeId}:auditoria.resultado_posterior:${resultado.fatoObservado}:${resultado.observadoEm}`;

  return {
    chaveIdempotencia,
    tipoEvento: "auditoria.resultado_posterior",
    entidadeTipo: resultado.entidadeTipo,
    entidadeId: resultado.entidadeId,
    payload: {
      decisao_origem_chave: resultado.decisaoOrigemChave,
      fato_observado: resultado.fatoObservado,
      observado_em: resultado.observadoEm,
      prova_causalidade: false,
    },
  };
}

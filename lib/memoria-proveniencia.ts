// ── Memória com Proveniência V1 ──────────────────────────────────────────
// Responde: "quando o OrganizaPro afirma que sabe alguma coisa sobre um
// cliente ou processo, conseguimos provar de onde essa informação veio?"
// Domínio puro (sem DB/HTTP) — menor camada necessária, não um sistema
// de memória genérico. Representa FATOS OPERACIONAIS com proveniência
// obrigatória, nunca opiniões ou inferências da IA.
//
// ── Precheck — patrimônio encontrado ─────────────────────────────────
// Busca em git log --all e grep de código: ZERO patrimônio de "AI
// Memory"/"memória" em todo o histórico do OrganizaPro.
//
// ACHADO — public.ai_memory_insights JÁ EXISTE no schema real de
// produção (schema-producao-organizapro-20260919.sql, linhas 248-268),
// com colunas muito próximas do que esta missão pede (origem,
// observado_em, valido_ate, confianca...). NÃO REUTILIZADA como fonte
// primária, por quê: (1) CHECK constraint trava `tipo` a um único valor
// literal ("repeticao_prioridade") e `especialista` a um vocabulário
// fechado (gestao/conversao/continuidade/cobranca/reputacao/presenca)
// vindo da arquitetura "IA Comercial" (docs/ia-comercial-v1-
// arquitetura.md) nunca implementada em código — usar essa tabela para
// fatos operacionais genéricos exigiria uma migration só para afrouxar
// esses CHECKs, o que "evitar migration" desaconselha quando existe
// alternativa; (2) grep confirma ZERO código em app/ ou lib/ que already
// leia/escreva essa tabela — é infraestrutura de schema completamente
// dormente, sem risco de quebrar nada ao não usá-la agora, mas também
// sem nenhum precedente de uso real para copiar. Documentado aqui para
// uma missão futura reconsiderar, se um motivo técnico real aparecer
// (ex.: necessidade de índice/consulta dedicada que eventos_dominio não
// atende).
//
// DECISÃO: public.eventos_dominio já provado suficiente — reusado 3
// vezes nesta sessão (Cobrador Digital, Follow-up Comercial) exatamente
// para este tipo de registro: clinica_id, tipo (texto livre),
// entidade_tipo, entidade_id, chave_idempotencia (única), payload
// (jsonb livre), criado_em. Cobre 100% dos campos pedidos pela missão
// (tenant, entidade de origem, id, tipo do fato, conteúdo estruturado,
// fonte, quando aconteceu, quando foi registrado) sem precisar de
// nenhuma coluna nova. Nenhuma migration criada nesta missão.
//
// ── Dois tipos de memória, nunca confundidos ────────────────────────────
// 1. REFERÊNCIA A ENTIDADE CANÔNICA: nunca duplica estado (ex.: "esse
//    orçamento está sem decisão") — a validade NUNCA é lida de um campo
//    congelado no momento do registro; é SEMPRE recalculada em cima do
//    estado ATUAL real da entidade (reaproveitando os mesmos predicados
//    já usados pelo Radar/Follow-up: status de orçamento/cobrança/
//    tratamento/pedido/oportunidade). Isso é o que garante, por
//    construção, que "estado canônico sempre prevalece sobre memória
//    velha" — nunca existe um jeito de a memória "vencer" o dado real,
//    porque ela nunca guarda sua própria verdade sobre isso.
// 2. FATO HUMANO: conteúdo que não existe em nenhuma tabela canônica
//    (ex.: "cliente pediu retorno sexta", "prefere contato à tarde").
//    Tem proveniência humana obrigatória (autor real) e pode ter
//    validoAte explícito; quando há mais de um fato do mesmo tipo para
//    o mesmo cliente, o mais recente (por observadoEm) sempre
//    prevalece — nunca acumula, nunca deixa um fato antigo "ganhar" de
//    um mais novo.
//
// ── Identidade do cliente ────────────────────────────────────────────
// Mesma regra já estabelecida em lib/cliente-360.ts: paciente_id quando
// presente, telefone normalizado como fallback — nunca por nome.

import type { StatusOrcamento } from "./motor-orcamentos";
import type { StatusCobranca } from "./motor-cobranca";
import type { StatusTratamento } from "./motor-tratamento";
import type { OportunidadeStatus } from "./oportunidades-demanda";

export type EntidadeTipoMemoria = "orcamento" | "cobranca" | "tratamento" | "pedido" | "oportunidade" | "agendamento";

export type OrigemMemoria =
  | { tipo: "entidade_canonica"; entidadeTipo: EntidadeTipoMemoria; entidadeId: string }
  | { tipo: "humano"; autorId: string | null; autorNome: string };

export type ClienteRef = { pacienteId: string | null; telefone: string | null };

export type ResultadoValidacaoProveniencia = { valido: true } | { valido: false; motivo: string };

/**
 * Fail-closed: sem uma origem real e identificável, a memória nunca é
 * considerada confiável — nunca persistida como fato.
 */
export function validarProveniencia(origem: OrigemMemoria): ResultadoValidacaoProveniencia {
  if (origem.tipo === "entidade_canonica") {
    if (!origem.entidadeId || !origem.entidadeId.trim()) return { valido: false, motivo: "referência sem id de entidade real" };
    return { valido: true };
  }
  if (origem.tipo === "humano") {
    if (!origem.autorNome || !origem.autorNome.trim()) return { valido: false, motivo: "fato humano sem autor identificado" };
    return { valido: true };
  }
  return { valido: false, motivo: "origem desconhecida" };
}

export type FatoMemoria = {
  clinicaId: string;
  cliente: ClienteRef;
  origem: OrigemMemoria;
  tipoFato: string; // texto livre documentado por quem registra (ex.: "combinado_retorno", "preferencia_contato")
  conteudo: string; // conteúdo estruturado mínimo — nunca um resumo generativo
  observadoEm: string; // timestamptz ISO — quando o fato aconteceu de fato
  validoAte: string | null; // só para fatos humanos com prazo explícito; entidade_canonica nunca usa isso
};

export type RegistroMemoriaPreparado = {
  chaveIdempotencia: string;
  tipoEvento: "memoria.fato";
  entidadeTipo: EntidadeTipoMemoria | "cliente";
  entidadeId: string;
  payload: {
    cliente: ClienteRef;
    origem: OrigemMemoria;
    tipo_fato: string;
    conteudo: string;
    observado_em: string;
    valido_ate: string | null;
  };
};

function normalizarTelefone(t: string | null): string {
  return (t || "").replace(/\D/g, "");
}

/**
 * Prepara o registro (payload + chave de idempotência determinística),
 * pronto para ser inserido em eventos_dominio por uma rota futura —
 * nunca persiste nada aqui (motor puro, sem DB/HTTP). Retorna null
 * quando a proveniência não é válida — fail-closed, nunca fabrica uma
 * origem para permitir o registro.
 */
export function prepararRegistroMemoria(fato: FatoMemoria): RegistroMemoriaPreparado | null {
  const validacao = validarProveniencia(fato.origem);
  if (!validacao.valido) return null;

  const chaveCliente = fato.cliente.pacienteId || normalizarTelefone(fato.cliente.telefone);
  if (!chaveCliente && fato.origem.tipo !== "entidade_canonica") return null; // fato humano sem cliente identificável nunca é registrado

  const entidadeTipo: EntidadeTipoMemoria | "cliente" = fato.origem.tipo === "entidade_canonica" ? fato.origem.entidadeTipo : "cliente";
  const entidadeId = fato.origem.tipo === "entidade_canonica" ? fato.origem.entidadeId : chaveCliente;

  // Determinística: o MESMO fato (mesma entidade + mesmo tipo + mesmo
  // momento observado) nunca duplica por duplo clique/retry. Um fato
  // NOVO (observadoEm diferente) sempre gera uma chave nova — nunca
  // bloqueia um follow-up legítimo futuro.
  const chaveIdempotencia = `${entidadeId}:memoria.fato:${fato.tipoFato}:${fato.observadoEm}`;

  return {
    chaveIdempotencia,
    tipoEvento: "memoria.fato",
    entidadeTipo,
    entidadeId,
    payload: {
      cliente: fato.cliente,
      origem: fato.origem,
      tipo_fato: fato.tipoFato,
      conteudo: fato.conteudo,
      observado_em: fato.observadoEm,
      valido_ate: fato.validoAte,
    },
  };
}

// ── Invalidação — estado canônico sempre prevalece ──────────────────────

export type EstadoAtualEntidade =
  | { entidadeTipo: "orcamento"; status: StatusOrcamento }
  | { entidadeTipo: "cobranca"; status: StatusCobranca }
  | { entidadeTipo: "tratamento"; status: StatusTratamento }
  | { entidadeTipo: "pedido"; status: "criado" | "confirmado" | "aguardando_confirmacao_pagamento" | "pago" | "cancelado" }
  | { entidadeTipo: "oportunidade"; status: OportunidadeStatus }
  | { entidadeTipo: "agendamento" }; // agendamento passado é sempre fato histórico válido, nunca "expira" por status

/**
 * Recalcula, a partir do estado ATUAL real (nunca de um campo
 * congelado), se uma memória de referência ainda representa a
 * realidade. Reaproveita literalmente os mesmos critérios já usados
 * pelo Radar/Follow-up para decidir "ainda está aberto" em cada
 * domínio — nenhuma regra nova.
 */
export function referenciaAindaValida(estado: EstadoAtualEntidade): boolean {
  switch (estado.entidadeTipo) {
    case "orcamento":
      return estado.status === "apresentado";
    case "cobranca":
      return estado.status === "pendente" || estado.status === "em_cobranca";
    case "tratamento":
      return estado.status === "em_andamento" || estado.status === "interrompido" || estado.status === "retorno_agendado" || estado.status === "criado";
    case "pedido":
      return estado.status === "criado" || estado.status === "confirmado" || estado.status === "aguardando_confirmacao_pagamento";
    case "oportunidade":
      return estado.status !== "convertida" && estado.status !== "perdida" && estado.status !== "expirada";
    case "agendamento":
      return true;
  }
}

/**
 * Para fatos humanos com prazo: válido só enquanto `agora` não passou
 * de validoAte. Sem validoAte, o fato não expira por tempo (mas ainda
 * pode ser substituído por um fato mais recente do mesmo tipo).
 */
export function fatoHumanoAindaValido(validoAte: string | null, agora: string): boolean {
  if (!validoAte) return true;
  return agora <= validoAte;
}

// ── Consulta: qual fato vale agora, entre vários registrados ───────────

export type FatoRegistrado = {
  entidadeId: string;
  tipoFato: string;
  conteudo: string;
  origem: OrigemMemoria;
  observadoEm: string;
  validoAte: string | null;
  registradoEm: string; // criado_em do evento — quando entrou no sistema, nunca confundido com observadoEm
};

/**
 * Entre vários fatos humanos do MESMO cliente e MESMO tipo, retorna só
 * o mais recente por observadoEm (nunca acumula, nunca deixa um fato
 * antigo prevalecer sobre um mais novo). Fatos de tipos diferentes
 * nunca se substituem entre si.
 */
export function fatoVigente(fatos: FatoRegistrado[]): FatoRegistrado | null {
  if (fatos.length === 0) return null;
  return [...fatos].sort((a, b) => b.observadoEm.localeCompare(a.observadoEm))[0];
}

/**
 * Ordena uma lista de fatos cronologicamente — mais recente primeiro,
 * por observadoEm (quando o fato aconteceu, nunca por quando foi
 * digitado no sistema).
 */
export function ordenarCronologicamente(fatos: FatoRegistrado[]): FatoRegistrado[] {
  return [...fatos].sort((a, b) => b.observadoEm.localeCompare(a.observadoEm));
}

// ── Núcleo Inteligente V1.1 · Sinal Canônico + Missão do Dia ────────────────
// Ver docs/nucleo-inteligente-v1-arquitetura.md (arquitetura V1.1, homologada
// e congelada em 2026-07-30). Fase 1, primeiro incremento: só o Especialista
// Comercial, só o essencial para a Missão do Dia existir sem duplicar regra
// nenhuma da Próxima Melhor Ação.
//
// Este arquivo NUNCA calcula um sinal novo — ele só traduz (adapta) o que
// lib/oportunidades-clientes.ts e lib/recomendacoes.ts já calculam para o
// formato único do Sinal Canônico, e organiza (ordena + deduplica) esses
// sinais de um jeito compartilhado por qualquer consumidor (hoje: Próxima
// Melhor Ação e Missão do Dia). Nenhuma consulta ao banco aqui — tudo entra
// por parâmetro, já carregado por quem chama.

import type { OportunidadeCliente } from "./oportunidades-clientes";
import type { CategoriaRecomendacao, CentralOportunidades, Recomendacao } from "./recomendacoes";
import { oportunidadeElegivelParaOrcamento, type OportunidadeStatus } from "./oportunidades-demanda";

export type EspecialistaOrigem = "comercial";
export type PrioridadeComercial = "alta" | "media" | "baixa";
export type ConfiancaClassificacao = "alta" | "media" | "baixa";
export type EntidadeTipoComercial =
  | "negocio"
  | "cliente"
  | "agendamento"
  | "oportunidade"
  | "orcamento"
  | "tratamento"
  | "cobranca"
  | "pedido";

// Estrutura mínima definida em docs/nucleo-inteligente-v1-arquitetura.md,
// seção 4.1 — identificado/motivo/ação/evidência (já provado em produção
// pela IA Comercial V1), mais os campos que faltavam para comparar sinais
// de especialistas diferentes no futuro (especialista, chaveDedup).
export type SinalCanonico = {
  id:            string;   // estável entre recarregamentos — mesmo id já usado hoje pela Próxima Melhor Ação
  especialista:  EspecialistaOrigem;
  tipo:          string;   // vocabulário do próprio especialista (nunca inventado aqui)
  prioridade:    PrioridadeComercial; // prioridade comercial; nunca confiança do classificador
  confianca?:    ConfiancaClassificacao | null;
  titulo:        string;
  motivo:        string;
  evidencia:     string;
  acaoSugerida:  string;
  contexto?:     { tipo: "cliente"; nome: string; telefone: string | null }; // ausente = sinal agregado
  chaveDedup:    string;
  criadoEm:      string | null; // null quando não há uma data real associada ao sinal
  entidadeTipo?: EntidadeTipoComercial; // opcional para compatibilidade com sinais V1 já persistidos/testados
  entidadeId?:   string;
  destino?:      string;
  destinoLabel?: string;
  destinoAcao?:  string; // fluxo governado quando a ação recomendada difere da consulta do domínio
  urgencia?:     number | null; // dias reais de espera; usado só como desempate, nunca como score
  dados?:        Record<string, string | number | boolean | null>;
  apresentacao?: {
    categoria: CategoriaRecomendacao;
    explicacao: string;
    impacto: string;
    tempoEstimado: string;
    quantidade: number;
  };
};

// ── Adaptador do Especialista Comercial ──────────────────────────────────
// Traduz literalmente o que os motores já existentes calculam — mesmo
// texto (motivo, ação, título) que já aparece hoje no Radar, na Central de
// Oportunidades e no Diretor Digital. Nenhuma regra de priorização nova.
//
// Cada tipo de sinal sabe de qual motor real veio — a evidência e o
// destino nunca herdam o texto genérico de agendamentos para sinais de
// outra origem (cadeia orçamento → venda → receita, convergência).
const ORIGEM_POR_TIPO: Partial<Record<OportunidadeCliente["sinais"][number]["tipo"], { evidencia: string; destino?: string; destinoLabel?: string }>> = {
  orcamento_parado:       { evidencia: "no orçamento real registrado",  destino: "/orcamentos", destinoLabel: "Ver orçamento" },
  cobranca_atrasada:      { evidencia: "na cobrança real registrada",   destino: "/cobrancas",  destinoLabel: "Ver cobrança" },
  tratamento_sem_retorno: { evidencia: "no tratamento real registrado", destino: "/tratamentos", destinoLabel: "Ver tratamento" },
  pedido_nao_concluido:   { evidencia: "no pedido real registrado", destino: "/pedidos", destinoLabel: "Ver pedido" },
  recompra_possivel:      { evidencia: "no histórico real de pedidos", destino: "/pedidos", destinoLabel: "Ver pedidos" },
  // P1.2 — Gerente Comercial AI: fechar a cadeia sinal→ação. Estes dois
  // tipos são fundamentalmente sobre um COMPROMISSO real (confirmar hoje,
  // reagendar um horário cancelado) — antes caíam no destino padrão
  // genérico (/clientes), que nunca abre o compromisso em questão. Corrige
  // a ligação, sem criar sinal nem regra nova.
  confirmacao_pendente:            { evidencia: "no compromisso real registrado", destino: "/agendamentos", destinoLabel: "Confirmar na agenda" },
  cancelamento_sem_reagendamento:  { evidencia: "no cancelamento real registrado", destino: "/agendamentos", destinoLabel: "Reagendar" },
};
const ORIGEM_PADRAO = { evidencia: "no histórico real de agendamentos", destino: "/clientes" as string | undefined, destinoLabel: "Ver cliente" as string | undefined };

export function adaptarOportunidadesClientes(oportunidades: OportunidadeCliente[]): SinalCanonico[] {
  return oportunidades.map(op => {
    const principal = op.sinais[0];
    const origem = ORIGEM_POR_TIPO[principal.tipo] ?? ORIGEM_PADRAO;
    return {
      id:           `cliente-${op.chave}`,
      especialista: "comercial",
      tipo:         principal.tipo,
      prioridade:   op.prioridade,
      titulo:       `${op.nome} — ${op.acaoSugerida}`,
      motivo:       op.motivoPrincipal,
      evidencia:    op.tempoDecorrido
        ? `Identificado ${origem.evidencia}, ${op.tempoDecorrido}.`
        : `Identificado ${origem.evidencia}.`,
      acaoSugerida: op.acaoSugerida,
      contexto:     { tipo: "cliente" as const, nome: op.nome, telefone: op.telefone },
      chaveDedup:   op.chave,
      criadoEm:     null,
      entidadeTipo: principal.entidadeTipo,
      entidadeId:   principal.entidadeId,
      destino:      principal.destino || origem.destino,
      destinoLabel: origem.destinoLabel,
      destinoAcao:  principal.destinoAcao,
      urgencia:     principal.diasDesdeEvento,
      apresentacao: {
        categoria: "oportunidade" as const,
        explicacao: principal.motivo,
        impacto: principal.acaoSugerida,
        tempoEstimado: principal.tempoDecorrido ?? "Agora",
        quantidade: 1,
      },
    };
  });
}

export function adaptarRecomendacoes(recomendacoes: Recomendacao[]): SinalCanonico[] {
  return recomendacoes.map(r => ({
    id:           `rec-${r.id}`,
    especialista: "comercial",
    tipo:         r.id,
    prioridade:   r.prioridade,
    titulo:       r.titulo,
    // `motivo` aqui é o mesmo campo `r.motivo` que a Próxima Melhor Ação já
    // usa hoje (preserva o texto exatamente como já está em produção); a
    // versão consultiva de "por que importa" (`r.explicacao`) é a que
    // lib/ia-comercial.ts já usa por conta própria, sem relação com este
    // adaptador.
    motivo:       r.motivo,
    evidencia:    `${r.quantidade} ${r.quantidade === 1 ? "registro real" : "registros reais"}.`,
    acaoSugerida: r.acao,
    chaveDedup:   `rec:${r.id}`,
    criadoEm:     null,
    entidadeTipo: "negocio",
    destino:      r.destino,
    destinoLabel: r.destinoLabel,
    apresentacao: {
      categoria: r.categoria,
      explicacao: r.explicacao,
      impacto: r.impacto,
      tempoEstimado: r.tempoEstimado,
      quantidade: r.quantidade,
    },
  }));
}

// ── Adaptador do primeiro elo do Smart Commerce (P1: Reintegração) ──────
// "Interesse sem compra" (public.oportunidades_demanda) — capturado via
// WhatsApp/manual/site, hoje isolado na tela /oportunidades e nunca
// enxergado pela Missão do Dia/Próxima Melhor Ação. Reaproveita 100% o
// predicado real que já trava a geração de orçamento (nunca uma regra de
// elegibilidade nova) e a própria classificação de confiança já registrada
// na oportunidade (nunca uma prioridade inventada aqui).
export type OportunidadeDemandaSinal = {
  id: string;
  canal: "whatsapp" | "manual" | "site";
  telefone: string;
  nome_informado: string | null;
  status: OportunidadeStatus;
  confianca_classificacao: "alta" | "media" | "baixa";
  orcamento_vinculado_id: string | null;
};

// Interesse real ainda sem orçamento é uma oportunidade comercial de
// prioridade média. A confiança descreve a certeza da classificação da
// origem, não a urgência de agir — por isso os dois conceitos permanecem
// separados. Oportunidade parada (>= limiar do Follow-up) continua alta no
// motor operacional próprio, sem ser inferida neste adaptador sem data.
const PRIORIDADE_COMERCIAL_POR_TIPO: Record<string, PrioridadeComercial> = {
  cancelamento_sem_reagendamento: "alta",
  orcamento_parado: "alta",
  cobranca_atrasada: "alta",
  pedido_nao_concluido: "alta",
  confirmacao_pendente: "alta",
  oportunidade_parada: "alta",
  interesse_sem_orcamento: "media",
  tratamento_sem_retorno: "media",
  recompra_possivel: "media",
  sem_proximo_compromisso: "media",
};

export function prioridadeComercialParaTipo(
  tipo: string,
  prioridadeLegada: PrioridadeComercial = "media"
): PrioridadeComercial {
  return PRIORIDADE_COMERCIAL_POR_TIPO[tipo] ?? prioridadeLegada;
}

const CANAL_LABEL_DEMANDA: Record<OportunidadeDemandaSinal["canal"], string> = {
  whatsapp: "WhatsApp", manual: "contato manual", site: "site",
};

export function adaptarOportunidadesDemanda(oportunidades: OportunidadeDemandaSinal[]): SinalCanonico[] {
  return oportunidades
    .filter(oportunidadeElegivelParaOrcamento)
    .map(op => ({
      id:           `demanda-${op.id}`,
      especialista: "comercial",
      tipo:         "interesse_sem_orcamento",
      prioridade:   prioridadeComercialParaTipo("interesse_sem_orcamento"),
      confianca:    op.confianca_classificacao,
      titulo:       `${op.nome_informado || "Contato"} — interesse ainda sem orçamento`,
      motivo:       `Sinalizou interesse via ${CANAL_LABEL_DEMANDA[op.canal]} e ainda não recebeu um orçamento.`,
      evidencia:    "Identificado na oportunidade real registrada (interesse sem compra).",
      acaoSugerida: "Entrar em contato e apresentar um orçamento",
      contexto:     { tipo: "cliente" as const, nome: op.nome_informado || "Contato", telefone: op.telefone },
      chaveDedup:   `demanda:${op.id}`,
      criadoEm:     null,
      entidadeTipo: "oportunidade" as const,
      entidadeId:   op.id,
      destino:      "/oportunidades",
      destinoLabel: "Ver oportunidade",
      dados:        { status: op.status, canal: op.canal },
      apresentacao: {
        categoria: "oportunidade" as const,
        explicacao: `Interesse real recebido via ${CANAL_LABEL_DEMANDA[op.canal]}, ainda sem orçamento vinculado.`,
        impacto: "Apresentar um orçamento com base no interesse registrado",
        tempoEstimado: "Agora",
        quantidade: 1,
      },
    }));
}

// ── Desempate determinístico ─────────────────────────────────────────────
// Mesma ordem já em produção na Próxima Melhor Ação V1 (antes vivia como
// TIE_BREAK/tieBreakDoCliente/tieBreakDaRecomendacao, local ao Dashboard) —
// só generalizada para operar sobre `tipo` de um Sinal Canônico qualquer,
// para que Próxima Melhor Ação e Missão do Dia nunca precisem recalcular a
// prioridade cada uma à sua moda.
const TIER: Record<string, number> = {
  cancelamento_sem_reagendamento: 0,
  orcamento_parado:               1,
  cobranca_atrasada:              2,
  pedido_nao_concluido:           3,
  confirmacao_pendente:           4,
  oportunidade_parada:            5,
  interesse_sem_orcamento:        6,
  // aliases V1: sinais antigos continuam ordenáveis sem regravação
  sinalizada:                     6,
  em_contato:                     6,
  agendada:                       6,
  atendida:                       6,
  tratamento_sem_retorno:         7,
  recompra_possivel:              8,
  sem_proximo_compromisso:        9,
  "compromissos-atrasados":      10,
  "horario-vago-hoje":           11,
};
const TIER_PADRAO = 99;

function tierDoSinal(sinal: SinalCanonico): number {
  return TIER[sinal.tipo] ?? TIER_PADRAO;
}

const PESO_PRIORIDADE: Record<PrioridadeComercial, number> = { alta: 0, media: 1, baixa: 2 };

// Princípio da Transparência (docs/nucleo-inteligente-v1-arquitetura.md,
// seção 2, item 6): todo sinal precisa de motivo, evidência e ação — um
// sinal sem essas partes não pode ser exibido em nenhuma tela.
function sinalValido(sinal: SinalCanonico): boolean {
  return !!sinal.titulo?.trim() && !!sinal.motivo?.trim() && !!sinal.evidencia?.trim() && !!sinal.acaoSugerida?.trim();
}

/**
 * Ordena por prioridade e desempata deterministicamente, remove sinais sem
 * evidência/motivo/ação válidos, e por fim remove duplicidades por
 * `chaveDedup` (mantendo a ocorrência de maior prioridade, já que a
 * deduplicação roda depois da ordenação). Hoje, com um único especialista,
 * colisão de chave entre as duas listas de entrada não ocorre (chaves de
 * cliente são telefone/nome; chaves de recomendação agregada são
 * `rec:<id>`) — a deduplicação já vem pronta para quando um segundo
 * especialista existir e puder, em tese, apontar para o mesmo cliente.
 */
export function organizarSinaisCanonicos(sinais: SinalCanonico[]): SinalCanonico[] {
  const ordenados = [...sinais]
    .filter(sinalValido)
    .sort((a, b) =>
      PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade]
      || tierDoSinal(a) - tierDoSinal(b)
      || (b.urgencia ?? -1) - (a.urgencia ?? -1)
      || a.chaveDedup.localeCompare(b.chaveDedup)
    );
  const vistos = new Set<string>();
  const resultado: SinalCanonico[] = [];
  for (const s of ordenados) {
    if (vistos.has(s.chaveDedup)) continue;
    vistos.add(s.chaveDedup);
    resultado.push(s);
  }
  return resultado;
}

// ── 🎯 Missão do Dia — camada de orquestração ────────────────────────────
// Nunca cria sinal novo, nunca altera evidência, nunca consulta banco —
// só organiza (seção 4.5 da arquitetura). Responde uma pergunta só: "se eu
// pudesse fazer só três coisas hoje, quais teriam mais impacto?" — por isso
// o teto fixo de 3, nunca uma lista maior.
export function gerarMissaoDoDia(sinais: SinalCanonico[], limite = 3): SinalCanonico[] {
  return organizarSinaisCanonicos(sinais).slice(0, limite);
}

export type EstadoComercialCanonico = {
  sinais: SinalCanonico[];
  missaoDoDia: SinalCanonico[];
  central: Record<PrioridadeComercial, SinalCanonico[]>;
  radar: SinalCanonico[];
  diretor: SinalCanonico[];
};

/** Uma única coleção organizada, projetada para cada superfície sem
 * recalcular prioridade. Radar mantém somente sinais com contexto de cliente;
 * Central recebe o quadro completo; Diretor e Missão recebem o mesmo top-N. */
export function gerarEstadoComercialCanonico(
  sinais: SinalCanonico[],
  limiteMissao = 3
): EstadoComercialCanonico {
  const organizados = organizarSinaisCanonicos(sinais);
  const missaoDoDia = organizados.slice(0, limiteMissao);
  return {
    sinais: organizados,
    missaoDoDia,
    central: {
      alta: organizados.filter(s => s.prioridade === "alta"),
      media: organizados.filter(s => s.prioridade === "media"),
      baixa: organizados.filter(s => s.prioridade === "baixa"),
    },
    radar: organizados.filter(s => !!s.contexto),
    diretor: missaoDoDia,
  };
}

function sinalParaRecomendacao(sinal: SinalCanonico): Recomendacao {
  const apresentacao = sinal.apresentacao;
  return {
    id: sinal.id,
    categoria: apresentacao?.categoria ?? "oportunidade",
    titulo: sinal.titulo,
    explicacao: apresentacao?.explicacao ?? sinal.motivo,
    motivo: sinal.evidencia,
    acao: sinal.acaoSugerida,
    destino: sinal.destino,
    destinoLabel: sinal.destinoLabel,
    prioridade: sinal.prioridade,
    impacto: apresentacao?.impacto ?? sinal.acaoSugerida,
    tempoEstimado: apresentacao?.tempoEstimado ?? "Agora",
    quantidade: apresentacao?.quantidade ?? 1,
  };
}

/** Adaptador temporário para o componente legado da Central. O conteúdo vem
 * integralmente do estado canônico; nenhuma regra ou prioridade é recalculada. */
export function adaptarCentralCanonicaParaLegado(
  central: EstadoComercialCanonico["central"]
): CentralOportunidades {
  return {
    alta: central.alta.map(sinalParaRecomendacao),
    media: central.media.map(sinalParaRecomendacao),
    baixa: central.baixa.map(sinalParaRecomendacao),
  };
}

/** Mantém o contrato atual do Radar enquanto o componente está na pista do
 * Capitão, mas aplica exatamente a ordem decidida pelo estado canônico. */
export function ordenarOportunidadesPorEstadoCanonico(
  oportunidades: OportunidadeCliente[],
  estado: EstadoComercialCanonico
): OportunidadeCliente[] {
  const porId = new Map(oportunidades.map(op => [`cliente-${op.chave}`, op]));
  return estado.radar.map(s => porId.get(s.id)).filter((op): op is OportunidadeCliente => !!op);
}

export type FontesComerciaisReais = {
  totalPacientes: number;
  totalAgendamentos: number;
  oportunidades: number;
  orcamentos: number;
  tratamentos: number;
  cobrancas: number;
  pedidos: number;
};

/** Dados comerciais podem existir antes do cadastro de um paciente. Esta
 * função só responde se existe alguma fonte real; não confunde disponibilidade
 * com conteúdo e não faz I/O. */
export function existemDadosComerciaisReais(fontes: FontesComerciaisReais): boolean {
  return Object.values(fontes).some(quantidade => quantidade > 0);
}

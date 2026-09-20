// ── Radar de Oportunidades · Motor de Oportunidades por Cliente ────────────
// (V1 se chamava "Agenda Autônoma de Receita" — mesmo motor, mesma base,
// evoluído em V2 para responder com mais clareza "quem merece atenção
// primeiro, por quê, e há quanto tempo".)
//
// Irmão de lib/recomendacoes.ts, mas resolve uma pergunta diferente:
// lib/recomendacoes.ts conta ("3 clientes sem movimentação"), este motor
// aponta ("João, Maria e Carlos, por este motivo cada um"). A pergunta que
// ele responde é sempre: quem merece um contato hoje?
//
// Mesma filosofia: nenhuma chamada a IA generativa, determinístico, e nunca
// inventa um dado que a tela não forneceu (nenhum "visitou a loja", "pediu
// orçamento", valor ou probabilidade estimados sem que isso exista de fato
// no input).
//
// Como adicionar um sinal novo no futuro: acrescente um novo campo de
// entrada em EntradaOportunidades, um novo loop em gerarOportunidadesClientes
// chamando `registrar(...)`, e uma entrada em PESO_TIPO — a deduplicação e a
// priorização já são automáticas.
//
// "orcamento_parado" (convergência com public.orcamentos, Motor de
// Orçamentos — lib/motor-orcamentos.ts) segue exatamente esse molde: dados
// já carregados pela tela, cálculo de "parado" delegado ao motor real
// (estaParado/diasParado), nenhuma consulta nova feita por este arquivo.

import { estaParado, diasParado as diasParadoOrcamento } from "./motor-orcamentos";
import { precisaRetorno, diasSemAtividade, diasInterrompido, type StatusTratamento } from "./motor-tratamento";
import { estaAtrasada, diasAtraso } from "./motor-cobranca";

export type PrioridadeOportunidade = "alta" | "media" | "baixa";

export type TipoSinal =
  | "cancelamento_sem_reagendamento"
  | "orcamento_parado"
  | "cobranca_atrasada"
  | "confirmacao_pendente"
  | "tratamento_sem_retorno"
  | "sem_proximo_compromisso";

export type SinalOportunidade = {
  tipo:             TipoSinal;
  motivo:           string;
  prioridade:       PrioridadeOportunidade;
  acaoSugerida:     string;
  diasDesdeEvento:  number | null; // dias corridos desde a data real do evento (cancelamento, atendimento previsto, ou 0 quando é hoje) — null quando não há data confiável
  tempoDecorrido:   string | null; // mesmo dado, já formatado ("hoje", "há 1 dia", "há 5 dias") — null quando diasDesdeEvento é null
};

export type OportunidadeCliente = {
  chave:           string; // telefone normalizado, ou identificador alternativo quando não há telefone
  nome:            string;
  telefone:        string | null; // já normalizado (só dígitos), pronto para wa.me
  temTelefone:     boolean;
  prioridade:      PrioridadeOportunidade; // maior prioridade entre os sinais deste cliente
  motivoPrincipal: string;       // motivo do sinal mais importante — o que a tela deve destacar
  acaoSugerida:    string;       // ação do sinal mais importante
  tempoDecorrido:  string | null; // tempo decorrido do sinal mais importante, já formatado
  sinaisAdicionais: number;      // quantos outros sinais também foram identificados para este cliente (0 quando só há um)
  sinais:          SinalOportunidade[]; // todos os sinais, já ordenados por importância
};

// ── Entradas — dados já carregados pela tela; este motor nunca consulta nada ──

export type ClienteSemProximoCompromisso = {
  id:               string;
  nome:             string;
  telefone?:        string | null;
  whatsapp?:        string | null;
  proximaConsulta?: string | null; // YYYY-MM-DD ou null
};

export type CompromissoCanceladoSemReagendamento = {
  id:        string;
  nome:      string;
  telefone?: string | null;
  data:      string; // YYYY-MM-DD do cancelamento
};

export type CompromissoConfirmacaoPendente = {
  id:        string;
  nome:      string;
  telefone?: string | null;
  data?:     string; // YYYY-MM-DD do compromisso; se ausente, assume-se "hoje"
};

// public.orcamentos com status='apresentado' — dados já carregados pela
// tela (mesma disciplina dos outros tipos de entrada acima). apresentadoEm
// é o timestamptz real da coluna, não uma data — o cálculo de "parado" usa
// o motor real (estaParado/diasParado), que trabalha em timestamp, não em
// data-only como o resto deste arquivo.
export type OrcamentoParadoInput = {
  id:            string;
  pacienteNome:  string;
  telefone?:     string | null;
  procedimento:  string;
  valor:         number;
  apresentadoEm: string; // timestamptz ISO — public.orcamentos.apresentado_em
};

// public.tratamentos — etapa "venda" da cadeia orçamento → venda → receita.
// updated_at/interrompido_em são timestamptz reais das colunas.
export type TratamentoSemRetornoInput = {
  id:                    string;
  pacienteNome:          string;
  telefone?:             string | null;
  tipoTratamento:        string;
  status:                StatusTratamento;
  proximaDataPrevista:   string | null; // YYYY-MM-DD ou null
  updatedAt:             string;        // timestamptz — usado quando em_andamento
  interrompidoEm:        string | null; // timestamptz — usado quando interrompido
};

// public.cobrancas — etapa "receita" da cadeia orçamento → venda → receita.
// vencimento é date-only (YYYY-MM-DD), igual ao resto deste arquivo.
export type CobrancaAtrasadaInput = {
  id:           string;
  pacienteNome: string;
  telefone?:    string | null;
  descricao:    string;
  valor:        number;
  vencimento:   string; // YYYY-MM-DD
  status:       "pendente" | "em_cobranca";
};

export type EntradaOportunidades = {
  hoje: string; // YYYY-MM-DD — referência para todos os cálculos de tempo decorrido
  // timestamptz ISO ("agora") — só necessário quando orcamentosParados ou
  // tratamentosSemRetorno é usado (os motores reais trabalham em timestamp,
  // não em data-only como o resto deste arquivo). Sem valor explícito, cai
  // no relógio real — por isso, para manter os testes determinísticos, o
  // chamador deve sempre informar este campo ao usar esses dois sinais.
  agora?: string;
  clientesSemProximoCompromisso: ClienteSemProximoCompromisso[];
  cancelamentosSemReagendamento: CompromissoCanceladoSemReagendamento[];
  confirmacoesPendentes:         CompromissoConfirmacaoPendente[];
  orcamentosParados?:            OrcamentoParadoInput[];
  tratamentosSemRetorno?:        TratamentoSemRetornoInput[];
  cobrancasAtrasadas?:           CobrancaAtrasadaInput[];
};

function normalizarTelefone(t?: string | null): string {
  return (t || "").replace(/\D/g, "");
}

function diasEntre(de: string, ate: string): number {
  const [y1, m1, d1] = de.split("-").map(Number);
  const [y2, m2, d2] = ate.split("-").map(Number);
  const ms = Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1);
  return Math.round(ms / 86_400_000);
}

function formatarTempoDecorrido(dias: number | null): string | null {
  if (dias === null) return null;
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}

const PESO_PRIORIDADE: Record<PrioridadeOportunidade, number> = { alta: 0, media: 1, baixa: 2 };

// Ordem entre tipos de sinal — usada tanto para decidir qual sinal é o
// "principal" de um cliente com mais de um, quanto para desempatar clientes
// de mesma prioridade. Cancelamento vem antes de confirmação pendente
// porque representa um horário que JÁ foi perdido de fato (o cliente
// desmarcou), enquanto a confirmação pendente ainda pode se resolver
// sozinha (o cliente pode simplesmente confirmar ou comparecer). "Sem
// próximo compromisso" vem por último por já ter prioridade média, não alta.
// "orcamento_parado" entra logo depois de cancelamento: representa receita
// real já apresentada e parada sem decisão — mais urgente que uma simples
// confirmação pendente, que ainda pode se resolver sozinha.
const PESO_TIPO: Record<TipoSinal, number> = {
  cancelamento_sem_reagendamento: 0,
  orcamento_parado:               1,
  cobranca_atrasada:              2,
  confirmacao_pendente:           3,
  tratamento_sem_retorno:         4,
  sem_proximo_compromisso:        5,
};

function ordenarSinais(sinais: SinalOportunidade[]): SinalOportunidade[] {
  return [...sinais].sort((a, b) => {
    const porPrioridade = PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade];
    if (porPrioridade !== 0) return porPrioridade;
    const porTipo = PESO_TIPO[a.tipo] - PESO_TIPO[b.tipo];
    if (porTipo !== 0) return porTipo;
    // Dentro do mesmo tipo, quem está esperando há mais tempo vem primeiro.
    return (b.diasDesdeEvento ?? -1) - (a.diasDesdeEvento ?? -1);
  });
}

/**
 * Gera a lista de oportunidades acionáveis — uma por cliente, nunca repetida
 * na mesma renderização. Quando o mesmo cliente aparece em mais de um sinal,
 * eles são reunidos em um único card: o sinal mais importante (maior
 * prioridade, depois tipo, depois tempo de espera) vira o motivo/ação/tempo
 * em destaque, e os demais só são contados em `sinaisAdicionais` — a tela
 * não precisa listar tudo para não sobrecarregar quem está lendo.
 */
export function gerarOportunidadesClientes(input: EntradaOportunidades): OportunidadeCliente[] {
  const porChave = new Map<string, { nome: string; telefone: string | null; sinais: SinalOportunidade[] }>();

  function registrar(nome: string, telefoneBruto: string | null | undefined, sinal: SinalOportunidade) {
    const tel = normalizarTelefone(telefoneBruto);
    const chave = tel || `sem-telefone:${nome.trim().toLowerCase()}`;
    const existente = porChave.get(chave);
    if (existente) existente.sinais.push(sinal);
    else porChave.set(chave, { nome, telefone: tel || null, sinais: [sinal] });
  }

  for (const c of input.clientesSemProximoCompromisso) {
    const semProximo = !c.proximaConsulta || c.proximaConsulta < input.hoje;
    if (!semProximo) continue;
    // Só há um "tempo decorrido" real quando havia uma data prevista que já passou.
    const dias = c.proximaConsulta ? diasEntre(c.proximaConsulta, input.hoje) : null;
    registrar(c.nome, c.whatsapp || c.telefone, {
      tipo:            "sem_proximo_compromisso",
      motivo:          `${c.nome} está sem um próximo atendimento programado.`,
      prioridade:      "media",
      acaoSugerida:    "Oferecer um novo horário",
      diasDesdeEvento: dias,
      tempoDecorrido:  formatarTempoDecorrido(dias),
    });
  }

  for (const a of input.cancelamentosSemReagendamento) {
    const dias = diasEntre(a.data, input.hoje);
    registrar(a.nome, a.telefone, {
      tipo:            "cancelamento_sem_reagendamento",
      motivo:          `${a.nome} teve um compromisso cancelado e pode precisar de um novo agendamento.`,
      prioridade:      "alta",
      acaoSugerida:    "Reagendar ou confirmar interesse",
      diasDesdeEvento: dias,
      tempoDecorrido:  formatarTempoDecorrido(dias),
    });
  }

  for (const a of input.confirmacoesPendentes) {
    const dias = diasEntre(a.data ?? input.hoje, input.hoje);
    registrar(a.nome, a.telefone, {
      tipo:            "confirmacao_pendente",
      motivo:          `${a.nome} possui um compromisso aguardando confirmação.`,
      prioridade:      "alta",
      acaoSugerida:    "Confirmar presença agora",
      diasDesdeEvento: dias,
      tempoDecorrido:  formatarTempoDecorrido(dias),
    });
  }

  if (input.orcamentosParados?.length && input.agora) {
    const agora = input.agora;
    for (const o of input.orcamentosParados) {
      if (!estaParado(o.apresentadoEm, agora)) continue;
      const dias = diasParadoOrcamento(o.apresentadoEm, agora);
      const valorFormatado = o.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      registrar(o.pacienteNome, o.telefone, {
        tipo:            "orcamento_parado",
        motivo:          `${o.pacienteNome} tem um orçamento de ${o.procedimento} (${valorFormatado}) parado há ${dias} dia${dias === 1 ? "" : "s"} sem decisão.`,
        prioridade:      "alta",
        acaoSugerida:    "Fazer follow-up do orçamento",
        diasDesdeEvento: dias,
        tempoDecorrido:  formatarTempoDecorrido(dias),
      });
    }
  }

  // Etapa "receita" (public.cobrancas) — dinheiro já vencido em aberto.
  // estaAtrasada/diasAtraso são data-only (mesmo formato de vencimento),
  // por isso usa `input.hoje`, não `input.agora`.
  if (input.cobrancasAtrasadas?.length) {
    for (const c of input.cobrancasAtrasadas) {
      if (!estaAtrasada(c.vencimento, input.hoje)) continue;
      const dias = diasAtraso(c.vencimento, input.hoje);
      const valorFormatado = c.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      registrar(c.pacienteNome, c.telefone, {
        tipo:            "cobranca_atrasada",
        motivo:          `${c.pacienteNome} tem uma cobrança de ${c.descricao} (${valorFormatado}) atrasada há ${dias} dia${dias === 1 ? "" : "s"}.`,
        prioridade:      "alta",
        acaoSugerida:    "Cobrar o pagamento pendente",
        diasDesdeEvento: dias,
        tempoDecorrido:  formatarTempoDecorrido(dias),
      });
    }
  }

  // Etapa "venda" (public.tratamentos) — continuidade interrompida.
  if (input.tratamentosSemRetorno?.length && input.agora) {
    const agora = input.agora;
    for (const t of input.tratamentosSemRetorno) {
      if (t.status === "em_andamento" && precisaRetorno({ status: t.status, proxima_data_prevista: t.proximaDataPrevista }, input.hoje)) {
        const dias = diasSemAtividade(t.updatedAt, agora);
        registrar(t.pacienteNome, t.telefone, {
          tipo:            "tratamento_sem_retorno",
          motivo:          `${t.pacienteNome} está com ${t.tipoTratamento} sem próximo retorno definido.`,
          prioridade:      "media",
          acaoSugerida:    "Agendar o próximo retorno",
          diasDesdeEvento: dias,
          tempoDecorrido:  formatarTempoDecorrido(dias),
        });
      } else if (t.status === "interrompido" && t.interrompidoEm) {
        const dias = diasInterrompido(t.interrompidoEm, agora);
        registrar(t.pacienteNome, t.telefone, {
          tipo:            "tratamento_sem_retorno",
          motivo:          `${t.pacienteNome} está com ${t.tipoTratamento} interrompido há ${dias} dia${dias === 1 ? "" : "s"}.`,
          prioridade:      "media",
          acaoSugerida:    "Retomar contato antes do abandono",
          diasDesdeEvento: dias,
          tempoDecorrido:  formatarTempoDecorrido(dias),
        });
      }
    }
  }

  const oportunidades: OportunidadeCliente[] = Array.from(porChave.entries()).map(([chave, v]) => {
    const sinais = ordenarSinais(v.sinais);
    const principal = sinais[0];
    return {
      chave,
      nome:             v.nome,
      telefone:         v.telefone,
      temTelefone:      !!v.telefone,
      prioridade:       principal.prioridade,
      motivoPrincipal:  principal.motivo,
      acaoSugerida:     principal.acaoSugerida,
      tempoDecorrido:   principal.tempoDecorrido,
      sinaisAdicionais: sinais.length - 1,
      sinais,
    };
  });

  oportunidades.sort((a, b) => {
    const porPrioridade = PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade];
    if (porPrioridade !== 0) return porPrioridade;
    const porTipo = PESO_TIPO[a.sinais[0].tipo] - PESO_TIPO[b.sinais[0].tipo];
    if (porTipo !== 0) return porTipo;
    return (b.sinais[0].diasDesdeEvento ?? -1) - (a.sinais[0].diasDesdeEvento ?? -1);
  });
  return oportunidades;
}

/**
 * Frase de abertura do Radar — fala do Diretor Digital em primeira pessoa,
 * mesma voz já usada em lib/recomendacoes.ts ("Encontrei", "Percebi").
 * Devolve string vazia quando não há oportunidades (a tela decide o que
 * mostrar nesse caso — este motor não sabe de UI).
 */
export function gerarResumoRadar(qtd: number): string {
  if (qtd <= 0) return "";
  if (qtd === 1) return "Encontrei 1 oportunidade que pode gerar receita hoje.";
  return `Encontrei ${qtd} oportunidades que podem gerar receita hoje.`;
}

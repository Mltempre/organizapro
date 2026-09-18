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
// ── Smart Commerce · Bloco sem migration (2026-09-18) ───────────────────────
// Dois sinais novos, "interesse_sem_compra" e "demanda_nao_atendida", são
// HEURÍSTICOS por natureza: `chatbot_logs` não persiste qual tópico foi
// identificado numa conversa nem se ela foi resolvida (só mensagem, resposta
// e camada que processou — ver app/api/chatbot/message/route.ts:748-755).
// Sem esse dado estruturado, este motor não pode saber com certeza se um
// contato "tinha interesse" ou "não foi atendido" — só recebe, de quem
// chama, uma classificação já feita a partir do texto real disponível hoje.
// Por isso os dois tipos sempre entram com prioridade "baixa" (nunca
// disputam lugar com um sinal confirmado de agenda) e um motivo que deixa
// o caráter heurístico explícito — nunca apresentados como fato.
//
// `sem_proximo_compromisso` também evoluiu: quando quem chama souber que o
// cliente já teve algum atendimento concluído no passado, o motor agora
// nomeia isso como reativação (candidato a recompra) em vez do texto
// genérico. O campo é opcional e, quando ausente, o comportamento é
// idêntico ao anterior — nenhuma regressão para quem já chama este motor
// sem o novo dado. Não foi criada nenhuma regra de intervalo/recorrência:
// `clinica_servicos` (supabase/migrations/20260625000002_site_modules.sql)
// não tem nenhuma coluna de frequência/intervalo, então essa parte mais
// ambiciosa da recompra fica bloqueada por schema, não implementada aqui.
//
// ── Orçamento → Venda → Receita (2026-09-18/19, ainda sem migration) ───────
// Quatro sinais deste domínio (orcamento_sem_resposta, orcamento_expirando,
// orcamento_expirado, orcamento_aceito_sem_agendamento) — ver
// docs/orcamento-venda-receita-v1-arquitetura.md para o desenho completo
// (entidades, estados, e por que NÃO são heurísticos: um orçamento só existe
// por ação humana explícita, nunca inferido de conversa). Os tipos de
// entrada são deliberadamente desacoplados de qual tabela vai guardar o
// dado — nenhuma migration foi executada ainda, então hoje ninguém chama
// estes campos com dado real; existem só para o motor já estar pronto no
// dia em que a migration for aprovada. `orcamento_aceito_sem_pagamento` e
// `pagamento_parcial_pendente` (Cobrador AI) ficam de fora desta lista de
// propósito: dependem de `orcamento_pagamentos`, uma tabela que não existe
// nem nesta proposta de migration — ver seção 8 do documento de arquitetura.

import { orcamentoExpirado, orcamentoExpirando } from "./orcamentos-state-machine";

export type PrioridadeOportunidade = "alta" | "media" | "baixa";

export type TipoSinal =
  | "cancelamento_sem_reagendamento"
  | "confirmacao_pendente"
  | "sem_proximo_compromisso"
  | "interesse_sem_compra"
  | "demanda_nao_atendida"
  | "orcamento_sem_resposta"
  | "orcamento_expirando"
  | "orcamento_expirado"
  | "orcamento_aceito_sem_agendamento";

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
  // Opcional: true quando o cliente já teve ao menos um agendamento com
  // status "concluido" no passado (dado real de `agendamentos`, calculado
  // por quem chama). Diferencia reativação (já foi cliente) de alguém que
  // nunca chegou a ser atendido. Ausente = comportamento idêntico ao
  // anterior a este campo existir.
  teveAtendimentoConcluido?: boolean;
};

// ── Sinais heurísticos a partir de conversas do WhatsApp (chatbot_logs) ─────
// `chatbot_logs` (id, clinica_id, telefone, nome_paciente, mensagem_paciente,
// resposta_bot, processado_por, created_at — ver app/chatbot/page.tsx:167)
// não guarda o tópico identificado nem se a conversa foi resolvida. Por
// isso este motor exige que quem chama já tenha decidido, a partir do texto
// real da mensagem/resposta, se aquela conversa indica interesse ou
// ausência de resolução — o motor só organiza e prioriza, nunca classifica.
export type ConversaChatbotSemConversao = {
  id:                  string;        // chatbot_logs.id
  nome:                string | null; // chatbot_logs.nome_paciente (frequentemente ausente)
  telefone:            string;        // chatbot_logs.telefone
  data:                string;        // YYYY-MM-DD derivado de chatbot_logs.created_at
  // true quando existe, para este telefone, algum agendamento real
  // (status diferente de "cancelado"/"faltou") datado a partir desta
  // conversa — calculado por quem chama a partir de `agendamentos`, nunca
  // suposto aqui. Quando true, a conversa já converteu e não é mais
  // oportunidade — o motor descarta o sinal.
  teveAgendamentoApos: boolean;
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

// ── Orçamento (ver docs/orcamento-venda-receita-v1-arquitetura.md) ──────────
// Diferente dos sinais heurísticos acima: um orçamento é um registro
// estruturado, criado por ação humana explícita (nunca inferido de texto de
// chatbot — ver seção 4 do documento de arquitetura), então estes sinais são
// tratados como CONFIRMADOS, não heurísticos. Estes tipos são
// intencionalmente desacoplados de qualquer schema específico — quem chama
// entrega os dados já resolvidos (`status='enviado'` no banco), seja qual
// for a tabela de origem quando a migration for aprovada e executada.
//
// Um único registro `OrcamentoEnviado` pode virar um de três sinais
// diferentes (sem_resposta / expirando / expirado), decidido por
// `lib/orcamentos-state-machine.ts` a partir de `validadeAte` — nunca
// gravado como um `status` diferente no banco (ver comentário no topo
// daquele módulo: vencimento é sempre computado ao vivo).
export type OrcamentoEnviado = {
  id:           string;
  nome:         string;
  telefone?:    string | null;
  // Valor real informado por quem criou o orçamento — nunca estimado.
  // Ausente/null quando o valor não foi informado (nunca 0 fantasioso).
  valor:        number | null;
  dataEnvio:    string;         // YYYY-MM-DD
  validadeAte?: string | null;  // YYYY-MM-DD; null = sem prazo definido
};

// Orçamento aceito (fechamento comercial real — ver seção 3 do documento de
// arquitetura: aceite NUNCA é confundido com pagamento) que ainda não virou
// um compromisso operacional. `dataAceite` vem de `respondido_em` no banco.
export type OrcamentoAceitoSemAgendamento = {
  id:         string;
  nome:       string;
  telefone?:  string | null;
  valor:      number | null;
  dataAceite: string; // YYYY-MM-DD
};

export type EntradaOportunidades = {
  hoje: string; // YYYY-MM-DD — referência para todos os cálculos de tempo decorrido
  clientesSemProximoCompromisso: ClienteSemProximoCompromisso[];
  cancelamentosSemReagendamento: CompromissoCanceladoSemReagendamento[];
  confirmacoesPendentes:         CompromissoConfirmacaoPendente[];
  // Opcionais — Smart Commerce, sinais heurísticos (ver comentário acima).
  // Omitidos = comportamento idêntico a antes destes campos existirem.
  conversasComInteresseSemAgendamento?: ConversaChatbotSemConversao[];
  conversasSemResolucao?:               ConversaChatbotSemConversao[];
  // Opcionais — Orçamento → Venda → Receita (ver comentário acima). Omitidos
  // = comportamento idêntico a antes destes campos existirem. Ainda sem
  // fonte de dado real (nenhuma migration executada) — ver
  // docs/orcamento-venda-receita-v1-arquitetura.md.
  orcamentosEnviados?:            OrcamentoEnviado[];
  orcamentosAceitosSemAgendamento?: OrcamentoAceitoSemAgendamento[];
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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
const PESO_TIPO: Record<TipoSinal, number> = {
  cancelamento_sem_reagendamento: 0,
  confirmacao_pendente:           1,
  // Orçamento (dado confirmado, não heurístico — ver
  // docs/orcamento-venda-receita-v1-arquitetura.md, seção 4), mesma
  // prioridade "alta" dos dois sinais acima. Ordem interna reflete o que
  // tem mais a perder primeiro: um negócio já fechado sem operação
  // (aceito_sem_agendamento) vale mais que um prazo perdido antes de
  // qualquer aceite (expirado), que vale mais que um prazo perto de vencer
  // (expirando), que vale mais que um sem pressão de prazo nenhuma.
  orcamento_aceito_sem_agendamento: 2,
  orcamento_expirado:               3,
  orcamento_expirando:              4,
  orcamento_sem_resposta:           5,
  sem_proximo_compromisso:          6,
  // Sinais heurísticos vêm por último — mesmo quando desempatam com um sinal
  // de agenda de mesma prioridade nominal, nunca disputam à frente dele
  // (na prática nem chegam a disputar: entram com prioridade "baixa", que
  // já perde de "media"/"alta" antes mesmo de olhar para PESO_TIPO).
  demanda_nao_atendida:             7,
  interesse_sem_compra:             8,
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
    // Recompra/reativação: só nomeada assim quando há evidência real de que
    // o cliente já foi atendido antes. Sem essa evidência (campo ausente),
    // o texto é idêntico ao de sempre.
    const ehReativacao = c.teveAtendimentoConcluido === true;
    registrar(c.nome, c.whatsapp || c.telefone, {
      tipo:            "sem_proximo_compromisso",
      motivo:          ehReativacao
        ? `${c.nome} já foi atendido antes e está sem um novo atendimento programado — candidato a reativação.`
        : `${c.nome} está sem um próximo atendimento programado.`,
      prioridade:      "media",
      acaoSugerida:    ehReativacao ? "Oferecer retorno e reativar o relacionamento" : "Oferecer um novo horário",
      diasDesdeEvento: dias,
      tempoDecorrido:  formatarTempoDecorrido(dias),
    });
  }

  for (const c of input.conversasComInteresseSemAgendamento ?? []) {
    if (c.teveAgendamentoApos) continue; // já converteu — não é mais oportunidade
    const dias = diasEntre(c.data, input.hoje);
    const nome = c.nome || "Contato sem nome salvo";
    registrar(nome, c.telefone, {
      tipo:            "interesse_sem_compra",
      motivo:          `${nome} demonstrou interesse pelo WhatsApp e, até onde os dados mostram, não chegou a agendar (sinal heurístico, baseado no texto da conversa — não é um registro confirmado de intenção).`,
      prioridade:      "baixa",
      acaoSugerida:    "Retomar contato e oferecer agendamento",
      diasDesdeEvento: dias,
      tempoDecorrido:  formatarTempoDecorrido(dias),
    });
  }

  for (const c of input.conversasSemResolucao ?? []) {
    if (c.teveAgendamentoApos) continue;
    const dias = diasEntre(c.data, input.hoje);
    const nome = c.nome || "Contato sem nome salvo";
    registrar(nome, c.telefone, {
      tipo:            "demanda_nao_atendida",
      motivo:          `${nome} enviou uma mensagem que o assistente não conseguiu resolver diretamente (sinal heurístico, baseado na resposta automática enviada — não é um registro confirmado do resultado da conversa).`,
      prioridade:      "baixa",
      acaoSugerida:    "Responder pessoalmente essa conversa",
      diasDesdeEvento: dias,
      tempoDecorrido:  formatarTempoDecorrido(dias),
    });
  }

  // Orçamento enviado, aguardando resposta: vira um de três sinais
  // diferentes (nunca mais de um ao mesmo tempo — ver teste de exclusão
  // mútua em lib/orcamentos-state-machine.ts), decidido sempre ao vivo a
  // partir de `validadeAte`, nunca de um `status` gravado como "expirado".
  for (const o of input.orcamentosEnviados ?? []) {
    const dias = diasEntre(o.dataEnvio, input.hoje);
    const validadeAte = o.validadeAte ?? null;
    const valorTexto = o.valor != null ? ` de ${formatarMoeda(o.valor)}` : "";

    if (orcamentoExpirado("enviado", validadeAte, input.hoje)) {
      registrar(o.nome, o.telefone, {
        tipo:            "orcamento_expirado",
        motivo:          `${o.nome} tem um orçamento${valorTexto} enviado cuja validade já venceu, sem resposta.`,
        prioridade:      "alta",
        acaoSugerida:    "Reativar o orçamento vencido ou encerrar formalmente",
        diasDesdeEvento: dias,
        tempoDecorrido:  formatarTempoDecorrido(dias),
      });
    } else if (orcamentoExpirando("enviado", validadeAte, input.hoje)) {
      registrar(o.nome, o.telefone, {
        tipo:            "orcamento_expirando",
        motivo:          `${o.nome} tem um orçamento${valorTexto} enviado, com validade vencendo em breve.`,
        prioridade:      "alta",
        acaoSugerida:    "Fazer follow-up urgente antes do orçamento vencer",
        diasDesdeEvento: dias,
        tempoDecorrido:  formatarTempoDecorrido(dias),
      });
    } else {
      registrar(o.nome, o.telefone, {
        tipo:            "orcamento_sem_resposta",
        motivo:          `${o.nome} tem um orçamento${valorTexto} enviado, ainda sem resposta.`,
        prioridade:      "alta",
        acaoSugerida:    "Fazer follow-up do orçamento",
        diasDesdeEvento: dias,
        tempoDecorrido:  formatarTempoDecorrido(dias),
      });
    }
  }

  // Orçamento aceito (fechamento comercial real) que ainda não virou um
  // compromisso operacional — nunca confundido com pagamento (ver seção 3
  // do documento de arquitetura).
  for (const o of input.orcamentosAceitosSemAgendamento ?? []) {
    const dias = diasEntre(o.dataAceite, input.hoje);
    const valorTexto = o.valor != null ? ` de ${formatarMoeda(o.valor)}` : "";
    registrar(o.nome, o.telefone, {
      tipo:            "orcamento_aceito_sem_agendamento",
      motivo:          `${o.nome} aceitou um orçamento${valorTexto}, mas ainda não tem nenhum agendamento vinculado.`,
      prioridade:      "alta",
      acaoSugerida:    "Agendar o atendimento combinado",
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

// ── IA Comercial V1 · Diretor Digital (Camada 1 — templates determinísticos) ──
// Ver docs/ia-comercial-v1-arquitetura.md (arquitetura homologada e congelada
// em 2026-07-26). Este módulo é só uma camada de NARRAÇÃO consultiva sobre
// sinais que já existem — nunca recalcula, nunca duplica e nunca altera
// nenhuma regra de lib/oportunidades-clientes.ts ou lib/recomendacoes.ts.
// Nenhuma chamada a IA generativa (princípio 9, seção 11.0 — Camada 1 é
// 100% templates + dados reais). Nenhuma estimativa de receita/probabilidade
// (seção 7 exige ticket médio automático, que não existe nesta v1 — ver
// seção 15, fase v1 "sem receita prevista").
//
// Regra de Ouro (seção 3.3) respondida antes deste código:
// 1) Problema real: hoje o empresário vê Radar/Central de Oportunidades como
//    dados soltos e precisa interpretar sozinho o que fazer primeiro e por
//    quê. 2) Princípios reforçados: 2 (clareza), 3 (utilidade), 4 (explicar
//    antes de recomendar), 7 (honestidade quando faltam dados). 3) Mantém
//    confiança: nunca inventa métrica, sempre cita evidência real. 4) Ajuda
//    a decidir hoje: aponta 1 prioridade central com motivo e ação prática.

import type { OportunidadeCliente } from "./oportunidades-clientes";
import type { Recomendacao } from "./recomendacoes";

export type CategoriaConsultiva =
  | "retorno_cliente"
  | "cancelamento_confirmacao"
  | "agenda_ociosa"
  | "reputacao";

// Estrutura obrigatória de toda recomendação consultiva (missão desta versão):
// o que foi identificado, por que importa, o que fazer agora, e a evidência
// real usada — nunca um número ou frase solta sem essas quatro partes.
export type RecomendacaoConsultiva = {
  id:            string;
  categoria:     CategoriaConsultiva;
  identificado:  string;
  motivo:        string;
  acao:          string;
  evidencia:     string;
  prioridade:    "alta" | "media" | "baixa";
  destino?:      string;
  destinoLabel?: string;
};

export type EntradaConsultor = {
  temDadosSuficientes:   boolean; // mesmo gate de insights.temDados — honestidade (princípio 7) em vez de recomendação vazia
  oportunidadesClientes: OportunidadeCliente[]; // já calculado pelo Radar — não recalculado aqui
  recomendacoes:         Recomendacao[];        // já calculado pela Central de Oportunidades — não recalculado aqui
  ocupacaoPct:           number | null;          // já calculado no Dashboard
};

const PESO_PRIORIDADE: Record<"alta" | "media" | "baixa", number> = { alta: 0, media: 1, baixa: 2 };

/**
 * Reformula sinais já existentes (Radar + Central de Oportunidades) na
 * estrutura consultiva de 4 partes. Não é uma nova fonte de sinal — é uma
 * nova forma de apresentar sinais que o sistema já calculou em outro lugar.
 * Honestidade absoluta (princípio 7): sem dado suficiente, devolve lista
 * vazia — a tela decide a frase honesta, nunca inventa achado aqui.
 */
export function gerarRecomendacoesConsultivas(input: EntradaConsultor): RecomendacaoConsultiva[] {
  if (!input.temDadosSuficientes) return [];

  const lista: RecomendacaoConsultiva[] = [];

  for (const op of input.oportunidadesClientes) {
    const sinal = op.sinais[0];
    if (sinal.tipo === "cancelamento_sem_reagendamento") {
      lista.push({
        id: `consultivo-cliente-${op.chave}`,
        categoria: "cancelamento_confirmacao",
        identificado: `${op.nome} teve um compromisso cancelado e ainda não remarcou.`,
        motivo: "Um cancelamento sem novo agendamento costuma significar receita parada, se ninguém retomar o contato a tempo.",
        acao: op.acaoSugerida,
        evidencia: op.tempoDecorrido
          ? `Cancelamento identificado no histórico real de agendamentos, ${op.tempoDecorrido}.`
          : "Cancelamento identificado no histórico real de agendamentos.",
        prioridade: op.prioridade,
        destino: "/clientes",
        destinoLabel: "Ver cliente",
      });
    } else if (sinal.tipo === "confirmacao_pendente") {
      lista.push({
        id: `consultivo-cliente-${op.chave}`,
        categoria: "cancelamento_confirmacao",
        identificado: `${op.nome} tem um compromisso aguardando confirmação.`,
        motivo: "Compromissos sem confirmação têm mais risco de falta, o que deixa um horário ocioso na agenda.",
        acao: op.acaoSugerida,
        evidencia: "Compromisso de hoje ainda sem confirmação, no histórico real de agendamentos.",
        prioridade: op.prioridade,
        destino: "/clientes",
        destinoLabel: "Ver cliente",
      });
    } else if (sinal.tipo === "sem_proximo_compromisso") {
      lista.push({
        id: `consultivo-retorno-${op.chave}`,
        categoria: "retorno_cliente",
        identificado: `${op.nome} não possui nenhum próximo compromisso agendado.`,
        motivo: "Clientes sem retorno agendado tendem a esfriar o relacionamento com o tempo — vale reaproximar antes que isso aconteça.",
        acao: op.acaoSugerida,
        evidencia: op.tempoDecorrido
          ? `Sem próxima consulta cadastrada, ${op.tempoDecorrido}.`
          : "Sem próxima consulta cadastrada no sistema.",
        prioridade: op.prioridade,
        destino: "/clientes",
        destinoLabel: "Ver cliente",
      });
    } else if (sinal.tipo === "orcamento_sem_resposta") {
      // Orçamento → Venda → Receita (ver docs/orcamento-venda-receita-v1-
      // arquitetura.md): dado CONFIRMADO, não heurístico — um orçamento só
      // existe por ação humana explícita. Reaproveita "cancelamento_confirmacao"
      // (mesmo tema: uma pendência que ainda pode se resolver sozinha) —
      // nenhuma categoria nova, nenhuma alteração em componente visual.
      lista.push({
        id: `consultivo-orcamento-${op.chave}`,
        categoria: "cancelamento_confirmacao",
        identificado: `${op.nome} tem um orçamento enviado, ainda sem resposta.`,
        motivo: "Um orçamento sem retorno é receita prevista parada — o cliente pode simplesmente ter esquecido de responder.",
        acao: op.acaoSugerida,
        evidencia: op.tempoDecorrido
          ? `Identificado no histórico real de orçamentos, ${op.tempoDecorrido}.`
          : "Identificado no histórico real de orçamentos.",
        prioridade: op.prioridade,
        destino: "/clientes",
        destinoLabel: "Ver cliente",
      });
    } else if (sinal.tipo === "orcamento_expirando") {
      lista.push({
        id: `consultivo-orcamento-${op.chave}`,
        categoria: "cancelamento_confirmacao",
        identificado: `${op.nome} tem um orçamento com validade vencendo em breve, ainda sem resposta.`,
        motivo: "Um orçamento perto de vencer sem resposta corre risco real de virar receita perdida se ninguém retomar o contato antes do prazo.",
        acao: op.acaoSugerida,
        evidencia: op.tempoDecorrido
          ? `Identificado no histórico real de orçamentos, ${op.tempoDecorrido}.`
          : "Identificado no histórico real de orçamentos.",
        prioridade: op.prioridade,
        destino: "/clientes",
        destinoLabel: "Ver cliente",
      });
    } else if (sinal.tipo === "orcamento_expirado") {
      lista.push({
        id: `consultivo-orcamento-${op.chave}`,
        categoria: "cancelamento_confirmacao",
        identificado: `${op.nome} tem um orçamento cuja validade já venceu, sem resposta registrada.`,
        motivo: "A validade vencer não significa que o cliente perdeu o interesse — vale confirmar se ainda há intenção antes de encerrar o orçamento.",
        acao: op.acaoSugerida,
        evidencia: op.tempoDecorrido
          ? `Identificado no histórico real de orçamentos, ${op.tempoDecorrido}.`
          : "Identificado no histórico real de orçamentos.",
        prioridade: op.prioridade,
        destino: "/clientes",
        destinoLabel: "Ver cliente",
      });
    } else if (sinal.tipo === "orcamento_aceito_sem_agendamento") {
      // Aceite é fechamento comercial real — nunca confundido com pagamento
      // (seção 3 do documento de arquitetura). "venda_fechada" ainda não
      // existe como categoria própria (evita tocar o componente visual);
      // reaproveita "cancelamento_confirmacao" pelo mesmo motivo dos dois
      // sinais acima.
      lista.push({
        id: `consultivo-orcamento-${op.chave}`,
        categoria: "cancelamento_confirmacao",
        identificado: `${op.nome} aceitou um orçamento, mas ainda não tem nenhum agendamento vinculado.`,
        motivo: "Um orçamento aceito sem agendamento é um negócio fechado que ainda não virou operação — vale marcar o compromisso antes que o cliente esfrie.",
        acao: op.acaoSugerida,
        evidencia: op.tempoDecorrido
          ? `Identificado no histórico real de orçamentos, ${op.tempoDecorrido}.`
          : "Identificado no histórico real de orçamentos.",
        prioridade: op.prioridade,
        destino: "/clientes",
        destinoLabel: "Ver cliente",
      });
    } else if (sinal.tipo === "interesse_sem_compra") {
      // Sinal heurístico (Smart Commerce — ver comentário no topo de
      // lib/oportunidades-clientes.ts): texto sempre deixa explícito que é
      // uma leitura de conversa, nunca um registro confirmado de intenção.
      lista.push({
        id: `consultivo-interesse-${op.chave}`,
        // Reaproveita a categoria "retorno_cliente" (nenhuma categoria nova
        // no contrato) — evita qualquer alteração em componente visual do
        // Dashboard (stCategoria em DiretorDigitalCard.tsx), fora do escopo
        // deste bloco. Semanticamente é o mesmo tema: cliente a reaproximar.
        categoria: "retorno_cliente",
        identificado: `${op.nome} demonstrou interesse pelo WhatsApp e, até onde os dados mostram, não chegou a agendar.`,
        motivo: "Sinal heurístico, baseado no texto da conversa — não é um registro confirmado de intenção, mas pode ser uma oportunidade perdida se ninguém retomar o contato.",
        acao: op.acaoSugerida,
        evidencia: op.tempoDecorrido
          ? `Sinal heurístico a partir de conversas do WhatsApp, ${op.tempoDecorrido} — não é um registro confirmado de interesse.`
          : "Sinal heurístico a partir de conversas do WhatsApp — não é um registro confirmado de interesse.",
        prioridade: op.prioridade,
        destino: "/clientes",
        destinoLabel: "Ver cliente",
      });
    } else if (sinal.tipo === "demanda_nao_atendida") {
      // Mesma ressalva heurística acima — a evidência nunca afirma que a
      // conversa ficou de fato sem resposta, só que o texto salvo sugere isso.
      lista.push({
        id: `consultivo-demanda-${op.chave}`,
        categoria: "retorno_cliente",
        identificado: `${op.nome} enviou uma mensagem pelo WhatsApp que o assistente não conseguiu resolver diretamente.`,
        motivo: "Sinal heurístico, baseado na resposta automática enviada — não é um registro confirmado do resultado da conversa, mas pode ser um cliente esperando uma resposta pessoal.",
        acao: op.acaoSugerida,
        evidencia: op.tempoDecorrido
          ? `Sinal heurístico a partir de conversas do WhatsApp, ${op.tempoDecorrido} — não é um registro confirmado de que a demanda ficou sem resposta.`
          : "Sinal heurístico a partir de conversas do WhatsApp — não é um registro confirmado de que a demanda ficou sem resposta.",
        prioridade: op.prioridade,
        destino: "/clientes",
        destinoLabel: "Ver cliente",
      });
    }
  }

  const recAgenda = input.recomendacoes.find(r =>
    r.id === "horario-vago-hoje" || r.id === "agenda-proximos-dias-vazia" || r.id === "agenda-semana-com-poucos-compromissos"
  );
  if (recAgenda) {
    lista.push({
      id: `consultivo-agenda-${recAgenda.id}`,
      categoria: "agenda_ociosa",
      identificado: recAgenda.motivo,
      motivo: recAgenda.explicacao,
      acao: recAgenda.acao,
      evidencia: `${recAgenda.quantidade} ${recAgenda.quantidade === 1 ? "registro real" : "registros reais"} na agenda.`,
      prioridade: recAgenda.prioridade,
      destino: recAgenda.destino,
      destinoLabel: recAgenda.destinoLabel,
    });
  }

  const recAvaliacao = input.recomendacoes.find(r => r.id === "avaliacao-pendente");
  if (recAvaliacao) {
    lista.push({
      id: "consultivo-reputacao",
      categoria: "reputacao",
      identificado: recAvaliacao.motivo,
      motivo: recAvaliacao.explicacao,
      acao: recAvaliacao.acao,
      evidencia: `${recAvaliacao.quantidade} ${recAvaliacao.quantidade === 1 ? "solicitação real" : "solicitações reais"} sem resposta do cliente.`,
      prioridade: recAvaliacao.prioridade,
      destino: recAvaliacao.destino,
      destinoLabel: recAvaliacao.destinoLabel,
    });
  }

  // Princípio 5 ("a próxima boa decisão", não a lista inteira de uma vez):
  // no máximo 3 recomendações consultivas por vez.
  return lista
    .sort((a, b) => PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade])
    .slice(0, 3);
}

/**
 * Narrativa curta do Diretor Digital (seção 11.3, versão v1 reduzida: a
 * saudação nominal já existe em outro cartão do Dashboard, então esta
 * narrativa começa no contexto do dia para não repetir cumprimento em
 * duplicidade). Aplica: ponto positivo primeiro quando existir (regra 4),
 * achados encadeados como fala (regra 2), uma prioridade só (regra 3),
 * nunca assusta (regra 5), convite à continuidade (regra 7). Estado Atual
 * Explicado (seção 12.6): descreve o presente, nunca inventa evolução —
 * este módulo não tem, ainda, Memória de Conversa nem snapshot histórico.
 */
export function gerarNarrativaDiretor(ctx: {
  ocupacaoPct: number | null;
  recomendacoes: RecomendacaoConsultiva[];
}): string {
  const partes: string[] = ["Analisei os dados reais do seu negócio hoje."];

  if (ctx.ocupacaoPct !== null) {
    partes.push(
      ctx.ocupacaoPct >= 70
        ? `Sua ocupação está boa, cerca de ${ctx.ocupacaoPct}%.`
        : `Sua ocupação hoje está em ${ctx.ocupacaoPct}%.`
    );
  }

  if (ctx.recomendacoes.length === 0) {
    partes.push("Não encontrei nenhum ponto comercial que precise da sua atenção agora — continue assim.");
    return partes.join(" ");
  }

  const [primeira, ...demais] = ctx.recomendacoes;
  if (demais.length > 0) {
    partes.push(`Também encontrei mais ${demais.length} ${demais.length > 1 ? "pontos que merecem" : "ponto que merece"} sua atenção.`);
  }
  partes.push(`Se eu pudesse sugerir apenas uma prioridade agora, seria: ${primeira.acao.toLowerCase()}.`);
  partes.push("Veja os detalhes abaixo.");
  return partes.join(" ");
}

/**
 * Honestidade absoluta (princípio 7): quando não há cliente/agendamento
 * cadastrado ainda, o Diretor nunca estima nem supõe — diz claramente que
 * ainda não tem dados suficientes.
 */
export function gerarMensagemDadosInsuficientes(): string {
  return "Ainda não possuo dados suficientes para gerar recomendações comerciais. Assim que você tiver clientes e compromissos cadastrados, vou te ajudar com orientações específicas para o seu negócio.";
}

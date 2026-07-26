// ── Motor de Recomendações · OrganizaPro Intelligence 1.5 ──────────────────
//
// Primeiro módulo oficial do "Diretor Digital" (ver docs/organizapro-
// intelligence-engine-v1.html). Nenhuma chamada a IA generativa aqui: cada
// regra é uma função pura e determinística que lê o contexto do negócio e
// decide, sozinha, se a recomendação se aplica.
//
// Por que uma lista de regras em vez de um if/else gigante:
// - Cada regra é isolada, testável e descartável sem afetar as outras.
// - Adicionar uma recomendação nova é só acrescentar um objeto ao array
//   REGRAS — nunca é preciso tocar nas regras existentes nem no motor.
// - A ordenação/priorização (por categoria) fica centralizada em UM lugar
//   (gerarRecomendacoes), não espalhada em condicionais aninhadas.
//
// Como adicionar uma regra nova no futuro:
//   1. Adicione o dado necessário a `ContextoNegocio` (se ainda não existir).
//   2. Garanta que esse dado já é lido em algum lugar do sistema — este
//      motor nunca deve disparar uma consulta própria.
//   3. Acrescente um objeto ao array REGRAS com id, categoria e a função
//      `avaliar`. Retorne `null` quando a regra não se aplica.
//   4. Pronto — o motor já ordena, prioriza e limita automaticamente.
//
// Voz (Intelligence 1.6 · "O Nascimento do Diretor Digital"): título e
// explicação são a fala do Diretor Digital em primeira pessoa — "Analisei",
// "Percebi", "Identifiquei", "Minha recomendação", nunca "O sistema
// encontrou". `motivo` é o único campo que pode ficar factual/neutro (é o
// dado bruto que embasa a fala). Toda regra nova deve seguir essa voz.

export type CategoriaRecomendacao = "atencao" | "oportunidade" | "organizacao" | "sugestao";

// Prioridade explícita da missão — Intelligence 2.1 ("Missão do Dia" /
// "Central de Oportunidades"). Não é redundante com `categoria`: categoria
// descreve a NATUREZA da recomendação (por que ela existe), prioridade
// descreve a URGÊNCIA de agir (quando) — é o campo que agrupa os cartões da
// Central de Oportunidades em 🔴 Alta / 🟡 Média / 🔵 Baixa.
export type PrioridadeMissao = "alta" | "media" | "baixa";

export type Recomendacao = {
  id:             string;
  categoria:      CategoriaRecomendacao;
  titulo:         string;
  explicacao:     string;
  motivo:         string;
  acao:           string;
  destino?:       string;
  destinoLabel?:  string;
  prioridade:     PrioridadeMissao;
  impacto:        string;
  tempoEstimado:  string;
  // Quantidade de ocorrências que originaram a recomendação (ex.: 3 clientes,
  // 2 horários vagos). Regras de reforço positivo (categoria "organizacao")
  // não têm ocorrência a contar — usam 0.
  quantidade:     number;
};

export type ContextoNegocio = {
  totalPacientes:       number;
  totalAgendamentos:    number;
  compromissosHoje:     number;
  pendentesHoje:        number;
  atrasados:            number;
  proximosSemana:       number;
  clientesParaReativar: number;
  cancelamentosHoje:    number;
  horariosVagosHoje:    number;
  avaliacoesPendentes:  number;
  temEmail:             boolean;
  temTelefone:          boolean;
  temEndereco:          boolean;
  temWhatsapp:          boolean;
};

type Regra = {
  id:        string;
  categoria: CategoriaRecomendacao;
  avaliar:   (ctx: ContextoNegocio) => Omit<Recomendacao, "id" | "categoria"> | null;
};

// Cada regra só conhece a si mesma. Nenhuma depende da ordem das outras.
const REGRAS: Regra[] = [
  // 🔴 Atenção — risco imediato, precisa de ação hoje.
  {
    id: "cancelamento-hoje",
    categoria: "atencao",
    avaliar: (ctx) => {
      if (ctx.cancelamentosHoje <= 0) return null;
      const plural = ctx.cancelamentosHoje > 1;
      return {
        titulo: `Percebi ${ctx.cancelamentosHoje} cancelamento${plural ? "s" : ""} hoje.`,
        explicacao: "Um horário cancelado é receita parada. Vale a pena tentar preencher essa vaga ainda hoje.",
        motivo: `${ctx.cancelamentosHoje} compromisso${plural ? "s" : ""} de hoje foi${plural ? "ram" : ""} cancelado${plural ? "s" : ""}.`,
        acao: "Tentar preencher o horário",
        destino: "/agendamentos", destinoLabel: "Ver agenda",
        prioridade: "alta",
        impacto: "Recupera a receita do horário que ficou livre",
        tempoEstimado: "10 min",
        quantidade: ctx.cancelamentosHoje,
      };
    },
  },
  {
    id: "horario-vago-hoje",
    categoria: "atencao",
    avaliar: (ctx) => {
      if (ctx.horariosVagosHoje <= 0) return null;
      const plural = ctx.horariosVagosHoje > 1;
      return {
        titulo: `Encontrei ${ctx.horariosVagosHoje} horário${plural ? "s" : ""} vago${plural ? "s" : ""} nas próximas 24 horas.`,
        explicacao: "Cada horário vazio hoje é uma venda que não vai acontecer sozinha. Vale tentar preencher agora.",
        motivo: `${ctx.horariosVagosHoje} horário${plural ? "s" : ""} livre${plural ? "s" : ""} identificado${plural ? "s" : ""} na agenda de hoje.`,
        acao: "Oferecer o horário a um cliente",
        destino: "/agendamentos", destinoLabel: "Ver agenda",
        prioridade: "alta",
        impacto: "Reduz horários ociosos e aumenta a receita do dia",
        tempoEstimado: "10 min",
        quantidade: ctx.horariosVagosHoje,
      };
    },
  },
  {
    id: "confirmacao-pendente-hoje",
    categoria: "atencao",
    avaliar: (ctx) => {
      if (ctx.pendentesHoje <= 0) return null;
      const plural = ctx.pendentesHoje > 1;
      return {
        titulo: `Percebi ${ctx.pendentesHoje} compromisso${plural ? "s" : ""} de hoje ainda sem confirmação.`,
        explicacao: "Sem confirmação, a chance de ausência aumenta. Minha recomendação é confirmar antes do horário chegar.",
        motivo: `${ctx.pendentesHoje} cliente${plural ? "s" : ""} ainda não confirmou presença para hoje.`,
        acao: "Confirmar agora",
        destino: "/agendamentos", destinoLabel: "Confirmar",
        prioridade: "alta",
        impacto: "Reduz o risco de falta e vaga ociosa hoje",
        tempoEstimado: "5 min",
        quantidade: ctx.pendentesHoje,
      };
    },
  },
  {
    id: "compromissos-atrasados",
    categoria: "atencao",
    avaliar: (ctx) => {
      if (ctx.atrasados <= 0) return null;
      const plural = ctx.atrasados > 1;
      return {
        titulo: `Analisei sua agenda e encontrei ${ctx.atrasados} compromisso${plural ? "s" : ""} em atraso.`,
        explicacao: "Compromissos atrasados costumam virar clientes esquecidos se não forem resolvidos rápido. Vale sua atenção agora.",
        motivo: `${ctx.atrasados} compromisso${plural ? "s" : ""} passou da data sem ser concluído, cancelado ou reagendado.`,
        acao: "Resolver agora",
        destino: "/agendamentos", destinoLabel: "Ver agenda",
        prioridade: "alta",
        impacto: "Evita perder o cliente e a receita do atendimento",
        tempoEstimado: "5 min",
        quantidade: ctx.atrasados,
      };
    },
  },
  {
    id: "clientes-sem-movimentacao",
    categoria: "atencao",
    avaliar: (ctx) => {
      if (ctx.clientesParaReativar <= 0) return null;
      const plural = ctx.clientesParaReativar > 1;
      return {
        titulo: "Identifiquei clientes sem nenhuma movimentação recente.",
        explicacao: "Relacionamentos esfriam quando ficam tempo demais sem contato. Vale a pena retomar hoje.",
        motivo: `${ctx.clientesParaReativar} cliente${plural ? "s" : ""} sem próximo compromisso agendado.`,
        acao: "Entrar em contato hoje",
        destino: "/clientes", destinoLabel: "Ver clientes",
        prioridade: "media",
        impacto: "Recupera clientes antes que esfriem de vez",
        tempoEstimado: "15 min",
        quantidade: ctx.clientesParaReativar,
      };
    },
  },

  // 🟡 Oportunidade — não é urgente, mas vale aproveitar.
  {
    id: "avaliacao-pendente",
    categoria: "oportunidade",
    avaliar: (ctx) => {
      if (ctx.avaliacoesPendentes <= 0) return null;
      const plural = ctx.avaliacoesPendentes > 1;
      return {
        titulo: `Notei ${ctx.avaliacoesPendentes} avaliação${plural ? "ões" : ""} do Google ainda pendente${plural ? "s" : ""}.`,
        explicacao: "Cada avaliação respondida fortalece sua reputação online e ajuda a atrair novos clientes.",
        motivo: `${ctx.avaliacoesPendentes} solicitação${plural ? "ões" : ""} de avaliação enviada${plural ? "s" : ""} ainda sem retorno do cliente.`,
        acao: "Acompanhar avaliações",
        destino: "/reputacao", destinoLabel: "Ver Reputação",
        prioridade: "media",
        impacto: "Fortalece a reputação online e atrai novos clientes",
        tempoEstimado: "10 min",
        quantidade: ctx.avaliacoesPendentes,
      };
    },
  },
  {
    id: "agenda-proximos-dias-vazia",
    categoria: "oportunidade",
    avaliar: (ctx) => {
      if (ctx.proximosSemana > 0) return null;
      return {
        titulo: "Observei que sua agenda dos próximos dias está livre.",
        explicacao: "Hoje eu faria uso desse espaço para prospectar — horário livre é oportunidade parada.",
        motivo: "Nenhum compromisso encontrado nos próximos 7 dias.",
        acao: "Agendar novos compromissos",
        destino: "/agendamentos", destinoLabel: "Agendar",
        prioridade: "media",
        impacto: "Preenche a semana e aumenta a receita prevista",
        tempoEstimado: "20 min",
        quantidade: 7,
      };
    },
  },
  {
    id: "agenda-semana-com-poucos-compromissos",
    categoria: "oportunidade",
    avaliar: (ctx) => {
      if (ctx.proximosSemana === 0 || ctx.proximosSemana >= 5) return null;
      return {
        titulo: "Notei poucos compromissos agendados para esta semana.",
        explicacao: "Preencher os próximos dias aumenta a receita prevista. Vale a pena agir cedo.",
        motivo: `Apenas ${ctx.proximosSemana} compromisso${ctx.proximosSemana > 1 ? "s" : ""} nos próximos 7 dias.`,
        acao: "Preencher a agenda",
        destino: "/agendamentos", destinoLabel: "Ver agenda",
        prioridade: "media",
        impacto: "Aumenta a ocupação da agenda nos próximos dias",
        tempoEstimado: "15 min",
        quantidade: ctx.proximosSemana,
      };
    },
  },
  {
    id: "whatsapp-nao-configurado",
    categoria: "oportunidade",
    avaliar: (ctx) => {
      if (ctx.temWhatsapp) return null;
      return {
        titulo: "Percebi que o WhatsApp automático ainda não está ativo.",
        explicacao: "Sem essa integração, lembretes e confirmações dependem de você fazer manualmente. Recomendo configurar assim que possível.",
        motivo: "Nenhuma credencial de WhatsApp foi encontrada nas configurações.",
        acao: "Configurar WhatsApp",
        destino: "/configuracoes", destinoLabel: "Configurações",
        prioridade: "media",
        impacto: "Automatiza lembretes e reduz faltas",
        tempoEstimado: "10 min",
        quantidade: 1,
      };
    },
  },
  {
    id: "perfil-incompleto",
    categoria: "oportunidade",
    avaliar: (ctx) => {
      if (ctx.temEmail && ctx.temTelefone && ctx.temEndereco) return null;
      return {
        titulo: "Encontrei dados da empresa ainda incompletos.",
        explicacao: "Um cadastro completo passa mais confiança aos seus clientes. Vale completar isso hoje.",
        motivo: "Faltam dados como e-mail, telefone ou endereço nas configurações.",
        acao: "Completar cadastro",
        destino: "/configuracoes", destinoLabel: "Configurações",
        prioridade: "baixa",
        impacto: "Aumenta a confiança do cliente no primeiro contato",
        tempoEstimado: "5 min",
        quantidade: 1,
      };
    },
  },

  // 🟢 Organização — reforço positivo, sem ação pendente. Não aparecem na
  // Central de Oportunidades (não são ações a executar), só na Missão do Dia
  // quando não há nada mais importante para fazer.
  {
    id: "cadastro-completo",
    categoria: "organizacao",
    avaliar: (ctx) => {
      if (!(ctx.temEmail && ctx.temTelefone && ctx.temEndereco)) return null;
      return {
        titulo: "Revisei o cadastro da empresa: está tudo completo.",
        explicacao: "Isso passa mais confiança aos seus clientes. Excelente trabalho de organização.",
        motivo: "E-mail, telefone e endereço já estão preenchidos nas configurações.",
        acao: "Excelente trabalho",
        prioridade: "baixa",
        impacto: "Nenhuma ação necessária",
        tempoEstimado: "—",
        quantidade: 0,
      };
    },
  },
  {
    id: "agenda-sem-pendencias",
    categoria: "organizacao",
    avaliar: (ctx) => {
      if (ctx.atrasados > 0 || ctx.pendentesHoje > 0) return null;
      return {
        titulo: "Analisei sua agenda: nenhuma pendência para hoje.",
        explicacao: "Sem atrasos, sem confirmações pendentes — a operação está sob controle.",
        motivo: "Não há compromissos atrasados nem sem confirmação hoje.",
        acao: "Continue assim",
        prioridade: "baixa",
        impacto: "Nenhuma ação necessária",
        tempoEstimado: "—",
        quantidade: 0,
      };
    },
  },

  // 💡 Sugestão — próximo passo natural para quem está começando.
  {
    id: "sem-compromissos-cadastrados",
    categoria: "sugestao",
    avaliar: (ctx) => {
      if (ctx.totalAgendamentos > 0) return null;
      return {
        titulo: "Ainda não encontrei nenhum compromisso cadastrado.",
        explicacao: "Minha recomendação é começar registrando os próximos atendimentos — isso me ajuda a acompanhar sua rotina.",
        motivo: "Nenhum compromisso foi cadastrado ainda.",
        acao: "Criar primeiro compromisso",
        destino: "/agendamentos", destinoLabel: "Agendar",
        prioridade: "media",
        impacto: "Começa a alimentar o sistema com dados reais",
        tempoEstimado: "5 min",
        quantidade: 1,
      };
    },
  },
  {
    id: "sem-clientes-cadastrados",
    categoria: "sugestao",
    avaliar: (ctx) => {
      if (ctx.totalPacientes > 0) return null;
      return {
        titulo: "Ainda não encontrei clientes cadastrados.",
        explicacao: "Uma base organizada é o ponto de partida para qualquer recomendação futura minha.",
        motivo: "Nenhum cliente foi cadastrado ainda.",
        acao: "Cadastrar cliente",
        destino: "/clientes", destinoLabel: "Cadastrar",
        prioridade: "media",
        impacto: "Base para todas as próximas recomendações",
        tempoEstimado: "5 min",
        quantidade: 1,
      };
    },
  },
];

// Ordem de prioridade entre categorias — não entre recomendações individuais
// dentro da mesma categoria, que seguem a ordem de definição em REGRAS.
const PESO_CATEGORIA: Record<CategoriaRecomendacao, number> = {
  atencao: 0,
  oportunidade: 1,
  organizacao: 2,
  sugestao: 3,
};

/**
 * Roda todas as regras contra o contexto atual e devolve as recomendações
 * que se aplicam, ordenadas por categoria (atenção primeiro) e limitadas a
 * `limite` itens — o Diretor Digital mostra o que importa mais agora, não
 * uma lista exaustiva de tudo que percebeu.
 */
export function gerarRecomendacoes(ctx: ContextoNegocio, limite = 3): Recomendacao[] {
  const encontradas: Recomendacao[] = [];
  for (const regra of REGRAS) {
    const resultado = regra.avaliar(ctx);
    if (resultado) encontradas.push({ id: regra.id, categoria: regra.categoria, ...resultado });
  }
  encontradas.sort((a, b) => PESO_CATEGORIA[a.categoria] - PESO_CATEGORIA[b.categoria]);
  return encontradas.slice(0, limite);
}

// ── OrganizaPro Intelligence 2.0 · Prioridade do Diretor ────────────────────
//
// Até aqui o Diretor Digital só listava o que percebeu. Aqui ele decide: das
// recomendações aplicáveis, qual é A ação mais importante agora. Essa
// escolha é o núcleo do Diretor Digital — o ponto exato que uma futura
// evolução com IA generativa vai substituir (por um modelo, um score, o que
// for). Por isso ela vive isolada nesta função, sem nenhum conhecimento de
// como a interface vai desenhar o resultado.
//
// Hoje a decisão é simples porque REGRAS já nasce na ordem certa: dentro de
// "atencao", cancelamento/horário vago/confirmação pendente/atraso (crítico)
// vêm antes de clientes parados; dentro de "oportunidade", avaliação
// pendente vem antes de agenda vazia/whatsapp/perfil. Combinado com
// PESO_CATEGORIA, isso já reproduz a ordem de importância do Diretor.
// `gerarRecomendacoes` entrega a lista nessa ordem — a prioridade principal
// é sempre a primeira.

export type PrioridadeDoDia = {
  prioridade: Recomendacao | null;
  demais:     Recomendacao[];
};

/**
 * Escolhe, entre as recomendações já ordenadas por importância, UMA
 * prioridade principal — e devolve o restante separado para exibição
 * secundária. Responsabilidade única: decidir. Não formata texto, não sabe
 * de UI.
 */
export function escolherPrioridadePrincipal(recomendacoes: Recomendacao[]): PrioridadeDoDia {
  const [prioridade, ...demais] = recomendacoes;
  return { prioridade: prioridade ?? null, demais };
}

/**
 * Atalho para o Dashboard: gera as recomendações aplicáveis e já devolve a
 * prioridade do dia separada das demais recomendações.
 */
export function gerarPrioridadeDoDia(ctx: ContextoNegocio, limiteTotal = 4): PrioridadeDoDia {
  return escolherPrioridadePrincipal(gerarRecomendacoes(ctx, limiteTotal));
}

// ── OrganizaPro Intelligence 2.2 · Central de Oportunidades ─────────────────
//
// Diferente da Missão do Dia (que escolhe UMA prioridade), a Central de
// Oportunidades mostra TODAS as ações disponíveis agrupadas por urgência —
// o empresário vê o quadro completo, não só o próximo passo. Reaproveita
// 100% das mesmas regras e do mesmo campo `prioridade`; a única diferença é
// que aqui nada é escolhido/descartado, e recomendações de reforço positivo
// (categoria "organizacao", sem ação real a executar) ficam de fora.

export type CentralOportunidades = {
  alta:  Recomendacao[];
  media: Recomendacao[];
  baixa: Recomendacao[];
};

/**
 * Atalho para o Dashboard: gera todas as recomendações acionáveis (exclui
 * reforço positivo) e agrupa por prioridade para a Central de Oportunidades.
 */
export function gerarCentralOportunidades(ctx: ContextoNegocio): CentralOportunidades {
  const todas = gerarRecomendacoes(ctx, REGRAS.length).filter(r => r.categoria !== "organizacao");
  return {
    alta:  todas.filter(r => r.prioridade === "alta"),
    media: todas.filter(r => r.prioridade === "media"),
    baixa: todas.filter(r => r.prioridade === "baixa"),
  };
}

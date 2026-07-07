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

export type CategoriaRecomendacao = "atencao" | "oportunidade" | "organizacao" | "sugestao";

export type Recomendacao = {
  id:            string;
  categoria:     CategoriaRecomendacao;
  titulo:        string;
  explicacao:    string;
  motivo:        string;
  acao:          string;
  destino?:      string;
  destinoLabel?: string;
};

export type ContextoNegocio = {
  totalPacientes:       number;
  totalAgendamentos:    number;
  compromissosHoje:     number;
  pendentesHoje:        number;
  atrasados:            number;
  proximosSemana:       number;
  clientesParaReativar: number;
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
    id: "compromissos-atrasados",
    categoria: "atencao",
    avaliar: (ctx) => {
      if (ctx.atrasados <= 0) return null;
      const plural = ctx.atrasados > 1;
      return {
        titulo: `Você tem ${ctx.atrasados} compromisso${plural ? "s" : ""} em atraso.`,
        explicacao: "Compromissos atrasados costumam virar clientes esquecidos se não forem resolvidos rápido.",
        motivo: `${ctx.atrasados} compromisso${plural ? "s" : ""} passou da data sem ser concluído, cancelado ou reagendado.`,
        acao: "Resolver agora",
        destino: "/agendamentos", destinoLabel: "Ver agenda",
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
        titulo: `${ctx.pendentesHoje} compromisso${plural ? "s" : ""} de hoje sem confirmação.`,
        explicacao: "Compromissos não confirmados têm mais chance de virar ausência.",
        motivo: `${ctx.pendentesHoje} cliente${plural ? "s" : ""} ainda não confirmou presença para hoje.`,
        acao: "Confirmar agora",
        destino: "/agendamentos", destinoLabel: "Confirmar",
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
        titulo: "Você possui clientes sem movimentação.",
        explicacao: "Clientes sem nenhum compromisso futuro tendem a esfriar o relacionamento com o tempo.",
        motivo: `${ctx.clientesParaReativar} cliente${plural ? "s" : ""} sem próximo compromisso agendado.`,
        acao: "Entrar em contato hoje",
        destino: "/pacientes", destinoLabel: "Ver clientes",
      };
    },
  },

  // 🟡 Oportunidade — não é urgente, mas vale aproveitar.
  {
    id: "agenda-proximos-dias-vazia",
    categoria: "oportunidade",
    avaliar: (ctx) => {
      if (ctx.proximosSemana > 0) return null;
      return {
        titulo: "Sua agenda dos próximos dias está vazia.",
        explicacao: "Horário livre é oportunidade de prospecção antes que vire tempo ocioso.",
        motivo: "Nenhum compromisso encontrado nos próximos 7 dias.",
        acao: "Agendar novos compromissos",
        destino: "/agendamentos", destinoLabel: "Agendar",
      };
    },
  },
  {
    id: "agenda-semana-com-poucos-compromissos",
    categoria: "oportunidade",
    avaliar: (ctx) => {
      if (ctx.proximosSemana === 0 || ctx.proximosSemana >= 5) return null;
      return {
        titulo: "Sua agenda da semana está com poucos compromissos.",
        explicacao: "Preencher os próximos dias aumenta a receita prevista da semana.",
        motivo: `Apenas ${ctx.proximosSemana} compromisso${ctx.proximosSemana > 1 ? "s" : ""} nos próximos 7 dias.`,
        acao: "Preencher a agenda",
        destino: "/agendamentos", destinoLabel: "Ver agenda",
      };
    },
  },
  {
    id: "whatsapp-nao-configurado",
    categoria: "oportunidade",
    avaliar: (ctx) => {
      if (ctx.temWhatsapp) return null;
      return {
        titulo: "O WhatsApp automático ainda não está configurado.",
        explicacao: "Sem essa integração, lembretes e confirmações precisam ser feitos manualmente.",
        motivo: "Nenhuma credencial de WhatsApp foi encontrada nas configurações.",
        acao: "Configurar WhatsApp",
        destino: "/configuracoes", destinoLabel: "Configurações",
      };
    },
  },
  {
    id: "perfil-incompleto",
    categoria: "oportunidade",
    avaliar: (ctx) => {
      if (ctx.temEmail && ctx.temTelefone && ctx.temEndereco) return null;
      return {
        titulo: "O perfil da sua empresa está incompleto.",
        explicacao: "Um cadastro completo passa mais confiança e facilita o contato com clientes.",
        motivo: "Faltam dados como e-mail, telefone ou endereço nas configurações.",
        acao: "Completar cadastro",
        destino: "/configuracoes", destinoLabel: "Configurações",
      };
    },
  },

  // 🟢 Organização — reforço positivo, sem ação pendente.
  {
    id: "cadastro-completo",
    categoria: "organizacao",
    avaliar: (ctx) => {
      if (!(ctx.temEmail && ctx.temTelefone && ctx.temEndereco)) return null;
      return {
        titulo: "Todos os dados da empresa estão completos.",
        explicacao: "Um cadastro completo transmite mais confiança para os seus clientes.",
        motivo: "E-mail, telefone e endereço já estão preenchidos nas configurações.",
        acao: "Excelente trabalho",
      };
    },
  },
  {
    id: "agenda-sem-pendencias",
    categoria: "organizacao",
    avaliar: (ctx) => {
      if (ctx.atrasados > 0 || ctx.pendentesHoje > 0) return null;
      return {
        titulo: "Sua agenda está em dia.",
        explicacao: "Nenhum atraso ou pendência de confirmação — a operação está sob controle.",
        motivo: "Não há compromissos atrasados nem sem confirmação hoje.",
        acao: "Continue assim",
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
        titulo: "Cadastre novos compromissos para manter sua agenda organizada.",
        explicacao: "Registrar compromissos ajuda a antecipar o dia e não esquecer nenhum cliente.",
        motivo: "Nenhum compromisso foi cadastrado ainda.",
        acao: "Criar primeiro compromisso",
        destino: "/agendamentos", destinoLabel: "Agendar",
      };
    },
  },
  {
    id: "sem-clientes-cadastrados",
    categoria: "sugestao",
    avaliar: (ctx) => {
      if (ctx.totalPacientes > 0) return null;
      return {
        titulo: "Cadastre seus primeiros clientes.",
        explicacao: "Uma base de clientes organizada é o ponto de partida de qualquer recomendação futura.",
        motivo: "Nenhum cliente foi cadastrado ainda.",
        acao: "Cadastrar cliente",
        destino: "/pacientes", destinoLabel: "Cadastrar",
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

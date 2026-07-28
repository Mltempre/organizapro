import type { FamiliaId } from "./families";

// Conteúdo institucional universal, agora por família visual — nunca um dado
// específico da empresa, e sim um fallback honesto para quando o cadastro
// ainda não tem essa informação própria. Nenhum item aqui é uma estatística
// inventada; a única coisa que muda por família é qual verdade universal do
// segmento é mais relevante — nunca um fato específico sobre esta empresa.

export const PROBLEMA: Record<FamiliaId, { titulo: string; corpo: string }> = {
  saude: {
    titulo: "Marcar um atendimento com alguém de confiança não devia ser tão difícil quanto costuma ser.",
    corpo: "Entre agendas cheias, respostas demoradas e a insegurança de não saber com quem você vai falar — o mais simples devia ser simples. É exatamente isso que resolvemos por aqui.",
  },
  autoridade: {
    titulo: "Uma questão sem clareza costuma gerar mais insegurança do que o problema em si.",
    corpo: "Antes de qualquer decisão, o mais importante é entender exatamente onde você está e quais são as suas opções reais — sem jargão, sem meio-termo.",
  },
  consumo: {
    titulo: "Encontrar um lugar de confiança, com atendimento à altura, não devia depender de sorte.",
    corpo: "Entre agendas lotadas, respostas demoradas e a dúvida de quem vai te atender dessa vez — o mais simples devia ser simples. É exatamente isso que resolvemos por aqui.",
  },
  tecnica: {
    titulo: "Saber se o problema foi realmente resolvido — e não só disfarçado — é a maior fonte de desconfiança nesse tipo de serviço.",
    corpo: "Um diagnóstico claro e um prazo real fazem toda a diferença entre confiar no que foi feito e continuar com dúvida.",
  },
  universal: {
    titulo: "Encontrar uma empresa de confiança, com informação clara desde o primeiro contato, não devia ser tão difícil quanto costuma ser.",
    corpo: "Entre respostas demoradas e informação incompleta, o mais simples devia ser simples. É exatamente isso que resolvemos por aqui.",
  },
};

export const DIFERENCIAIS: Record<FamiliaId, { titulo: string; desc: string }[]> = {
  saude: [
    { titulo: "Atendimento sem pressa, no seu tempo",        desc: "Cada consulta é pensada para você entender cada etapa, sem sensação de linha de produção." },
    { titulo: "Explicação clara antes de qualquer decisão",  desc: "Você decide com informação, nunca com dúvida." },
    { titulo: "Acompanhamento contínuo, não só pontual",     desc: "O cuidado continua depois do atendimento — não termina nele." },
  ],
  autoridade: [
    { titulo: "Explicação em linguagem clara, sem jargão",           desc: "Você entende exatamente onde está, em cada etapa." },
    { titulo: "Prazo e próximos passos definidos desde o início",    desc: "Nada de incerteza sobre o que vem a seguir." },
    { titulo: "Acompanhamento direto, sem intermediário",            desc: "Você fala com quem realmente conduz o seu caso." },
  ],
  consumo: [
    { titulo: "Horário marcado é horário respeitado",         desc: "Sem fila, sem ‘só mais um cliente antes de você’." },
    { titulo: "Atendimento que conhece você, não só o seu nome", desc: "Sem precisar explicar tudo de novo a cada visita." },
    { titulo: "Ambiente pensado para a experiência",           desc: "Não é só o serviço — é o momento inteiro." },
  ],
  tecnica: [
    { titulo: "Diagnóstico honesto antes de qualquer orçamento", desc: "Você só paga pelo que realmente precisa ser feito." },
    { titulo: "Prazo real, sem enrolação",                       desc: "Combinado é combinado — sem surpresa no final." },
    { titulo: "Serviço garantido, não só entregue",              desc: "O compromisso continua depois que o serviço termina." },
  ],
  universal: [
    { titulo: "Atendimento personalizado",        desc: "Cada cliente recebe atenção genuína, do primeiro contato ao acompanhamento final." },
    { titulo: "Processo bem definido",            desc: "Etapas organizadas e comunicação objetiva do início ao fim." },
    { titulo: "Transparência em cada etapa",      desc: "Informações claras para você acompanhar todo o processo com confiança." },
  ],
};

export const PROCESSO: Record<FamiliaId, { numero: string; titulo: string; desc: string }[]> = {
  saude: [
    { numero: "01", titulo: "Você agenda sua avaliação",          desc: "Pelo canal mais prático para você, sem burocracia." },
    { numero: "02", titulo: "Conversamos com calma",              desc: "Entendemos sua necessidade antes de qualquer decisão." },
    { numero: "03", titulo: "Você decide com clareza",            desc: "Sempre com informação completa sobre os próximos passos." },
  ],
  autoridade: [
    { numero: "01", titulo: "Você relata sua situação",           desc: "Sem compromisso, para entendermos o contexto real." },
    { numero: "02", titulo: "Recebe uma avaliação inicial",       desc: "Clara, direta, sem jargão desnecessário." },
    { numero: "03", titulo: "Decide com segurança",               desc: "Sabendo exatamente quais são os próximos passos." },
  ],
  consumo: [
    { numero: "01", titulo: "Você entra em contato",              desc: "Fale com a gente pelo canal mais prático para você." },
    { numero: "02", titulo: "Escolhe o horário que serve",        desc: "A gente confirma na hora, sem enrolação." },
    { numero: "03", titulo: "Vive a experiência completa",        desc: "Do início ao fim, sem pressa e sem imprevisto." },
  ],
  tecnica: [
    { numero: "01", titulo: "Você descreve o problema",           desc: "Conta o que está acontecendo, do seu jeito." },
    { numero: "02", titulo: "Recebe um diagnóstico honesto",      desc: "Antes de qualquer orçamento ou decisão." },
    { numero: "03", titulo: "O serviço é resolvido com garantia",  desc: "Com prazo real e acompanhamento até o fim." },
  ],
  universal: [
    { numero: "01", titulo: "Você entra em contato",              desc: "Fale com a gente pelo canal mais prático para você." },
    { numero: "02", titulo: "Entendemos sua necessidade",         desc: "Ouvimos o seu contexto para indicar o melhor caminho." },
    { numero: "03", titulo: "Você recebe um retorno",             desc: "Uma resposta objetiva, com os próximos passos." },
  ],
};

// Convite contextual ao WhatsApp — muda a mensagem pré-preenchida conforme a
// seção de origem, para reduzir a fricção de "ter que explicar tudo de novo".
export const CTA_CONTEXTUAL: Record<FamiliaId, Record<"hero" | "problema" | "servicos" | "final", string>> = {
  saude: {
    hero: "Olá! Gostaria de agendar uma avaliação.",
    problema: "Olá! Gostaria de entender melhor como vocês podem me ajudar.",
    servicos: "Olá! Gostaria de saber mais sobre os atendimentos disponíveis.",
    final: "Olá! Gostaria de agendar um horário.",
  },
  autoridade: {
    hero: "Olá! Gostaria de falar sobre a minha situação.",
    problema: "Olá! Gostaria de uma orientação inicial.",
    servicos: "Olá! Gostaria de saber mais sobre os serviços.",
    final: "Olá! Gostaria de agendar uma conversa.",
  },
  consumo: {
    hero: "Olá! Gostaria de agendar um horário.",
    problema: "Olá! Gostaria de saber mais.",
    servicos: "Olá! Gostaria de saber mais sobre os serviços.",
    final: "Olá! Gostaria de agendar agora.",
  },
  tecnica: {
    hero: "Olá! Gostaria de solicitar um orçamento.",
    problema: "Olá! Gostaria de entender melhor o que vocês oferecem.",
    servicos: "Olá! Gostaria de solicitar um orçamento para um destes serviços.",
    final: "Olá! Gostaria de solicitar um orçamento.",
  },
  universal: {
    hero: "Olá! Gostaria de saber mais.",
    problema: "Olá! Gostaria de entender melhor como vocês podem me ajudar.",
    servicos: "Olá! Gostaria de saber mais sobre os serviços.",
    final: "Olá! Gostaria de saber mais.",
  },
};

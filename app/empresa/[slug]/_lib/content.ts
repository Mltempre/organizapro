// Conteúdo institucional universal — nunca é um dado específico da empresa,
// e sim um fallback honesto para quando o cadastro ainda não tem essa
// informação. Nenhum item aqui menciona nicho (saúde, clínica, jurídico etc).

export const NAV_LINKS: [string, string][] = [
  ["#hero", "Início"],
  ["#sobre", "Sobre"],
  ["#servicos", "Serviços"],
  ["#contato", "Contato"],
];

export const DIFERENCIAIS = [
  { icone: "handshake", titulo: "Atendimento próximo", desc: "Cada cliente é ouvido com atenção real, do primeiro contato ao pós-atendimento." },
  { icone: "grid",      titulo: "Organização",         desc: "Processos claros, sem enrolação, do início ao fim do atendimento." },
  { icone: "bolt",      titulo: "Agilidade",            desc: "Respostas rápidas e prazos que respeitam o seu tempo." },
  { icone: "shield",    titulo: "Transparência",        desc: "Informações claras em cada etapa, sem letras miúdas." },
  { icone: "target",    titulo: "Experiência personalizada", desc: "Cada atendimento é conduzido de acordo com a sua necessidade específica." },
  { icone: "check",     titulo: "Compromisso com resultados", desc: "O foco é entregar o que foi combinado, com qualidade." },
];

export const PROCESSO = [
  { numero: "01", titulo: "Entre em contato",              desc: "Fale com a gente pelo WhatsApp, telefone ou e-mail." },
  { numero: "02", titulo: "Explique sua necessidade",       desc: "Entendemos o seu contexto para indicar o melhor caminho." },
  { numero: "03", titulo: "Receba atendimento personalizado", desc: "Um retorno feito sob medida para o que você precisa." },
];

export const SERVICOS_FALLBACK = [
  { icone: "target",   nome: "Atendimento Personalizado", desc: "Cada cliente recebe uma solução pensada para a sua necessidade específica." },
  { icone: "calendar", nome: "Agendamento Facilitado",     desc: "Marque seu atendimento pelo canal que for mais prático para você." },
  { icone: "chat",     nome: "Suporte Contínuo",           desc: "Acompanhamento em todas as etapas, do primeiro contato ao resultado final." },
];

export const FAQS = [
  { p: "Como faço para entrar em contato?",                r: "Pelo WhatsApp, telefone ou e-mail — os canais estão disponíveis em toda a página." },
  { p: "Como funciona o primeiro atendimento?",             r: "O primeiro contato é dedicado a entender sua necessidade e indicar o melhor caminho, sem compromisso." },
  { p: "Quais formas de pagamento são aceitas?",            r: "Combinamos a forma de pagamento diretamente com você, de acordo com o que for mais prático." },
  { p: "Quanto tempo leva para receber uma resposta?",      r: "Buscamos responder o mais rápido possível — normalmente ainda no mesmo dia." },
];

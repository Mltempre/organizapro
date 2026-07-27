// Conteúdo institucional universal — nunca é um dado específico da empresa,
// e sim um fallback honesto para quando o cadastro ainda não tem essa
// informação própria. Nenhum item aqui menciona nicho (saúde, clínica,
// jurídico etc); nenhum item aqui é uma estatística inventada.

export const NAV_LINKS: [string, string][] = [
  ["#sobre", "Sobre"],
  ["#servicos", "Serviços"],
  ["#depoimentos", "Depoimentos"],
  ["#contato", "Contato"],
];

export const DIFERENCIAIS = [
  { icone: "handshake", titulo: "Atendimento personalizado",   desc: "Cada cliente recebe atenção genuína, do primeiro contato ao acompanhamento final." },
  { icone: "grid",      titulo: "Processo bem definido",       desc: "Etapas organizadas e comunicação objetiva para uma experiência segura do início ao fim." },
  { icone: "bolt",      titulo: "Agilidade com qualidade",     desc: "Respostas eficientes e prazos conduzidos com respeito ao seu tempo." },
  { icone: "shield",    titulo: "Transparência em cada etapa", desc: "Informações claras para que você acompanhe todo o processo com confiança." },
  { icone: "target",    titulo: "Soluções sob medida",         desc: "Cada proposta considera o seu contexto, suas prioridades e o resultado que você busca." },
  { icone: "check",     titulo: "Compromisso com a entrega",   desc: "Cuidado em cada detalhe para entregar o que foi combinado com excelência." },
];

export const PROCESSO = [
  { numero: "01", titulo: "Você entra em contato",       desc: "Fale com a gente pelo canal mais prático para você." },
  { numero: "02", titulo: "Entendemos sua necessidade",  desc: "Ouvimos o seu contexto para indicar o melhor caminho." },
  { numero: "03", titulo: "Você recebe um retorno",      desc: "Uma resposta objetiva, sem enrolação, com os próximos passos." },
];

export const SERVICOS_FALLBACK = [
  { icone: "target",   nome: "Atendimento personalizado", desc: "Cada cliente recebe uma solução construída para a sua necessidade específica." },
  { icone: "calendar", nome: "Agendamento facilitado",     desc: "Marque seu atendimento pelo canal que for mais prático para você." },
  { icone: "chat",     nome: "Suporte contínuo",           desc: "Acompanhamento em todas as etapas, do primeiro contato ao resultado final." },
];

export const FAQS = [
  { p: "Como faço para entrar em contato?",             r: "Pelo WhatsApp, telefone ou e-mail — os canais estão disponíveis em toda a página." },
  { p: "Como funciona o primeiro atendimento?",          r: "O primeiro contato é dedicado a entender sua necessidade e indicar o melhor caminho, sem compromisso." },
  { p: "Quais formas de pagamento são aceitas?",         r: "Combinamos a forma de pagamento diretamente com você, de acordo com o que for mais prático." },
  { p: "Quanto tempo leva para receber uma resposta?",   r: "Buscamos responder o mais rápido possível — normalmente ainda no mesmo dia." },
];

// Selos genéricos e honestos (nunca uma estatística inventada), usados só
// quando a empresa não tem nenhum dado real para compor a faixa de confiança.
export const CONFIANCA_FALLBACK = ["Atendimento profissional", "Resposta ágil", "Compromisso com resultado"];

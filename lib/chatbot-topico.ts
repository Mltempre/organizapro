// ── Classificação de tópico do Chatbot IA ───────────────────────────────────
// Extraído de app/api/chatbot/message/route.ts (mesma regra, mesmo texto,
// zero duplicação) para que outra camada — hoje, a leitura heurística de
// chatbot_logs em app/dashboard/page.tsx para o Smart Commerce — possa
// classificar uma mensagem pelo texto real sem reimplementar o regex em
// paralelo. `chatbot_logs` não persiste o tópico decidido em tempo de
// resposta (só `processado_por`), então esta função é usada tanto para
// decidir a resposta do bot (route.ts, como sempre foi) quanto para
// reclassificar, a partir do texto salvo, uma conversa já antiga — nos dois
// casos é a mesma regra determinística, nunca duas versões divergentes.

export type Topico =
  | "horario" | "endereco" | "convenios" | "procedimentos"
  | "faq" | "consulta" | "agendar" | "saudacao" | "humano" | "default";

export function normalizar(t: string): string {
  return t.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function classificarTopico(msg: string): Topico {
  const t = normalizar(msg);
  if (/hor[aá]rio|funciona|abre|fecha|atende quando|que horas/.test(t))                  return "horario";
  if (/endere[cç]o|localiz|onde fica|como cheg|rua |av\.|avenida|bairro|cep/.test(t))    return "endereco";
  if (/conv[eê]nio|plano|unimed|sul.?am[eé]rica|amil|bradesco|hapvida|aceita/.test(t))   return "convenios";
  if (/procedimento|tratamento|especialidade|servi[cç]o|exame|cirurgia|realiz/.test(t))  return "procedimentos";
  if (/consulta/.test(t) && /valor|pre[cç]o|quanto|custo|custa|cobr/.test(t))            return "consulta";
  if (/^consulta$/.test(t))                                                                return "consulta";
  if (/valor|pre[cç]o|quanto custa|custo|tabela|particular|cobr/.test(t))                 return "faq";
  if (/agendar|marcar|consulta|reservar|encaixar|quero uma|quero marcar/.test(t))         return "agendar";
  if (/^(oi|ol[aá]|bom dia|boa tarde|boa noite|ola|hey|e a[ií])/.test(t))                return "saudacao";
  if (/humano|atendente|pessoa|recepci|falar com|fale com/.test(t))                       return "humano";
  return "default";
}

// ── Classificação de conversas para o Smart Commerce (sinais heurísticos) ──
// Ver comentário no topo de lib/oportunidades-clientes.ts: interesse_sem_compra
// e demanda_nao_atendida são heurísticos por natureza, porque chatbot_logs não
// persiste o tópico nem a resolução da conversa. Esta função só organiza —
// reclassifica cada log pelo texto real salvo (mesma regra acima, nunca uma
// segunda versão) e decide, por telefone, qual conversa mais recente entra em
// cada lista. Não sabe nada de agenda: teveAgendamentoApos (a diferença entre
// "oportunidade" e "já converteu") é decidido por quem chama, a partir de
// `agendamentos` real — nunca suposto aqui.

export type ChatbotLogParaClassificar = {
  id:                string;
  telefone:          string;
  nomePaciente:      string | null;
  mensagemPaciente:  string;
  processadoPor:     string;
  data:              string; // YYYY-MM-DD, já derivado de chatbot_logs.created_at por quem chama
};

export type ConversaClassificada = {
  id:       string;
  nome:     string | null;
  telefone: string;
  data:     string;
};

export type ConversasClassificadas = {
  interesse:    ConversaClassificada[]; // candidatos a "interesse_sem_compra"
  semResolucao: ConversaClassificada[]; // candidatos a "demanda_nao_atendida"
};

/**
 * `logs` deve vir ordenado do mais recente para o mais antigo (mesma ordem
 * já usada na consulta a chatbot_logs) — mantém só a conversa mais recente
 * por telefone em cada lista, para não inflar sinaisAdicionais com o mesmo
 * assunto repetido.
 *
 * interesse: o texto da mensagem, reclassificado, indica intenção de
 * agendar — independe de quem respondeu (regras, treinamento ou IA
 * Universal), porque a evidência de intenção está na mensagem do cliente,
 * não na resposta do bot.
 *
 * semResolucao: só quando NENHUMA camada (treinamento da própria clínica,
 * IA Universal) resolveu a conversa — processado_por precisa ser "regras" —
 * E o texto reclassificado não corresponde a nenhum tópico reconhecido
 * ("default") ou pede explicitamente um humano ("humano"). Sem essa dupla
 * checagem, uma resposta treinada que o regex daqui não reconhece seria
 * incorretamente marcada como demanda não atendida.
 */
export function classificarConversasChatbot(logs: ChatbotLogParaClassificar[]): ConversasClassificadas {
  const interesse    = new Map<string, ConversaClassificada>();
  const semResolucao = new Map<string, ConversaClassificada>();

  for (const log of logs) {
    if (!log.telefone || !log.mensagemPaciente) continue;
    const topico = classificarTopico(log.mensagemPaciente);

    if (topico === "agendar") {
      if (!interesse.has(log.telefone)) {
        interesse.set(log.telefone, { id: log.id, nome: log.nomePaciente, telefone: log.telefone, data: log.data });
      }
    } else if (
      log.processadoPor === "regras" &&
      (topico === "default" || topico === "humano") &&
      !semResolucao.has(log.telefone)
    ) {
      semResolucao.set(log.telefone, { id: log.id, nome: log.nomePaciente, telefone: log.telefone, data: log.data });
    }
  }

  return { interesse: Array.from(interesse.values()), semResolucao: Array.from(semResolucao.values()) };
}

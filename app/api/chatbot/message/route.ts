import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────

// Score numérico: 10 = frio | 50 = morno | 100 = quente
type Etapa =
  | "inicial"
  | "qualificacao_nome"
  | "qualificacao_cidade"
  | "qualificacao_especialidade"
  | "qualificacao_pacientes"
  | "qualificacao_sistema"
  | "descoberta_dor"
  | "concluido";

type Topico =
  | "horario" | "endereco" | "convenios" | "procedimentos"
  | "faq" | "consulta" | "agendar" | "saudacao" | "humano" | "default";

type Config      = Record<string, string | boolean | null | undefined>;
type Treinamento = { id: string; palavras_chave: string; resposta: string };

interface Lead {
  etapa:          Etapa;
  score:          number;
  nome?:          string | null;
  cidade?:        string | null;
  especialidade?: string | null;
  pacientes_mes?: string | null;
  porte_clinica?: string | null;
  sistema_atual?: string | null;
  dor?:           string | null;
  dor_principal?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizar(t: string): string {
  return t.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const REGEX_CONFIRMACAO =
  /^(sim|s|nao|n|confirmo|confirmado|ok|certo|cancelar|cancela|reagendar|remarcar|estarei la|estou indo|pode confirmar)[\s,!.?]?$/;

function ehConfirmacaoDeConsulta(msg: string): boolean {
  const t = normalizar(msg);
  if (t === "👍" || t === "✅") return true;
  return REGEX_CONFIRMACAO.test(t);
}

// ─── Classificador de tópico (regras fixas) ───────────────────────────────────

function classificarTopico(msg: string): Topico {
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

// ─── Montagem de resposta (regras fixas) ──────────────────────────────────────

function montarResposta(topico: Topico, config: Config): string {
  const link = config.link_humano
    ? `\n\nFale diretamente com nossa equipe: ${config.link_humano}`
    : "";
  switch (topico) {
    case "saudacao":
      return (
        `Olá! Sou o Assistente Virtual do OrganizaPro. 👋\n\n` +
        `Ajudamos pequenos negócios a:\n• Reduzir faltas com confirmações automáticas\n` +
        `• Automatizar atendimentos via WhatsApp\n• Aumentar avaliações no Google\n\n` +
        `Posso te ajudar com:\n• Valores e planos\n• Demonstração gratuita\n` +
        `• WhatsApp automático\n• Avaliações Google\n• Sites profissionais\n\n` +
        `Como posso te ajudar hoje?`
      );
    case "horario":
      return config.horario_funcionamento
        ? `Nosso horário de atendimento:\n\n${config.horario_funcionamento}`
        : `Para informações sobre horários, entre em contato:${link}`;
    case "endereco":
      return config.endereco
        ? `Estamos localizados em:\n\n${config.endereco}`
        : `Para informações sobre endereço, entre em contato:${link}`;
    case "convenios":
      return config.convenios
        ? `Convênios aceitos:\n\n${config.convenios}`
        : `Para informações sobre convênios, entre em contato:${link}`;
    case "procedimentos":
      return config.procedimentos
        ? `Procedimentos realizados:\n\n${config.procedimentos}`
        : `Para informações sobre procedimentos, entre em contato:${link}`;
    case "consulta":
      return (
        `A consulta inicial pode variar conforme a avaliação e o procedimento necessário.` +
        ` Para confirmar o valor certinho, nossa equipe pode te atender.` +
        ` Quer que eu chame um atendente?${link}`
      );
    case "faq":
      return config.faq
        ? String(config.faq)
        : `Para informações sobre valores, entre em contato:${link}`;
    case "agendar":
      return config.link_humano
        ? `Para agendar sua consulta, fale com nossa equipe:\n\n${config.link_humano}`
        : `Para agendar, entre em contato conosco.${link}`;
    case "humano":
      return config.link_humano
        ? `Claro! Para falar com um de nossos atendentes:\n\n${config.link_humano}`
        : `Vou te conectar com nossa equipe em breve.`;
    default:
      return (
        `Posso ajudar com:\n\n` +
        `• Valores\n• Demonstração\n• WhatsApp automático\n` +
        `• Avaliações Google\n• Sites profissionais\n\n` +
        `Qual assunto você gostaria de conhecer?`
      );
  }
}

// ─── Matching por treinamento ─────────────────────────────────────────────────

function matchTreinamento(msgNorm: string, treinamentos: Treinamento[]): Treinamento | null {
  for (const t of treinamentos) {
    if (!t.palavras_chave?.trim()) continue;
    const keywords = t.palavras_chave
      .split(",")
      .map(k => normalizar(k.trim()))
      .filter(k => k.length > 0);
    if (keywords.some(kw => msgNorm.includes(kw))) return t;
  }
  return null;
}

// ─── Lead scoring (numérico) ──────────────────────────────────────────────────

const HOT_SIGNALS  = ["quero contratar", "quero demonstracao", "quero fechar", "como comecar agora", "tenho interesse", "quero assinar", "quero comprar", "agendar demonstracao", "quero uma demonstracao", "quero comecar", "quero fechar agora", "quero ver agora"];
const WARM_SIGNALS = ["quanto custa", "como funciona", "me explique", "quero saber mais", "pode me contar", "quero conhecer", "como e o sistema", "mensalidade", "qual o valor", "o que faz", "me interessa"];
const COLD_SIGNALS = ["so olhando", "depois vejo", "pesquisando", "so curiosidade", "nao preciso agora", "depois eu vejo", "mais para frente", "sem interesse"];

function calcularScore(mensagem: string): number {
  const n = normalizar(mensagem);
  if (HOT_SIGNALS.some(s  => n.includes(normalizar(s)))) return 100;
  if (WARM_SIGNALS.some(s => n.includes(normalizar(s)))) return  50;
  if (COLD_SIGNALS.some(s => n.includes(normalizar(s)))) return  10;
  return 50;
}

function upgradeScore(atual: number, novo: number): number {
  return Math.max(atual, novo);
}

// ─── High intent ──────────────────────────────────────────────────────────────

const HIGH_INTENT_KWS = [
  "quero contratar", "quero assinar", "quero comecar", "quero fechar",
  "quero comprar", "demonstracao", "agendar demonstracao", "quero ver funcionando",
  "como contrato", "como assino", "me interessa", "tenho interesse",
  "quero saber mais", "quanto custa", "qual o valor", "mensalidade",
  "como funciona", "quero conhecer", "quero uma demonstracao",
];

function isHighIntent(palavrasChave: string, mensagem: string): boolean {
  const n = normalizar(palavrasChave + " " + mensagem);
  return HIGH_INTENT_KWS.some(s => n.includes(normalizar(s)));
}

// ─── SDR: pergunta de qualificação ───────────────────────────────────────────

function perguntaSDR(lead: Lead): string | null {
  if (!lead.nome)
    return "\n\nPara personalizar melhor o atendimento: qual é o seu nome?";
  if (!lead.cidade)
    return `\n\n${lead.nome}, em qual cidade seu negócio está?`;
  if (!lead.especialidade)
    return `\n\nE qual é o segmento do seu negócio, ${lead.nome}?`;
  if (!lead.pacientes_mes)
    return `\n\nQuantos clientes seu negócio atende por mês, ${lead.nome}?`;
  if (!lead.sistema_atual)
    return (
      `\n\n${lead.nome}, você já utiliza algum sistema atualmente?\n\n` +
      `• Planilha\n• Agenda de papel\n• Outro sistema\n• Nenhum`
    );
  if (!lead.dor)
    return (
      `\n\nÚltima pergunta, ${lead.nome}: o que você gostaria de melhorar hoje?\n\n` +
      `• Reduzir faltas\n• Organizar WhatsApp\n• Mais avaliações Google\n` +
      `• Site profissional\n• Atrair mais clientes\n• Melhorar Instagram`
    );
  return null;
}

// ─── SDR: classificações auxiliares ──────────────────────────────────────────

function classificarPorte(pacientesMes: string): string {
  const match = pacientesMes.match(/\d+/);
  if (!match) return "pequena";
  const n = parseInt(match[0], 10);
  if (n <= 100) return "pequena";
  if (n <= 300) return "media";
  return "grande";
}

function normalizarDorPrincipal(dor: string): string {
  const d = normalizar(dor);
  if (/falta|confirma|lembrete|ocupa|agenda/.test(d))                          return "faltas";
  if (/whatsapp|automatiz|mensagem auto/.test(d))                              return "whatsapp";
  if (/avalia|google|estrela|reputac|nota|maps/.test(d))                       return "google";
  if (/site|land|pagina|web/.test(d))                                          return "site";
  if (/instagram|post|social|conteudo|marketing|atrair|novo cliente|novo paciente/.test(d)) return "marketing";
  if (/organiz|gestao|controle|sistema|caos/.test(d))                          return "organizacao";
  return "outro";
}

// ─── SDR: resposta consultiva + resumo do lead ────────────────────────────────

function respostaPorDor(dor: string, lead: Lead): string {
  const d = normalizar(dor);

  let solucao = "";
  if (/falta|confirma|lembrete|ocupa|agenda/.test(d)) {
    solucao = "O OrganizaPro envia confirmações e lembretes automáticos pelo WhatsApp — reduzindo faltas e mantendo a agenda ocupada sem esforço da equipe.";
  } else if (/whatsapp|automatiz|mensagem/.test(d)) {
    solucao = "O WhatsApp automático do OrganizaPro organiza confirmações, lembretes e conta com chatbot IA que responde clientes 24h.";
  } else if (/avalia|google|estrela|reputac|nota|maps/.test(d)) {
    solucao = "O OrganizaPro solicita avaliações Google automaticamente após cada atendimento — via WhatsApp, com 1 clique para o cliente.";
  } else if (/site|land|pagina|web/.test(d)) {
    solucao = "Temos Site Premium (R$ 999) e Landing Page Express (R$ 497) criados para qualquer negócio — com WhatsApp integrado e SEO local.";
  } else if (/cliente|paciente|atrair|marketing|novo|crescer/.test(d)) {
    solucao = "A Presença Digital Premium (a partir de R$ 697/mês) combina Google, Instagram e site para atrair novos clientes continuamente.";
  } else if (/instagram|post|social|conteudo/.test(d)) {
    solucao = "O Instagram IA (R$ 197 a R$ 397/mês) cria 12 posts mensais profissionais para o seu negócio — sem você precisar criar nada.";
  } else {
    solucao = "O OrganizaPro tem a solução certa para a sua necessidade!";
  }

  // Resumo do lead qualificado
  const dorLabel   = normalizarDorPrincipal(dor);
  const linhas: string[] = [];
  if (lead.nome)          linhas.push(`👤 Nome: ${lead.nome}`);
  if (lead.cidade)        linhas.push(`📍 Cidade: ${lead.cidade}`);
  if (lead.especialidade) linhas.push(`🏢 Segmento: ${lead.especialidade}`);
  if (lead.pacientes_mes) linhas.push(`👥 Clientes/mês: ${lead.pacientes_mes}`);
  if (lead.sistema_atual) linhas.push(`💻 Sistema atual: ${lead.sistema_atual}`);
  linhas.push(`🎯 Necessidade: ${dorLabel}`);

  const resumo = linhas.join("\n");
  const nome   = lead.nome ?? "";

  return (
    `Perfeito${nome ? `, ${nome}` : ""}! Com base no que você me contou:\n\n` +
    `${resumo}\n\n` +
    `${solucao}\n\n` +
    `Acredito que o OrganizaPro pode ajudar bastante o seu negócio.\n\n` +
    `Deseja agendar uma demonstração gratuita com nosso time?\n\n` +
    `📱 WhatsApp: 41 98837-9119\n\n` +
    `Em 30 minutos você vê tudo funcionando na prática — sem compromisso!`
  );
}

// ─── SDR: resposta GOLDEN RULE (lead quente) ─────────────────────────────────

function respostaLeadQuente(lead: Lead | null): string {
  const nome = lead?.nome ? `, ${lead.nome}` : "";
  return (
    `Que ótimo${nome}! 🚀\n\n` +
    `Parece que você está pronto para dar o próximo passo!\n\n` +
    `Vamos agendar sua demonstração gratuita agora?\n\n` +
    `📱 WhatsApp: 41 98837-9119\n\n` +
    `Em 30 minutos você vê tudo funcionando na prática — sem compromisso!`
  );
}

// ─── SDR: processar etapa de coleta ──────────────────────────────────────────

type ColetaResult = {
  updates:      Partial<Lead>;
  resposta:     string;
  proximaEtapa: Etapa;
};

function processarColetaSDR(etapa: Etapa, mensagem: string, lead: Lead): ColetaResult {
  const valor = mensagem.trim().slice(0, 200);

  switch (etapa) {
    case "qualificacao_nome": {
      const nome = valor.split(/\s+/).slice(0, 4).join(" ");
      const proximaEtapa = "qualificacao_cidade" as const;
      console.log("[CHATBOT] próxima etapa", proximaEtapa);
      return {
        updates:      { nome },
        resposta:     `Prazer, ${nome}! 😊\n\nEm qual cidade seu negócio está?`,
        proximaEtapa,
      };
    }
    case "qualificacao_cidade":
      return {
        updates:      { cidade: valor },
        resposta:     `Ótimo! E qual é o segmento do seu negócio?\n\n(advogado, barbearia, psicólogo, fisioterapeuta, contador, estética, consultoria...)`,
        proximaEtapa: "qualificacao_especialidade",
      };
    case "qualificacao_especialidade": {
      const nome = lead.nome ? `, ${lead.nome}` : "";
      return {
        updates:      { especialidade: valor },
        resposta:     `Perfeito${nome}! Atendemos muitos negócios de ${valor}. 🏢\n\nQuantos clientes seu negócio atende por mês, aproximadamente?`,
        proximaEtapa: "qualificacao_pacientes",
      };
    }
    case "qualificacao_pacientes": {
      const nome  = lead.nome ? `, ${lead.nome}` : "";
      const porte = classificarPorte(valor);
      return {
        updates: { pacientes_mes: valor, porte_clinica: porte },
        resposta: (
          `Com esse volume de clientes${nome}, o OrganizaPro pode gerar impacto real. 📈\n\n` +
          `Você já utiliza algum sistema atualmente?\n\n` +
          `• Planilha\n• Agenda de papel\n• Outro sistema\n• Nenhum`
        ),
        proximaEtapa: "qualificacao_sistema",
      };
    }
    case "qualificacao_sistema": {
      const nome = lead.nome ? `, ${lead.nome}` : "";
      const s    = normalizar(valor);
      let contexto = "";
      if (/planilha|excel|sheets/.test(s))     contexto = "Com planilhas, a confirmação de atendimentos precisa ser feita manualmente. O OrganizaPro automatiza exatamente isso.";
      else if (/papel|caderno|anotac/.test(s)) contexto = "Migrar de papel para digital com o OrganizaPro é simples — nossa equipe cuida de tudo na implantação.";
      else if (/outro|sistema|software/.test(s)) contexto = "O OrganizaPro pode complementar o que você já usa, adicionando WhatsApp automático e avaliações Google.";
      else                                      contexto = "Perfeito! Começar do zero com o OrganizaPro é ainda mais simples — sem migração de dados necessária.";
      return {
        updates:  { sistema_atual: valor },
        resposta: (
          `Entendi${nome}! ${contexto}\n\n` +
          `O que você gostaria de melhorar hoje?\n\n` +
          `• Reduzir faltas\n• Organizar WhatsApp\n• Mais avaliações Google\n` +
          `• Ter um site profissional\n• Atrair mais clientes\n• Melhorar Instagram`
        ),
        proximaEtapa: "descoberta_dor",
      };
    }
    case "descoberta_dor": {
      const dorPrincipal = normalizarDorPrincipal(valor);
      return {
        updates:      { dor_principal: dorPrincipal },
        resposta:     respostaPorDor(valor, lead),
        proximaEtapa: "concluido",
      };
    }
    default:
      return {
        updates:      {},
        resposta:     `Para continuar, fale com nosso time:\n\n📱 WhatsApp: 41 98837-9119`,
        proximaEtapa: "concluido",
      };
  }
}

// ─── DB: lead state (resiliente — funciona mesmo sem migration 000003) ────────

function normalizarLeadScore(raw: unknown): number {
  // Suporta score como integer (000003) ou text (000001) ou undefined
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return parseInt(raw, 10) || 10;
  return 10;
}

// Últimos N dígitos de um telefone (para busca por sufixo — Z-API varia o formato)
function sufixoTelefone(tel: string, n = 10): string {
  return tel.replace(/\D/g, "").slice(-n);
}

async function fetchLead(clinica_id: string, telefone: string): Promise<Lead | null> {
  const COLS = "etapa, score, nome, cidade, especialidade, pacientes_mes, porte_clinica, sistema_atual, dor_principal";
  const COLS_MIN = "etapa, score, nome, cidade, especialidade, pacientes_mes";

  async function query(cols: string, filtro: { tipo: "eq" | "ilike"; valor: string }) {
    let q = supabase.from("chatbot_leads").select(cols).eq("clinica_id", clinica_id);
    q = filtro.tipo === "eq" ? q.eq("telefone", filtro.valor) : q.ilike("telefone", `%${filtro.valor}`);
    return q.maybeSingle();
  }

  try {
    // 1. Exact match, todas as colunas
    const { data, error } = await query(COLS, { tipo: "eq", valor: telefone });
    if (!error && data) {
      const row = data as unknown as Record<string, unknown>;
      console.log("[CHATBOT] fetchLead: encontrado (exato)", { etapa: row.etapa });
      return { ...row, score: normalizarLeadScore(row.score) } as Lead;
    }

    // 2. Sufixo de 8 dígitos — cobre variação 8→9 dígito do Z-API
    //    553899412822  (sem 9) → últimos 8 = 99412822
    //    5538999412822 (com 9) → últimos 8 = 99412822  ← mesmo sufixo!
    if (!error) {
      const sufixo = sufixoTelefone(telefone, 8);
      console.log("[CHATBOT] fetchLead: exact sem resultado — tentando sufixo8:", sufixo);
      const { data: ds, error: es } = await query(COLS, { tipo: "ilike", valor: sufixo });
      if (!es && ds) {
        const row = ds as unknown as Record<string, unknown>;
        console.log("[CHATBOT] fetchLead: encontrado (sufixo8)", { etapa: row.etapa });
        return { ...row, score: normalizarLeadScore(row.score) } as Lead;
      }
    }

    // 3. Fallback: colunas mínimas (migration 000001 apenas — sem porte_clinica, sistema_atual, dor_principal)
    if (error) {
      console.warn("[CHATBOT] fetchLead — colunas avançadas ausentes (migration 000003 pendente):", error.message);
      const { data: d2, error: e2 } = await query(COLS_MIN, { tipo: "eq", valor: telefone });
      if (!e2 && d2) {
        const row = d2 as unknown as Record<string, unknown>;
        return { ...row, score: normalizarLeadScore(row.score) } as Lead;
      }
      const sufixo = sufixoTelefone(telefone, 8);
      const { data: d3, error: e3 } = await query(COLS_MIN, { tipo: "ilike", valor: sufixo });
      if (!e3 && d3) {
        const row = d3 as unknown as Record<string, unknown>;
        return { ...row, score: normalizarLeadScore(row.score) } as Lead;
      }
      if (e3) console.error("[CHATBOT] fetchLead FALHOU — execute migration 20260624000003:", e3.message);
    }

    console.log("[CHATBOT] fetchLead: sem registro para este lead");
    return null;
  } catch (e) {
    console.error("[CHATBOT] fetchLead exception:", e instanceof Error ? e.message : e);
    return null;
  }
}

type LeadUpdates = Partial<Lead> & { interesse?: string; mensagem_original?: string };

// Colunas adicionadas apenas na migration 000003 (falham em schemas mais antigos)
const COLUNAS_V3 = ["porte_clinica", "sistema_atual", "dor_principal", "ultima_interacao", "origem"] as const;

async function salvarLead(clinica_id: string, telefone: string, updates: LeadUpdates): Promise<void> {
  try {
    // Se já existe um registro com o mesmo sufixo (Z-API varia formato), usa o telefone armazenado
    // como chave do upsert — evita criar registro duplicado com número diferente.
    const sufixo = telefone.replace(/\D/g, "").slice(-8);
    const { data: existente } = await supabase
      .from("chatbot_leads")
      .select("telefone")
      .eq("clinica_id", clinica_id)
      .ilike("telefone", `%${sufixo}`)
      .maybeSingle();
    const telefoneKey = (existente as Record<string, string> | null)?.telefone ?? telefone;

    const payload = {
      clinica_id, telefone: telefoneKey, ...updates,
      ultima_interacao: new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    };

    const { error } = await supabase.from("chatbot_leads").upsert(
      payload, { onConflict: "clinica_id,telefone" }
    );

    if (!error) {
      console.log("[CHATBOT] lead salvo:", { etapa: updates.etapa, score: updates.score });
      return;
    }

    // Fallback: remove colunas exclusivas da migration 000003
    console.warn("[CHATBOT] salvarLead — usando fallback sem colunas v3. Execute migration 20260624000003:", error.message);
    const fallback = Object.fromEntries(
      Object.entries(payload).filter(([k]) => !(COLUNAS_V3 as readonly string[]).includes(k))
    );
    const { error: e2 } = await supabase.from("chatbot_leads").upsert(
      fallback, { onConflict: "clinica_id,telefone" }
    );
    if (e2) console.error("[CHATBOT] salvarLead FALHOU — execute migration 20260624000003:", e2.message);
  } catch (e) {
    console.error("[CHATBOT] salvarLead exception:", e instanceof Error ? e.message : e);
  }
}

// ─── POST /api/chatbot/message ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── PASSO 1: log imediato ─────────────────────────────────────────────────
  console.log("[CHATBOT] ===== NOVA REQUISIÇÃO =====");

  try {
    const body = await req.json();
    const { clinica_id, telefone, mensagem, nome_paciente } = body as {
      clinica_id?: string;
      telefone?: string;
      mensagem?: string;
      nome_paciente?: string;
    };

    console.log("[CHATBOT] requisição recebida:", { clinica_id, telefone, mensagem });

    if (!clinica_id || !telefone || !mensagem) {
      console.warn("[CHATBOT] retorno antecipado: campos obrigatórios ausentes", {
        tem_clinica_id: !!clinica_id,
        tem_telefone:   !!telefone,
        tem_mensagem:   !!mensagem,
      });
      return NextResponse.json(
        { sucesso: false, error: "clinica_id, telefone e mensagem são obrigatórios" },
        { status: 400 }
      );
    }

    if (ehConfirmacaoDeConsulta(mensagem)) {
      console.log("[CHATBOT] retorno antecipado: confirmação de consulta detectada — ignorada pelo chatbot");
      return NextResponse.json({ sucesso: true, ignorado: "confirmacao_de_consulta" });
    }

    console.log("[CHATBOT] iniciando processamento");

    const { data: config, error: configErr } = await supabase
      .from("chatbot_config")
      .select("*")
      .eq("clinica_id", clinica_id)
      .maybeSingle();

    if (configErr) {
      console.error("[CHATBOT] retorno antecipado: erro ao buscar chatbot_config:", configErr.message);
      return NextResponse.json({ sucesso: false, error: configErr.message }, { status: 500 });
    }

    if (!config) {
      console.warn("[CHATBOT] retorno antecipado: chatbot_config NÃO encontrado para clinica_id:", clinica_id);
      return NextResponse.json({ sucesso: true, ignorado: "chatbot_sem_config" });
    }

    if (!config.ativo) {
      console.warn("[CHATBOT] retorno antecipado: chatbot INATIVO (config.ativo = false) para clinica_id:", clinica_id);
      return NextResponse.json({ sucesso: true, ignorado: "chatbot_inativo" });
    }

    console.log("[CHATBOT] config encontrada e ativa — prosseguindo");

    // Busca treinamentos + estado do lead em paralelo
    const [treinaResult, leadAtual] = await Promise.all([
      supabase
        .from("chatbot_treinamento")
        .select("id, palavras_chave, resposta")
        .eq("clinica_id", clinica_id)
        .eq("ativo", true),
      fetchLead(clinica_id, telefone),
    ]);

    // ── LOG 2: estado do lead lido do banco ──────────────────────────────────
    console.log("[CHATBOT] lead", leadAtual);

    const treinamentos = (treinaResult.data ?? []) as Treinamento[];
    const msgNorm      = normalizar(mensagem);
    const match        = matchTreinamento(msgNorm, treinamentos);
    const novoScore    = calcularScore(mensagem);
    const scoreAtual   = leadAtual?.score ?? 10;
    const score        = upgradeScore(scoreAtual, novoScore);
    const etapaAtual   = (leadAtual?.etapa ?? "inicial") as Etapa;
    const emColeta     = etapaAtual !== "inicial" && etapaAtual !== "concluido";

    // ── LOG 3: decisão da máquina de estados ─────────────────────────────────
    console.log("[CHATBOT] emColeta", { emColeta, etapa: leadAtual?.etapa });

    let resposta:      string;
    let processadoPor: string;
    let topico:        string;
    let leadUpdates:   LeadUpdates = { score };

    // ── GOLDEN RULE: mensagem QUENTE sem coleta ativa → CTA direto ───────────
    if (novoScore >= 100 && !emColeta && !match) {
      resposta      = respostaLeadQuente(leadAtual);
      processadoPor = "sdr_quente";
      topico        = "cta_quente";
      leadUpdates   = { score, etapa: "concluido" };
      console.log("[CHATBOT] GOLDEN RULE: lead quente → CTA direto");

    // ── Coleta SDR ativa → PRIORIDADE ABSOLUTA sobre treinamentos ────────────
    } else if (emColeta) {
      if (match) {
        // Usuário perguntou algo durante qualificação: responde e repete a pergunta atual
        const perguntaAtual = perguntaSDR(leadAtual ?? ({} as Lead));
        resposta      = match.resposta + (perguntaAtual ?? "");
        processadoPor = "sdr_com_treinamento";
        topico        = `sdr_${etapaAtual}`;
        // Não avança etapa — mantém a mesma pergunta pendente
        console.log("[CHATBOT] sdr: questão durante coleta, repetindo etapa:", etapaAtual);
      } else {
        // Resposta direta à pergunta de qualificação → avança etapa
        const coleta  = processarColetaSDR(etapaAtual, mensagem, leadAtual ?? ({} as Lead));
        resposta      = coleta.resposta;
        processadoPor = "sdr";
        topico        = `sdr_${etapaAtual}`;
        leadUpdates   = { ...leadUpdates, etapa: coleta.proximaEtapa, ...coleta.updates };
        console.log("[CHATBOT] sdr coleta:", { etapa: etapaAtual, prox: coleta.proximaEtapa });
      }

    } else {
      // ── Resposta normal (treinamento ou regras fixas) ─────────────────────
      if (match) {
        resposta      = match.resposta;
        processadoPor = "treinamento";
        topico        = "treinamento";
        console.log("[CHATBOT] treinamento:", match.id.slice(0, 8));
      } else {
        topico        = classificarTopico(mensagem);
        resposta      = montarResposta(topico as Topico, config as Config);
        processadoPor = "regras";
        console.log("[CHATBOT] regras:", topico);
      }

      // ── SDR: iniciar qualificação em mensagens de interesse ───────────────
      const highIntent     = isHighIntent(match?.palavras_chave ?? "", mensagem);
      const deveQualificar = highIntent;

      if (deveQualificar) {
        leadUpdates.etapa             = "qualificacao_nome";
        leadUpdates.interesse         = (match?.palavras_chave.split(",")[0] ?? topico).slice(0, 120);
        leadUpdates.mensagem_original = mensagem.slice(0, 400);
        const q = perguntaSDR(leadAtual ?? ({} as Lead));
        if (q) resposta = resposta + q;
      }
    }

    console.log("[CHATBOT] resposta gerada:", {
      processadoPor,
      topico,
      resposta: resposta.slice(0, 120),
    });

    await salvarLead(clinica_id, telefone, leadUpdates);

    // ── Envio via Z-API ───────────────────────────────────────────────────────
    console.log("[CHATBOT] enviando resposta via /api/whatsapp");
    try {
      const baseUrl = new URL(req.url).origin;
      const r       = await fetch(`${baseUrl}/api/whatsapp`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ clinica_id, telefone, mensagem: resposta }),
      });
      let rBody: unknown = null;
      try { rBody = await r.json(); } catch { rBody = null; }
      if (r.ok) {
        console.log("[CHATBOT] resposta enviada com sucesso:", {
          status:  r.status,
          sucesso: (rBody as Record<string, unknown>)?.sucesso ?? null,
        });
      } else {
        console.error("[CHATBOT] /api/whatsapp retornou erro:", {
          status:  r.status,
          error:   (rBody as Record<string, unknown>)?.error,
          detalhe: (rBody as Record<string, unknown>)?.detalhe ?? null,
        });
      }
    } catch (waErr) {
      console.error("[CHATBOT] /api/whatsapp exception:", waErr instanceof Error ? waErr.message : waErr);
    }

    // ── Log ───────────────────────────────────────────────────────────────────
    const { error: logErr } = await supabase.from("chatbot_logs").insert({
      clinica_id,
      telefone,
      nome_paciente:     nome_paciente || null,
      mensagem_paciente: mensagem,
      resposta_bot:      resposta,
      processado_por:    processadoPor,
    });
    if (logErr) console.error("[CHATBOT] log:", logErr.message);

    return NextResponse.json({ sucesso: true, topico, processado_por: processadoPor, resposta });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[CHATBOT] erro inesperado:", message);
    return NextResponse.json({ sucesso: false, error: message }, { status: 500 });
  }
}

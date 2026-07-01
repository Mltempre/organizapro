import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizar(t: string) {
  return t.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function classificarTopico(msg: string): string {
  const t = normalizar(msg);
  if (/hor[aá]rio|funciona|abre|fecha|atende quando|que horas/.test(t)) return "horario";
  if (/endere[cç]o|localiz|onde fica|como cheg|rua |av\.|avenida|bairro|cep/.test(t)) return "endereco";
  if (/conv[eê]nio|plano|unimed|sul.?am[eé]rica|amil|bradesco|hapvida|aceita/.test(t)) return "convenios";
  if (/procedimento|tratamento|especialidade|exame|cirurgia|realiz/.test(t)) return "procedimentos";
  if (/valor|pre[cç]o|quanto custa|custo|tabela|particular|cobr/.test(t)) return "faq";
  if (/agendar|marcar|consulta|reservar|encaixar|quero uma|quero marcar/.test(t)) return "agendar";
  if (/^(oi|ol[aá]|bom dia|boa tarde|boa noite|ola|hey|e a[ií])/.test(t)) return "saudacao";
  if (/humano|atendente|pessoa|recepci|falar com|fale com/.test(t)) return "humano";
  return "default";
}

function montarResposta(topico: string, config: Record<string, string | boolean | null>): string {
  const nome = config.nome_clinica ? `da ${config.nome_clinica}` : "da clínica";
  const link = config.link_humano ? `\n\nFale diretamente com nossa equipe: ${config.link_humano}` : "";

  switch (topico) {
    case "saudacao":
      return `Olá! Sou o assistente virtual ${nome}. Posso te ajudar com:\n\n• Horários de atendimento\n• Endereço\n• Convênios aceitos\n• Procedimentos realizados\n• Agendamentos\n\nCom o que posso te ajudar?`;

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

    case "faq":
      return config.faq
        ? `${config.faq}`
        : `Para informações sobre valores, entre em contato:${link}`;

    case "agendar":
      return config.link_humano
        ? `Para agendar sua consulta, clique no link abaixo e fale com nossa equipe:\n\n${config.link_humano}`
        : `Para agendar, entre em contato conosco.${link}`;

    case "humano":
      return config.link_humano
        ? `Claro! Para falar com um de nossos atendentes:\n\n${config.link_humano}`
        : `Vou te conectar com nossa equipe em breve.`;

    default:
      return `Não entendi sua mensagem. Posso te ajudar com horários, endereço, convênios, procedimentos ou agendamentos.${link}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { clinica_id, telefone, mensagem, nome_paciente } = await req.json();

    if (!clinica_id || !telefone || !mensagem) {
      return NextResponse.json({ sucesso: false, error: "clinica_id, telefone e mensagem obrigatórios" }, { status: 400 });
    }

    const { data: config } = await supabase
      .from("chatbot_config")
      .select("*")
      .eq("clinica_id", clinica_id)
      .maybeSingle();

    if (!config?.ativo) {
      return NextResponse.json({ sucesso: true, ignorado: "chatbot_inativo" });
    }

    const topico = classificarTopico(mensagem);
    const resposta = montarResposta(topico, config);

    console.log("[chatbot] processando:", { telefone, topico, processado_por: "regras" });

    const baseUrl = new URL(req.url).origin;
    try {
      await fetch(`${baseUrl}/api/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinica_id, telefone, mensagem: resposta }),
      });
    } catch (e) {
      console.error("[chatbot] erro ao enviar resposta WA:", e);
    }

    await supabase.from("chatbot_logs").insert({
      clinica_id,
      telefone,
      nome_paciente: nome_paciente || null,
      mensagem_paciente: mensagem,
      resposta_bot: resposta,
      processado_por: "regras",
    });

    return NextResponse.json({ sucesso: true, topico, resposta });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[chatbot] erro inesperado:", message);
    return NextResponse.json({ sucesso: false, error: message }, { status: 500 });
  }
}

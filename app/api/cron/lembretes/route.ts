import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEMPLATE_PADRAO =
  "Olá, {nome}! 👋\n\nPassamos para lembrar do seu compromisso agendado para *amanhã, {data}* às *{horario}* na {clinica_nome}.\n\nPara confirmar sua presença, responda *SIM*.\nPara remarcar, é só nos avisar com antecedência. 📅\n\nContamos com você. Até amanhã! 😊";

// Suporta tanto {nome}/{data}/{horario}/{clinica_nome} quanto {{paciente_nome}}/{{hora}}/{{clinica_nome}}
function interpolar(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{nome\}|\{\{paciente_nome\}\}/g, vars.nome)
    .replace(/\{data\}|\{\{data\}\}/g, vars.data)
    .replace(/\{horario\}|\{\{hora\}\}/g, vars.horario)
    .replace(/\{clinica_nome\}|\{\{clinica_nome\}\}/g, vars.clinica_nome);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const baseUrl = new URL(request.url).origin;

  // "Amanhã" calculado no fuso de Brasília (UTC-3) para evitar divergência de data noturna
  const hojeStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [ano, mes, dia] = hojeStr.split("-").map(Number);
  const dataAmanha = new Date(Date.UTC(ano, mes - 1, dia + 1)).toISOString().split("T")[0];
  const [aY, aM, aD] = dataAmanha.split("-");
  const dataFormatada = `${aD}/${aM}/${aY}`; // DD/MM/YYYY para exibir na mensagem

  // msg_lembrete / msg_confirmacao — nomes corretos conforme configuracoes/page.tsx
  const { data: clinicas } = await supabase
    .from("clinica_config")
    .select(
      "clinica_id, zapi_instance, zapi_token, zapi_client_token, msg_lembrete, msg_confirmacao, nome_clinica"
    )
    .not("zapi_instance", "is", null)
    .not("zapi_token", "is", null);

  if (!clinicas || clinicas.length === 0) {
    return NextResponse.json({
      sucesso: true,
      enviados: 0,
      erros: 0,
      detalhes: [],
    });
  }

  let enviados = 0;
  let erros = 0;
  const detalhes: string[] = [];

  for (const clinica of clinicas) {
    const { data: agendamentos } = await supabase
      .from("agendamentos")
      .select("id, paciente_nome, telefone, data, hora")
      .eq("clinica_id", clinica.clinica_id)
      .or("lembrete_enviado.eq.false,lembrete_enviado.is.null")
      .eq("data", dataAmanha)
      .not("status", "in", '("cancelado","concluido","faltou")')
      .not("telefone", "is", null);

    if (!agendamentos || agendamentos.length === 0) continue;

    // Usa nome_clinica configurado pelo admin; fallback na tabela clinicas
    let nomeClinica = clinica.nome_clinica || "";
    if (!nomeClinica) {
      const { data: clinicaInfo } = await supabase
        .from("clinicas")
        .select("nome")
        .eq("id", clinica.clinica_id)
        .maybeSingle();
      nomeClinica = clinicaInfo?.nome || "sua clínica";
    }

    for (const ag of agendamentos) {
      try {
        const hora = ag.hora ?? "horário a confirmar";
        const template = clinica.msg_lembrete || clinica.msg_confirmacao || TEMPLATE_PADRAO;

        const mensagem = interpolar(template, {
          nome: ag.paciente_nome,
          data: dataFormatada,
          horario: hora,
          clinica_nome: nomeClinica,
        });

        const res = await fetch(`${baseUrl}/api/whatsapp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${cronSecret}`,
          },
          body: JSON.stringify({
            telefone: ag.telefone,
            mensagem,
            clinica_id: clinica.clinica_id,
          }),
        });

        if (res.ok) {
          await supabase
            .from("agendamentos")
            .update({ lembrete_enviado: true, confirmacao_enviada: true })
            .eq("id", ag.id);

          enviados++;
          detalhes.push(`✅ ${ag.paciente_nome} — lembrete enviado para ${dataFormatada} às ${hora}`);
        } else {
          erros++;
          detalhes.push(`❌ ${ag.paciente_nome} — erro no envio`);
        }
      } catch (err: unknown) {
        erros++;
        const msg = err instanceof Error ? err.message : String(err);
        detalhes.push(`❌ ${ag.paciente_nome} — excecao: ${msg}`);
      }
    }
  }

  return NextResponse.json({
    sucesso: true,
    data_alvo: dataAmanha,
    data_formatada: dataFormatada,
    enviados,
    erros,
    detalhes,
  });
}

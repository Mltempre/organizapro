import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function montarMensagem(template: string, nome: string, link: string): string {
  return template
    .replace(/\{nome\}/g, nome)
    .replace(/\{link\}/g, link);
}

export async function GET(req: NextRequest) {
  // Aceita Authorization: Bearer ou x-cron-secret (legado)
  const cronSecret = process.env.CRON_SECRET;
  const secret     = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization");
  const bearer     = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!cronSecret || (secret !== cronSecret && bearer !== cronSecret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Janela de 7 dias: só processa consultas concluídas recentemente
  const hojeStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [y, m, d] = hojeStr.split("-").map(Number);
  const seteDiasAtras = new Date(Date.UTC(y, m - 1, d - 7)).toISOString().split("T")[0];

  let enviados = 0;
  let erros    = 0;
  let silenciados = 0;
  const detalhes: string[] = [];

  try {
    const { data: configs, error: configError } = await supabase
      .from("clinica_config")
      .select("clinica_id, zapi_instance, zapi_token, zapi_client_token, msg_avaliacao, link_google")
      .not("zapi_instance",     "is", null)
      .not("zapi_token",        "is", null)
      .not("zapi_client_token", "is", null)
      .not("link_google",       "is", null);

    if (configError) {
      return NextResponse.json({ error: "Erro ao buscar configs: " + configError.message }, { status: 500 });
    }

    if (!configs || configs.length === 0) {
      return NextResponse.json({ mensagem: "Nenhuma clinica com Z-API e link Google configurados.", enviados: 0 });
    }

    for (const config of configs) {
      if (!config.link_google) continue;

      // ── Proteção contra disparo em massa na primeira ativação ──────────────
      // Se esta clínica nunca teve nenhum registro processado (avaliacao_solicitada = true),
      // é a primeira vez que o cron roda para ela. Silenciamos TODOS os registros
      // antigos (fora da janela de 7 dias) sem enviar mensagens.
      const { count: jaProcessados } = await supabase
        .from("agendamentos")
        .select("*", { count: "exact", head: true })
        .eq("clinica_id", config.clinica_id)
        .eq("avaliacao_solicitada", true);

      if ((jaProcessados ?? 0) === 0) {
        const { error: silencioErr } = await supabase
          .from("agendamentos")
          .update({ avaliacao_solicitada: true })
          .eq("clinica_id",          config.clinica_id)
          .eq("status",              "concluido")
          .lt("data",                seteDiasAtras);

        if (!silencioErr) {
          detalhes.push(
            `🛡️ Clinica ${config.clinica_id}: primeira ativação — registros anteriores a ${seteDiasAtras} silenciados sem envio`
          );
          silenciados++;
        }
      }
      // ──────────────────────────────────────────────────────────────────────

      // Busca apenas consultas concluídas nos últimos 7 dias sem avaliação enviada
      const { data: agendamentos, error: agError } = await supabase
        .from("agendamentos")
        .select("id, paciente_nome, telefone")
        .eq("clinica_id",           config.clinica_id)
        .eq("status",               "concluido")
        .eq("avaliacao_solicitada", false)
        .gte("data",                seteDiasAtras)
        .not("telefone",            "is", null)
        .limit(50);

      if (agError) {
        detalhes.push(`Clinica ${config.clinica_id}: erro ao buscar agendamentos — ${agError.message}`);
        erros++;
        continue;
      }

      if (!agendamentos || agendamentos.length === 0) continue;

      for (const ag of agendamentos) {
        try {
          const template = config.msg_avaliacao ||
            "Olá, {nome}! 😊\n\nEsperamos que seu atendimento tenha sido excelente! Sua opinião é muito importante para nós e ajuda outros clientes a nos encontrar.\n\nPoderia nos avaliar no Google? Leva menos de 1 minuto:\n👉 {link}\n\nMuito obrigado pela confiança! 🙏";

          const mensagem = montarMensagem(
            template,
            ag.paciente_nome || "paciente",
            config.link_google
          );

          const baseUrl = req.nextUrl.origin;
          const res = await fetch(`${baseUrl}/api/whatsapp`, {
            method:  "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${cronSecret}`,
            },
            body: JSON.stringify({
              clinica_id: config.clinica_id,
              telefone:   ag.telefone,
              mensagem,
            }),
          });

          const resultado = await res.json();

          if (resultado.sucesso) {
            await supabase
              .from("agendamentos")
              .update({ avaliacao_solicitada: true })
              .eq("id", ag.id);

            await supabase.from("avaliacoes").insert({
              clinica_id:     config.clinica_id,
              agendamento_id: ag.id,
              paciente_nome:  ag.paciente_nome,
              telefone:       ag.telefone,
              enviado_em:     new Date().toISOString(),
              respondeu:      false,
            });

            enviados++;
            detalhes.push(`✅ ${ag.paciente_nome} (${ag.telefone})`);
          } else {
            erros++;
            detalhes.push(`❌ ${ag.paciente_nome} — ${resultado.error || "erro desconhecido"}`);
          }

        } catch (err: unknown) {
          erros++;
          const msg = err instanceof Error ? err.message : String(err);
          detalhes.push(`❌ ${ag.paciente_nome} — excecao: ${msg}`);
        }
      }
    }

    return NextResponse.json({
      sucesso:         true,
      janela_de_dias:  7,
      clinicas_primeira_ativacao: silenciados,
      enviados,
      erros,
      detalhes,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Erro interno: " + message }, { status: 500 });
  }
}

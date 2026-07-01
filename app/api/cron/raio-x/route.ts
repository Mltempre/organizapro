// Cron: toda segunda-feira às 08h00 (Brasília) = 11h UTC
// Configurar no vercel.json:
// { "crons": [{ "path": "/api/cron/raio-x", "schedule": "0 11 * * 1" }] }

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  calcularIndice,
  taxaConfirmacao,
  nivelAtual,
  missaoFallback,
  type IndiceInput,
} from "../../../../lib/raio-x";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizarTelefone(tel: string): string {
  const n = tel.replace(/\D/g, "");
  return n.startsWith("55") && n.length >= 12 ? n : "55" + n;
}

async function countTable(table: string, clinicaId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("clinica_id", clinicaId);
  return error ? 0 : (count ?? 0);
}

export async function GET(req: NextRequest) {
  const secret  = req.headers.get("x-cron-secret");
  const bearer  = req.headers.get("authorization")?.startsWith("Bearer ")
    ? req.headers.get("authorization")!.slice(7) : null;

  if (process.env.CRON_SECRET) {
    if (secret !== process.env.CRON_SECRET && bearer !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  // Datas
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const inicioSemana = new Date(Date.UTC(ano, mes - 1, dia - 6)).toISOString().split("T")[0];
  const [, aM, aD] = inicioSemana.split("-");
  const [, hM, hD] = hoje.split("-");
  const dataRange   = `${aD}/${aM} a ${hD}/${hM}`;

  const { data: configs, error: cfgErr } = await supabase
    .from("clinica_config")
    .select("clinica_id, zapi_instance, zapi_token, zapi_client_token, nome_clinica, msg_lembrete, logo_url, hero_url")
    .not("zapi_instance", "is", null)
    .not("zapi_token",    "is", null);

  if (cfgErr || !configs?.length) {
    return NextResponse.json({ sucesso: true, enviados: 0, motivo: cfgErr?.message ?? "sem clínicas" });
  }

  let enviados = 0;
  let erros    = 0;
  const detalhes: string[] = [];

  for (const cfg of configs) {
    const cid = cfg.clinica_id;

    const { data: clinica } = await supabase
      .from("clinicas")
      .select("whatsapp, nome, slug, logo_url, nota_google, num_avaliacoes")
      .eq("id", cid)
      .maybeSingle();

    if (!clinica?.whatsapp) { detalhes.push(`${cid}: sem telefone`); continue; }

    const [agsRes, pacRes, nGaleria, nEquipe, nSrv] = await Promise.all([
      supabase.from("agendamentos").select("id,status").eq("clinica_id", cid).gte("data", inicioSemana).lte("data", hoje),
      supabase.from("pacientes").select("*", { count: "exact", head: true }).eq("clinica_id", cid),
      countTable("clinica_galeria",  cid),
      countTable("clinica_equipe",   cid),
      countTable("clinica_servicos", cid),
    ]);

    const ags          = agsRes.data ?? [];
    const totalPacientes = pacRes.count ?? 0;
    const cfgExtra     = cfg as Record<string, unknown>;
    const notaGoogle   = (cfgExtra.nota_google   ?? clinica?.nota_google)   as number | null;
    const numAvaliacoes = (cfgExtra.num_avaliacoes ?? clinica?.num_avaliacoes) as number | null;
    const nomeClinica  = cfg.nome_clinica ?? clinica?.nome ?? "Clínica";
    const taxa         = taxaConfirmacao(ags);
    const faltas       = ags.filter(a => a.status === "faltou").length;

    const inp: IndiceInput = {
      agsSemana:           ags,
      agsHistorico:        0,
      totalPacientes,
      notaGoogle,
      numAvaliacoes,
      hasSlug:        !!(clinica?.slug),
      hasLogo:        !!(cfg.logo_url    || clinica?.logo_url),
      hasHero:        !!(cfg.hero_url),
      hasNome:        !!(cfg.nome_clinica || clinica?.nome),
      hasZapi:        true,
      hasMsgLembrete: !!cfg.msg_lembrete,
      nGaleria, nEquipe, nSrv,
      tendenciaConfirmacao: null,
    };

    const bd     = calcularIndice(inp);
    const nivel  = nivelAtual(bd.total);
    const missao = missaoFallback(bd);

    const linhas = [
      `📊 *RAIO-X DA CLÍNICA*`,
      `Semana ${dataRange}`,
      ``,
      `*Índice ClínicaFlow: ${bd.total}/100*`,
      `${nivel.emoji} ${nivel.label}`,
      ``,
      `📅 Agendamentos: ${ags.length}`,
      `✅ Confirmações: ${taxa !== null ? taxa + "%" : "—"}`,
      faltas > 0 ? `⚠️ Faltas: ${faltas}` : "",
      `👤 Pacientes: ${totalPacientes}`,
      notaGoogle !== null ? `⭐ Google: ${notaGoogle}${numAvaliacoes !== null ? ` (${numAvaliacoes} avaliações)` : ""}` : "",
      ``,
      `🎯 *Missão desta semana:*`,
      missao,
      ``,
      `_Acesse clinicaflow.com.br para ver a análise completa._`,
    ].filter(Boolean).join("\n");

    try {
      const zapiUrl = `https://api.z-api.io/instances/${cfg.zapi_instance}/token/${cfg.zapi_token}/send-text`;
      const zapiRes = await fetch(zapiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cfg.zapi_client_token ? { "Client-Token": cfg.zapi_client_token } : {}),
        },
        body: JSON.stringify({ phone: normalizarTelefone(clinica.whatsapp), message: linhas }),
      });

      if (zapiRes.ok) {
        enviados++;
        detalhes.push(`${nomeClinica}: OK (${nivel.emoji} ${bd.total}/100)`);
      } else {
        erros++;
        const err = await zapiRes.json().catch(() => ({}));
        detalhes.push(`${nomeClinica}: Z-API ${zapiRes.status} — ${JSON.stringify(err)}`);
      }
    } catch (e) {
      erros++;
      detalhes.push(`${nomeClinica}: exceção — ${e instanceof Error ? e.message : String(e)}`);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  return NextResponse.json({ sucesso: true, enviados, erros, data: hoje, detalhes });
}

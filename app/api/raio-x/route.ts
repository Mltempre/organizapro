import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  calcularIndice,
  taxaConfirmacao,
  nivelAtual,
  proximoObjetivo,
  gerarFallbacks,
  type IndiceInput,
  type FallbackContext,
} from "../../../lib/raio-x";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function countTable(table: string, clinicaId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("clinica_id", clinicaId);
  return error ? 0 : (count ?? 0);
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
    if (!token) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: { user } } = await supabaseAnon.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

    const { data: cu } = await supabase
      .from("clinica_usuarios")
      .select("clinica_id")
      .eq("usuario_id", user.id)
      .maybeSingle();

    if (!cu?.clinica_id) return NextResponse.json({ error: "Clínica não encontrada" }, { status: 404 });

    const cid = cu.clinica_id;

    // Date ranges (Brasília)
    const hoje        = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const [ano, mes, dia] = hoje.split("-").map(Number);
    const inicioSemana    = new Date(Date.UTC(ano, mes - 1, dia - 6)).toISOString().split("T")[0];
    const inicioSemanaAnt = new Date(Date.UTC(ano, mes - 1, dia - 13)).toISOString().split("T")[0];
    const fimSemanaAnt    = new Date(Date.UTC(ano, mes - 1, dia - 7)).toISOString().split("T")[0];

    // Parallel queries
    const [
      agsAllRes, agsSemanaRes, agsAntRes,
      pacRes, clinicaRes, configRes,
      nGaleria, nEquipe, nAntes, nDep, nSrv, nEst,
    ] = await Promise.all([
      supabase.from("agendamentos").select("id,status").eq("clinica_id", cid),
      supabase.from("agendamentos").select("id,status").eq("clinica_id", cid).gte("data", inicioSemana).lte("data", hoje),
      supabase.from("agendamentos").select("id,status").eq("clinica_id", cid).gte("data", inicioSemanaAnt).lte("data", fimSemanaAnt),
      supabase.from("pacientes").select("*", { count: "exact", head: true }).eq("clinica_id", cid),
      supabase.from("clinicas").select("*").eq("id", cid).maybeSingle(),
      supabase.from("clinica_config").select("*").eq("clinica_id", cid).maybeSingle(),
      countTable("clinica_galeria",     cid),
      countTable("clinica_equipe",      cid),
      countTable("clinica_antes_depois", cid),
      countTable("clinica_depoimentos", cid),
      countTable("clinica_servicos",    cid),
      countTable("clinica_estrutura",   cid),
    ]);

    const agsAll    = agsAllRes.data    ?? [];
    const agsSemana = agsSemanaRes.data ?? [];
    const agsAnt    = agsAntRes.data    ?? [];
    const totalPacientes = pacRes.count ?? 0;

    const clinica = clinicaRes.data  as Record<string, unknown> | null;
    const config  = configRes.data   as Record<string, unknown> | null;

    const notaGoogle    = (config?.nota_google    ?? clinica?.nota_google)    as number | null;
    const numAvaliacoes = (config?.num_avaliacoes ?? clinica?.num_avaliacoes) as number | null;
    const nomeClinica   = (config?.nome_clinica   ?? clinica?.nome ?? "sua clínica") as string;
    const hasSlug       = !!(clinica?.slug       || config?.slug);
    const hasLogo       = !!(clinica?.logo_url   || config?.logo_url);
    const hasHero       = !!(clinica?.hero_url   || config?.hero_url);
    const hasNome       = !!(clinica?.nome       || config?.nome_clinica);
    const hasZapi       = !!config?.zapi_instance;
    const hasMsgLembrete = !!config?.msg_lembrete;

    // Tendência de confirmação semana atual vs. anterior
    const taxaSemana   = taxaConfirmacao(agsSemana);
    const taxaAnterior = taxaConfirmacao(agsAnt);
    const tendenciaConfirmacao = taxaSemana !== null && taxaAnterior !== null && taxaAnterior > 0
      ? Math.round(((taxaSemana - taxaAnterior) / taxaAnterior) * 100)
      : null;

    const faltasSemana   = agsSemana.filter(a => a.status === "faltou").length;
    const faltasAnterior = agsAnt.filter(a => a.status === "faltou").length;
    const reducaoFaltas  = faltasAnterior > 0
      ? Math.round(((faltasAnterior - faltasSemana) / faltasAnterior) * 100)
      : null;

    // ── Índice ClínicaFlow (fonte única: lib/raio-x.ts) ──────────────────────
    const inp: IndiceInput = {
      agsSemana,
      agsHistorico:        agsAll.length,
      totalPacientes,
      notaGoogle,
      numAvaliacoes,
      hasSlug, hasLogo, hasHero, hasNome,
      hasZapi, hasMsgLembrete,
      nGaleria, nEquipe, nSrv,
      tendenciaConfirmacao,
    };
    const bd     = calcularIndice(inp);
    const indice = bd.total;

    // ── Nível atual e próximo (para contexto do prompt e fallback) ────────────
    const nivel   = nivelAtual(indice);
    const proximo = proximoObjetivo(indice);

    // ── OpenAI — consultoria executiva personalizada ──────────────────────────
    const dadosCtx = `Clínica: "${nomeClinica}"
Agendamentos esta semana: ${agsSemana.length}
Taxa de confirmação: ${taxaSemana !== null ? taxaSemana + "%" : "sem dados ainda"}
Variação vs semana anterior: ${tendenciaConfirmacao !== null ? (tendenciaConfirmacao >= 0 ? "+" : "") + tendenciaConfirmacao + "%" : "sem comparativo"}
Faltas esta semana: ${faltasSemana}
Redução de faltas: ${reducaoFaltas !== null ? reducaoFaltas + "%" : "sem comparativo"}
Total de pacientes: ${totalPacientes}
Nota Google: ${notaGoogle !== null ? notaGoogle : "não informada"}
Avaliações Google: ${numAvaliacoes !== null ? numAvaliacoes : "não informadas"}
Site — galeria: ${nGaleria} foto(s), equipe: ${nEquipe} membro(s), serviços: ${nSrv}
WhatsApp automático: ${hasZapi ? "configurado" : "não configurado"}
Índice ClínicaFlow: ${indice}/100 — Nível: ${nivel.label}
Pontos: Gestão ${bd.gestao}/25 · Site ${bd.site}/25 · Google ${bd.reputacao}/20 · WhatsApp ${bd.automacao}/15 · Atividade ${bd.atividade}/15
Próximo nível: ${proximo ? `${proximo.nivel.label} (faltam ${proximo.pontosRestantes} pontos)` : "nível máximo atingido"}`;

    const nivelTom: Record<string, string> = {
      "Clínica Premium": "Reconheça a excelência alcançada. Celebre os resultados e foque na manutenção do alto padrão.",
      "Excelente":       "Parabenize os resultados expressivos. Aponte oportunidades de refinamento para alcançar o nível máximo.",
      "Em Evolução":     "Transmita confiança e mostre a proximidade do próximo nível. Enfatize o progresso contínuo.",
      "Atenção":         "Foque em ações práticas de maior impacto imediato. Transmita esperança e clareza de caminho.",
      "Crítico":         "Jamais transmita desânimo. Mostre o grande potencial de evolução com ações objetivas e acessíveis.",
    };

    const systemMsg = `Você é um consultor sênior especializado em gestão de clínicas de saúde.
Sua comunicação é profissional, positiva, objetiva e estratégica.
Nunca critique a clínica. Nunca utilize linguagem negativa.
Sempre destaque os pontos fortes antes de qualquer oportunidade de melhoria.
Utilize linguagem semelhante à utilizada por consultorias empresariais premium.
Evite frases genéricas. Escreva como se estivesse entregando um diagnóstico exclusivo para aquela clínica.
Nunca use listas. Escreva em linguagem natural, elegante e profissional.
Palavras proibidas: problema, erro, ruim, péssimo, falha, fraco, insuficiente.
Palavras preferidas: oportunidade, potencial, evolução, crescimento, fortalecimento, otimização, desenvolvimento, melhoria contínua.
Tom específico para o nível atual (${nivel.label}): ${nivelTom[nivel.label] ?? ""}
Nunca mencione o nome da clínica dentro dos textos. Use sempre "sua clínica" para se referir a ela.
Responda sempre em JSON válido.`;

    const itensJaFeitos = [
      hasZapi              && "- WhatsApp automático: JÁ CONFIGURADO — não recomendar configurar",
      nGaleria > 0         && `- Galeria: ${nGaleria} foto(s) JÁ CADASTRADA(S) — não recomendar adicionar galeria`,
      nEquipe  > 0         && `- Equipe: ${nEquipe} membro(s) JÁ CADASTRADO(S) — não recomendar apresentar equipe`,
      notaGoogle !== null  && `- Nota Google ${notaGoogle} JÁ REGISTRADA — não recomendar cadastrar nota Google`,
      numAvaliacoes !== null && numAvaliacoes >= 20 && `- ${numAvaliacoes} avaliações Google — reputação consolidada, não recomendar solicitar mais avaliações`,
    ].filter(Boolean).join("\n");

    const userMsg = `Analise os dados abaixo e retorne um JSON com exatamente 5 campos:

- "diagnostico": visão executiva da situação atual da clínica (2-3 frases, cite números reais, SEMPRE inicie por algo positivo)
- "pontos_fortes": principais acertos e resultados positivos desta semana (1-2 frases)
- "oportunidade": a única ação de maior impacto estratégico ainda não realizada — explique o benefício concreto (2 frases)
- "missao": a ação prática e objetiva para esta semana (1 frase clara e direta)
- "motivacional": encerramento inspirador mencionando o nível atual e o próximo objetivo (1-2 frases)

Regras absolutas: português do Brasil, sem asteriscos ou markdown, sem emojis no texto, sem listas, APENAS JSON válido, máximo 3 frases por campo.

${itensJaFeitos ? `ITENS JÁ REALIZADOS — NÃO recomendar nenhum destes:\n${itensJaFeitos}\n\n` : ""}${dadosCtx}

Exemplo de formato: {"diagnostico":"Sua clínica apresenta...","pontos_fortes":"Os dados mostram...","oportunidade":"A principal oportunidade...","missao":"Solicite avaliações Google...","motivacional":"Sua clínica está em evolução constante..."}`;

    let ai_diagnostico   = "";
    let ai_pontos_fortes = "";
    let ai_oportunidade  = "";
    let ai_missao        = "";
    let ai_motivacional  = "";

    if (process.env.OPENAI_API_KEY) {
      try {
        const controller = new AbortController();
        const tm = setTimeout(() => controller.abort(), 25_000);
        const oRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemMsg },
              { role: "user",   content: userMsg   },
            ],
            max_tokens: 700,
            temperature: 0.72,
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        });
        clearTimeout(tm);
        if (oRes.ok) {
          const oData  = await oRes.json();
          const parsed = JSON.parse(oData.choices?.[0]?.message?.content ?? "{}");
          ai_diagnostico   = parsed.diagnostico    ?? "";
          ai_pontos_fortes = parsed.pontos_fortes  ?? "";
          ai_oportunidade  = parsed.oportunidade   ?? "";
          ai_missao        = parsed.missao         ?? "";
          ai_motivacional  = parsed.motivacional   ?? "";
        }
      } catch (err) {
        console.error("[raio-x] OpenAI error:", err);
      }
    }

    // Fallbacks inteligentes — biblioteca com múltiplos modelos por nível
    if (!ai_diagnostico || !ai_pontos_fortes || !ai_oportunidade || !ai_missao || !ai_motivacional) {
      const fbCtx: FallbackContext = {
        bd, nivel,
        agsSemana:            agsSemana.length,
        taxaSemana,
        totalPacientes,
        notaGoogle,
        numAvaliacoes,
        hasZapi,
        nGaleria, nEquipe, nSrv,
        tendenciaConfirmacao,
      };
      const fb = gerarFallbacks(fbCtx);
      if (!ai_diagnostico)   ai_diagnostico   = fb.diagnostico;
      if (!ai_pontos_fortes) ai_pontos_fortes = fb.pontos_fortes;
      if (!ai_oportunidade)  ai_oportunidade  = fb.oportunidade;
      if (!ai_missao)        ai_missao        = fb.missao;
      if (!ai_motivacional)  ai_motivacional  = fb.motivacional;
    }

    return NextResponse.json({
      metricas: {
        gestao: {
          total_semana:          agsSemana.length,
          confirmados_semana:    agsSemana.filter(a => a.status === "confirmado" || a.status === "concluido").length,
          faltas_semana:         faltasSemana,
          taxa_confirmacao:      taxaSemana,
          tendencia_confirmacao: tendenciaConfirmacao,
          reducao_faltas:        reducaoFaltas,
          total_historico:       agsAll.length,
        },
        pacientes:  { total: totalPacientes },
        reputacao:  { nota_google: notaGoogle, num_avaliacoes: numAvaliacoes },
        site: {
          galeria: nGaleria, equipe: nEquipe, antes_depois: nAntes,
          depoimentos: nDep, servicos: nSrv, estrutura: nEst,
          has_logo: hasLogo, has_hero: hasHero, has_slug: hasSlug,
        },
        automacao: { has_zapi: hasZapi },
      },
      indice,
      indice_breakdown: {
        gestao:    bd.gestao,
        site:      bd.site,
        reputacao: bd.reputacao,
        automacao: bd.automacao,
        atividade: bd.atividade,
      },
      ai_diagnostico,
      ai_pontos_fortes,
      ai_oportunidade,
      ai_missao,
      ai_motivacional,
      assinatura: "Análise elaborada com base nos indicadores operacionais atuais da sua clínica pelo Motor de Inteligência ClínicaFlow.",
      nome_clinica: nomeClinica,
      data_geracao: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/raio-x] Erro:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

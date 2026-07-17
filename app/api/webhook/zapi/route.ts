import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Normalização de telefone ────────────────────────────────────────────────

function normalizarTelefone(raw: string): string {
  const digits = raw.replace(/@.*$/, "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return "55" + digits;
}

// ─── Normalização de texto ───────────────────────────────────────────────────

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// ─── Interpolação de templates ───────────────────────────────────────────────

function interpolar(
  template: string,
  vars: { nome: string; data: string; horario: string; clinica_nome: string }
): string {
  return template
    .replace(/\{nome\}|\{\{paciente_nome\}\}/g, vars.nome)
    .replace(/\{data\}|\{\{data\}\}/g, vars.data)
    .replace(/\{horario\}|\{\{hora\}\}/g, vars.horario)
    .replace(/\{clinica_nome\}|\{\{clinica_nome\}\}/g, vars.clinica_nome);
}

// ─── Classificação de resposta ───────────────────────────────────────────────

const CONFIRMAR_EXATO = new Set([
  "s",
  "\u{1F44D}", // 👍
  "✅",
  "estarei la",
  "estou indo",
  "pode confirmar",
]);

const REAGENDAR_EXATO = new Set(["n"]);

const CONFIRMAR_PREFIXO = ["sim", "confirmo", "confirmado", "ok", "certo"];
const REAGENDAR_PREFIXO = ["nao", "cancelar", "cancela", "reagendar", "remarcar"];

function iniciaCom(texto: string, palavra: string): boolean {
  if (texto === palavra) return true;
  if (!texto.startsWith(palavra)) return false;
  return /^[\s,!.?]/.test(texto.slice(palavra.length));
}

// ─── TRAVA DE EMERGÊNCIA — automação pausada por tenant ──────────────────────
// Ativada em 2026-07-17: o número conectado à instância Z-API do tenant
// "OrganizaPro Oficial" é o WhatsApp pessoal do proprietário, e mensagens
// particulares (família/amigos) estavam sendo respondidas automaticamente
// pelo funil comercial do chatbot. Pausa TODO processamento automático
// (chatbot e resposta de confirmação/reagendamento) para os clinica_id
// listados aqui, até que uma instância Z-API dedicada e exclusiva para o
// negócio seja criada (fora do escopo desta correção emergencial).
// Reversão: remover o clinica_id deste Set. Evolução futura: substituir por
// uma coluna clinica_config.chatbot_ativo (requer migração aprovada).
const TENANTS_COM_AUTOMACAO_PAUSADA = new Set<string>([
  "9b21a735-4bbb-4cbc-8666-7d941be9d35c", // OrganizaPro Oficial — número pessoal do dono
]);

function automacaoPausada(clinicaId: string | null | undefined): boolean {
  return !!clinicaId && TENANTS_COM_AUTOMACAO_PAUSADA.has(clinicaId);
}

export function classificarResposta(texto: string): "confirmar" | "reagendar" | "ignorar" {
  const t = normalizar(texto);
  if (CONFIRMAR_EXATO.has(t)) return "confirmar";
  if (REAGENDAR_EXATO.has(t)) return "reagendar";
  if (CONFIRMAR_PREFIXO.some((p) => iniciaCom(t, p))) return "confirmar";
  if (REAGENDAR_PREFIXO.some((p) => iniciaCom(t, p))) return "reagendar";
  return "ignorar";
}

// ─── Templates padrão de resposta automática ─────────────────────────────────

const MSG_CONFIRMACAO_PADRAO =
  "Perfeito, {nome}! ✅\n\nSua consulta do dia *{data}* às *{horario}* está confirmada.\n\nEsperamos você! 😊";

const MSG_REAGENDAMENTO_PADRAO =
  "Entendemos, {nome}! 📅\n\nVamos reagendar sua consulta. Nossa equipe entrará em contato em breve para definir a melhor data para você.\n\nObrigado pela atenção! 😊";

// ─── Handler do webhook ──────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  // ── PASSO 1: log imediato — antes de qualquer processamento ─────────────────
  console.log("[WEBHOOK] ===== NOVA REQUISIÇÃO =====");
  console.log("[WEBHOOK] entrada:", {
    method:    req.method,
    url:       req.url,
    timestamp: new Date().toISOString(),
    ua:        req.headers.get("user-agent")?.slice(0, 80) ?? "(sem UA)",
  });

  try {
    const secret = process.env.WEBHOOK_SECRET;
    if (secret) {
      const { searchParams } = new URL(req.url);
      const token = searchParams.get("token") ?? req.headers.get("x-webhook-token");
      if (token !== secret) {
        console.log("[WEBHOOK] retorno antecipado: token inválido", { token: token?.slice(0, 10) });
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
      }
    }

    const body = await req.json();
    console.log("[WEBHOOK] payload completo:", JSON.stringify(body).slice(0, 2000));

    if (body.fromMe === true) {
      console.log("[WEBHOOK] retorno antecipado: fromMe=true (mensagem própria)");
      return NextResponse.json({ sucesso: true, ignorado: "fromMe" });
    }
    if (body.isGroup === true) {
      console.log("[WEBHOOK] retorno antecipado: isGroup=true (mensagem de grupo)");
      return NextResponse.json({ sucesso: true, ignorado: "grupo" });
    }

    // Z-API envia o texto em body.text.message (objeto) ou body.body (string)
    const phoneRaw: string = body.phone ?? body.sender ?? body.from ?? "";
    const mensagem: string =
      (typeof body.text === "object" && body.text !== null ? body.text.message : "") ||
      body.body ||
      body.message ||
      (typeof body.text === "string" ? body.text : "") ||
      "";
    const instanceId: string =
      body.instanceId ?? body.instanceName ?? body.instance ?? body.id ?? "";

    console.log("[WEBHOOK] campos extraídos:", {
      phoneRaw: phoneRaw || "(vazio)",
      mensagem: mensagem.slice(0, 100) || "(vazio)",
      instanceId: instanceId || "(vazio)",
      fromMe:     body.fromMe,
      isGroup:    body.isGroup,
    });

    if (!phoneRaw || !mensagem.trim()) {
      console.log("[WEBHOOK] retorno antecipado: sem phoneRaw ou mensagem", {
        phoneRaw: phoneRaw || "(vazio)",
        mensagem: mensagem.slice(0, 40) || "(vazio)",
      });
      return NextResponse.json({ sucesso: true, ignorado: "sem_dados" });
    }

    const telefone = normalizarTelefone(phoneRaw);
    const sufixo9  = telefone.slice(-9);
    const sufixo8  = telefone.slice(-8);
    const acao     = classificarResposta(mensagem);

    console.log("[webhook/zapi] dados extraídos:", {
      phoneRaw, telefone, sufixo9, sufixo8, instanceId, acao,
      mensagem: mensagem.slice(0, 80),
    });

    // ── ROTEAMENTO ────────────────────────────────────────────────────────────
    console.log("[WEBHOOK] ── ROTEAMENTO ──", {
      acao,
      destino: acao === "ignorar" ? "→ CHATBOT IA" : "→ FLUXO DE CONFIRMAÇÃO",
      mensagem: mensagem.slice(0, 60),
    });

    // ── Chatbot: mensagens que não são confirmação nem reagendamento ────────
    if (acao === "ignorar") {
      console.log("[WEBHOOK] mensagem recebida:", {
        telefone, instanceId: instanceId || "(vazio)",
        mensagem: mensagem.slice(0, 100),
      });
      console.log("[WEBHOOK] classificada como chatbot — buscando clinica_id");

      let chatbotClinicaId: string | null = null;

      // Busca 1: via instanceId exato (case-insensitive)
      if (instanceId) {
        const { data: cfgExato, error: cfgErr } = await supabase
          .from("clinica_config")
          .select("clinica_id, zapi_instance")
          .ilike("zapi_instance", instanceId)
          .maybeSingle();

        if (cfgErr) {
          console.error("[WEBHOOK] erro ao buscar clinica_config por instanceId:", cfgErr.message);
        } else if (cfgExato?.clinica_id) {
          chatbotClinicaId = cfgExato.clinica_id;
          console.log("[WEBHOOK] clinica_id encontrado via instanceId:", {
            clinica_id: chatbotClinicaId,
            instanceId_payload: instanceId,
            instanceId_banco: cfgExato.zapi_instance,
          });
        } else {
          // PASSO 2: comparação lado-a-lado para diagnóstico de mismatch
          const { data: todasClinicas } = await supabase
            .from("clinica_config")
            .select("clinica_id, zapi_instance, nome_clinica")
            .limit(5);
          console.warn("[WEBHOOK] ===== instanceId NÃO ENCONTRADO =====");
          console.warn("[WEBHOOK] instanceId recebido  :", JSON.stringify(instanceId));
          console.warn("[WEBHOOK] instanceId no banco  :", JSON.stringify(
            todasClinicas?.map(c => ({ nome: c.nome_clinica, zapi_instance: c.zapi_instance })) ?? []
          ));
          console.warn("[WEBHOOK] retorno antecipado: clinica_id não encontrado — chatbot não será chamado");
        }
      } else {
        // Etapa 3 (trava de emergência): nunca mais adivinhar a clínica quando
        // o payload não traz instanceId — isso já causou o encaminhamento de
        // conversas particulares para o funil comercial. Registra e encerra.
        console.warn("[WEBHOOK] instanceId vazio no payload — evento registrado e ignorado (sem adivinhação de clínica)");
        await supabase.from("whatsapp_logs").insert({
          clinica_id: null,
          telefone, mensagem, status: "recebido",
          resposta: { acao, processado: false, motivo: "sem_instance_id" },
        });
        return NextResponse.json({ sucesso: true, ignorado: "sem_instance_id" });
      }

      if (chatbotClinicaId && automacaoPausada(chatbotClinicaId)) {
        console.warn("[WEBHOOK] automação pausada para este tenant — chatbot não será chamado:", { clinica_id: chatbotClinicaId });
        await supabase.from("whatsapp_logs").insert({
          clinica_id: chatbotClinicaId,
          telefone, mensagem, status: "recebido",
          resposta: { acao, processado: false, motivo: "chatbot_pausado_manualmente" },
        });
        return NextResponse.json({ sucesso: true, recebido: true, ignorado: "automacao_pausada" });
      }

      if (chatbotClinicaId) {
        console.log("[WEBHOOK] ▶ Encaminhando para Chatbot IA:", {
          clinica_id: chatbotClinicaId,
          telefone,
          mensagem: mensagem.slice(0, 80),
        });
        // after() garante que o Vercel mantenha a função viva após enviar o 200 para a Z-API,
        // executando o chatbot em background sem risco de o contexto ser encerrado prematuramente.
        const baseUrl = new URL(req.url).origin;
        const chatbotPayload = JSON.stringify({
          clinica_id: chatbotClinicaId,
          telefone,
          mensagem,
          nome_paciente: body.senderName ?? body.chatName ?? "",
        });
        console.log("[WEBHOOK] chamando chatbot:", {
          clinica_id: chatbotClinicaId,
          telefone,
          mensagem: mensagem.slice(0, 80),
        });
        after(async () => {
          try {
            const r = await fetch(`${baseUrl}/api/chatbot/message`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: chatbotPayload,
            });
            const j = await r.json().catch(() => null);
            console.log("[WEBHOOK] chatbot respondeu:", {
              status:        r.status,
              sucesso:       j?.sucesso,
              topico:        j?.topico,
              processado_por: j?.processado_por,
              ignorado:      j?.ignorado ?? null,
            });
          } catch (e) {
            console.error("[WEBHOOK] ERRO ao chamar chatbot:", e instanceof Error ? e.message : e);
          }
        });
        console.log("[WEBHOOK] chatbot disparado — retornando 200 para Z-API");
      } else {
        console.warn("[WEBHOOK] retorno antecipado: clinica_id não encontrado — chatbot não chamado");
        console.warn("[WEBHOOK] instanceId que falhou:", JSON.stringify(instanceId || "(vazio)"));
      }

      // Responde 200 para Z-API imediatamente — não espera o chatbot processar
      return NextResponse.json({ sucesso: true, recebido: true, mensagem });
    }

    console.log("[WEBHOOK] ▶ Entrou no fluxo de confirmação:", { acao, telefone, instanceId: instanceId || "(vazio)" });

    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

    // ── Passo 1: clinica_id via instanceId (filtro opcional, não obrigatório) ─
    let clinicaIdHint: string | null = null;
    if (instanceId) {
      const { data: configRow } = await supabase
        .from("clinica_config")
        .select("clinica_id")
        .eq("zapi_instance", instanceId)
        .maybeSingle();
      clinicaIdHint = configRow?.clinica_id ?? null;
    }
    console.log("[webhook/zapi] passo 1 — instanceId:", {
      instanceId: instanceId || "vazio",
      clinicaIdHint: clinicaIdHint ?? "não encontrado",
    });

    if (automacaoPausada(clinicaIdHint)) {
      console.warn("[webhook/zapi] automação pausada para este tenant — fluxo de confirmação encerrado:", { clinica_id: clinicaIdHint });
      await supabase.from("whatsapp_logs").insert({
        clinica_id: clinicaIdHint,
        telefone, mensagem, status: "recebido",
        resposta: { acao, processado: false, motivo: "chatbot_pausado_manualmente" },
      });
      return NextResponse.json({ sucesso: true, recebido: true, ignorado: "automacao_pausada" });
    }

    // ── Passo 2: buscar agendamento por telefone ─────────────────────────────
    // Tenta três formatos: telefone exato (com DDI), sufixo8, sufixo9.
    // clinicaIdHint restringe a busca quando disponível (evita colisão multi-clínica).
    // confirmado = false OU null (ambos indicam pendente).

    type AgRow = {
      id: string;
      paciente_nome: string;
      clinica_id: string;
      status: string;
      data: string;
      hora: string;
      confirmacao_enviada: boolean;
      confirmado: boolean | null;
      precisa_reagendar: boolean;
    };

    async function buscarAgendamento(
      filtroTelefone: { tipo: "eq" | "ilike"; valor: string },
      comClinica: boolean,
      exigirConfirmacaoEnviada = true
    ): Promise<AgRow | null> {
      let q = supabase
        .from("agendamentos")
        .select("id,paciente_nome,clinica_id,status,data,hora,confirmacao_enviada,confirmado,precisa_reagendar");

      if (filtroTelefone.tipo === "eq") {
        q = q.eq("telefone", filtroTelefone.valor);
      } else {
        q = q.ilike("telefone", `%${filtroTelefone.valor}`);
      }

      if (exigirConfirmacaoEnviada) {
        q = q.eq("confirmacao_enviada", true);
      }

      q = q
        .or("confirmado.eq.false,confirmado.is.null")
        .eq("precisa_reagendar", false)
        .gte("data", hoje)
        .not("status", "in", '("confirmado","concluido","faltou","cancelado","reagendar")')
        .order("data", { ascending: true })
        .order("hora", { ascending: true })
        .limit(1);

      if (comClinica && clinicaIdHint) q = q.eq("clinica_id", clinicaIdHint);

      const { data, error } = await q;
      if (error) {
        console.error("[webhook/zapi] erro na query agendamento:", error.message, { filtroTelefone, comClinica, exigirConfirmacaoEnviada });
        return null;
      }
      return (data?.[0] as AgRow) ?? null;
    }

    let ag: AgRow | null = null;
    const tentativas = [
      { tipo: "eq"    as const, valor: telefone, desc: "exato" },
      { tipo: "ilike" as const, valor: sufixo8,  desc: "sufixo8" },
      { tipo: "ilike" as const, valor: sufixo9,  desc: "sufixo9" },
    ];

    for (const t of tentativas) {
      // Com filtro de clínica primeiro (mais seguro em multi-tenant)
      if (clinicaIdHint) {
        ag = await buscarAgendamento(t, true);
        if (ag) { console.log(`[webhook/zapi] passo 2 — match ${t.desc} + clinica:`, ag.paciente_nome); break; }
      }
      // Sem filtro de clínica (fallback)
      ag = await buscarAgendamento(t, false);
      if (ag) { console.log(`[webhook/zapi] passo 2 — match ${t.desc} sem clinica:`, ag.paciente_nome); break; }
    }

    // Fallback: busca sem exigir confirmacao_enviada=true.
    // Cobre o caso onde o botão manual falhou em marcar o campo (anon key / RLS).
    if (!ag) {
      console.warn("[webhook/zapi] passo 2 — retry sem confirmacao_enviada:", { telefone, sufixo8, sufixo9 });
      for (const t of tentativas) {
        if (clinicaIdHint) {
          ag = await buscarAgendamento(t, true, false);
          if (ag) {
            console.log(`[webhook/zapi] passo 2 — fallback match ${t.desc} + clinica:`, ag.paciente_nome);
            await supabase.from("agendamentos").update({ confirmacao_enviada: true }).eq("id", ag.id);
            break;
          }
        }
        ag = await buscarAgendamento(t, false, false);
        if (ag) {
          console.log(`[webhook/zapi] passo 2 — fallback match ${t.desc} sem clinica:`, ag.paciente_nome);
          await supabase.from("agendamentos").update({ confirmacao_enviada: true }).eq("id", ag.id);
          break;
        }
      }
    }

    if (!ag) {
      console.warn("[webhook/zapi] passo 2 — nenhum agendamento elegível:", {
        telefone, sufixo8, sufixo9, clinicaIdHint, hoje, acao,
      });
      // Sem agendamento pendente: a mensagem (mesmo que sim/não) vai para o chatbot.
      // O chatbot tem guarda interna que descarta confirmações sem contexto.
      const clinicaParaChatbot = clinicaIdHint;
      if (clinicaParaChatbot && automacaoPausada(clinicaParaChatbot)) {
        console.warn("[WEBHOOK] automação pausada para este tenant — fallback para chatbot não será chamado:", { clinica_id: clinicaParaChatbot });
      } else if (clinicaParaChatbot) {
        console.log("[WEBHOOK] sem agendamento — roteando para chatbot:", { clinica_id: clinicaParaChatbot, acao });
        try {
          const baseUrl = new URL(req.url).origin;
          const cbRes2 = await fetch(`${baseUrl}/api/chatbot/message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clinica_id: clinicaParaChatbot,
              telefone,
              mensagem,
              nome_paciente: body.senderName ?? body.chatName ?? "",
            }),
          });
          const cbJson2 = await cbRes2.json().catch(() => null);
          console.log("[WEBHOOK] chatbot fallback resposta:", {
            status: cbRes2.status,
            sucesso: cbJson2?.sucesso,
            topico: cbJson2?.topico,
            processado_por: cbJson2?.processado_por,
          });
        } catch (e) {
          console.error("[webhook/zapi] chatbot fallback erro:", e);
        }
      } else {
        console.warn("[WEBHOOK] sem agendamento E sem clinicaIdHint — chatbot não chamado");
      }
      await supabase.from("whatsapp_logs").insert({
        clinica_id: clinicaIdHint,
        telefone, mensagem, status: "recebido",
        resposta: { acao, processado: false, motivo: "agendamento_nao_encontrado", instanceId },
      });
      return NextResponse.json({
        sucesso: true, acao, telefone,
        agendamento_encontrado: false,
        motivo: "agendamento_nao_encontrado",
      });
    }

    // clinica_id vem do agendamento encontrado — fonte de verdade
    const clinicaId = ag.clinica_id;

    // ── Passo 3: atualizar agendamento ───────────────────────────────────────
    const agora = new Date().toISOString();
    const updates =
      acao === "confirmar"
        ? { status: "confirmado", confirmado: true,  precisa_reagendar: false, resposta_confirmacao: mensagem, respondido_em: agora }
        : { status: "reagendar",  confirmado: false, precisa_reagendar: true,  resposta_confirmacao: mensagem, respondido_em: agora };

    const { error: updErr } = await supabase.from("agendamentos").update(updates).eq("id", ag.id);
    if (updErr) {
      console.error("[webhook/zapi] passo 3 — erro no UPDATE:", updErr.message);
    } else {
      console.log("[webhook/zapi] passo 3 — agendamento atualizado:", { id: ag.id, acao, status: updates.status });
    }

    // ── Passo 4: resposta automática ─────────────────────────────────────────
    if (automacaoPausada(clinicaId)) {
      console.warn("[webhook/zapi] automação pausada para este tenant — resposta automática não será enviada:", { clinica_id: clinicaId });
      await supabase.from("whatsapp_logs").insert({
        clinica_id: clinicaId,
        telefone, mensagem, status: "recebido",
        resposta: { acao, agendamento_id: ag.id, processado: false, motivo: "chatbot_pausado_manualmente" },
      });
      return NextResponse.json({ sucesso: true, recebido: true, ignorado: "automacao_pausada" });
    }
    try {
      const { data: clinicaConfig } = await supabase
        .from("clinica_config")
        .select("msg_confirmacao, msg_reagendamento, nome_clinica")
        .eq("clinica_id", clinicaId)
        .maybeSingle();

      const template =
        acao === "confirmar"
          ? (clinicaConfig?.msg_confirmacao || MSG_CONFIRMACAO_PADRAO)
          : (clinicaConfig?.msg_reagendamento || MSG_REAGENDAMENTO_PADRAO);

      const mensagemResposta = interpolar(template, {
        nome:         ag.paciente_nome || "",
        data:         ag.data ? ag.data.split("-").reverse().join("/") : "",
        horario:      ag.hora?.substring(0, 5) || "",
        clinica_nome: clinicaConfig?.nome_clinica || "nossa clínica",
      });

      const baseUrl = new URL(req.url).origin;
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret) {
        throw new Error("CRON_SECRET não configurado para envio interno");
      }
      await fetch(`${baseUrl}/api/whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({ clinica_id: clinicaId, telefone, mensagem: mensagemResposta }),
      });
      console.log("[webhook/zapi] passo 4 — resposta automática enviada");
    } catch (respErr) {
      console.error("[webhook/zapi] passo 4 — erro resposta automática:", respErr);
    }

    // ── Log final ────────────────────────────────────────────────────────────
    await supabase.from("whatsapp_logs").insert({
      clinica_id: clinicaId,
      telefone, mensagem, status: "recebido",
      resposta: {
        acao,
        agendamento_id:  ag.id,
        paciente_nome:   ag.paciente_nome,
        data:            ag.data,
        hora:            ag.hora,
        processado:      true,
      },
    });

    return NextResponse.json({
      sucesso:               true,
      acao,
      telefone,
      clinica_id:            clinicaId,
      agendamento_id:        ag.id,
      agendamento_encontrado: true,
      paciente_nome:         ag.paciente_nome,
      data:                  ag.data,
      hora:                  ag.hora,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[webhook/zapi] erro inesperado:", message);
    return NextResponse.json({ sucesso: false, error: message }, { status: 500 });
  }
}

import { produtoOrganizaPro, reservarOperacao } from "../../../../lib/seguranca-operacoes";
import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classificarResposta } from "../../../../lib/zapi-classificar-resposta";
import {
  detectarPedidoOptOut, entidadeIdDeTelefone, entidadeIdDeterministico,
  chaveIdempotenciaWebhookRecebido, chaveIdempotenciaConsentimento,
} from "../../../../lib/whatsapp-governado";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Replay reservado pela PK antes de qualquer efeito. Falha do banco bloqueia.
async function jaProcessadoOuMarcar(clinicaId: string, instanceId: string, messageId: string): Promise<boolean> {
  const chave = chaveIdempotenciaWebhookRecebido(instanceId, messageId);
  const { data: legado, error: legadoError } = await supabase.from("eventos_dominio").select("id")
    .eq("clinica_id", clinicaId).eq("tipo", "whatsapp.webhook_recebido").eq("chave_idempotencia", chave).maybeSingle();
  if (legadoError) throw new Error("Consulta de replay indisponível");
  if (legado) return true;
  const reserva = await reservarOperacao(supabase, clinicaId, "webhook:" + chave, chave);
  if (reserva) return false;
  // Distingue replay conhecido de indisponibilidade: esta última deve permitir
  // reentrega pelo provider, sem executar efeitos nesta tentativa.
  const id = entidadeIdDeterministico("seguranca.p1", JSON.stringify([clinicaId, "webhook:" + chave]));
  const { data, error } = await supabase.from("eventos_dominio").select("id").eq("id", id).eq("clinica_id", clinicaId).maybeSingle();
  if (error || !data) throw new Error("Reserva de webhook indisponível");
  return true;
}

async function registrarOptOutSePedido(clinicaId: string, telefone: string, mensagem: string): Promise<boolean> {
  if (!detectarPedidoOptOut(mensagem)) return false;
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const entidadeId = entidadeIdDeTelefone(clinicaId, telefone);
  const { error } = await supabase.from("eventos_dominio").insert({
    clinica_id: clinicaId, tipo: "whatsapp.consentimento", entidade_tipo: "contato_whatsapp", entidade_id: entidadeId,
    chave_idempotencia: chaveIdempotenciaConsentimento(entidadeId, `webhook_optout:${hoje}`),
    payload: { telefone, estado: "bloqueado", origem: "webhook_optout_automatico" }, criado_em: new Date().toISOString(),
  });
  if (error && error.code !== "23505") throw new Error("Persistência de consentimento indisponível");
  console.warn("[WEBHOOK] opt-out detectado — contato bloqueado para automação comercial:");
  return true;
}

// ─── Normalização de telefone ────────────────────────────────────────────────

function normalizarTelefone(raw: string): string {
  const digits = raw.replace(/@.*$/, "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return "55" + digits;
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
// 2026-09-24: OrganizaPro Oficial liberado — instância Z-API dedicada
// (número exclusivo do negócio) validada em produção com entrada e saída reais.
const TENANTS_COM_AUTOMACAO_PAUSADA = new Set<string>([]);

function automacaoPausada(clinicaId: string | null | undefined): boolean {
  return !!clinicaId && TENANTS_COM_AUTOMACAO_PAUSADA.has(clinicaId);
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
  // Nunca loga req.url bruto: a partir do rollout do WEBHOOK_SECRET, a URL
  // real passa a conter `?token=<segredo>` na query string — logar a URL
  // inteira vazaria o segredo em texto puro nos logs do servidor. Só o
  // pathname é seguro de registrar.
  console.log("[WEBHOOK] ===== NOVA REQUISIÇÃO =====");
  console.log("[WEBHOOK] entrada:");

  try {
    // Autenticação obrigatória e fail-closed (auditoria 2026-08-17): antes
    // desta correção, a checagem só rodava SE a env var existisse — ausência
    // de configuração equivalia a aceitar qualquer requisição sem nenhuma
    // credencial. Mesmo padrão já homologado em CHATBOT_INTERNAL_SECRET:
    // sem a variável configurada, falha fechada (503); token ausente ou
    // incorreto, 401. `?token=` na query string é o único mecanismo que a
    // Z-API real suporta (a URL do webhook é só uma string, sem campo de
    // headers customizados — confirmado na documentação oficial); o header
    // `x-webhook-token` permanece só como alternativa para teste manual.
    // Ocorre antes de qualquer leitura/escrita no banco.
    const secret = process.env.WEBHOOK_SECRET;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token") ?? req.headers.get("x-webhook-token");

    // ── Observação segura (preparação da Fase 1 do rollout) ──────────────────
    // Só booleanos — nunca o valor do token nem do WEBHOOK_SECRET. Existe
    // para comprovar, antes de Production passar a exigir o token, que a
    // Z-API já está enviando `?token=` corretamente. Roda sempre, nos dois
    // modos abaixo — é diagnóstico, nunca decide autorização sozinho.
    console.log("[WEBHOOK] observacao_auth:");

    // Observação nunca dispensa autenticação.
    if (!secret) return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
    if (token !== secret) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json();
    console.log("[WEBHOOK] payload recebido");

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

    console.log("[WEBHOOK] campos extraídos:");

    if (!phoneRaw || !mensagem.trim()) {
      console.log("[WEBHOOK] retorno antecipado: sem phoneRaw ou mensagem");
      return NextResponse.json({ sucesso: true, ignorado: "sem_dados" });
    }

    const telefone = normalizarTelefone(phoneRaw);
    const sufixo9  = telefone.slice(-9);
    const sufixo8  = telefone.slice(-8);
    const acao     = classificarResposta(mensagem);

    console.log("[webhook/zapi] dados extraídos:");

    // ── ROTEAMENTO ────────────────────────────────────────────────────────────
    console.log("[WEBHOOK] ── ROTEAMENTO ──");

    // ── Chatbot: mensagens que não são confirmação nem reagendamento ────────
    if (acao === "ignorar") {
      console.log("[WEBHOOK] mensagem recebida:");
      console.log("[WEBHOOK] classificada como chatbot — buscando clinica_id");

      let chatbotClinicaId: string | null = null;

      // Busca 1: via instanceId exato (case-insensitive)
      if (instanceId) {
        const { data: cfgExato, error: cfgErr } = await supabase
          .from("clinica_config")
          .select("clinica_id, zapi_instance")
          .eq("zapi_instance", instanceId)
          .maybeSingle();

        if (cfgErr) {
          console.error("[WEBHOOK] erro ao buscar clinica_config por instanceId:");
        } else if (cfgExato?.clinica_id) {
          chatbotClinicaId = cfgExato.clinica_id;
          console.log("[WEBHOOK] clinica_id encontrado via instanceId:");
        } else {
          // PASSO 2: comparação lado-a-lado para diagnóstico de mismatch
          console.warn("[WEBHOOK] retorno antecipado: clinica_id não encontrado — chatbot não será chamado");
        }
      } else {
        // Etapa 3 (trava de emergência): nunca mais adivinhar a clínica quando
        // o payload não traz instanceId — isso já causou o encaminhamento de
        // conversas particulares para o funil comercial. Registra e encerra.
        console.warn("[WEBHOOK] instanceId vazio no payload — evento registrado e ignorado (sem adivinhação de clínica)");
        await supabase.from("whatsapp_logs").insert({
          clinica_id: null,
          telefone, mensagem: "[conteúdo omitido]", status: "recebido",
          resposta: { tipo: "webhook_processado" },
        });
        return NextResponse.json({ sucesso: true, ignorado: "sem_instance_id" });
      }

      if (chatbotClinicaId && !await produtoOrganizaPro(supabase, chatbotClinicaId)) return NextResponse.json({ error: "Tenant não autorizado" }, { status: 403 });
      if (chatbotClinicaId && automacaoPausada(chatbotClinicaId)) {
        console.warn("[WEBHOOK] automação pausada para este tenant — chatbot não será chamado:");
        await supabase.from("whatsapp_logs").insert({
          clinica_id: chatbotClinicaId,
          telefone, mensagem: "[conteúdo omitido]", status: "recebido",
          resposta: { tipo: "webhook_processado" },
        });
        return NextResponse.json({ sucesso: true, recebido: true, ignorado: "automacao_pausada" });
      }

      if (chatbotClinicaId) {
        const messageId: string = body.messageId ?? body.zaapId ?? "";
        if (typeof messageId !== "string" || !messageId) return NextResponse.json({ error: "Identificador de mensagem obrigatório" }, { status: 400 });
        // Persistir opt-out antes da reserva: falha permite reentrega segura.
        if (await registrarOptOutSePedido(chatbotClinicaId, telefone, mensagem)) return NextResponse.json({ sucesso: true, ignorado: "optout" });
        if (messageId && await jaProcessadoOuMarcar(chatbotClinicaId, instanceId, messageId)) {
          console.warn("[WEBHOOK] mensagem já processada (replay do provider) — chatbot não chamado novamente:");
          return NextResponse.json({ sucesso: true, recebido: true, ignorado: "replay" });
        }
        console.log("[WEBHOOK] ▶ Encaminhando para Chatbot IA:");
        // after() garante que o Vercel mantenha a função viva após enviar o 200 para a Z-API,
        // executando o chatbot em background sem risco de o contexto ser encerrado prematuramente.
        const baseUrl = new URL(req.url).origin;
        const chatbotPayload = JSON.stringify({
          clinica_id: chatbotClinicaId,
          telefone,
          mensagem,
          operacao: `chatbot:${instanceId}:${messageId}`,
          nome_paciente: body.senderName ?? body.chatName ?? "",
        });
        console.log("[WEBHOOK] chamando chatbot:");
        after(async () => {
          try {
            const r = await fetch(`${baseUrl}/api/chatbot/message`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.CHATBOT_INTERNAL_SECRET}`,
              },
              body: chatbotPayload,
            });
            console.log("[WEBHOOK] chatbot respondeu", { status: r.status });
          } catch {
            console.error("[WEBHOOK] ERRO ao chamar chatbot:");
          }
        });
        console.log("[WEBHOOK] chatbot disparado — retornando 200 para Z-API");
      } else {
        console.warn("[WEBHOOK] retorno antecipado: clinica_id não encontrado — chatbot não chamado");
        console.warn("[WEBHOOK] instanceId que falhou:");
      }

      // Responde 200 para Z-API imediatamente — não espera o chatbot processar
      return NextResponse.json({ sucesso: true, recebido: true, mensagem });
    }

    console.log("[WEBHOOK] ▶ Entrou no fluxo de confirmação:");

    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

    // ── Passo 1: clinica_id via instanceId — OBRIGATÓRIO para todo o fluxo de
    // confirmação/reagendamento. Auditoria 2026-08-17: antes desta correção,
    // quando instanceId estava ausente/inválido/sem correspondência, o
    // passo 2 caía num fallback que buscava agendamentos em TODOS os
    // tenants por sufixo de telefone — permitia alterar agendamento real de
    // qualquer clínica só com um número de telefone. Regra agora obrigatória
    // e sem exceção: instanceId → clinica_config.zapi_instance → clinica_id
    // → agendamento daquele tenant. Sem tenant identificado, o fluxo encerra
    // aqui — nunca busca nem altera nada. Mesma disciplina já usada no ramo
    // do chatbot acima (bloco "sem instanceId vazio"), agora também aqui.
    let clinicaIdHint: string | null = null;
    if (instanceId) {
      const { data: configRow } = await supabase
        .from("clinica_config")
        .select("clinica_id")
        .eq("zapi_instance", instanceId)
        .maybeSingle();
      clinicaIdHint = configRow?.clinica_id ?? null;
    }
    console.log("[webhook/zapi] passo 1 — instanceId:");

    if (!clinicaIdHint) {
      console.warn("[webhook/zapi] instanceId ausente ou sem correspondência inequívoca — fluxo de confirmação encerrado (fail-closed, nunca busca/altera agendamento sem tenant identificado)");
      await supabase.from("whatsapp_logs").insert({
        clinica_id: null,
        telefone, mensagem: "[conteúdo omitido]", status: "recebido",
        resposta: { tipo: "webhook_processado" },
      });
      return NextResponse.json({ sucesso: true, ignorado: "sem_instance_id" });
    }
    // const, não let: garante ao TypeScript (e a qualquer leitor) que daqui
    // em diante o tenant está definitivamente resolvido — nunca mais undefined.
    const clinicaIdConfirmado: string = clinicaIdHint;
    if (!await produtoOrganizaPro(supabase, clinicaIdConfirmado)) return NextResponse.json({ error: "Tenant não autorizado" }, { status: 403 });
    const messageId = body.messageId ?? body.zaapId;
    if (typeof messageId !== "string" || !messageId) return NextResponse.json({ error: "Identificador de mensagem obrigatório" }, { status: 400 });
    if (await jaProcessadoOuMarcar(clinicaIdConfirmado, instanceId, messageId)) return NextResponse.json({ sucesso: true, ignorado: "replay" });

    if (automacaoPausada(clinicaIdConfirmado)) {
      console.warn("[webhook/zapi] automação pausada para este tenant — fluxo de confirmação encerrado:");
      await supabase.from("whatsapp_logs").insert({
        clinica_id: clinicaIdConfirmado,
        telefone, mensagem: "[conteúdo omitido]", status: "recebido",
        resposta: { tipo: "webhook_processado" },
      });
      return NextResponse.json({ sucesso: true, recebido: true, ignorado: "automacao_pausada" });
    }

    // ── Passo 2: buscar agendamento por telefone — SEMPRE restrito ao tenant
    // identificado no passo 1. Tenta três formatos: telefone exato (com
    // DDI), sufixo8, sufixo9. confirmado = false OU null (ambos pendente).
    // Não existe mais nenhum caminho que busque sem filtro de clinica_id.

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
      exigirConfirmacaoEnviada = true
    ): Promise<AgRow | null> {
      let q = supabase
        .from("agendamentos")
        .select("id,paciente_nome,clinica_id,status,data,hora,confirmacao_enviada,confirmado,precisa_reagendar")
        .eq("clinica_id", clinicaIdConfirmado);

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

      const { data, error } = await q;
      if (error) {
        console.error("[webhook/zapi] erro na query agendamento:");
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
      ag = await buscarAgendamento(t);
      if (ag) { console.log("[webhook/zapi] evento operacional"); break; }
    }

    // Fallback: busca sem exigir confirmacao_enviada=true (cobre o caso onde
    // o botão manual falhou em marcar o campo) — sempre ainda restrito ao
    // tenant identificado no passo 1, nunca sem clinica_id.
    if (!ag) {
      console.warn("[webhook/zapi] passo 2 — retry sem confirmacao_enviada:");
      for (const t of tentativas) {
        ag = await buscarAgendamento(t, false);
        if (ag) {
          console.log("[webhook/zapi] evento operacional");
          await supabase.from("agendamentos").update({ confirmacao_enviada: true }).eq("id", ag.id);
          break;
        }
      }
    }

    if (!ag) {
      console.warn("[webhook/zapi] passo 2 — nenhum agendamento elegível:");
      // Sem agendamento pendente: a mensagem (mesmo que sim/não) vai para o
      // chatbot, sempre no mesmo tenant já identificado no passo 1 — nunca
      // em outro. O chatbot tem guarda interna que descarta confirmações
      // sem contexto.
      if (automacaoPausada(clinicaIdConfirmado)) {
        console.warn("[WEBHOOK] automação pausada para este tenant — fallback para chatbot não será chamado:");
      } else {
        console.log("[WEBHOOK] sem agendamento — roteando para chatbot:");
        try {
          const baseUrl = new URL(req.url).origin;
          const cbRes2 = await fetch(`${baseUrl}/api/chatbot/message`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.CHATBOT_INTERNAL_SECRET}`,
            },
            body: JSON.stringify({
              clinica_id: clinicaIdConfirmado,
              operacao: `chatbot:${instanceId}:${messageId}`,
              telefone,
              mensagem,
              nome_paciente: body.senderName ?? body.chatName ?? "",
            }),
          });
          console.log("[WEBHOOK] chatbot fallback resposta", { status: cbRes2.status });
        } catch {
          console.error("[webhook/zapi] chatbot fallback erro:");
        }
      }
      await supabase.from("whatsapp_logs").insert({
        clinica_id: clinicaIdConfirmado,
        telefone, mensagem: "[conteúdo omitido]", status: "recebido",
        resposta: { tipo: "webhook_processado" },
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
      console.error("[webhook/zapi] passo 3 — erro no UPDATE:");
    } else {
      console.log("[webhook/zapi] passo 3 — agendamento atualizado:");
    }

    // ── Passo 4: resposta automática ─────────────────────────────────────────
    if (automacaoPausada(clinicaId)) {
      console.warn("[webhook/zapi] automação pausada para este tenant — resposta automática não será enviada:");
      await supabase.from("whatsapp_logs").insert({
        clinica_id: clinicaId,
        telefone, mensagem: "[conteúdo omitido]", status: "recebido",
        resposta: { tipo: "webhook_processado" },
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
      const internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET;
      if (!internalServiceSecret) {
        throw new Error("INTERNAL_SERVICE_SECRET não configurado para envio interno");
      }
      await fetch(`${baseUrl}/api/whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${internalServiceSecret}`,
        },
        body: JSON.stringify({ clinica_id: clinicaId, telefone, mensagem: mensagemResposta, operacao: `confirmacao:${instanceId}:${messageId}` }),
      });
      console.log("[webhook/zapi] passo 4 — resposta automática enviada");
    } catch {
      console.error("[webhook/zapi] passo 4 — erro resposta automática:");
    }

    // ── Log final ────────────────────────────────────────────────────────────
    await supabase.from("whatsapp_logs").insert({
      clinica_id: clinicaId,
      telefone, mensagem: "[conteúdo omitido]", status: "recebido",
      resposta: { tipo: "webhook_processado" },
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

  } catch {

    console.error("[webhook/zapi] erro inesperado:");
    return NextResponse.json({ sucesso: false, error: "Falha operacional" }, { status: 500 });
  }
}

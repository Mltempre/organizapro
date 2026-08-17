import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function normalizarTelefone(telefone: string): string {
  const soNumeros = telefone.replace(/\D/g, "");

  if (soNumeros.startsWith("55") && soNumeros.length >= 12) {
    return soNumeros;
  }

  return "55" + soNumeros;
}

// Chamada de serviço interno (cron, webhook Z-API, chatbot) — não há auth.uid();
// o clinica_id já foi resolvido por código server-side confiável antes de chegar aqui,
// nunca por input de um usuário externo.
function autenticarServicoInterno(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cronSecret = process.env.CRON_SECRET;
  return !!(bearer && cronSecret && bearer === cronSecret);
}

// Chamada de usuário real. clinica_id do body é tratado como NÃO CONFIÁVEL até
// confirmar vínculo ativo entre auth.uid() (derivado do token, nunca do body) e
// esse clinica_id específico.
async function autorizarUsuario(
  req: NextRequest,
  clinicaId: string
): Promise<{ ok: true } | { ok: false; status: 401 | 403 }> {
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearer) return { ok: false, status: 401 };

  const { data: { user } } = await supabaseAnon.auth.getUser(bearer);
  if (!user) return { ok: false, status: 401 };

  const { data: vinculo } = await supabase
    .from("clinica_usuarios")
    .select("id")
    .eq("usuario_id", user.id)
    .eq("clinica_id", clinicaId)
    .eq("ativo", true)
    .maybeSingle();

  if (!vinculo) return { ok: false, status: 403 };

  // PENDENTE: checagem de clinicas.produto = 'organizapro' (hardcoded).
  // Coluna ainda não existe no banco (confirmado por leitura direta, sem migration
  // aplicada). Fica bloqueado até a Fase A do isolamento de produto ser executada —
  // reportado ao Diretor, não implementado por aproximação.

  return { ok: true };
}

export async function POST(req: NextRequest) {
  let body: { clinica_id?: string; telefone?: string; mensagem?: string } = {};
  try {
    body = await req.json();

    const clinica_id = body.clinica_id;
    const telefone   = body.telefone;
    const mensagem   = body.mensagem;

    if (!clinica_id || !telefone || !mensagem) {
      return NextResponse.json(
        { sucesso: false, error: "clinica_id, telefone e mensagem são obrigatórios" },
        { status: 400 }
      );
    }

    if (!autenticarServicoInterno(req)) {
      const auth = await autorizarUsuario(req, clinica_id);
      if (!auth.ok) {
        const error = auth.status === 401
          ? "Não autenticado"
          : "Usuário não tem vínculo com esta clínica";
        return NextResponse.json({ sucesso: false, error }, { status: auth.status });
      }
    }

    const { data: config, error: configError } = await supabase
      .from("clinica_config")
      .select("zapi_instance, zapi_token, zapi_client_token")
      .eq("clinica_id", clinica_id)
      .maybeSingle();

    if (!config) {
      console.error("[whatsapp/route] config Z-API não encontrada:", {
        clinica_id,
        ultimo_erro: configError?.message ?? "vazio",
      });
      return NextResponse.json(
        {
          sucesso:  false,
          error:    configError?.message ?? "Configuração da clínica não encontrada",
          detalhe:  configError?.message ?? null,
          code:     configError?.code    ?? null,
          hint:     configError?.hint    ?? null,
        },
        { status: 404 }
      );
    }

    console.log("[whatsapp/route] config encontrada:", {
      clinica_id,
      zapi_instance:     config.zapi_instance ? config.zapi_instance.slice(0, 8) + "…" : "VAZIO",
      zapi_token:        config.zapi_token        ? "✅" : "❌ VAZIO",
      zapi_client_token: config.zapi_client_token ? "✅" : "❌ VAZIO",
    });

    const telefoneNormalizado = normalizarTelefone(telefone!);

    const url = `https://api.z-api.io/instances/${config.zapi_instance}/token/${config.zapi_token}/send-text`;
    console.log("[whatsapp/route] chamando Z-API:", {
      instancia: config.zapi_instance?.slice(0, 8) + "…",
      telefone_destino: telefoneNormalizado,
      mensagem_chars: mensagem!.length,
      mensagem_preview: mensagem!.slice(0, 60),
    });

    const controller = new AbortController();
    const zapiTimeout = setTimeout(() => controller.abort(), 10_000);
    let zapiRes: Response;
    try {
      zapiRes = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": config.zapi_client_token,
        },
        body: JSON.stringify({
          phone: telefoneNormalizado,
          message: mensagem,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(zapiTimeout);
    }

    const zapiText = await zapiRes.text();
    console.log("[WHATSAPP] resposta Z-API:", {
      status: zapiRes.status,
      ok:     zapiRes.ok,
      body:   zapiText.slice(0, 200),
    });
    console.log("[whatsapp/route] resposta Z-API:", {
      status: zapiRes.status,
      ok:     zapiRes.ok,
      body:   zapiText.slice(0, 200),
    });

    let zapiJson: unknown;
    try {
      zapiJson = JSON.parse(zapiText);
    } catch {
      zapiJson = zapiText;
    }

    const { error: logError } = await supabase.from("whatsapp_logs").insert({
      clinica_id,
      telefone: telefoneNormalizado,
      mensagem,
      status: zapiRes.ok ? "enviado" : "erro",
      resposta: zapiJson,
    });
    if (logError) {
      console.error("[whatsapp/route] erro ao gravar whatsapp_log:", logError.message);
    }

    if (!zapiRes.ok) {
      console.error("[whatsapp/route] Z-API retornou erro:", {
        status: zapiRes.status,
        body:   zapiText.slice(0, 300),
      });
      return NextResponse.json(
        {
          sucesso: false,
          error: "Erro ao enviar pela Z-API",
          status: zapiRes.status,
          resposta: zapiJson,
          log_error: logError?.message ?? null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sucesso: true,
      telefone: telefoneNormalizado,
      resposta: zapiJson,
      log_error: logError?.message ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Registra exceção em whatsapp_logs para visibilidade no painel
    try {
      await supabase.from("whatsapp_logs").insert({
        clinica_id: body?.clinica_id ?? null,
        telefone:   body?.telefone   ?? null,
        mensagem:   body?.mensagem   ?? null,
        status:     "erro",
        resposta:   { error: message, tipo: "excecao" },
      });
    } catch { /* não quebrar por falha de log */ }

    return NextResponse.json(
      { sucesso: false, error: message },
      { status: 500 }
    );
  }
}

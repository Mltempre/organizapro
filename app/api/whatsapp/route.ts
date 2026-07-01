import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizarTelefone(telefone: string): string {
  const soNumeros = telefone.replace(/\D/g, "");

  if (soNumeros.startsWith("55") && soNumeros.length >= 12) {
    return soNumeros;
  }

  return "55" + soNumeros;
}

export async function POST(req: NextRequest) {
  console.log("[WHATSAPP] recebeu envio");
  console.log("[whatsapp/route] env check:", {
    url:     !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    service: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  let body: { clinica_id?: string; user_id?: string; telefone?: string; mensagem?: string } = {};
  try {
    body = await req.json();

    const clinica_id = body.clinica_id;
    const user_id    = body.user_id;
    const telefone   = body.telefone;
    const mensagem   = body.mensagem;

    if (!clinica_id || !telefone || !mensagem) {
      return NextResponse.json(
        { sucesso: false, error: "clinica_id, telefone e mensagem são obrigatórios" },
        { status: 400 }
      );
    }

    type ZapiConfig = { zapi_instance: string; zapi_token: string; zapi_client_token: string };
    type DbError = { message?: string; code?: string; hint?: string } | null;

    let config: ZapiConfig | null = null;
    let lastError: DbError = null;

    // Tentativa 1: clinica_config WHERE clinica_id = body.clinica_id
    {
      const { data, error } = await supabase
        .from("clinica_config")
        .select("zapi_instance, zapi_token, zapi_client_token")
        .eq("clinica_id", clinica_id)
        .maybeSingle();
      if (data) config = data;
      else lastError = error;
    }

    // Tentativa 2: clinica_usuarios WHERE usuario_id = user_id → clinica_config WHERE clinica_id
    if (!config && user_id) {
      const { data: cu } = await supabase
        .from("clinica_usuarios")
        .select("clinica_id")
        .eq("usuario_id", user_id)
        .maybeSingle();
      if (cu?.clinica_id) {
        const { data, error } = await supabase
          .from("clinica_config")
          .select("zapi_instance, zapi_token, zapi_client_token")
          .eq("clinica_id", cu.clinica_id)
          .maybeSingle();
        if (data) config = data;
        else lastError = error;
      }
    }

    // Tentativa 3: clinica_usuarios WHERE clinica_id → usuario_id → clinica_config WHERE user_id
    if (!config) {
      const { data: vinculo } = await supabase
        .from("clinica_usuarios")
        .select("usuario_id")
        .eq("clinica_id", clinica_id)
        .maybeSingle();
      if (vinculo?.usuario_id) {
        const { data, error } = await supabase
          .from("clinica_config")
          .select("zapi_instance, zapi_token, zapi_client_token")
          .eq("user_id", vinculo.usuario_id)
          .maybeSingle();
        if (data) config = data;
        else lastError = error;
      }
    }

    // Tentativa 4: fallback final — clinica_config WHERE user_id = body.user_id
    if (!config && user_id) {
      const { data, error } = await supabase
        .from("clinica_config")
        .select("zapi_instance, zapi_token, zapi_client_token")
        .eq("user_id", user_id)
        .maybeSingle();
      if (data) config = data;
      else lastError = error;
    }

    if (!config) {
      console.error("[whatsapp/route] config Z-API não encontrada:", {
        clinica_id, user_id: user_id ?? null,
        ultimo_erro: lastError?.message ?? "vazio",
      });
      return NextResponse.json(
        {
          sucesso:  false,
          error:    lastError?.message ?? "Configuração da clínica não encontrada",
          detalhe:  lastError?.message ?? null,
          code:     lastError?.code    ?? null,
          hint:     lastError?.hint    ?? null,
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

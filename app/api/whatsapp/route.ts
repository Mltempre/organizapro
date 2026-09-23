import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../lib/auth-clinica";
import { normalizarTelefone } from "../../../lib/whatsapp-governado";
import { produtoOrganizaPro, consentimentoEnvio, reservarOperacao, finalizarOperacao, type Reserva } from "../../../lib/seguranca-operacoes";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const MENSAGEM_TESTE = "✅ Teste OrganizaPro: integração Z-API funcionando corretamente!";

export async function POST(req: NextRequest) {
  let body: { clinica_id?: string; telefone?: string; mensagem?: string; operacao?: string } = {};
  let reserva: Reserva | null = null;
  try {
    body = await req.json();
    const { clinica_id, telefone, mensagem } = body;
    if (!clinica_id || !telefone || !mensagem) {
      return NextResponse.json({ sucesso: false, error: "clinica_id, telefone e mensagem são obrigatórios", nao_enviado: true }, { status: 400 });
    }
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET;
    const interno = !!internalSecret && req.headers.get("authorization") === `Bearer ${internalSecret}`;
    if (!interno) {
      const auth = await autorizarUsuarioNaClinica(req, clinica_id);
      if (!auth.ok) return NextResponse.json({ sucesso: false, error: auth.error, nao_enviado: true }, { status: auth.status });
    }
    if (!await produtoOrganizaPro(supabase, clinica_id)) {
      return NextResponse.json({ sucesso: false, error: "Tenant não autorizado", nao_enviado: true }, { status: 403 });
    }
    const { data: config, error } = await supabase.from("clinica_config")
      .select("zapi_instance, zapi_token, zapi_client_token, telefone, user_id").eq("clinica_id", clinica_id).maybeSingle();
    if (error || !config?.zapi_instance || !config.zapi_token || !config.zapi_client_token) {
      return NextResponse.json({ sucesso: false, error: "Configuração de envio indisponível", nao_enviado: true }, { status: 503 });
    }
    const telefoneNormalizado = normalizarTelefone(telefone);
    // Único uso direto legítimo já existente: teste fixo para o telefone
    // salvo do próprio negócio. Corpo arbitrário não substitui aprovação.
    if (!interno && (mensagem !== MENSAGEM_TESTE || !config.telefone || telefoneNormalizado !== normalizarTelefone(config.telefone))) {
      return NextResponse.json({ sucesso: false, error: "Use o fluxo de aprovação do envio", nao_enviado: true }, { status: 403 });
    }
    if (!await consentimentoEnvio(supabase, clinica_id, telefoneNormalizado)) {
      return NextResponse.json({ sucesso: false, error: "Envio bloqueado pelo consentimento ou sua indisponibilidade", nao_enviado: true }, { status: 409 });
    }
    const operacao = interno ? body.operacao : `teste:${new Date().toISOString().slice(0, 13)}`;
    if (typeof operacao !== "string" || !operacao || operacao.length > 500) {
      return NextResponse.json({ sucesso: false, error: "Operação de envio obrigatória", nao_enviado: true }, { status: 400 });
    }
    reserva = await reservarOperacao(supabase, clinica_id, `whatsapp:${operacao}`, JSON.stringify([telefoneNormalizado, mensagem]), true);
    if (!reserva) return NextResponse.json({ sucesso: false, error: "Operação já reservada ou indisponível; não repetir sem verificar resultado" }, { status: 409 });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(`https://api.z-api.io/instances/${config.zapi_instance}/token/${config.zapi_token}/send-text`, {
        method: "POST", headers: { "Content-Type": "application/json", "Client-Token": config.zapi_client_token },
        body: JSON.stringify({ phone: telefoneNormalizado, message: mensagem }), signal: controller.signal,
      });
    } finally { clearTimeout(timeout); }
    // Sem contrato comprovado do provider, resposta de erro/timeout não prova
    // ausência de efeito. Nunca liberar retry automático nesses casos.
    const estado = res.ok ? "sucesso" : "incerto";
    const persistido = await finalizarOperacao(supabase, reserva, estado);
    console.info("[whatsapp] resultado", { status: res.status, persistido });
    await supabase.from("whatsapp_logs").insert({ clinica_id, telefone: telefoneNormalizado,
      mensagem: "[conteúdo omitido]", status: res.ok ? "enviado" : "erro", resposta: { status: res.status, estado } });
    if (!persistido || !res.ok) return NextResponse.json({ sucesso: false, error: "Resultado exige verificação antes de nova tentativa" }, { status: 502 });
    return NextResponse.json({ sucesso: true, telefone: telefoneNormalizado });
  } catch {
    if (reserva) await finalizarOperacao(supabase, reserva, "incerto").catch(() => false);
    // Mantém diagnóstico persistido existente, sem copiar mensagem/erro externo.
    try {
      await supabase.from("whatsapp_logs").insert({ clinica_id: body?.clinica_id ?? null,
        telefone: body?.telefone ?? null, mensagem: "[conteúdo omitido]", status: "erro", resposta: { tipo: "excecao" } });
    } catch { /* diagnóstico não altera resultado */ }
    console.error("[whatsapp] falha operacional");
    return NextResponse.json({ sucesso: false, error: "Falha operacional; verifique o resultado antes de repetir" }, { status: 500 });
  }
}

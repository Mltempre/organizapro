import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { produtoOrganizaPro, consumirCotaIa } from "../../../lib/seguranca-operacoes";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Verifica sessão — impede uso não autenticado dos créditos OpenAI
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const { data: { user: authUser } } = await supabaseAnon.auth.getUser(token);
    if (!authUser) {
      return NextResponse.json({ error: "Sessão inválida ou expirada" }, { status: 401 });
    }

    const { data: vinculos, error: vinculoError } = await admin.from("clinica_usuarios")
      .select("clinica_id").eq("usuario_id", authUser.id).eq("ativo", true).limit(2);
    if (vinculoError || vinculos?.length !== 1 || !await produtoOrganizaPro(admin, vinculos[0].clinica_id)) {
      return NextResponse.json({ error: "Vínculo OrganizaPro obrigatório" }, { status: 403 });
    }
    const clinicaId = vinculos[0].clinica_id;
    let body: { prompt?: string; max_tokens?: number } = {};

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Body inválido — JSON malformado" }, { status: 400 });
    }

    if (!body || typeof body.prompt !== "string" || body.prompt.length > 20000 ||
      (body.max_tokens !== undefined && (!Number.isInteger(body.max_tokens) || body.max_tokens < 1 || body.max_tokens > 2000))) {
      return NextResponse.json({ error: "Entrada ou limite de tokens inválido" }, { status: 400 });
    }
    const prompt = body.prompt.trim();

    console.log("[/api/ia] prompt recebido:");

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY não configurada" }, { status: 500 });
    }

    if (!prompt) {
      console.error("[/api/ia] prompt vazio");
      return NextResponse.json({ error: "Prompt vazio" }, { status: 400 });
    }

    if (!await consumirCotaIa(admin, clinicaId, authUser.id, 20) || !await consumirCotaIa(admin, clinicaId, "tenant", 100)) {
      return NextResponse.json({ error: "Cota de IA indisponível nesta hora" }, { status: 429 });
    }
    const controller = new AbortController();
    const openaiTimeout = setTimeout(() => controller.abort(), 20_000);

    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Você é um especialista em marketing para pequenos e médios negócios. Crie conteúdos em português do Brasil, com linguagem persuasiva, profissional e pronta para Instagram.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: body.max_tokens || 700,
          temperature: 0.8,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(openaiTimeout);
    }

    const data = await res.json();

    if (!res.ok) {
      console.error("[/api/ia] Erro OpenAI:");
      return NextResponse.json(
        { error: "Erro no serviço de IA" },
        { status: res.status }
      );
    }

    const content = data.choices?.[0]?.message?.content || "";
    console.log("[/api/ia] resposta OK");

    return NextResponse.json({ content });

  } catch {

    console.error("[/api/ia] Exceção:");
    return NextResponse.json({ error: "Falha no serviço de IA" }, { status: 500 });
  }
}
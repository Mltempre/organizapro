import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    let body: { prompt?: string; max_tokens?: number } = {};

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Body inválido — JSON malformado" }, { status: 400 });
    }

    const prompt = (body.prompt || "").trim();

    console.log("[/api/ia] prompt recebido:", prompt.slice(0, 80));

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY não configurada" }, { status: 500 });
    }

    if (!prompt) {
      console.error("[/api/ia] prompt vazio. Body recebido:", body);
      return NextResponse.json({ error: "Prompt vazio" }, { status: 400 });
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
              content: "Você é um especialista em marketing para clínicas. Crie conteúdos em português do Brasil, com linguagem persuasiva, profissional e pronta para Instagram.",
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
      console.error("[/api/ia] Erro OpenAI:", data);
      return NextResponse.json(
        { error: data?.error?.message || "Erro na OpenAI" },
        { status: res.status }
      );
    }

    const content = data.choices?.[0]?.message?.content || "";
    console.log("[/api/ia] resposta OK, chars:", content.length);

    return NextResponse.json({ content });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[/api/ia] Exceção:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
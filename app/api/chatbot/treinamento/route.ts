import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/chatbot/treinamento?clinica_id=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clinica_id = searchParams.get("clinica_id");
  if (!clinica_id) {
    return NextResponse.json({ error: "clinica_id obrigatório" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("chatbot_treinamento")
    .select("id, pergunta, resposta, palavras_chave, ativo, created_at")
    .eq("clinica_id", clinica_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/chatbot/treinamento — criar
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clinica_id, pergunta, resposta, palavras_chave } = body as {
    clinica_id?: string;
    pergunta?: string;
    resposta?: string;
    palavras_chave?: string;
  };

  if (!clinica_id || !pergunta || !resposta) {
    return NextResponse.json(
      { error: "clinica_id, pergunta e resposta são obrigatórios" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("chatbot_treinamento")
    .insert({
      clinica_id,
      pergunta: pergunta.trim(),
      resposta: resposta.trim(),
      palavras_chave: (palavras_chave ?? "").trim(),
      ativo: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ sucesso: false, error: error.message }, { status: 500 });
  return NextResponse.json({ sucesso: true, data });
}

// PUT /api/chatbot/treinamento — editar
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, pergunta, resposta, palavras_chave, ativo } = body as {
    id?: string;
    pergunta?: string;
    resposta?: string;
    palavras_chave?: string;
    ativo?: boolean;
  };

  if (!id) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (pergunta      !== undefined) updates.pergunta       = pergunta.trim();
  if (resposta      !== undefined) updates.resposta       = resposta.trim();
  if (palavras_chave !== undefined) updates.palavras_chave = palavras_chave.trim();
  if (ativo         !== undefined) updates.ativo          = ativo;

  const { data, error } = await supabase
    .from("chatbot_treinamento")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ sucesso: false, error: error.message }, { status: 500 });
  return NextResponse.json({ sucesso: true, data });
}

// DELETE /api/chatbot/treinamento?id=...
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  const { error } = await supabase
    .from("chatbot_treinamento")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ sucesso: false, error: error.message }, { status: 500 });
  return NextResponse.json({ sucesso: true });
}

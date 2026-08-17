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

// Únicos campos que esta tela (app/site/page.tsx) tem permissão de
// atualizar em `clinicas`. Nunca repassar o body inteiro para o Supabase —
// qualquer chave fora desta lista é ignorada, nunca persistida.
const CAMPOS_PERMITIDOS = [
  "nome", "especialidade", "telefone", "whatsapp",
  "endereco", "cidade", "estado", "google_maps_url", "email",
] as const;

// Campos que o cliente NUNCA pode influenciar por este endpoint — se
// vierem no body, a requisição inteira é rejeitada (não apenas ignorada),
// para deixar explícito que foi uma tentativa de alterar algo fora do
// escopo desta tela, e não um esquecimento de payload.
const CAMPOS_PROIBIDOS = [
  "id", "clinica_id", "produto", "user_id", "usuario_id",
  "owner_id", "criado_em", "created_at",
];

function normalizarWhatsapp(valor: string): string {
  return valor.replace(/\D/g, "");
}

// Resolve o clinica_id do usuário autenticado — mesma autorização do PUT
// abaixo (sessão real → auth.uid() → vínculo ativo), fail-closed. Só
// devolve o id; nenhum campo de `clinicas` é exposto aqui (ver Sublote 2.5
// para as telas que precisam de mais que isso).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearer) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: { user } } = await supabaseAnon.auth.getUser(bearer);
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: vinculo, error: vinculoError } = await supabase
    .from("clinica_usuarios")
    .select("clinica_id")
    .eq("usuario_id", user.id)
    .eq("ativo", true)
    .maybeSingle();

  if (vinculoError) {
    console.error("[minha-clinica/GET] erro ao consultar vínculo:", vinculoError.message);
    return NextResponse.json({ error: "Não foi possível validar seu vínculo. Tente novamente." }, { status: 500 });
  }
  if (!vinculo?.clinica_id) {
    return NextResponse.json({ error: "Usuário não tem vínculo com nenhuma clínica" }, { status: 404 });
  }

  // Colunas explícitas, nunca SELECT * — mesma allowlist já homologada no
  // PUT, mais `produto` (só para a checagem abaixo, nunca devolvido no
  // JSON). Só telas que realmente precisam desses campos (Sublote 2.5)
  // chamam este GET esperando mais que clinica_id.
  const { data: clinica, error: clinicaError } = await supabase
    .from("clinicas")
    .select("produto, nome, especialidade, telefone, whatsapp, endereco, cidade, estado, google_maps_url, email")
    .eq("id", vinculo.clinica_id)
    .maybeSingle();

  if (clinicaError) {
    console.error("[minha-clinica/GET] erro ao consultar clinica:", clinicaError.message);
    return NextResponse.json({ error: "Não foi possível carregar os dados da clínica. Tente novamente." }, { status: 500 });
  }

  // 'organizapro' é literal — nunca lido do cliente. produto ausente (NULL)
  // ou diferente de 'organizapro' reprova com a mesma mensagem do caso
  // "sem vínculo", para não revelar o motivo exato a um chamador não autorizado.
  if (clinica?.produto !== "organizapro") {
    return NextResponse.json({ error: "Usuário não tem vínculo com nenhuma clínica" }, { status: 404 });
  }

  return NextResponse.json({
    clinica_id:      vinculo.clinica_id,
    nome:            clinica?.nome            ?? "",
    especialidade:   clinica?.especialidade   ?? "",
    telefone:        clinica?.telefone        ?? "",
    whatsapp:        clinica?.whatsapp        ?? "",
    endereco:        clinica?.endereco        ?? "",
    cidade:          clinica?.cidade          ?? "",
    estado:          clinica?.estado          ?? "",
    google_maps_url: clinica?.google_maps_url ?? "",
    email:           clinica?.email           ?? "",
  });
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!bearer) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { data: { user } } = await supabaseAnon.auth.getUser(bearer);
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // auth.uid() é a única fonte do vínculo — clinica_id nunca é lido do
    // body. Um eventual erro de consulta bloqueia (fail-closed), não
    // segue em frente com dado incompleto.
    const { data: vinculo, error: vinculoError } = await supabase
      .from("clinica_usuarios")
      .select("clinica_id")
      .eq("usuario_id", user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (vinculoError) {
      console.error("[minha-clinica/PUT] erro ao consultar vínculo:", vinculoError.message);
      return NextResponse.json({ error: "Não foi possível validar seu vínculo. Tente novamente." }, { status: 500 });
    }
    if (!vinculo?.clinica_id) {
      return NextResponse.json({ error: "Usuário não tem vínculo com nenhuma clínica" }, { status: 403 });
    }

    // 'organizapro' é literal — nunca lido do cliente. Mesma mensagem do
    // caso "sem vínculo" para produto ausente (NULL) ou diferente — antes
    // de ler o body ou escrever qualquer coisa.
    const { data: clinicaAtual } = await supabase
      .from("clinicas")
      .select("produto")
      .eq("id", vinculo.clinica_id)
      .maybeSingle();
    if (clinicaAtual?.produto !== "organizapro") {
      return NextResponse.json({ error: "Usuário não tem vínculo com nenhuma clínica" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
    }
    const bodyRecord = body as Record<string, unknown>;

    for (const campo of CAMPOS_PROIBIDOS) {
      if (campo in bodyRecord) {
        return NextResponse.json(
          { error: `Campo '${campo}' não pode ser alterado por este endpoint` },
          { status: 400 }
        );
      }
    }

    const payload: Record<string, string> = {};
    for (const campo of CAMPOS_PERMITIDOS) {
      const valor = bodyRecord[campo];
      if (valor !== undefined && typeof valor !== "string") {
        return NextResponse.json({ error: `Campo '${campo}' inválido` }, { status: 400 });
      }
      payload[campo] = typeof valor === "string" ? valor : "";
    }
    payload.whatsapp = normalizarWhatsapp(payload.whatsapp);

    // service_role só executa a escrita AQUI — depois de sessão validada,
    // vínculo confirmado e payload restrito à allowlist. id vem do
    // vínculo (servidor), nunca do body.
    const { error: updateError } = await supabase
      .from("clinicas")
      .upsert({ id: vinculo.clinica_id, ...payload }, { onConflict: "id" });

    if (updateError) {
      console.error("[minha-clinica/PUT] erro ao salvar:", updateError.message);
      return NextResponse.json({ error: "Não foi possível salvar os dados do negócio." }, { status: 500 });
    }

    return NextResponse.json({ sucesso: true, clinica_id: vinculo.clinica_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[minha-clinica/PUT] exceção:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

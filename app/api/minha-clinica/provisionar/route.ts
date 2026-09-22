// POST /api/minha-clinica/provisionar — P1.1: Fechar a Casa do OrganizaPro.
// Corrige a CAUSA RAIZ (não remendo de página) de "Negócio não vinculado
// ao usuário": até esta missão, zero código criava clinicas/
// clinica_usuarios — todo vínculo era 100% manual/externo. Esta rota é o
// único ponto de escrita self-service, sempre service-role (RLS de
// clinicas/clinica_usuarios não libera INSERT para authenticated — só
// SELECT do próprio vínculo — então nenhuma migration foi necessária
// para viabilizar isto).
//
// Fail-closed por construção (lib/onboarding-negocio.ts,
// decidirProvisionamento): um vínculo existente inativo ou de outro
// produto NUNCA é reaproveitado/reativado automaticamente — sempre
// bloqueia e pede suporte humano. Idempotente: chamar de novo com um
// vínculo organizapro já ativo apenas devolve o clinica_id existente,
// nunca cria um segundo negócio.
//
// Race conhecida e documentada (não uma migration necessária agora): dois
// cliques/abas simultâneos do MESMO usuário, ambos sem vínculo ainda,
// podem em teoria criar duas clinicas antes que a primeira termine de
// gravar — não há UNIQUE em clinica_usuarios.usuario_id hoje. Mitigado na
// prática pelo botão desabilitado no client após o primeiro clique. Ver
// sql/onboarding-clinica-usuarios-unique-ativo.sql — migration preparada
// e NÃO executada, aguardando GO explícito.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decidirProvisionamento } from "../../../../lib/onboarding-negocio";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearer) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: { user } } = await supabaseAnon.auth.getUser(bearer);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: { nome?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido — JSON malformado" }, { status: 400 });
  }

  // auth.uid() é a única fonte do vínculo — nunca lido do body. Relido do
  // banco (nunca confia em cache/estado do client) para decidir com o
  // dado real mais recente.
  const { data: vinculoRow, error: erroVinculo } = await admin
    .from("clinica_usuarios")
    .select("clinica_id, ativo")
    .eq("usuario_id", user.id)
    .maybeSingle();
  if (erroVinculo) {
    return NextResponse.json({ error: "Não foi possível validar seu vínculo. Tente novamente." }, { status: 500 });
  }

  let vinculo: Parameters<typeof decidirProvisionamento>[0] = null;
  if (vinculoRow) {
    const { data: clinicaExistente } = await admin
      .from("clinicas")
      .select("produto")
      .eq("id", vinculoRow.clinica_id)
      .maybeSingle();
    vinculo = { ativo: !!vinculoRow.ativo, produtoClinica: clinicaExistente?.produto ?? null };
  }

  const decisao = decidirProvisionamento(vinculo, body.nome);

  if (decisao.acao === "bloqueado") {
    return NextResponse.json({ error: decisao.motivo }, { status: 409 });
  }
  if (decisao.acao === "reaproveitar_existente") {
    return NextResponse.json({ sucesso: true, clinica_id: vinculoRow!.clinica_id });
  }

  // decisao.acao === "criar" — cria a clinica e o vínculo, nessa ordem;
  // se o vínculo falhar, desfaz a clinica órfã (compensação, nunca deixa
  // um negócio sem dono nenhum criado por acidente).
  const { data: novaClinica, error: erroClinica } = await admin
    .from("clinicas")
    .insert({ nome: body.nome!.trim(), produto: "organizapro" })
    .select("id")
    .single();
  if (erroClinica || !novaClinica) {
    return NextResponse.json({ error: "Não foi possível criar o negócio. Tente novamente." }, { status: 500 });
  }

  const { error: erroVinculoNovo } = await admin
    .from("clinica_usuarios")
    .insert({ clinica_id: novaClinica.id, usuario_id: user.id, papel: "dono", ativo: true });
  if (erroVinculoNovo) {
    await admin.from("clinicas").delete().eq("id", novaClinica.id);
    return NextResponse.json({ error: "Não foi possível vincular seu usuário ao negócio criado. Tente novamente." }, { status: 500 });
  }

  return NextResponse.json({ sucesso: true, clinica_id: novaClinica.id });
}

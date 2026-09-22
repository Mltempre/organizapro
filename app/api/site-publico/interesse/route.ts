import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizarTelefone, validarNovaOportunidade, type NovaOportunidade } from "../../../../lib/oportunidades-demanda";
import { logOperacao } from "../../../../lib/log-estruturado";

// ── Captura pública de interesse — E-commerce IA V1 ──────────────────────
//
// Fecha o gap real encontrado na auditoria: `canal: "site"` já existe no
// tipo/schema de `oportunidades_demanda` (lib/oportunidades-demanda.ts,
// app/oportunidades/page.tsx), mas nenhuma rota o produzia — só existia
// `POST /api/oportunidades` (autenticado, uso manual do lojista). Um
// visitante do site público que "demonstra interesse" ou "pede
// orçamento" (regra nº3 da missão) não tinha nenhum jeito de virar sinal
// comercial rastreável a não ser completando um pedido inteiro.
//
// Mesmo padrão de segurança já homologado em site-publico/pedidos: slug é
// a única entrada pública de tenant, produto é sempre o literal
// "organizapro", clinica_id nunca vem do corpo da requisição, e a chave de
// idempotência evita duplicar a mesma manifestação de interesse em
// duplo-clique/retry. Nenhuma tabela nova, nenhuma migration nova —
// reaproveita 100% de public.oportunidades_demanda (mesmo motor de
// validação puro de lib/oportunidades-demanda.ts usado pela rota
// autenticada).
//
// Nunca fabrica sinal por mera visita de página: só existe registro
// quando o visitante preenche e envia o formulário deliberadamente.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type DadosPublicos = { clinica_id: string };

// Confiança "media": o visitante é quem forneceu o contato diretamente,
// mas ainda sem qualquer verificação humana (isso é o que a rota
// autenticada registra manualmente como "alta"). Nunca "baixa" — não é
// uma inferência estatística, é uma ação real e deliberada da pessoa.
const CONFIANCA_INTERESSE_PUBLICO: NovaOportunidade["confianca_classificacao"] = "media";

// Janela padrão para o lojista fazer o primeiro contato antes de a
// oportunidade ser considerada expirada — mesma ordem de grandeza do
// limiar de "oportunidade_parada" (3 dias) com folga para o primeiro
// atendimento de um lead que chegou fora do horário comercial.
const DIAS_JANELA_CONTATO = 7;

function texto(valor: unknown, maximo: number): string | null {
  if (typeof valor !== "string") return null;
  const normalizado = valor.trim();
  return normalizado && normalizado.length <= maximo ? normalizado : null;
}

export async function POST(req: NextRequest) {
  let body: {
    slug?: unknown;
    nome?: unknown;
    telefone?: unknown;
    mensagem?: unknown;
    servico_nome?: unknown;
    idempotency_key?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sucesso: false, error: "Body inválido — JSON malformado" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ sucesso: false, error: "Body inválido" }, { status: 400 });
  }

  const slug = texto(body.slug, 120);
  const nome = body.nome === undefined ? null : texto(body.nome, 160);
  const telefone = texto(body.telefone, 40);
  const mensagem = body.mensagem === undefined ? null : texto(body.mensagem, 500);
  const servicoNome = body.servico_nome === undefined ? null : texto(body.servico_nome, 160);
  const idempotencyKey = texto(body.idempotency_key, 120);

  if (!slug || !telefone || !idempotencyKey) {
    return NextResponse.json({ sucesso: false, error: "slug, telefone e idempotency_key são obrigatórios" }, { status: 400 });
  }
  if (body.nome !== undefined && body.nome !== null && nome === null) {
    return NextResponse.json({ sucesso: false, error: "nome inválido" }, { status: 400 });
  }
  if (body.mensagem !== undefined && body.mensagem !== null && mensagem === null) {
    return NextResponse.json({ sucesso: false, error: "mensagem inválida" }, { status: 400 });
  }
  if (normalizarTelefone(telefone).length < 8) {
    return NextResponse.json({ sucesso: false, error: "telefone inválido" }, { status: 400 });
  }

  // O slug é a única entrada pública de tenant. O produto é literal e o
  // clinica_id nunca vem do navegador (mesmo padrão de site-publico/pedidos).
  const { data: empresa, error: erroEmpresa } = await admin
    .rpc("site_publico_por_slug_v2", { p_slug: slug, p_produto: "organizapro" })
    .maybeSingle<DadosPublicos>();
  if (erroEmpresa || !empresa?.clinica_id) {
    return NextResponse.json({ sucesso: false, error: "Empresa não encontrada" }, { status: 404 });
  }
  const clinicaId = empresa.clinica_id;
  const chaveIdempotencia = `interesse-publico:${idempotencyKey}`;

  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + DIAS_JANELA_CONTATO * 86_400_000).toISOString();

  const novaOportunidade: NovaOportunidade = {
    canal: "site",
    identificador_canal: servicoNome ? `servico:${servicoNome}` : null,
    telefone,
    nome_informado: nome,
    confianca_classificacao: CONFIANCA_INTERESSE_PUBLICO,
    evidencia_bruta: mensagem,
    contexto_classificacao: { origem: "site_publico", servico_nome: servicoNome },
    expira_em: expiraEm,
    chave_idempotencia: chaveIdempotencia,
  };
  const erroValidacao = validarNovaOportunidade(novaOportunidade);
  if (erroValidacao) return NextResponse.json({ sucesso: false, error: erroValidacao }, { status: 400 });

  const { data: oportunidade, error } = await admin
    .from("oportunidades_demanda")
    .upsert({
      clinica_id: clinicaId,
      canal: novaOportunidade.canal,
      identificador_canal: novaOportunidade.identificador_canal,
      telefone: novaOportunidade.telefone,
      telefone_normalizado: normalizarTelefone(novaOportunidade.telefone),
      nome_informado: novaOportunidade.nome_informado,
      confianca_classificacao: novaOportunidade.confianca_classificacao,
      evidencia_bruta: novaOportunidade.evidencia_bruta,
      contexto_classificacao: novaOportunidade.contexto_classificacao,
      expira_em: novaOportunidade.expira_em,
      chave_idempotencia: novaOportunidade.chave_idempotencia,
      criado_por: null, // visitante público — nunca um usuário autenticado do painel
    }, { onConflict: "clinica_id,chave_idempotencia" })
    .select("id")
    .single();

  if (error || !oportunidade) {
    logOperacao({ operacao: "interesse.publico.criar", clinica_id: clinicaId, resultado: "erro", motivo: error?.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível registrar seu interesse agora." }, { status: 500 });
  }

  logOperacao({ operacao: "interesse.publico.criar", clinica_id: clinicaId, entidade_id: oportunidade.id, resultado: "sucesso" });
  return NextResponse.json({ sucesso: true, id: oportunidade.id }, { status: 201 });
}

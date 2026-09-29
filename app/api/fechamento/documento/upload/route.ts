// Contador IA — Fechamento Inteligente V1.
// POST /api/fechamento/documento/upload — recebe o arquivo real de um
// cliente para uma competência, classifica pelo nome (lib/fechamento-
// identificacao.ts — sem OCR/visão, nunca finge reconhecimento de
// conteúdo) e, só quando a confiança é ALTA, dá baixa automática na
// pendência correspondente. Confiança insuficiente ou divergência de
// competência -> REVISÃO NECESSÁRIA (nunca baixa automática duvidosa).
//
// Storage: bucket PRIVADO próprio ("fechamento-documentos"), nunca o
// bucket público de assets de site (app/api/upload/route.ts) — documento
// contábil nunca pode ter URL pública adivinhável. Mesmo padrão de criação
// de bucket sob demanda já usado ali (storage.createBucket, idempotente).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autorizarUsuarioNaClinica } from "../../../../../lib/auth-clinica";
import { logOperacao } from "../../../../../lib/log-estruturado";
import {
  competenciaValida, nomesEfetivos,
  type TipoDocumentoConfig, type ExcecaoClienteConfig,
} from "../../../../../lib/fechamento-contabil";
import { classificarArquivo } from "../../../../../lib/fechamento-identificacao";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "fechamento-documentos";
const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10MB — documento contábil real (PDF/foto), nunca vídeo
const MIME_PERMITIDO = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const EXT_PERMITIDA = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const clinica_id = formData.get("clinica_id") as string | null;
  const cliente_id = formData.get("cliente_id") as string | null;
  const competencia = formData.get("competencia") as string | null;

  if (!file || !clinica_id || !cliente_id || !competencia) {
    return NextResponse.json({ sucesso: false, error: "file, clinica_id, cliente_id e competencia são obrigatórios" }, { status: 400 });
  }
  if (!competenciaValida(competencia)) {
    return NextResponse.json({ sucesso: false, error: "competencia deve estar no formato AAAA-MM" }, { status: 400 });
  }

  const autorizacao = await autorizarUsuarioNaClinica(req, clinica_id);
  if (!autorizacao.ok) {
    logOperacao({ operacao: "fechamento.arquivo.upload", clinica_id, entidade_id: cliente_id, resultado: "rejeitado", motivo: autorizacao.error });
    return NextResponse.json({ sucesso: false, error: autorizacao.error }, { status: autorizacao.status });
  }

  const { data: cliente } = await admin.from("pacientes").select("id, nome").eq("id", cliente_id).eq("clinica_id", clinica_id).maybeSingle();
  if (!cliente) {
    logOperacao({ operacao: "fechamento.arquivo.upload", clinica_id, entidade_id: cliente_id, resultado: "rejeitado", motivo: "cliente nao pertence a esta clinica" });
    return NextResponse.json({ sucesso: false, error: "Cliente não encontrado nesta clínica" }, { status: 404 });
  }

  if (file.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ sucesso: false, error: "Arquivo muito grande. Máximo 10MB." }, { status: 400 });
  }
  const ext = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!EXT_PERMITIDA.has(ext) || !MIME_PERMITIDO.has(file.type)) {
    return NextResponse.json({ sucesso: false, error: "Tipo de arquivo não permitido. Use PDF, JPG, PNG ou WEBP." }, { status: 400 });
  }

  const [{ data: tiposRows }, { data: excecoesRows }] = await Promise.all([
    admin.from("fechamento_tipos_documento").select("nome, obrigatorio, ativo").eq("clinica_id", clinica_id),
    admin.from("fechamento_excecoes_cliente").select("cliente_id, tipo_documento, incluido").eq("clinica_id", clinica_id).eq("cliente_id", cliente_id),
  ]);
  const tipos: TipoDocumentoConfig[] = (tiposRows ?? []).map((t) => ({ nome: t.nome, obrigatorio: t.obrigatorio, ativo: t.ativo }));
  const excecoes: ExcecaoClienteConfig[] = (excecoesRows ?? []).map((e) => ({ clienteId: e.cliente_id, tipoDocumento: e.tipo_documento, incluido: e.incluido }));
  const tiposConhecidos = nomesEfetivos(cliente_id, tipos, excecoes);

  const classificacao = classificarArquivo({ nomeArquivo: file.name, competenciaAlvo: competencia }, tiposConhecidos);

  const agora = new Date().toISOString();
  const path = `${clinica_id}/${cliente_id}/${competencia}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: TAMANHO_MAXIMO }).catch(() => null);
  const bytes = await file.arrayBuffer();
  const { error: erroUpload } = await admin.storage.from(BUCKET).upload(path, Buffer.from(bytes), { contentType: file.type });
  if (erroUpload) {
    logOperacao({ operacao: "fechamento.arquivo.upload", clinica_id, entidade_id: cliente_id, resultado: "erro", motivo: erroUpload.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível enviar o arquivo" }, { status: 500 });
  }

  const autoConfirmado = classificacao.confianca === "alta" && !classificacao.necessitaRevisao && !!classificacao.tipoDocumentoSugerido;
  const { data: arquivo, error: erroArquivo } = await admin
    .from("fechamento_arquivos")
    .insert({
      clinica_id, cliente_id, competencia,
      nome_original: file.name, storage_path: path,
      tamanho_bytes: file.size, mime_type: file.type,
      tipo_documento_sugerido: classificacao.tipoDocumentoSugerido,
      confianca: classificacao.confianca,
      classificacao_status: autoConfirmado ? "auto_confirmado" : "pendente_confirmacao",
      motivo_classificacao: classificacao.motivo,
      tipo_documento_final: autoConfirmado ? classificacao.tipoDocumentoSugerido : null,
      enviado_por: autorizacao.userId,
    })
    .select()
    .single();

  if (erroArquivo || !arquivo) {
    await admin.storage.from(BUCKET).remove([path]);
    logOperacao({ operacao: "fechamento.arquivo.upload", clinica_id, entidade_id: cliente_id, resultado: "erro", motivo: erroArquivo?.message });
    return NextResponse.json({ sucesso: false, error: "Não foi possível registrar o arquivo" }, { status: 500 });
  }

  // Só quando a identificação teve confiança alta e apontou um tipo real
  // conhecido, o item do checklist já nasce RESOLVIDO — nunca com um tipo
  // inventado (classificarArquivo nunca retorna um tipo fora de tiposConhecidos).
  // Quando um tipo foi sugerido mas a confiança não é suficiente, o item
  // vira REVISÃO NECESSÁRIA (nunca fica "pendente" silenciosamente enquanto
  // um arquivo real já chegou para ele).
  if (classificacao.tipoDocumentoSugerido) {
    const { error: erroDocumento } = await admin.from("fechamento_documentos").upsert(
      {
        clinica_id, cliente_id, competencia,
        tipo_documento: classificacao.tipoDocumentoSugerido,
        status: autoConfirmado ? "recebido" : "revisao_necessaria",
        recebido_em: autoConfirmado ? agora : null,
        arquivo_id: arquivo.id,
        atualizado_por: autorizacao.userId,
      },
      { onConflict: "clinica_id,cliente_id,competencia,tipo_documento" }
    );
    if (erroDocumento) {
      logOperacao({ operacao: "fechamento.documento.atualizar", clinica_id, entidade_id: cliente_id, resultado: "erro", motivo: erroDocumento.message });
    }
  }

  const { error: erroEvento } = await admin.from("eventos_dominio").insert({
    clinica_id, tipo: "fechamento.arquivo_recebido", entidade_tipo: "cliente", entidade_id: cliente_id,
    chave_idempotencia: `${cliente_id}:fechamento.arquivo_recebido:${arquivo.id}`,
    payload: { competencia, nome_original: file.name, classificacao_status: arquivo.classificacao_status, tipo_documento_sugerido: classificacao.tipoDocumentoSugerido },
    criado_em: agora,
  });
  if (erroEvento && !/duplicate|unique/i.test(erroEvento.message ?? "")) {
    logOperacao({ operacao: "fechamento.arquivo_recebido", clinica_id, entidade_id: cliente_id, resultado: "erro", motivo: `evidencia nao gravada: ${erroEvento.message}` });
  }

  logOperacao({ operacao: "fechamento.arquivo.upload", clinica_id, entidade_id: cliente_id, resultado: "sucesso", motivo: `${arquivo.classificacao_status} (${classificacao.confianca})` });
  return NextResponse.json({ sucesso: true, arquivo, classificacao });
}

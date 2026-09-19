import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";
import SiteEmpresaClient from "./SiteEmpresaClient";
import { normalizarEspecialidade } from "./_lib/helpers";
import { capturarOrigem, classificarOrigem, gerarCodigoOrigem } from "../../../lib/atribuicao-origem";
import { persistirOrigemCaptada } from "../../../lib/origem-persistencia";

// Fase 1.1 (hardening) — client de service_role, só para a escrita de
// origem_captacoes. Mesmo padrão canônico já usado em app/r/[codigo]/route.ts
// e em toda a família app/api/*/route.ts deste projeto: uma rota/página
// pública (sem sessão de usuário) que precisa gravar um fato do lado do
// servidor usa service_role, nunca pede uma policy de INSERT para `anon`.
// Isso elimina por completo a superfície de ataque anterior: com
// service_role, não existe (e não pode existir) nenhuma policy de RLS que
// permita a um cliente HTTP arbitrário, de posse só da chave pública
// anon, inserir em origem_captacoes sob o clinica_id de outro tenant —
// porque `anon` nunca tem privilégio nenhum na tabela (nem SELECT, nem
// INSERT). O único caminho de escrita passa a ser este código, rodando no
// servidor, com clinica_id resolvido por buscarResumoEmpresa(slug) — nunca
// um valor que o navegador possa escolher.
const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ResumoEmpresa = {
  clinica_id?: string;
  nome?: string;
  especialidade?: string;
  cidade?: string;
  estado?: string;
  logo_url?: string;
  hero_url?: string;
  banner_url?: string | null;
  seo_titulo?: string | null;
  seo_descricao?: string | null;
  seo_imagem_url?: string | null;
};

// Busca mínima só para metadata (título/descrição/OG/Twitter) — a página em
// si (SiteEmpresaClient) carrega os dados completos separadamente no
// cliente. seo_titulo/seo_descricao/seo_imagem_url, quando preenchidos pelo
// cliente no painel, têm prioridade sobre os valores gerados automaticamente.
//
// p_produto é sempre o literal 'organizapro' — nunca lido de query string,
// body ou qualquer input do cliente. site_publico_por_slug_v2 já filtra por
// produto internamente; slug de outro produto ou clinicas.produto IS NULL
// devolvem 0 linhas por design (ver sql/isolamento-produto-clinicas-clinica-usuarios.sql).
async function buscarResumoEmpresa(slug: string): Promise<ResumoEmpresa | null> {
  const { data } = await supabase
    .rpc("site_publico_por_slug_v2", { p_slug: slug, p_produto: "organizapro" })
    .maybeSingle<ResumoEmpresa>();
  if (!data?.nome) return null;

  return {
    clinica_id: data.clinica_id,
    nome: data.nome,
    especialidade: data.especialidade,
    cidade: data.cidade,
    estado: data.estado,
    logo_url: data.logo_url,
    hero_url: data.hero_url,
    banner_url: data.banner_url,
    seo_titulo: data.seo_titulo,
    seo_descricao: data.seo_descricao,
    seo_imagem_url: data.seo_imagem_url,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const resumo = await buscarResumoEmpresa(slug);

  if (!resumo) {
    return { title: "Site não encontrado | OrganizaPro" };
  }

  const local = [resumo.cidade, resumo.estado].filter(Boolean).join(", ");
  const especialidade = normalizarEspecialidade(resumo.especialidade);
  const descricaoAuto = [especialidade, local].filter(Boolean).join(" · ") || `Conheça ${resumo.nome}.`;
  const tituloAuto = especialidade ? `${resumo.nome} — ${especialidade}` : resumo.nome!;

  const titulo = resumo.seo_titulo?.trim() || tituloAuto;
  const descricao = resumo.seo_descricao?.trim() || descricaoAuto;
  const imagem = resumo.seo_imagem_url || resumo.hero_url || resumo.banner_url || resumo.logo_url;

  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      type: "website",
      images: imagem ? [{ url: imagem }] : undefined,
    },
    twitter: {
      card: imagem ? "summary_large_image" : "summary",
      title: titulo,
      description: descricao,
      images: imagem ? [imagem] : undefined,
    },
  };
}

// Payload não confiável (query string é a área mais fácil de manipular de
// toda a requisição): cada campo capturado é limitado a um tamanho
// razoável antes de persistir. Isto é validação de armazenamento, não de
// negócio — por isso vive aqui, não em capturarOrigem/classificarOrigem
// (que continuam puras e sem opinião sobre limite de tamanho).
const TAMANHO_MAXIMO_CAMPO = 300;

function limitarTamanho(v: string | null): string | null {
  return v === null ? null : v.slice(0, TAMANHO_MAXIMO_CAMPO);
}

// Fase 1 (Origem Real) — captura best-effort na entrada pública do site.
// NUNCA bloqueia nem atrasa a renderização: qualquer falha (RPC, tabela
// ainda não migrada, header ausente) é engolida aqui, nunca propagada para
// o visitante. Sem clinica_id resolvido (slug inválido — a própria página
// já mostra "não encontrado" via SiteEmpresaClient), não há origem para
// persistir, então a captura é pulada por completo. A escrita usa
// service_role (ver supabaseServiceRole acima) — nunca o client anônimo.
async function capturarEPersistirOrigem(
  clinicaId: string,
  searchParams: Record<string, string | string[] | undefined>
): Promise<string | undefined> {
  try {
    const referer = (await headers()).get("referer");
    const origem = capturarOrigem(searchParams, referer, new Date().toISOString());
    const classificacao = classificarOrigem(origem);
    const codigoRastreio = gerarCodigoOrigem();

    await persistirOrigemCaptada(supabaseServiceRole, {
      clinicaId,
      utmSource:      limitarTamanho(origem.utmSource),
      utmMedium:      limitarTamanho(origem.utmMedium),
      utmCampaign:    limitarTamanho(origem.utmCampaign),
      utmContent:     limitarTamanho(origem.utmContent),
      gclid:          limitarTamanho(origem.gclid),
      fbclid:         limitarTamanho(origem.fbclid),
      referrerHost:   limitarTamanho(origem.referrerHost),
      classificacao,
      codigoRastreio,
      capturadoEm:    origem.capturadoEm,
    });

    return codigoRastreio;
  } catch (e) {
    console.warn("[origem] captura na entrada do site falhou, seguindo sem código de rastreio:", e instanceof Error ? e.message : e);
    return undefined;
  }
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;

  const resumo = await buscarResumoEmpresa(slug);
  const codigoRastreio = resumo?.clinica_id
    ? await capturarEPersistirOrigem(resumo.clinica_id, sp)
    : undefined;

  return <SiteEmpresaClient slug={slug} codigoRastreio={codigoRastreio} />;
}

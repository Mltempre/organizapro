import type { Metadata, Viewport } from "next";
import { supabase } from "../../../lib/supabase";
import SiteEmpresaClient from "./SiteEmpresaClient";
import { normalizarEspecialidade } from "./_lib/helpers";

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

type Props = { params: Promise<{ slug: string }> };

type ResumoEmpresa = {
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

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <SiteEmpresaClient slug={slug} />;
}

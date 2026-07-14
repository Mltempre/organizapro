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
async function buscarResumoEmpresa(slug: string): Promise<ResumoEmpresa | null> {
  const { data: config } = await supabase
    .from("clinica_config_publica")
    .select("clinica_id, logo_url, hero_url, banner_url, seo_titulo, seo_descricao, seo_imagem_url")
    .eq("slug", slug)
    .maybeSingle();
  if (!config?.clinica_id) return null;

  const { data: empresa } = await supabase
    .from("clinicas")
    .select("nome, especialidade, cidade, estado")
    .eq("id", config.clinica_id)
    .maybeSingle();
  if (!empresa?.nome) return null;

  return {
    ...empresa,
    logo_url: config.logo_url,
    hero_url: config.hero_url,
    banner_url: config.banner_url,
    seo_titulo: config.seo_titulo,
    seo_descricao: config.seo_descricao,
    seo_imagem_url: config.seo_imagem_url,
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

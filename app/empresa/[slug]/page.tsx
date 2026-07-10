import type { Metadata, Viewport } from "next";
import { supabase } from "../../../lib/supabase";
import SiteEmpresaClient from "./SiteEmpresaClient";

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

type Props = { params: Promise<{ slug: string }> };

type ResumoEmpresa = {
  nome?: string;
  especialidade?: string;
  cidade?: string;
  estado?: string;
  logo_url?: string;
  hero_url?: string;
};

// Busca mínima só para metadata (título/descrição/OG) — a página em si
// (SiteEmpresaClient) carrega os dados completos separadamente no cliente.
async function buscarResumoEmpresa(slug: string): Promise<ResumoEmpresa | null> {
  const { data: config } = await supabase
    .from("clinica_config")
    .select("clinica_id, logo_url, hero_url")
    .eq("slug", slug)
    .maybeSingle();
  if (!config?.clinica_id) return null;

  const { data: empresa } = await supabase
    .from("clinicas")
    .select("nome, especialidade, cidade, estado")
    .eq("id", config.clinica_id)
    .maybeSingle();
  if (!empresa?.nome) return null;

  return { ...empresa, logo_url: config.logo_url, hero_url: config.hero_url };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const resumo = await buscarResumoEmpresa(slug);

  if (!resumo) {
    return { title: "Site não encontrado | OrganizaPro" };
  }

  const local = [resumo.cidade, resumo.estado].filter(Boolean).join(", ");
  const descricao = [resumo.especialidade, local].filter(Boolean).join(" · ") || `Conheça ${resumo.nome}.`;
  const titulo = resumo.especialidade ? `${resumo.nome} — ${resumo.especialidade}` : resumo.nome!;
  const imagem = resumo.hero_url || resumo.logo_url;

  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      type: "website",
      images: imagem ? [{ url: imagem }] : undefined,
    },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <SiteEmpresaClient slug={slug} />;
}

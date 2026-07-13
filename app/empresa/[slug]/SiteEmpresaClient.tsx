"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import Header from "./_components/Header";
import Hero from "./_components/Hero";
import Banner from "./_components/Banner";
import Sobre from "./_components/Sobre";
import Servicos from "./_components/Servicos";
import Diferenciais from "./_components/Diferenciais";
import Processo from "./_components/Processo";
import Galeria from "./_components/Galeria";
import Equipe from "./_components/Equipe";
import Depoimentos from "./_components/Depoimentos";
import Faq from "./_components/Faq";
import Contato from "./_components/Contato";
import CtaFinal from "./_components/CtaFinal";
import Footer from "./_components/Footer";
import { IcWa } from "./_components/icons";
import { gerarSobre, gerarTituloHero, gerarSubtituloHero, safeData } from "./_lib/helpers";
import { color, font, gradient, shadow } from "./_lib/theme";
import type { Empresa, DBGaleria, DBEquipe, DBDepoimento, DBServico, DBEstrutura, DBFaq } from "./_lib/types";

// ── Site Institucional Universal — OrganizaPro ──────────────────────────────
//
// Este arquivo é só o orquestrador: busca os dados reais no Supabase e
// distribui para os componentes de _components/. Nenhuma seção mostra dado
// específico inventado (nome, fotos, depoimentos, avaliações sempre vêm do
// banco). Seções sem fonte própria (Diferenciais, Processo, FAQ, e os
// fallbacks de Serviços/Galeria) usam copy institucional universal — nunca
// um fato específico sobre esta empresa.

export default function SiteEmpresaClient({ slug }: { slug: string }) {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [galeria, setGaleria] = useState<DBGaleria[]>([]);
  const [equipe, setEquipe] = useState<DBEquipe[]>([]);
  const [depoimentos, setDepoimentos] = useState<DBDepoimento[]>([]);
  const [servicos, setServicos] = useState<DBServico[]>([]);
  const [estrutura, setEstrutura] = useState<DBEstrutura[]>([]);
  const [faqs, setFaqs] = useState<DBFaq[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    async function carregar() {
      type ConfigRow = {
        clinica_id: string; logo_url?: string; hero_url?: string; banner_url?: string | null;
        nota_google?: number | null; num_avaliacoes?: number | null; horario_funcionamento?: string | null;
        instagram_url?: string | null; facebook_url?: string | null; linkedin_url?: string | null; tiktok_url?: string | null;
        seo_titulo?: string | null; seo_descricao?: string | null; seo_imagem_url?: string | null;
      };
      let config: ConfigRow | null = null;
      // Lê da view pública clinica_config_publica — a tabela base
      // clinica_config não aceita mais leitura anônima (ver migração
      // 20260713000002_fix_clinica_config_rls.sql), só as 14 colunas
      // necessárias para o site institucional ficam expostas aqui.
      const { data: cfgFull, error: cfgErr } = await supabase
        .from("clinica_config_publica")
        .select("clinica_id, logo_url, hero_url, banner_url, nota_google, num_avaliacoes, horario_funcionamento, instagram_url, facebook_url, linkedin_url, tiktok_url, seo_titulo, seo_descricao, seo_imagem_url")
        .eq("slug", slug)
        .maybeSingle();

      if (cfgErr?.code === "42703") {
        const { data: cfgBasic } = await supabase.from("clinica_config_publica").select("clinica_id, logo_url").eq("slug", slug).maybeSingle();
        config = cfgBasic ? { clinica_id: cfgBasic.clinica_id, logo_url: cfgBasic.logo_url } : null;
      } else if (!cfgErr) {
        config = cfgFull;
      }

      if (!config?.clinica_id) { setEmpresa(null); setLoading(false); return; }
      const cid = config.clinica_id;

      const [empresaRes, galeriaRes, equipeRes, depRes, srvRes, estRes, faqRes] = await Promise.all([
        supabase.from("clinicas").select("*").eq("id", cid).maybeSingle(),
        supabase.from("clinica_galeria").select("*").eq("clinica_id", cid).order("ordem"),
        supabase.from("clinica_equipe").select("*").eq("clinica_id", cid).order("ordem"),
        supabase.from("clinica_depoimentos").select("*").eq("clinica_id", cid).order("ordem"),
        supabase.from("clinica_servicos").select("*").eq("clinica_id", cid).order("ordem"),
        supabase.from("clinica_estrutura").select("*").eq("clinica_id", cid).order("ordem"),
        supabase.from("clinica_faq").select("*").eq("clinica_id", cid).order("ordem"),
      ]);

      setEmpresa({
        ...(empresaRes.data ?? {}),
        logo_url: config.logo_url ?? undefined,
        hero_url: config.hero_url ?? undefined,
        banner_url: config.banner_url ?? null,
        nota_google: config.nota_google ?? null,
        num_avaliacoes: config.num_avaliacoes ?? null,
        horario_funcionamento: config.horario_funcionamento ?? null,
        instagram_url: config.instagram_url ?? null,
        facebook_url: config.facebook_url ?? null,
        linkedin_url: config.linkedin_url ?? null,
        tiktok_url: config.tiktok_url ?? null,
        seo_titulo: config.seo_titulo ?? null,
        seo_descricao: config.seo_descricao ?? null,
        seo_imagem_url: config.seo_imagem_url ?? null,
      });
      setGaleria(safeData(galeriaRes as { data: DBGaleria[] | null; error: { code?: string } | null }));
      setEquipe(safeData(equipeRes as { data: DBEquipe[] | null; error: { code?: string } | null }));
      setDepoimentos(safeData(depRes as { data: DBDepoimento[] | null; error: { code?: string } | null }));
      setServicos(safeData(srvRes as { data: DBServico[] | null; error: { code?: string } | null }));
      setEstrutura(safeData(estRes as { data: DBEstrutura[] | null; error: { code?: string } | null }));
      setFaqs(safeData(faqRes as { data: DBFaq[] | null; error: { code?: string } | null }));
      setLoading(false);
    }
    carregar();
  }, [slug]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif", background: "#FAF7F2" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #E8E1D4", borderTop: "3px solid #B8863D", borderRadius: "50%", margin: "0 auto 14px", animation: "spin 0.8s linear infinite" }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ color: "#6B6459", fontSize: 14, margin: 0 }}>Carregando...</p>
      </div>
    </div>
  );

  if (!empresa) return (
    <div style={{ minHeight: "100vh", background: "#FAF7F2", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 520, textAlign: "center", background: "#ffffff", borderRadius: 20, padding: "40px 32px", border: "1px solid #E8E1D4" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>:(</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 16px", color: "#14110D" }}>Página não encontrada</h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "#6B6459", margin: 0 }}>Não existe um site cadastrado com esse endereço.</p>
      </div>
    </div>
  );

  const whatsappNumber = empresa.whatsapp?.replace(/\D/g, "");
  const waLink = whatsappNumber ? "https://wa.me/" + whatsappNumber + "?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais." : "#";
  const nome = empresa.nome || "Nosso negócio";
  const esp = empresa.especialidade || "";
  const local = [empresa.cidade, empresa.estado].filter(Boolean).join(", ");
  const sobre = gerarSobre(empresa, equipe.length);
  const titulo = gerarTituloHero(empresa);
  const subtitulo = gerarSubtituloHero(empresa, local);

  return (
    <div style={{ fontFamily: font.family, background: color.ink, color: color.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box}body{margin:0}
        html{scroll-behavior:smooth}
        h1,h2,h3{text-wrap:balance;font-family:${font.family}}
        #sobre,#servicos,#depoimentos,#contato{scroll-margin-top:76px}

        .nav-link-item{transition:opacity .18s}
        .nav-link-item:hover{opacity:1!important}
        .servico-card:hover{border-color:${color.accentBorder}!important;transform:translateY(-3px);background:${color.surfaceHover}!important}
        .dif-card:hover{background:rgba(255,255,255,0.06)!important;border-color:rgba(255,255,255,0.22)!important;transform:translateY(-2px)}
        .dep-card:hover{border-color:${color.accentBorder}!important;transform:translateY(-3px)}
        .galeria-item:hover img{transform:scale(1.06)}
        .btn-hero-glow{animation:ctaGlow 2.6s ease-in-out infinite}
        @keyframes ctaGlow{0%,100%{box-shadow:${shadow.ctaGlow}}50%{box-shadow:${shadow.ctaGlowHover}}}
        .live-dot-hero{animation:pulseDot 1.6s ease-in-out infinite}
        @keyframes pulseDot{0%,100%{opacity:1}50%{opacity:0.35}}

        @media(max-width:1024px){
          .three-col{grid-template-columns:repeat(2,1fr)!important}
          .dif-grid{grid-template-columns:repeat(2,1fr)!important}
          .four-col{grid-template-columns:repeat(2,1fr)!important}
        }
        @media(max-width:900px){
          .nav-links{display:none!important}
          .nav-burger{display:flex!important}
          .hero-grid{grid-template-columns:1fr!important;padding-top:116px!important;gap:40px!important}
          .hero-visual{order:-1;aspect-ratio:16/9!important;max-height:320px}
          .hero-visual-panel{aspect-ratio:auto!important;max-height:none!important}
          .sobre-grid{grid-template-columns:1fr!important}
          .sobre-grid > div:last-child{aspect-ratio:16/9!important;order:-1}
        }
        @media(max-width:768px){
          .hero-ctas{flex-direction:column!important;align-items:stretch!important}
          .two-col{grid-template-columns:1fr!important;gap:16px!important}
          .processo-grid{grid-template-columns:1fr!important;gap:32px!important}
          .processo-line{display:none!important}
          .galeria-grid{grid-template-columns:1fr 1fr!important}
          .footer-cols{flex-direction:column!important;gap:24px!important}
        }
        @media(max-width:560px){
          .three-col{grid-template-columns:1fr!important}
          .dif-grid{grid-template-columns:1fr!important}
          .four-col{grid-template-columns:1fr!important}
          .galeria-grid{grid-template-columns:1fr!important}
          .galeria-grid > div{grid-row:auto!important}
        }
      `}</style>

      <Header nome={nome} logoUrl={empresa.logo_url} waLink={waLink} whatsappNumber={whatsappNumber}/>
      <Hero empresa={empresa} esp={esp} local={local} titulo={titulo} subtitulo={subtitulo} waLink={waLink} whatsappNumber={whatsappNumber}/>
      <Banner bannerUrl={empresa.banner_url} nome={nome}/>
      <Sobre empresa={empresa} nome={nome} sobre={sobre}/>
      <Servicos servicos={servicos} empresa={empresa}/>
      <Diferenciais/>
      <Processo/>
      <Galeria galeria={galeria} estrutura={estrutura} empresa={empresa}/>
      <Equipe equipe={equipe}/>
      <Depoimentos depoimentos={depoimentos}/>
      <Faq faqs={faqs}/>
      <Contato empresa={empresa} waLink={waLink} whatsappNumber={whatsappNumber}/>
      <CtaFinal empresa={empresa} waLink={waLink} whatsappNumber={whatsappNumber}/>

      {whatsappNumber && (
        <a href={waLink} target="_blank" rel="noreferrer" title="Falar no WhatsApp"
          style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, width: 56, height: 56, borderRadius: "50%", background: gradient, color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: shadow.ctaGlow, textDecoration: "none", transition: "transform 0.2s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.08)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = ""; }}>
          <IcWa/>
        </a>
      )}

      <Footer empresa={empresa} nome={nome} esp={esp} waLink={waLink} whatsappNumber={whatsappNumber}/>
    </div>
  );
}

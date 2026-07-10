"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import Header from "./_components/Header";
import Hero from "./_components/Hero";
import Credibilidade from "./_components/Credibilidade";
import Sobre from "./_components/Sobre";
import Servicos from "./_components/Servicos";
import Diferenciais from "./_components/Diferenciais";
import Processo from "./_components/Processo";
import Galeria from "./_components/Galeria";
import Depoimentos from "./_components/Depoimentos";
import Faq from "./_components/Faq";
import Contato from "./_components/Contato";
import CtaFinal from "./_components/CtaFinal";
import Footer from "./_components/Footer";
import { IcWa } from "./_components/icons";
import { gerarSobre, gerarTituloHero, gerarSubtituloHero, safeData } from "./_lib/helpers";
import type { Empresa, DBGaleria, DBEquipe, DBDepoimento, DBServico, DBEstrutura } from "./_lib/types";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    async function carregar() {
      let config: { clinica_id: string; logo_url?: string; hero_url?: string; nota_google?: number | null; num_avaliacoes?: number | null; horario_funcionamento?: string | null } | null = null;
      const { data: cfgFull, error: cfgErr } = await supabase
        .from("clinica_config")
        .select("clinica_id, logo_url, hero_url, nota_google, num_avaliacoes, horario_funcionamento")
        .eq("slug", slug)
        .maybeSingle();

      if (cfgErr?.code === "42703") {
        const { data: cfgBasic } = await supabase.from("clinica_config").select("clinica_id, logo_url").eq("slug", slug).maybeSingle();
        config = cfgBasic ? { clinica_id: cfgBasic.clinica_id, logo_url: cfgBasic.logo_url } : null;
      } else if (!cfgErr) {
        config = cfgFull;
      }

      if (!config?.clinica_id) { setEmpresa(null); setLoading(false); return; }
      const cid = config.clinica_id;

      const [empresaRes, galeriaRes, equipeRes, depRes, srvRes, estRes] = await Promise.all([
        supabase.from("clinicas").select("*").eq("id", cid).maybeSingle(),
        supabase.from("clinica_galeria").select("*").eq("clinica_id", cid).order("ordem"),
        supabase.from("clinica_equipe").select("*").eq("clinica_id", cid).order("ordem"),
        supabase.from("clinica_depoimentos").select("*").eq("clinica_id", cid).order("ordem"),
        supabase.from("clinica_servicos").select("*").eq("clinica_id", cid).order("ordem"),
        supabase.from("clinica_estrutura").select("*").eq("clinica_id", cid).order("ordem"),
      ]);

      setEmpresa({
        ...(empresaRes.data ?? {}),
        logo_url: config.logo_url ?? undefined,
        hero_url: config.hero_url ?? undefined,
        nota_google: config.nota_google ?? null,
        num_avaliacoes: config.num_avaliacoes ?? null,
        horario_funcionamento: config.horario_funcionamento ?? null,
      });
      setGaleria(safeData(galeriaRes as { data: DBGaleria[] | null; error: { code?: string } | null }));
      setEquipe(safeData(equipeRes as { data: DBEquipe[] | null; error: { code?: string } | null }));
      setDepoimentos(safeData(depRes as { data: DBDepoimento[] | null; error: { code?: string } | null }));
      setServicos(safeData(srvRes as { data: DBServico[] | null; error: { code?: string } | null }));
      setEstrutura(safeData(estRes as { data: DBEstrutura[] | null; error: { code?: string } | null }));
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
  const titulo = gerarTituloHero();
  const subtitulo = gerarSubtituloHero();

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: "#ffffff", color: "#14110D" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,450;9..144,550;9..144,650&display=swap');
        *{box-sizing:border-box}body{margin:0}
        html{scroll-behavior:smooth}
        h1,h2{font-family:'Fraunces',Georgia,serif;font-optical-sizing:auto}
        h1,h2,h3{text-wrap:balance}
        #sobre,#servicos,#contato{scroll-margin-top:84px}
        .servico-row:first-child{border-top:none}
        @media(max-width:900px){
          .nav-links{display:none!important}
          .nav-burger{display:flex!important}
          .hero-grid{grid-template-columns:1fr!important;padding-top:120px!important}
          .hero-visual{order:-1;aspect-ratio:16/10!important;max-height:340px}
          .sobre-grid{grid-template-columns:1fr!important}
          .sobre-grid > div:last-child{aspect-ratio:16/9!important;order:-1}
        }
        @media(max-width:768px){
          .hero-ctas{flex-direction:column!important;align-items:stretch!important}
          .two-col{grid-template-columns:1fr!important;gap:8px!important}
          .dif-grid{grid-template-columns:1fr!important}
          .three-col{grid-template-columns:1fr!important}
          .four-col{grid-template-columns:1fr 1fr!important}
          .processo-grid{grid-template-columns:1fr!important;gap:32px!important}
          .processo-line{display:none!important}
          .cred-bar{flex-direction:column!important}
          .cred-bar > div{border-left:none!important;border-top:1px solid rgba(255,255,255,0.10);justify-content:flex-start!important;width:100%}
          .cred-bar > div:first-child{border-top:none}
          .galeria-grid{grid-template-columns:1fr 1fr!important}
          .footer-cols{flex-direction:column!important;gap:24px!important}
        }
        @media(max-width:480px){
          .four-col{grid-template-columns:1fr!important}
          .galeria-grid{grid-template-columns:1fr!important}
          .galeria-grid > div{grid-row:auto!important}
        }
      `}</style>

      <Header nome={nome} logoUrl={empresa.logo_url} waLink={waLink} whatsappNumber={whatsappNumber}/>
      <Hero empresa={empresa} esp={esp} local={local} titulo={titulo} subtitulo={subtitulo} waLink={waLink} whatsappNumber={whatsappNumber}/>
      <Credibilidade empresa={empresa} local={local}/>
      <Sobre empresa={empresa} nome={nome} sobre={sobre}/>
      <Servicos servicos={servicos}/>
      <Diferenciais/>
      <Processo/>
      <Galeria galeria={galeria} estrutura={estrutura}/>
      <Depoimentos depoimentos={depoimentos}/>
      <Faq/>
      <Contato empresa={empresa} waLink={waLink} whatsappNumber={whatsappNumber}/>
      <CtaFinal empresa={empresa} waLink={waLink} whatsappNumber={whatsappNumber}/>

      {whatsappNumber && (
        <a href={waLink} target="_blank" rel="noreferrer" title="Falar no WhatsApp"
          style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, width: 58, height: 58, borderRadius: "50%", background: "#25D366", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 24px rgba(37,211,102,0.40)", textDecoration: "none", transition: "transform 0.2s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.1)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = ""; }}>
          <IcWa/>
        </a>
      )}

      <Footer empresa={empresa} nome={nome} esp={esp} waLink={waLink} whatsappNumber={whatsappNumber}/>
    </div>
  );
}

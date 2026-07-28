"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import Header from "./_components/Header";
import Hero from "./_components/Hero";
import Banner from "./_components/Banner";
import Problema from "./_components/Problema";
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
import { gerarSobre, gerarTituloHero, gerarSubtituloHero, normalizarEspecialidade, safeData } from "./_lib/helpers";
import { gradienteDe, brilhoCta } from "./_lib/theme";
import { resolverFamilia, font } from "./_lib/families";
import { CTA_CONTEXTUAL } from "./_lib/content";
import type { Empresa, DBGaleria, DBEquipe, DBDepoimento, DBServico, DBEstrutura, DBFaq } from "./_lib/types";

// ── Site Institucional Universal — OrganizaPro (Site Premium 10.0) ──────────
//
// Este arquivo é só o orquestrador: busca os dados reais no Supabase,
// resolve a família visual do segmento (_lib/families.ts) e distribui tudo
// para os componentes de _components/. Nenhuma seção mostra dado específico
// inventado (nome, fotos, depoimentos, avaliações sempre vêm do banco).
// Seções sem fonte própria (Diferenciais, Processo, Problema) usam copy
// universal POR FAMÍLIA — nunca um fato específico sobre esta empresa.
//
// Uma única arquitetura, quatro identidades visuais — mesmo padrão que já
// funcionou nos 13 segmentos da IA Universal, agora na camada visual.

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
        especialidade: normalizarEspecialidade(empresaRes.data?.especialidade),
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

  const tema = resolverFamilia(empresa?.especialidade);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.body, background: "#0d1016" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,.1)", borderTop: "3px solid #79bdcd", borderRadius: "50%", margin: "0 auto 14px", animation: "spin 0.8s linear infinite" }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ color: "#9aa8b9", fontSize: 14, margin: 0 }}>Carregando...</p>
      </div>
    </div>
  );

  if (!empresa) return (
    <div style={{ minHeight: "100vh", background: "#0d1016", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.body, padding: 24 }}>
      <div style={{ maxWidth: 520, textAlign: "center", background: "rgba(255,255,255,.03)", borderRadius: 20, padding: "40px 32px", border: "1px solid rgba(255,255,255,.1)" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>:(</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 16px", color: "#f8fafc" }}>Página não encontrada</h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "#9aa8b9", margin: 0 }}>Não existe um site cadastrado com esse endereço.</p>
      </div>
    </div>
  );

  const whatsappNumber = empresa.whatsapp?.replace(/\D/g, "");
  const waComMsg = (msg: string) => whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}` : "#";
  const ctaMsgs = CTA_CONTEXTUAL[tema.id];
  const waHero = waComMsg(ctaMsgs.hero);
  const waProblema = waComMsg(ctaMsgs.problema);
  const waFinal = waComMsg(ctaMsgs.final);
  const waBase = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=` : undefined;

  const nome = empresa.nome || "Nosso negócio";
  const esp = normalizarEspecialidade(empresa.especialidade);
  const local = [empresa.cidade, empresa.estado].filter(Boolean).join(", ");
  const sobre = gerarSobre(empresa, equipe.length);
  const titulo = gerarTituloHero(empresa, tema.id);
  const subtitulo = gerarSubtituloHero(empresa, local, tema.id);
  const mediaHero = empresa.hero_url || empresa.banner_url;
  const temGaleria = galeria.length + estrutura.length > 0;
  const temContato = Boolean(empresa.endereco || empresa.telefone || empresa.email || whatsappNumber);

  // Ritmo claro/escuro (§5) calculado só entre as seções que vão de fato
  // aparecer: quando uma seção com dado ausente some (§9 — o caso comum,
  // não raro, para um cliente novo), a ordem fixa abaixo alternaria dois
  // tons iguais lado a lado. Recalcular aqui garante que isso nunca aconteça,
  // mantendo a sequência narrativa original (Sobre→Diferenciais→Como
  // funciona→Serviços→Equipe→Galeria→Depoimentos→FAQ→Contato).
  // Ordem aqui precisa espelhar exatamente a ordem de renderização no JSX
  // abaixo (Servicos→Galeria→Equipe→Depoimentos→Faq→Contato) — a alternância
  // só é válida se calculada na mesma sequência em que as seções aparecem.
  const secoesMeio: [string, boolean][] = [
    ["problema", true], ["sobre", true], ["diferenciais", true], ["processo", true],
    ["servicos", servicos.length > 0], ["galeria", temGaleria], ["equipe", equipe.length > 0],
    ["depoimentos", depoimentos.length > 0], ["faq", faqs.length > 0], ["contato", temContato],
  ];
  const tons: Record<string, { tone: "light" | "dark"; variant: 1 | 2 }> = {};
  {
    const chavesVisiveis = secoesMeio.filter(([, v]) => v).map(([k]) => k);
    // Início já é sempre "light" (abre contra o Hero, fixo escuro). O fecho
    // (Contato) também precisa ser sempre "light", porque o próximo bloco —
    // CtaFinal + Footer — é um duo escuro fixo, intencional (o "fecho
    // dramático"), não parte do ritmo alternado do meio do site. Quando o
    // total de seções visíveis é par, a alternação simples terminaria em
    // "dark" bem contra esse duo; corrigimos só a última posição.
    const tons_: ("light" | "dark")[] = chavesVisiveis.map((_, i) => (i % 2 === 0 ? "light" : "dark"));
    if (tons_.length > 0 && tons_[tons_.length - 1] === "dark") tons_[tons_.length - 1] = "light";
    let claros = 0, escuros = 0;
    chavesVisiveis.forEach((chave, i) => {
      const tone = tons_[i];
      const variant = (((tone === "light" ? claros : escuros) % 2) + 1) as 1 | 2;
      if (tone === "light") claros++; else escuros++;
      tons[chave] = { tone, variant };
    });
  }

  const navItems: [string, string][] = [
    ["#sobre", "Sobre"],
    ...(servicos.length > 0 ? [["#servicos", "Serviços"]] as [string, string][] : []),
    ...(temGaleria ? [["#galeria", "Galeria"]] as [string, string][] : []),
    ...(equipe.length > 0 ? [["#equipe", "Equipe"]] as [string, string][] : []),
    ...(depoimentos.length > 0 ? [["#depoimentos", "Depoimentos"]] as [string, string][] : []),
    ...(faqs.length > 0 ? [["#faq", "FAQ"]] as [string, string][] : []),
    ...(temContato ? [["#contato", "Contato"]] as [string, string][] : []),
  ];

  return (
    <div style={{ fontFamily: font.body, background: tema.ink, color: tema.text }}>
      <style>{`
        @font-face{font-family:'Fraunces';font-style:normal;font-weight:300 700;font-display:swap;src:local('Fraunces');}
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box}body{margin:0}body{overflow-x:hidden}a,button{outline-offset:4px}a:focus-visible,button:focus-visible{outline:2px solid ${tema.primary}}
        html{scroll-behavior:smooth}
        @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
        h1,h2,h3{text-wrap:balance}
        #sobre,#servicos,#depoimentos,#contato,#faq,#galeria,#equipe{scroll-margin-top:76px}
        .premium-section{padding:96px 24px}
        .section-shell{max-width:1180px;margin:0 auto}
        .section-label{display:inline-block;color:${tema.primary};font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;font-family:${font.body}}
        .section-heading{display:flex;align-items:end;justify-content:space-between;gap:48px;margin-bottom:46px}
        .section-heading h2{max-width:620px;margin:18px 0 0;color:${tema.text};font-family:${font.display};font-weight:600;font-size:clamp(30px,3.8vw,44px);line-height:1.12}
        .section-heading>p{max-width:360px;margin:0;color:${tema.textMuted};font-size:14px;line-height:1.75}

        .nav-link-item{transition:opacity .18s}
        .nav-link-item:hover{opacity:1!important}
        .galeria-item:hover img{transform:scale(1.06)}
        .btn-hero-glow{animation:ctaGlow 2.6s ease-in-out infinite}
        @keyframes ctaGlow{0%,100%{box-shadow:${brilhoCta(tema)}}50%{box-shadow:${brilhoCta(tema)}}}
        @keyframes heroIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        #hero .premium-hero__copy{animation:heroIn .8s ease both}
        #hero .premium-hero__media,#hero .premium-hero__fallback{animation:heroIn .9s ease .12s both}
        @media(prefers-reduced-motion:reduce){#hero .premium-hero__copy,#hero .premium-hero__media,#hero .premium-hero__fallback{animation:none}}

        @media(max-width:1024px){
          .three-col{grid-template-columns:repeat(2,1fr)!important}
          .dif-grid{grid-template-columns:repeat(2,1fr)!important}
          .four-col{grid-template-columns:repeat(2,1fr)!important}
        }
        @media(max-width:900px){
          .nav-links{display:none!important}
          .nav-burger{display:flex!important}
          .section-heading{align-items:start;flex-direction:column;gap:18px}
        }
        @media(max-width:768px){
          .hero-ctas{flex-direction:column!important;align-items:stretch!important}
          .two-col{grid-template-columns:1fr!important;gap:16px!important}
          .footer-cols{flex-direction:column!important;gap:24px!important}
        }
        @media(max-width:560px){
          .three-col{grid-template-columns:1fr!important}
          .dif-grid{grid-template-columns:1fr!important}
          .four-col{grid-template-columns:1fr!important}
          .premium-section{padding:74px 20px}
        }
      `}</style>

      <Header nome={nome} logoUrl={empresa.logo_url} waLink={waHero} whatsappNumber={whatsappNumber} navItems={navItems} tema={tema}/>
      <Hero empresa={empresa} esp={esp} local={local} titulo={titulo} subtitulo={subtitulo} waLink={waHero} whatsappNumber={whatsappNumber} mediaUrl={mediaHero} hasServices={servicos.length > 0} tema={tema}/>
      <Banner bannerUrl={empresa.hero_url ? empresa.banner_url : null} nome={nome} tema={tema}/>
      <Problema familiaId={tema.id} tema={tema} ctaHref={waProblema} ctaTexto="Conte com a gente para resolver isso" tone={tons.problema?.tone} variant={tons.problema?.variant}/>
      <Sobre empresa={empresa} nome={nome} sobre={sobre} tema={tema} tone={tons.sobre?.tone} variant={tons.sobre?.variant}/>
      <Diferenciais familiaId={tema.id} tema={tema} tone={tons.diferenciais?.tone} variant={tons.diferenciais?.variant}/>
      <Processo familiaId={tema.id} tema={tema} tone={tons.processo?.tone} variant={tons.processo?.variant}/>
      <Servicos servicos={servicos} empresa={empresa} tema={tema} familiaId={tema.id} waBase={waBase} tone={tons.servicos?.tone} variant={tons.servicos?.variant}/>
      <Galeria galeria={galeria} estrutura={estrutura} empresa={empresa} tema={tema} tone={tons.galeria?.tone} variant={tons.galeria?.variant}/>
      <Equipe equipe={equipe} tema={tema} tone={tons.equipe?.tone} variant={tons.equipe?.variant}/>
      <Depoimentos depoimentos={depoimentos} tema={tema} tone={tons.depoimentos?.tone} variant={tons.depoimentos?.variant}/>
      <Faq faqs={faqs} tema={tema} tone={tons.faq?.tone} variant={tons.faq?.variant}/>
      <Contato empresa={empresa} waLink={waComMsg(ctaMsgs.problema)} whatsappNumber={whatsappNumber} tema={tema} tone={tons.contato?.tone} variant={tons.contato?.variant}/>
      <CtaFinal empresa={empresa} waLink={waFinal} whatsappNumber={whatsappNumber} titulo="Seu próximo passo pode começar agora." subtitulo="Entre em contato pelo canal que for mais conveniente para você." ctaTexto={ctaMsgs.final.includes("orçamento") ? "Solicitar orçamento" : "Falar no WhatsApp"} tema={tema}/>

      {whatsappNumber && (
        <a href={waFinal} target="_blank" rel="noreferrer" title="Falar no WhatsApp" className="btn-hero-glow"
          style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, width: 56, height: 56, borderRadius: "50%", background: gradienteDe(tema), color: "#0c0f12", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", transition: "transform 0.2s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.08)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = ""; }}>
          <IcWa/>
        </a>
      )}

      <Footer empresa={empresa} nome={nome} esp={esp} waLink={waFinal} whatsappNumber={whatsappNumber} navItems={navItems} tema={tema}/>
    </div>
  );
}

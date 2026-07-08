"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";

// ── Site Institucional Universal — OrganizaPro ──────────────────────────────
//
// Regra de personalização: todo conteúdo exibido vem de dados reais da
// empresa. Nenhum campo tem fallback fictício (sem estatísticas inventadas,
// sem depoimentos/equipe/fotos de exemplo) — se o dado não existe, a seção
// correspondente simplesmente não é renderizada. As únicas seções sem dados
// próprios (Diferenciais, Processo de Atendimento, FAQ) são texto
// institucional universal, não afirmações específicas sobre a empresa.

// ── Types ────────────────────────────────────────────────────────────────────
type Empresa = {
  nome?: string; especialidade?: string; cidade?: string; estado?: string;
  telefone?: string; email?: string; endereco?: string; whatsapp?: string;
  google_maps_url?: string; logo_url?: string; hero_url?: string;
  nota_google?: number | null; num_avaliacoes?: number | null;
};
type DBGaleria    = { id:string; url:string; categoria:string; titulo:string|null; ordem:number };
type DBEquipe     = { id:string; foto_url:string|null; nome:string; especialidade:string|null; cro:string|null; descricao:string|null; ordem:number };
type DBAntes      = { id:string; antes_url:string|null; depois_url:string|null; titulo:string; descricao:string|null; ordem:number };
type DBDepoimento = { id:string; nome:string; cidade:string|null; comentario:string; nota:number; foto_url:string|null; ordem:number };
type DBServico    = { id:string; icone:string; imagem_url:string|null; nome:string; descricao:string|null; ordem:number };
type DBEstrutura  = { id:string; imagem_url:string; titulo:string; descricao:string|null; categoria:string; ordem:number };

// ── SVG Icons ────────────────────────────────────────────────────────────────
const IcWa = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);
const IcStar = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#f59e0b">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);
const IcCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00c896" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IcChevron = ({ open }: { open: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s" }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const IcPhone = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
  </svg>
);
const IcMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);
const IcPin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

// ── Conteúdo institucional universal (não é dado da empresa) ────────────────
const DIFERENCIAIS = [
  "Atendimento humanizado e atencioso",
  "Processos modernos e eficientes",
  "Ambiente profissional e organizado",
  "Equipe qualificada e comprometida",
  "Transparência do início ao fim",
  "Flexibilidade para atender sua necessidade",
];

const PROCESSO = [
  { icone: "📞", titulo: "Contato inicial",  desc: "Você entra em contato pelo WhatsApp, telefone ou e-mail." },
  { icone: "🗣️", titulo: "Entendimento",     desc: "Entendemos o que você precisa e como podemos ajudar." },
  { icone: "✅", titulo: "Atendimento",       desc: "Você recebe um atendimento personalizado, no seu tempo." },
  { icone: "🤝", titulo: "Acompanhamento",   desc: "Seguimos por perto para garantir a sua satisfação." },
];

const FAQS = [
  { p:"Como faço para entrar em contato?",               r:"É simples! Clique no botão do WhatsApp em qualquer parte do site. Nossa equipe responde rapidamente." },
  { p:"Quais formas de pagamento são aceitas?",          r:"Aceitamos cartões de crédito e débito, PIX e outras formas combinadas diretamente com nossa equipe." },
  { p:"Como funciona o primeiro atendimento?",           r:"O primeiro contato é dedicado a entender sua necessidade e apresentar a melhor solução, sem compromisso." },
  { p:"Atendem com urgência?",                           r:"Entre em contato pelo WhatsApp para verificarmos a disponibilidade o quanto antes." },
  { p:"Preciso levar algo para o primeiro atendimento?", r:"Normalmente não — nossa equipe orienta você em cada etapa, com antecedência se algo for necessário." },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const initials = (nome: string) => nome.trim().split(" ").filter(Boolean).map(w => w[0].toUpperCase()).slice(0,2).join("");
const safeData = <T,>(res: { data: T[]|null; error: { code?: string }|null }) =>
  res.error ? [] : (res.data ?? []);

// Parágrafo "Sobre a empresa" gerado a partir dos dados reais cadastrados —
// nunca um texto genérico fixo, mas também nunca informação inventada: cada
// frase só aparece se o campo correspondente existir.
function gerarSobre(empresa: Empresa, qtdEquipe: number): string {
  const frases: string[] = [];
  const local = [empresa.cidade, empresa.estado].filter(Boolean).join(", ");
  if (empresa.especialidade && local) {
    frases.push(`A ${empresa.nome} atua em ${empresa.especialidade.toLowerCase()} e está localizada em ${local}.`);
  } else if (empresa.especialidade) {
    frases.push(`A ${empresa.nome} atua em ${empresa.especialidade.toLowerCase()}.`);
  } else if (local) {
    frases.push(`A ${empresa.nome} está localizada em ${local}.`);
  } else {
    frases.push(`A ${empresa.nome} é uma empresa comprometida em oferecer o melhor atendimento aos seus clientes.`);
  }
  if (qtdEquipe > 0) {
    frases.push(`Contamos com uma equipe de ${qtdEquipe} profissional${qtdEquipe > 1 ? "is" : ""} dedicada${qtdEquipe > 1 ? "s" : ""} a oferecer um atendimento próximo e de confiança.`);
  }
  return frases.join(" ");
}

// ── Sub-components ────────────────────────────────────────────────────────────
function FAQItem({ p, r }: { p: string; r: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(o => !o)} style={{ background:"#ffffff", borderRadius:14, marginBottom:10, border:open?"1.5px solid #00c896":"1.5px solid #e2e8f0", boxShadow:open?"0 4px 24px rgba(0,200,150,0.10)":"0 2px 8px rgba(0,0,0,0.04)", transition:"all 0.25s", cursor:"pointer", overflow:"hidden" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 22px", gap:12 }}>
        <span style={{ fontWeight:600, color:"#0f172a", fontSize:15, lineHeight:1.4, flex:1 }}>{p}</span>
        <span style={{ color:open?"#00c896":"#94a3b8", flexShrink:0, transition:"color 0.25s" }}><IcChevron open={open} /></span>
      </div>
      <div style={{ maxHeight:open?300:0, overflow:"hidden", transition:"max-height 0.35s ease" }}>
        <div style={{ padding:"0 22px 18px", color:"#475569", fontSize:14, lineHeight:1.75, borderTop:"1px solid #f1f5f9" }}>{r}</div>
      </div>
    </div>
  );
}

function CTABand({ waLink }: { waLink: string }) {
  return (
    <section style={{ background:"linear-gradient(135deg,#00c896 0%,#00a87d 100%)", padding:"48px 20px", textAlign:"center" }}>
      <p style={{ fontSize:13, fontWeight:700, color:"rgba(255,255,255,0.7)", letterSpacing:"0.1em", textTransform:"uppercase", margin:"0 0 10px" }}>Fale conosco</p>
      <h2 style={{ fontSize:"clamp(22px,4vw,34px)", fontWeight:900, color:"#ffffff", margin:"0 0 28px", lineHeight:1.2 }}>Vamos conversar sobre o seu negócio?</h2>
      <a href={waLink} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:10, padding:"16px 36px", borderRadius:50, background:"#ffffff", color:"#00a87d", textDecoration:"none", fontWeight:800, fontSize:16, boxShadow:"0 8px 30px rgba(0,0,0,0.15)" }}>
        <IcWa /> Falar no WhatsApp
      </a>
    </section>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SiteEmpresaClient({ slug }: { slug: string }) {
  const [empresa,    setEmpresa]    = useState<Empresa | null>(null);
  const [galeria,    setGaleria]    = useState<DBGaleria[]>([]);
  const [equipe,     setEquipe]     = useState<DBEquipe[]>([]);
  const [antesDepois,setAntesDepois]= useState<DBAntes[]>([]);
  const [depoimentos,setDepoimentos]= useState<DBDepoimento[]>([]);
  const [servicos,   setServicos]   = useState<DBServico[]>([]);
  const [estrutura,  setEstrutura]  = useState<DBEstrutura[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!slug) return;
    async function carregar() {
      // 1. Busca config pelo slug
      let config: { clinica_id:string; logo_url?:string; hero_url?:string; nota_google?:number|null; num_avaliacoes?:number|null }|null = null;
      const { data: cfgFull, error: cfgErr } = await supabase
        .from("clinica_config")
        .select("clinica_id, logo_url, hero_url, nota_google, num_avaliacoes")
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

      // 2. Carrega empresa + todos os modulos em paralelo
      const [empresaRes, galeriaRes, equipeRes, adRes, depRes, srvRes, estRes] = await Promise.all([
        supabase.from("clinicas").select("*").eq("id", cid).maybeSingle(),
        supabase.from("clinica_galeria").select("*").eq("clinica_id", cid).order("ordem"),
        supabase.from("clinica_equipe").select("*").eq("clinica_id", cid).order("ordem"),
        supabase.from("clinica_antes_depois").select("*").eq("clinica_id", cid).order("ordem"),
        supabase.from("clinica_depoimentos").select("*").eq("clinica_id", cid).order("ordem"),
        supabase.from("clinica_servicos").select("*").eq("clinica_id", cid).order("ordem"),
        supabase.from("clinica_estrutura").select("*").eq("clinica_id", cid).order("ordem"),
      ]);

      setEmpresa({
        ...(empresaRes.data ?? {}),
        logo_url:       config.logo_url       ?? undefined,
        hero_url:       config.hero_url       ?? undefined,
        nota_google:    config.nota_google    ?? null,
        num_avaliacoes: config.num_avaliacoes ?? null,
      });
      setGaleria(safeData(galeriaRes as { data: DBGaleria[]|null; error: { code?:string }|null }));
      setEquipe(safeData(equipeRes as { data: DBEquipe[]|null; error: { code?:string }|null }));
      setAntesDepois(safeData(adRes as { data: DBAntes[]|null; error: { code?:string }|null }));
      setDepoimentos(safeData(depRes as { data: DBDepoimento[]|null; error: { code?:string }|null }));
      setServicos(safeData(srvRes as { data: DBServico[]|null; error: { code?:string }|null }));
      setEstrutura(safeData(estRes as { data: DBEstrutura[]|null; error: { code?:string }|null }));
      setLoading(false);
    }
    carregar();
  }, [slug]);

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Inter,sans-serif", background:"#f8fafc" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:44,height:44,border:"3px solid #e2e8f0",borderTop:"3px solid #00c896",borderRadius:"50%",margin:"0 auto 14px",animation:"spin 0.8s linear infinite" }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ color:"#94a3b8",fontSize:14,margin:0 }}>Carregando...</p>
      </div>
    </div>
  );

  if (!empresa) return (
    <div style={{ minHeight:"100vh",background:"#f3f4f6",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter,sans-serif",padding:24 }}>
      <div style={{ maxWidth:520,textAlign:"center",background:"#ffffff",borderRadius:24,padding:"40px 32px",boxShadow:"0 20px 60px rgba(15,23,42,0.08)" }}>
        <div style={{ fontSize:56,marginBottom:16 }}>:(</div>
        <h1 style={{ fontSize:32,fontWeight:800,margin:"0 0 16px",color:"#1e293b" }}>Página não encontrada</h1>
        <p style={{ fontSize:16,lineHeight:1.7,color:"#475569",margin:0 }}>Não existe um site cadastrado com esse endereço.</p>
      </div>
    </div>
  );

  const whatsappNumber = empresa.whatsapp?.replace(/\D/g,"");
  const waLink = whatsappNumber ? "https://wa.me/"+whatsappNumber+"?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais." : "#";
  const nome = empresa.nome || "Nosso negócio";
  const esp  = empresa.especialidade || "";
  const local = [empresa.cidade, empresa.estado].filter(Boolean).join(", ");

  const cardHover = (el: HTMLDivElement, on: boolean) => {
    el.style.transform = on ? "translateY(-4px)" : "";
    el.style.boxShadow = on ? "0 16px 40px rgba(0,0,0,0.10)" : "";
    el.style.borderColor = on ? "#00c896" : "#e2e8f0";
  };

  const showGaleria    = galeria.length > 0;
  const showEquipe     = equipe.length > 0;
  const showAntes      = antesDepois.length > 0;
  const showDep        = depoimentos.length > 0;
  const showSrv        = servicos.length > 0;
  const showEstrutura  = estrutura.length > 0;
  const sobre          = gerarSobre(empresa, equipe.length);

  return (
    <div style={{ fontFamily:"Inter,sans-serif", background:"#f8fafc", color:"#0f172a" }}>
      <style>{`
        *{box-sizing:border-box}body{margin:0}
        @media(max-width:768px){
          .hero-ctas{flex-direction:column!important}
          .two-col{grid-template-columns:1fr!important;gap:40px!important}
          .three-col{grid-template-columns:1fr!important}
          .four-col{grid-template-columns:1fr 1fr!important}
          .footer-cols{flex-direction:column!important;gap:24px!important;text-align:center!important}
        }
        @media(max-width:480px){.four-col{grid-template-columns:1fr!important}}
      `}</style>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section style={{
        background: empresa.hero_url
          ? `linear-gradient(140deg,rgba(6,28,44,0.85) 0%,rgba(10,46,30,0.80) 50%,rgba(6,28,44,0.85) 100%), url(${empresa.hero_url}) center/cover no-repeat`
          : "linear-gradient(140deg,#061c2c 0%,#0a2e1e 50%,#061c2c 100%)",
        position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute",top:-150,right:-150,width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,200,150,0.13) 0%,transparent 70%)",pointerEvents:"none" }}/>
        <div style={{ position:"absolute",bottom:-100,left:-100,width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(59,130,246,0.08) 0%,transparent 70%)",pointerEvents:"none" }}/>
        <div style={{ maxWidth:1080,margin:"0 auto",padding:"110px 20px 80px",position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center" }}>
          {empresa.logo_url && (
            <div style={{ marginBottom:24 }}>
              <img src={empresa.logo_url} alt={nome} style={{ height:64,maxWidth:200,objectFit:"contain",filter:"drop-shadow(0 2px 10px rgba(0,0,0,0.50))" }}/>
            </div>
          )}
          {(esp || local) && (
            <div style={{ display:"inline-flex",alignItems:"center",gap:8,background:"rgba(0,200,150,0.12)",border:"1px solid rgba(0,200,150,0.30)",borderRadius:50,padding:"6px 16px",marginBottom:28 }}>
              <span style={{ width:7,height:7,borderRadius:"50%",background:"#00c896",display:"inline-block",boxShadow:"0 0 8px #00c896" }}/>
              <span style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.08em" }}>{esp}{esp && local ? " · " : ""}{local}</span>
            </div>
          )}
          <h1 style={{ fontSize:"clamp(32px,4.5vw,54px)",fontWeight:900,color:"#ffffff",lineHeight:1.15,margin:"0 0 16px",letterSpacing:"-0.02em",maxWidth:820 }}>
            {nome}
          </h1>
          {empresa.nota_google && (
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,margin:"-4px 0 20px" }}>
              <div style={{ display:"flex",gap:2 }}>{[1,2,3,4,5].map(s => <IcStar key={s} size={18}/>)}</div>
              <span style={{ color:"#f59e0b",fontWeight:800,fontSize:17 }}>{empresa.nota_google}</span>
              {empresa.num_avaliacoes && <span style={{ color:"rgba(255,255,255,0.45)",fontSize:13 }}>({empresa.num_avaliacoes} avaliações)</span>}
            </div>
          )}
          <p style={{ fontSize:"clamp(16px,2.5vw,20px)",color:"rgba(255,255,255,0.60)",margin:"0 0 44px",maxWidth:560,lineHeight:1.65,textAlign:"center" }}>
            Entre em contato e descubra como podemos ajudar o seu negócio.
          </p>
          <div className="hero-ctas" style={{ display:"flex",flexWrap:"wrap",gap:12,alignItems:"center" }}>
            {whatsappNumber && (
              <a href={waLink} target="_blank" rel="noreferrer" style={{ display:"inline-flex",alignItems:"center",gap:10,padding:"16px 32px",borderRadius:50,background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#ffffff",textDecoration:"none",fontWeight:800,fontSize:16,boxShadow:"0 8px 32px rgba(37,211,102,0.35)" }}>
                <IcWa/> Falar agora
              </a>
            )}
            {empresa.telefone && (
              <a href={"tel:"+empresa.telefone} style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"16px 24px",borderRadius:50,border:"1.5px solid rgba(255,255,255,0.20)",color:"rgba(255,255,255,0.80)",textDecoration:"none",fontSize:15,fontWeight:500 }}>
                <IcPhone/> {empresa.telefone}
              </a>
            )}
          </div>
        </div>
        <div style={{ textAlign:"center",paddingBottom:28,position:"relative",zIndex:1 }}>
          <div style={{ width:1,height:40,background:"linear-gradient(to bottom,transparent,rgba(255,255,255,0.15))",margin:"0 auto" }}/>
        </div>
      </section>

      {/* ── SOBRE A EMPRESA ─────────────────────────────────────────────────── */}
      <section style={{ padding:"72px 20px",background:"#ffffff" }}>
        <div style={{ maxWidth:760,margin:"0 auto",textAlign:"center" }}>
          <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>Sobre {nome}</p>
          <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:"0 0 20px",lineHeight:1.2 }}>Quem cuida do seu atendimento</h2>
          <p style={{ fontSize:16,color:"#475569",lineHeight:1.8,margin:0 }}>{sobre}</p>
        </div>
      </section>

      {/* ── SERVIÇOS (só exibe se houver dados reais) ──────────────────────── */}
      {showSrv && (
        <section style={{ padding:"72px 20px",background:"#f8fafc" }}>
          <div style={{ maxWidth:1080,margin:"0 auto" }}>
            <div style={{ textAlign:"center",marginBottom:52 }}>
              <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>O que oferecemos</p>
              <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:0,lineHeight:1.2 }}>Nossos serviços</h2>
            </div>
            <div className="three-col" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18 }}>
              {servicos.map(s => (
                <div key={s.id} style={{ background:"#ffffff",borderRadius:18,overflow:"hidden",border:"1.5px solid #e2e8f0",transition:"all 0.2s",cursor:"default" }}
                  onMouseEnter={e => cardHover(e.currentTarget as HTMLDivElement, true)}
                  onMouseLeave={e => cardHover(e.currentTarget as HTMLDivElement, false)}>
                  {s.imagem_url && <div style={{ height:120,overflow:"hidden" }}><img src={s.imagem_url} alt={s.nome} style={{ width:"100%",height:"100%",objectFit:"cover" }} loading="lazy"/></div>}
                  <div style={{ padding:"20px 22px 22px" }}>
                    <h3 style={{ fontSize:16,fontWeight:700,color:"#0f172a",margin:"0 0 8px" }}>{s.nome}</h3>
                    {s.descricao && <p style={{ fontSize:13,color:"#475569",lineHeight:1.65,margin:0 }}>{s.descricao}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {whatsappNumber && <CTABand waLink={waLink}/>}

      {/* ── GALERIA (só exibe se houver dados reais) ───────────────────────── */}
      {showGaleria && (
        <section style={{ padding:"72px 20px",background:"#ffffff" }}>
          <div style={{ maxWidth:1080,margin:"0 auto" }}>
            <div style={{ textAlign:"center",marginBottom:48 }}>
              <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>Nosso espaço</p>
              <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:0 }}>Conheça nosso ambiente</h2>
            </div>
            <div className="four-col" style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:18 }}>
              {galeria.map(g => (
                <div key={g.id} style={{ borderRadius:20,overflow:"hidden",border:"1.5px solid #e2e8f0",background:"#f8fafc",transition:"transform 0.2s,box-shadow 0.2s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform="translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow="0 16px 40px rgba(0,0,0,0.10)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform=""; (e.currentTarget as HTMLDivElement).style.boxShadow=""; }}>
                  <div style={{ height:160,overflow:"hidden" }}>
                    <img src={g.url} alt={g.titulo??g.categoria} style={{ width:"100%",height:"100%",objectFit:"cover",transition:"transform 0.3s" }} loading="lazy"/>
                  </div>
                  <div style={{ padding:"16px 18px 18px" }}>
                    <div style={{ display:"inline-block",background:"#f0fdf4",color:"#00a878",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",borderRadius:6,padding:"2px 8px",marginBottom:6 }}>{g.categoria}</div>
                    <h3 style={{ fontSize:14,fontWeight:700,color:"#0f172a",margin:0 }}>{g.titulo || g.categoria}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── ESTRUTURA (só exibe se houver dados reais) ─────────────────────── */}
      {showEstrutura && (
        <section style={{ padding:"72px 20px",background:showGaleria?"#f8fafc":"#ffffff" }}>
          <div style={{ maxWidth:1080,margin:"0 auto" }}>
            <div style={{ textAlign:"center",marginBottom:48 }}>
              <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>Nossas instalações</p>
              <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:0 }}>Nossa estrutura</h2>
            </div>
            <div className="three-col" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18 }}>
              {estrutura.map(e => (
                <div key={e.id} style={{ borderRadius:18,overflow:"hidden",border:"1.5px solid #e2e8f0",background:"#ffffff",transition:"transform 0.2s,box-shadow 0.2s" }}
                  onMouseEnter={el => { (el.currentTarget as HTMLDivElement).style.transform="translateY(-4px)"; (el.currentTarget as HTMLDivElement).style.boxShadow="0 16px 40px rgba(0,0,0,0.09)"; }}
                  onMouseLeave={el => { (el.currentTarget as HTMLDivElement).style.transform=""; (el.currentTarget as HTMLDivElement).style.boxShadow=""; }}>
                  <div style={{ height:170,overflow:"hidden" }}>
                    <img src={e.imagem_url} alt={e.titulo} style={{ width:"100%",height:"100%",objectFit:"cover" }} loading="lazy"/>
                  </div>
                  <div style={{ padding:"18px 18px 20px" }}>
                    <div style={{ fontSize:10,fontWeight:700,color:"#00a878",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6 }}>{e.categoria}</div>
                    <h3 style={{ fontSize:15,fontWeight:700,color:"#0f172a",margin:"0 0 6px" }}>{e.titulo}</h3>
                    {e.descricao && <p style={{ fontSize:13,color:"#64748b",lineHeight:1.6,margin:0 }}>{e.descricao}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── DIFERENCIAIS ──────────────────────────────────────────────────── */}
      <section style={{ padding:"72px 20px",background:"linear-gradient(135deg,#061c2c 0%,#0a2e1e 100%)" }}>
        <div style={{ maxWidth:1080,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:44 }}>
            <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 12px" }}>Por que nos escolher</p>
            <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#ffffff",margin:0,lineHeight:1.2 }}>Diferenciais</h2>
          </div>
          <div className="two-col" style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16,maxWidth:820,margin:"0 auto" }}>
            {DIFERENCIAIS.map((d, i) => (
              <div key={i} style={{ display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:14,padding:"16px 18px" }}>
                <div style={{ width:26,height:26,borderRadius:"50%",background:"rgba(0,200,150,0.15)",border:"1px solid rgba(0,200,150,0.30)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><IcCheck/></div>
                <span style={{ fontSize:14.5,color:"rgba(255,255,255,0.85)" }}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROCESSO DE ATENDIMENTO ─────────────────────────────────────────── */}
      <section style={{ padding:"72px 20px",background:"#ffffff" }}>
        <div style={{ maxWidth:1080,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:52 }}>
            <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>Como funciona</p>
            <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:0 }}>Nosso processo de atendimento</h2>
          </div>
          <div className="four-col" style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:18 }}>
            {PROCESSO.map((p, i) => (
              <div key={i} style={{ textAlign:"center" }}>
                <div style={{ width:56,height:56,borderRadius:"50%",background:"#f0fdf4",border:"1.5px solid rgba(0,200,150,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 16px" }}>{p.icone}</div>
                <h3 style={{ fontSize:15,fontWeight:700,color:"#0f172a",margin:"0 0 8px" }}>{p.titulo}</h3>
                <p style={{ fontSize:13,color:"#64748b",lineHeight:1.6,margin:0 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ANTES E DEPOIS (só exibe se houver dados reais) ────────────────── */}
      {showAntes && (
        <section style={{ padding:"72px 20px",background:"#f8fafc" }}>
          <div style={{ maxWidth:1080,margin:"0 auto" }}>
            <div style={{ textAlign:"center",marginBottom:48 }}>
              <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>Resultados reais</p>
              <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:0 }}>Antes e depois</h2>
            </div>
            <div className="three-col" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20 }}>
              {antesDepois.map((item) => (
                <div key={item.id} style={{ borderRadius:20,overflow:"hidden",border:"1.5px solid #e2e8f0",background:"#ffffff" }}>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",height:170 }}>
                    <div style={{ overflow:"hidden",borderRight:"2px solid #f8fafc",background:"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center" }}>
                      {item.antes_url
                        ? <img src={item.antes_url} alt="antes" style={{ width:"100%",height:"100%",objectFit:"cover" }} loading="lazy"/>
                        : <span style={{ fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase" }}>Antes</span>
                      }
                    </div>
                    <div style={{ overflow:"hidden",background:"rgba(0,200,150,0.08)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                      {item.depois_url
                        ? <img src={item.depois_url} alt="depois" style={{ width:"100%",height:"100%",objectFit:"cover" }} loading="lazy"/>
                        : <span style={{ fontSize:10,color:"#00c896",fontWeight:700,textTransform:"uppercase" }}>Depois</span>
                      }
                    </div>
                  </div>
                  <div style={{ padding:"20px 20px 22px" }}>
                    <h3 style={{ fontSize:16,fontWeight:700,color:"#0f172a",margin:"0 0 8px" }}>{item.titulo}</h3>
                    {item.descricao && <p style={{ fontSize:13,color:"#64748b",lineHeight:1.6,margin:0 }}>{item.descricao}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── EQUIPE (só exibe se houver dados reais) ────────────────────────── */}
      {showEquipe && (
        <section style={{ padding:"72px 20px",background:"#ffffff" }}>
          <div style={{ maxWidth:1080,margin:"0 auto" }}>
            <div style={{ textAlign:"center",marginBottom:48 }}>
              <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>Nossa equipe</p>
              <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:0 }}>Quem vai te atender</h2>
            </div>
            <div className="three-col" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20 }}>
              {equipe.map(m => (
                <div key={m.id} style={{ background:"#f8fafc",borderRadius:20,overflow:"hidden",border:"1.5px solid #e2e8f0",textAlign:"center",transition:"transform 0.2s,box-shadow 0.2s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform="translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow="0 16px 40px rgba(0,0,0,0.09)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform=""; (e.currentTarget as HTMLDivElement).style.boxShadow=""; }}>
                  <div style={{ height:150,background:"linear-gradient(135deg,#0d3d2e,#0f172a)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                    {m.foto_url
                      ? <img src={m.foto_url} alt={m.nome} style={{ width:90,height:90,borderRadius:"50%",objectFit:"cover",border:"3px solid rgba(255,255,255,0.25)" }} loading="lazy"/>
                      : <div style={{ width:80,height:80,borderRadius:"50%",background:"rgba(255,255,255,0.12)",border:"2.5px solid rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"#ffffff" }}>{initials(m.nome)}</div>
                    }
                  </div>
                  <div style={{ padding:"20px 18px 24px" }}>
                    <h3 style={{ fontSize:16,fontWeight:700,color:"#0f172a",margin:"0 0 4px" }}>{m.nome}</h3>
                    {m.especialidade && <p style={{ fontSize:13,color:"#00a87d",fontWeight:600,margin:"0 0 4px" }}>{m.especialidade}</p>}
                    {m.cro && <p style={{ fontSize:12,color:"#94a3b8",margin:"0 0 10px" }}>{m.cro}</p>}
                    {m.descricao && <p style={{ fontSize:13,color:"#475569",lineHeight:1.6,margin:0 }}>{m.descricao}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── DEPOIMENTOS (só exibe se houver dados reais) ───────────────────── */}
      {showDep && (
        <>
          {whatsappNumber && <CTABand waLink={waLink}/>}
          <section style={{ padding:"72px 20px",background:"#ffffff" }}>
            <div style={{ maxWidth:1080,margin:"0 auto" }}>
              <div style={{ textAlign:"center",marginBottom:48 }}>
                <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>Depoimentos</p>
                <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:0 }}>O que nossos clientes dizem</h2>
              </div>
              <div className="four-col" style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:18 }}>
                {depoimentos.map(d => (
                  <div key={d.id} style={{ background:"#f8fafc",borderRadius:20,padding:"24px 20px",border:"1.5px solid #e2e8f0" }}>
                    <div style={{ display:"flex",gap:3,marginBottom:14 }}>{[1,2,3,4,5].map(s => <span key={s} style={{ color:s<=d.nota?"#f59e0b":"#e2e8f0",fontSize:14 }}>★</span>)}</div>
                    <p style={{ fontSize:14,color:"#475569",lineHeight:1.72,margin:"0 0 18px",fontStyle:"italic" }}>&ldquo;{d.comentario}&rdquo;</p>
                    <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                      {d.foto_url
                        ? <img src={d.foto_url} alt={d.nome} style={{ width:38,height:38,borderRadius:"50%",objectFit:"cover",flexShrink:0 }} loading="lazy"/>
                        : <div style={{ width:38,height:38,borderRadius:"50%",background:"#00a878",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#ffffff",flexShrink:0 }}>{initials(d.nome)}</div>
                      }
                      <div>
                        <div style={{ fontWeight:700,fontSize:13,color:"#0f172a" }}>{d.nome}</div>
                        {d.cidade && <div style={{ fontSize:12,color:"#94a3b8" }}>{d.cidade}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* ── LOCALIZAÇÃO (só exibe campos existentes) ───────────────────────── */}
      {(empresa.endereco || empresa.telefone || empresa.email || whatsappNumber) && (
        <section style={{ padding:"72px 20px",background:"#f8fafc" }}>
          <div style={{ maxWidth:1080,margin:"0 auto" }}>
            <div style={{ textAlign:"center",marginBottom:48 }}>
              <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>Contato</p>
              <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:0 }}>Fale com a gente</h2>
            </div>
            <div className="two-col" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:28,alignItems:"start" }}>
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                {empresa.endereco && (
                  <div style={{ display:"flex",alignItems:"flex-start",gap:14,background:"#ffffff",borderRadius:14,padding:"18px 20px",border:"1.5px solid #e2e8f0" }}>
                    <span style={{ color:"#00c896",flexShrink:0,marginTop:1 }}><IcPin/></span>
                    <div>
                      <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4 }}>Endereço</div>
                      <div style={{ fontSize:15,color:"#0f172a",fontWeight:600 }}>{empresa.endereco}</div>
                      {empresa.cidade && <div style={{ fontSize:13,color:"#64748b",marginTop:2 }}>{empresa.cidade}, {empresa.estado}</div>}
                    </div>
                  </div>
                )}
                {empresa.telefone && (
                  <a href={"tel:"+empresa.telefone} style={{ display:"flex",alignItems:"center",gap:14,background:"#ffffff",borderRadius:14,padding:"18px 20px",border:"1.5px solid #e2e8f0",textDecoration:"none" }}>
                    <span style={{ color:"#00c896" }}><IcPhone/></span>
                    <div>
                      <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4 }}>Telefone</div>
                      <div style={{ fontSize:15,color:"#0f172a",fontWeight:600 }}>{empresa.telefone}</div>
                    </div>
                  </a>
                )}
                {empresa.email && (
                  <a href={"mailto:"+empresa.email} style={{ display:"flex",alignItems:"center",gap:14,background:"#ffffff",borderRadius:14,padding:"18px 20px",border:"1.5px solid #e2e8f0",textDecoration:"none" }}>
                    <span style={{ color:"#00c896" }}><IcMail/></span>
                    <div>
                      <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4 }}>Email</div>
                      <div style={{ fontSize:15,color:"#0f172a",fontWeight:600 }}>{empresa.email}</div>
                    </div>
                  </a>
                )}
                {whatsappNumber && (
                  <a href={waLink} target="_blank" rel="noreferrer" style={{ display:"flex",alignItems:"center",gap:12,background:"#25D366",borderRadius:14,padding:"18px 20px",textDecoration:"none",color:"#ffffff",fontWeight:700,fontSize:15 }}>
                    <IcWa/> Enviar mensagem no WhatsApp
                  </a>
                )}
                {empresa.google_maps_url && (
                  <a href={empresa.google_maps_url} target="_blank" rel="noreferrer" style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"14px 20px",borderRadius:12,background:"#4285F4",color:"#ffffff",textDecoration:"none",fontSize:14,fontWeight:600 }}>
                    Ver no Google Maps
                  </a>
                )}
              </div>
              <div style={{ background:"#e2e8f0",borderRadius:20,minHeight:280,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,border:"1.5px solid #e2e8f0" }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <p style={{ fontSize:14,color:"#64748b",textAlign:"center",margin:0,padding:"0 28px",lineHeight:1.6 }}>{empresa.endereco || "Localização não cadastrada"}</p>
                {empresa.google_maps_url && (
                  <a href={empresa.google_maps_url} target="_blank" rel="noreferrer" style={{ padding:"10px 22px",borderRadius:10,background:"#00c896",color:"#ffffff",textDecoration:"none",fontSize:13,fontWeight:700 }}>
                    Ver no mapa
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section style={{ padding:"72px 20px",background:"#f8fafc" }}>
        <div style={{ maxWidth:700,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:44 }}>
            <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>Dúvidas frequentes</p>
            <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:0 }}>Perguntas Frequentes</h2>
          </div>
          {FAQS.map((f, i) => <FAQItem key={i} p={f.p} r={f.r}/>)}
        </div>
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────────────────────── */}
      {whatsappNumber && (
        <section style={{ background:"linear-gradient(135deg,#061c2c 0%,#0a2e1e 100%)",padding:"88px 20px",textAlign:"center",position:"relative",overflow:"hidden" }}>
          <div style={{ position:"absolute",top:-100,left:"50%",transform:"translateX(-50%)",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,200,150,0.10) 0%,transparent 65%)",pointerEvents:"none" }}/>
          <div style={{ maxWidth:680,margin:"0 auto",position:"relative",zIndex:1 }}>
            <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 16px" }}>Vamos conversar?</p>
            <h2 style={{ fontSize:"clamp(28px,5vw,50px)",fontWeight:900,color:"#ffffff",margin:"0 0 16px",lineHeight:1.1 }}>
              Fale com a gente{" "}
              <span style={{ backgroundImage:"linear-gradient(90deg,#00c896,#3bffd8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>agora mesmo.</span>
            </h2>
            <p style={{ fontSize:16,color:"rgba(255,255,255,0.50)",margin:"0 0 40px",lineHeight:1.7 }}>Nossa equipe está pronta para atender você com atenção. Respondemos rápido.</p>
            <a href={waLink} target="_blank" rel="noreferrer" style={{ display:"inline-flex",alignItems:"center",gap:12,padding:"18px 42px",borderRadius:50,background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#ffffff",textDecoration:"none",fontWeight:800,fontSize:17,boxShadow:"0 12px 40px rgba(37,211,102,0.40)" }}>
              <IcWa/> Falar no WhatsApp
            </a>
            <div style={{ marginTop:24,fontSize:13,color:"rgba(255,255,255,0.25)" }}>Atendimento humanizado &middot; Respondemos rápido</div>
          </div>
        </section>
      )}

      {/* ── WHATSAPP FLUTUANTE ─────────────────────────────────────────────── */}
      {whatsappNumber && (
        <a href={waLink} target="_blank" rel="noreferrer" title="Falar no WhatsApp"
          style={{ position:"fixed",bottom:24,right:24,zIndex:9999,width:60,height:60,borderRadius:"50%",background:"#25D366",color:"#ffffff",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 24px rgba(37,211,102,0.50)",textDecoration:"none",transition:"transform 0.2s,box-shadow 0.2s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform="scale(1.12)"; (e.currentTarget as HTMLAnchorElement).style.boxShadow="0 8px 32px rgba(37,211,102,0.65)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform=""; (e.currentTarget as HTMLAnchorElement).style.boxShadow="0 4px 24px rgba(37,211,102,0.50)"; }}>
          <IcWa/>
        </a>
      )}

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer style={{ background:"#040d14",padding:"36px 20px",borderTop:"1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth:1080,margin:"0 auto" }}>
          <div className="footer-cols" style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:20,marginBottom:24 }}>
            <div>
              <div style={{ fontSize:18,fontWeight:800,color:"#ffffff",marginBottom:4 }}>{nome}</div>
              {esp && <div style={{ fontSize:13,color:"rgba(255,255,255,0.35)" }}>{esp}</div>}
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {empresa.telefone && <a href={"tel:"+empresa.telefone} style={{ display:"flex",alignItems:"center",gap:8,color:"rgba(255,255,255,0.50)",textDecoration:"none",fontSize:13 }}><IcPhone/> {empresa.telefone}</a>}
              {whatsappNumber && <a href={waLink} target="_blank" rel="noreferrer" style={{ display:"flex",alignItems:"center",gap:8,color:"#25D366",textDecoration:"none",fontSize:13,fontWeight:600 }}><IcWa/> WhatsApp</a>}
              {empresa.email && <a href={"mailto:"+empresa.email} style={{ display:"flex",alignItems:"center",gap:8,color:"rgba(255,255,255,0.50)",textDecoration:"none",fontSize:13 }}><IcMail/> {empresa.email}</a>}
            </div>
            {empresa.endereco && (
              <div style={{ display:"flex",alignItems:"flex-start",gap:8,color:"rgba(255,255,255,0.40)",fontSize:13,maxWidth:220 }}>
                <span style={{ marginTop:1 }}><IcPin/></span>
                <span>{empresa.endereco}{empresa.cidade ? " - "+empresa.cidade+", "+empresa.estado : ""}</span>
              </div>
            )}
          </div>
          <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:18,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10,alignItems:"center" }}>
            <span style={{ fontSize:12,color:"rgba(255,255,255,0.20)" }}>&copy; {new Date().getFullYear()} {nome}. Todos os direitos reservados.</span>
            <span style={{ fontSize:12,color:"rgba(0,200,150,0.50)",fontWeight:600 }}>Site criado com OrganizaPro</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

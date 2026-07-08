"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

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

// ── Static fallbacks (exibidos até o cliente cadastrar o próprio conteúdo) ────
const SERVICOS_STATIC = [
  { icon:"tooth",      titulo:"Atendimento Personalizado", desc:"Cada cliente recebe atenção dedicada e uma solução sob medida para sua necessidade." },
  { icon:"smile",      titulo:"Agendamento Facilitado",     desc:"Marque seu horário de forma rápida, sem burocracia e sem complicação." },
  { icon:"gem",        titulo:"Qualidade Garantida",        desc:"Padrão de excelência em cada atendimento, do início ao fim." },
  { icon:"microscope", titulo:"Equipe Especializada",       desc:"Profissionais experientes e preparados para atender você." },
  { icon:"shield",     titulo:"Confiança e Transparência",  desc:"Relacionamento claro e honesto em todas as etapas." },
  { icon:"sparkle",    titulo:"Suporte Contínuo",           desc:"Acompanhamento antes, durante e depois do atendimento." },
];
const SERVICO_COLORS: Record<string, string> = {
  tooth:"#00c896", smile:"#3b82f6", gem:"#8b5cf6", microscope:"#f59e0b", shield:"#ef4444", sparkle:"#06b6d4", heart:"#ec4899", clinic:"#10b981",
};
const ICON_EMOJI: Record<string, string> = {
  tooth:"⭐", smile:"😊", gem:"💎", microscope:"🔍", shield:"🛡️", sparkle:"✨", heart:"❤️", clinic:"🏢",
};
const SERVICO_SVG: Record<string, React.ReactElement> = {
  tooth: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  smile: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  gem:   <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="6 3 18 3 22 9 12 22 2 9"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="12" y1="3" x2="6" y2="9"/><line x1="12" y1="3" x2="18" y2="9"/></svg>,
  microscope: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  shield: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  sparkle: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
};
const GALERIA_STATIC = [
  { titulo:"Recepcao",             desc:"Ambiente acolhedor e organizado para o seu conforto." },
  { titulo:"Espaco de Atendimento",desc:"Preparado para oferecer o melhor atendimento." },
  { titulo:"Estrutura",            desc:"Ambiente pensado para o seu bem-estar." },
  { titulo:"Equipe",               desc:"Profissionais dedicados e experientes." },
];
const GALERIA_GRAD = [
  "linear-gradient(135deg,#0a2e1e,#0d4a32)",
  "linear-gradient(135deg,#1a3a5c,#0a2040)",
  "linear-gradient(135deg,#2d1b69,#1a0f3d)",
  "linear-gradient(135deg,#7c2d12,#431407)",
];
const ANTES_STATIC = [
  { titulo:"Organizacao",         antes:"Processos manuais e demorados",       depois:"Rotina simples e organizada",        cor:"#f59e0b" },
  { titulo:"Atendimento",         antes:"Respostas lentas e desorganizadas",   depois:"Atendimento rapido e profissional",  cor:"#8b5cf6" },
  { titulo:"Presenca Online",     antes:"Pouca visibilidade para clientes",    depois:"Encontrado facilmente por quem procura", cor:"#00c896" },
];
const EQUIPE_STATIC = [
  { iniciais:"CF", nome:"Carlos Ferreira", cor:"#0d3d2e", esp:"Fundador"     },
  { iniciais:"AM", nome:"Ana Mendes",      cor:"#1a3a5c", esp:"Atendimento"  },
  { iniciais:"RB", nome:"Rafael Braga",    cor:"#2d1b69", esp:"Operacoes"    },
];
const DIFERENCIAIS = [
  "Atendimento humanizado e atencioso",
  "Ferramentas e processos modernos",
  "Ambiente agradavel e profissional",
  "Equipe com especializacao comprovada",
  "Orcamento gratuito e sem compromisso",
  "Parcelamento facilitado em ate 12x",
];
const DEPOIMENTOS_STATIC = [
  { nome:"Ana Carolina S.", cidade:"Sao Paulo, SP",      texto:"O atendimento superou todas as minhas expectativas. Profissionalismo em cada detalhe!", avatar:"AC", cor:"#00c896", nota:5 },
  { nome:"Roberto Mendes",  cidade:"Rio de Janeiro, RJ", texto:"Precisava de uma solucao rapida e a equipe foi extremamente atenciosa. Resultado perfeito!", avatar:"RM", cor:"#3b82f6", nota:5 },
  { nome:"Juliana Farias",  cidade:"Curitiba, PR",       texto:"Contratei o servico e minha experiencia mudou completamente. Profissionalismo em cada detalhe!", avatar:"JF", cor:"#8b5cf6", nota:5 },
  { nome:"Marcos Oliveira", cidade:"Belo Horizonte, MG", texto:"Atendimento rapido e resultado incrivel em pouco tempo. Nota mil!", avatar:"MO", cor:"#f59e0b", nota:5 },
];
const FAQS = [
  { p:"Como faco para agendar um atendimento?", r:"E simples! Clique no botao do WhatsApp em qualquer parte do site. Nossa equipe responde rapidamente e agenda no melhor horario para voce." },
  { p:"A avaliacao inicial e gratuita?",         r:"Sim! Realizamos uma avaliacao inicial gratuita e sem compromisso. Voce saira com um orcamento detalhado e personalizado." },
  { p:"Quais formas de pagamento sao aceitas?",  r:"Aceitamos cartoes de credito e debito, PIX e parcelamos em ate 12x sem juros nos principais servicos." },
  { p:"Como funciona o primeiro atendimento?",   r:"O primeiro atendimento e dedicado a entender sua necessidade e apresentar a melhor solucao, sem compromisso." },
  { p:"Atendimento de urgencia?",                r:"Sim, atendemos casos urgentes. Entre em contato pelo WhatsApp para verificarmos a disponibilidade o mais rapido possivel." },
  { p:"Preciso levar algo para o primeiro atendimento?", r:"Normalmente nao — nossa equipe te orienta em cada etapa e informa com antecedencia caso algo seja necessario." },
];
const EQUIPE_COLORS = ["#0d3d2e","#1a3a5c","#2d1b69","#7c2d12","#064e3b","#1e3a5f"];
const AVATAR_COLORS = ["#00c896","#3b82f6","#8b5cf6","#f59e0b","#ef4444","#06b6d4"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const initials = (nome: string) => nome.trim().split(" ").filter(Boolean).map(w => w[0].toUpperCase()).slice(0,2).join("");
const safeData = <T,>(res: { data: T[]|null; error: { code?: string }|null }) =>
  res.error ? [] : (res.data ?? []);

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
      <p style={{ fontSize:13, fontWeight:700, color:"rgba(255,255,255,0.7)", letterSpacing:"0.1em", textTransform:"uppercase", margin:"0 0 10px" }}>Avaliacao 100% gratuita</p>
      <h2 style={{ fontSize:"clamp(22px,4vw,34px)", fontWeight:900, color:"#ffffff", margin:"0 0 28px", lineHeight:1.2 }}>Agende agora e conheca nossos servicos</h2>
      <a href={waLink} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:10, padding:"16px 36px", borderRadius:50, background:"#ffffff", color:"#00a87d", textDecoration:"none", fontWeight:800, fontSize:16, boxShadow:"0 8px 30px rgba(0,0,0,0.15)" }}>
        <IcWa /> Falar no WhatsApp
      </a>
    </section>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SiteEmpresa() {
  const { slug } = useParams();
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
        <h1 style={{ fontSize:32,fontWeight:800,margin:"0 0 16px",color:"#1e293b" }}>Pagina nao encontrada</h1>
        <p style={{ fontSize:16,lineHeight:1.7,color:"#475569",margin:0 }}>Nao existe um site cadastrado com esse endereco.</p>
      </div>
    </div>
  );

  const whatsappNumber = empresa.whatsapp?.replace(/\D/g,"");
  const waLink = whatsappNumber ? "https://wa.me/"+whatsappNumber+"?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais." : "#";
  const nome = empresa.nome || "Nosso Negocio";
  const esp  = empresa.especialidade || "";

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

  return (
    <div style={{ fontFamily:"Inter,sans-serif", background:"#f8fafc", color:"#0f172a" }}>
      <style>{`
        *{box-sizing:border-box}body{margin:0}
        @media(max-width:768px){
          .hero-stats{flex-direction:column!important;gap:16px!important}
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
          <div style={{ display:"inline-flex",alignItems:"center",gap:8,background:"rgba(0,200,150,0.12)",border:"1px solid rgba(0,200,150,0.30)",borderRadius:50,padding:"6px 16px",marginBottom:28 }}>
            <span style={{ width:7,height:7,borderRadius:"50%",background:"#00c896",display:"inline-block",boxShadow:"0 0 8px #00c896" }}/>
            <span style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.08em" }}>{esp ? `${esp} · ` : ""}{empresa.cidade}{empresa.cidade && empresa.estado ? ", " : ""}{empresa.estado}</span>
          </div>
          <h1 style={{ fontSize:"clamp(34px,4.5vw,58px)",fontWeight:900,color:"#ffffff",lineHeight:1.08,margin:"0 0 16px",letterSpacing:"-0.02em",maxWidth:900 }}>
            Excelencia e Cuidado em{" "}
            <span style={{ backgroundImage:"linear-gradient(90deg,#00c896,#3bffd8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>
              Cada Atendimento
            </span>
          </h1>
          {empresa.nota_google && (
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,margin:"-4px 0 20px" }}>
              <div style={{ display:"flex",gap:2 }}>{[1,2,3,4,5].map(s => <IcStar key={s} size={18}/>)}</div>
              <span style={{ color:"#f59e0b",fontWeight:800,fontSize:17 }}>{empresa.nota_google}</span>
              {empresa.num_avaliacoes && <span style={{ color:"rgba(255,255,255,0.45)",fontSize:13 }}>({empresa.num_avaliacoes} avaliações)</span>}
            </div>
          )}
          <p style={{ fontSize:"clamp(16px,2.5vw,20px)",color:"rgba(255,255,255,0.60)",margin:"0 0 44px",maxWidth:520,lineHeight:1.65,textAlign:"center" }}>
            Agende uma avaliacao gratuita hoje e descubra a melhor solucao para voce.
          </p>
          <div className="hero-ctas" style={{ display:"flex",flexWrap:"wrap",gap:12,alignItems:"center",marginBottom:52 }}>
            {whatsappNumber && (
              <a href={waLink} target="_blank" rel="noreferrer" style={{ display:"inline-flex",alignItems:"center",gap:10,padding:"16px 32px",borderRadius:50,background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#ffffff",textDecoration:"none",fontWeight:800,fontSize:16,boxShadow:"0 8px 32px rgba(37,211,102,0.35)" }}>
                <IcWa/> Agendar Avaliacao Gratuita
              </a>
            )}
            {empresa.telefone && (
              <a href={"tel:"+empresa.telefone} style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"16px 24px",borderRadius:50,border:"1.5px solid rgba(255,255,255,0.20)",color:"rgba(255,255,255,0.80)",textDecoration:"none",fontSize:15,fontWeight:500 }}>
                <IcPhone/> {empresa.telefone}
              </a>
            )}
          </div>
          <div className="hero-stats" style={{ display:"flex",gap:40,flexWrap:"wrap" }}>
            {[["98%","Satisfacao"],["200+","Clientes"],["10+","Anos de exp."],["0 R$","Avaliacao"]].map(([v,l]) => (
              <div key={l}>
                <div style={{ fontSize:"clamp(26px,4vw,38px)",fontWeight:900,color:"#00c896",letterSpacing:"-0.02em",lineHeight:1 }}>{v}</div>
                <div style={{ fontSize:13,color:"rgba(255,255,255,0.45)",marginTop:4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ textAlign:"center",paddingBottom:28,position:"relative",zIndex:1 }}>
          <div style={{ width:1,height:40,background:"linear-gradient(to bottom,transparent,rgba(255,255,255,0.15))",margin:"0 auto" }}/>
        </div>
      </section>

      {/* ── SERVIÇOS ──────────────────────────────────────────────────────── */}
      <section style={{ padding:"72px 20px",background:"#ffffff" }}>
        <div style={{ maxWidth:1080,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:52 }}>
            <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>O que oferecemos</p>
            <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:0,lineHeight:1.2 }}>Solucoes completas para voce</h2>
            <p style={{ fontSize:15,color:"#64748b",margin:"14px auto 0",maxWidth:480,lineHeight:1.7 }}>Processos modernos e equipe especializada para cada necessidade.</p>
          </div>
          <div className="three-col" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18 }}>
            {(showSrv ? servicos : SERVICOS_STATIC).map((s, i) => {
              const isDB = showSrv;
              const icone = isDB ? (s as DBServico).icone : (s as typeof SERVICOS_STATIC[0]).icon;
              const titulo = isDB ? (s as DBServico).nome : (s as typeof SERVICOS_STATIC[0]).titulo;
              const desc   = isDB ? (s as DBServico).descricao ?? "" : (s as typeof SERVICOS_STATIC[0]).desc;
              const cor    = SERVICO_COLORS[icone] ?? "#00c896";
              const hasImg = isDB && (s as DBServico).imagem_url;
              return (
                <div key={i} style={{ background:"#f8fafc",borderRadius:18,overflow:"hidden",border:"1.5px solid #e2e8f0",transition:"all 0.2s",cursor:"default" }}
                  onMouseEnter={e => cardHover(e.currentTarget as HTMLDivElement, true)}
                  onMouseLeave={e => cardHover(e.currentTarget as HTMLDivElement, false)}>
                  {hasImg && <div style={{ height:120,overflow:"hidden" }}><img src={(s as DBServico).imagem_url!} alt={titulo} style={{ width:"100%",height:"100%",objectFit:"cover" }} loading="lazy"/></div>}
                  <div style={{ padding:"20px 22px 22px" }}>
                    <div style={{ width:52,height:52,borderRadius:14,background:cor+"20",display:"flex",alignItems:"center",justifyContent:"center",color:cor,marginBottom:16 }}>
                      {SERVICO_SVG[icone] ?? <span style={{ fontSize:24 }}>{ICON_EMOJI[icone] ?? "⭐"}</span>}
                    </div>
                    <h3 style={{ fontSize:16,fontWeight:700,color:"#0f172a",margin:"0 0 8px" }}>{titulo}</h3>
                    <p style={{ fontSize:13,color:"#475569",lineHeight:1.65,margin:0 }}>{desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {whatsappNumber && <CTABand waLink={waLink}/>}

      {/* ── GALERIA ───────────────────────────────────────────────────────── */}
      <section style={{ padding:"72px 20px",background:"#f8fafc" }}>
        <div style={{ maxWidth:1080,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:48 }}>
            <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>Nossa estrutura</p>
            <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:0 }}>Conheca Nosso Espaco</h2>
            <p style={{ fontSize:15,color:"#64748b",margin:"14px auto 0",maxWidth:460,lineHeight:1.7 }}>Ambiente preparado, processos modernos e equipe dedicada ao seu atendimento.</p>
          </div>
          <div className="four-col" style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:18 }}>
            {showGaleria
              ? galeria.map((g) => (
                  <div key={g.id} style={{ borderRadius:20,overflow:"hidden",border:"1.5px solid #e2e8f0",background:"#ffffff",transition:"transform 0.2s,box-shadow 0.2s" }}
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
                ))
              : GALERIA_STATIC.map((g, i) => (
                  <div key={i} style={{ borderRadius:20,overflow:"hidden",border:"1.5px solid #e2e8f0",background:"#ffffff",transition:"transform 0.2s,box-shadow 0.2s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform="translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow="0 16px 40px rgba(0,0,0,0.10)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform=""; (e.currentTarget as HTMLDivElement).style.boxShadow=""; }}>
                    <div style={{ height:160,background:GALERIA_GRAD[i],display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8 }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                      <span style={{ fontSize:11,color:"rgba(255,255,255,0.35)",letterSpacing:"0.06em",textTransform:"uppercase" }}>foto em breve</span>
                    </div>
                    <div style={{ padding:"18px 18px 20px" }}>
                      <h3 style={{ fontSize:15,fontWeight:700,color:"#0f172a",margin:"0 0 6px" }}>{g.titulo}</h3>
                      <p style={{ fontSize:13,color:"#64748b",lineHeight:1.6,margin:0 }}>{g.desc}</p>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>
      </section>

      {/* ── ESTRUTURA (só exibe se houver dados reais) ─────────────────────── */}
      {showEstrutura && (
        <section style={{ padding:"72px 20px",background:"#ffffff" }}>
          <div style={{ maxWidth:1080,margin:"0 auto" }}>
            <div style={{ textAlign:"center",marginBottom:48 }}>
              <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>Nossas instalacoes</p>
              <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:0 }}>Nossa Estrutura</h2>
            </div>
            <div className="three-col" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18 }}>
              {estrutura.map(e => (
                <div key={e.id} style={{ borderRadius:18,overflow:"hidden",border:"1.5px solid #e2e8f0",background:"#f8fafc",transition:"transform 0.2s,box-shadow 0.2s" }}
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

      {/* ── ANTES E DEPOIS ────────────────────────────────────────────────── */}
      <section style={{ padding:"72px 20px",background:showEstrutura?"#f8fafc":"#ffffff" }}>
        <div style={{ maxWidth:1080,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:48 }}>
            <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>Resultados reais</p>
            <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:0 }}>Antes e Depois</h2>
            <p style={{ fontSize:15,color:"#64748b",margin:"14px auto 0",maxWidth:460,lineHeight:1.7 }}>Veja as transformacoes que realizamos. Cada resultado conta uma historia.</p>
          </div>
          <div className="three-col" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20 }}>
            {showAntes
              ? antesDepois.map((item) => (
                  <div key={item.id} style={{ borderRadius:20,overflow:"hidden",border:"1.5px solid #e2e8f0",background:"#f8fafc" }}>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",height:170 }}>
                      <div style={{ overflow:"hidden",borderRight:"2px solid #ffffff",background:"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center" }}>
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
                ))
              : ANTES_STATIC.map((item, i) => (
                  <div key={i} style={{ borderRadius:20,overflow:"hidden",border:"1.5px solid #e2e8f0",background:"#f8fafc" }}>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",height:160 }}>
                      <div style={{ background:"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:6,borderRight:"2px solid #ffffff" }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                        <span style={{ fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em" }}>Antes</span>
                      </div>
                      <div style={{ background:item.cor+"33",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:6 }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={item.cor} strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                        <span style={{ fontSize:10,color:item.cor,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em" }}>Depois</span>
                      </div>
                    </div>
                    <div style={{ padding:"20px 20px 22px" }}>
                      <h3 style={{ fontSize:16,fontWeight:700,color:"#0f172a",margin:"0 0 12px" }}>{item.titulo}</h3>
                      <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                        <div style={{ fontSize:13,color:"#94a3b8" }}>&#x2715; {item.antes}</div>
                        <div style={{ fontSize:13,color:"#00a87d",fontWeight:600 }}>&#x2713; {item.depois}</div>
                      </div>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>
      </section>

      {/* ── DIFERENCIAIS ──────────────────────────────────────────────────── */}
      <section style={{ padding:"72px 20px",background:"linear-gradient(135deg,#061c2c 0%,#0a2e1e 100%)" }}>
        <div className="two-col" style={{ maxWidth:1080,margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:60,alignItems:"center" }}>
          <div>
            <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 12px" }}>Por que nos escolher</p>
            <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#ffffff",margin:"0 0 16px",lineHeight:1.2 }}>Cuidado que vai alem do atendimento</h2>
            <p style={{ fontSize:15,color:"rgba(255,255,255,0.55)",lineHeight:1.75,margin:"0 0 32px" }}>Acreditamos que um bom atendimento transforma a experiencia do cliente. Por isso, combinamos processos modernos com atendimento verdadeiramente humano.</p>
            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              {DIFERENCIAIS.map((d, i) => (
                <div key={i} style={{ display:"flex",alignItems:"center",gap:12 }}>
                  <div style={{ width:26,height:26,borderRadius:"50%",background:"rgba(0,200,150,0.15)",border:"1px solid rgba(0,200,150,0.30)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><IcCheck/></div>
                  <span style={{ fontSize:15,color:"rgba(255,255,255,0.82)" }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
            {[["98%","Satisfacao"],["200+","Clientes"],["10+","Anos exp."],["Gratis","Avaliacao"]].map(([v,l], i) => (
              <div key={i} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:18,padding:"28px 16px",textAlign:"center" }}>
                <div style={{ fontSize:"clamp(28px,3vw,38px)",fontWeight:900,color:"#00c896",letterSpacing:"-0.02em" }}>{v}</div>
                <div style={{ fontSize:13,color:"rgba(255,255,255,0.45)",marginTop:6 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EQUIPE ────────────────────────────────────────────────────────── */}
      <section style={{ padding:"72px 20px",background:"#f8fafc" }}>
        <div style={{ maxWidth:1080,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:48 }}>
            <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>Nossos especialistas</p>
            <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:0 }}>Conheca Nossa Equipe</h2>
            <p style={{ fontSize:15,color:"#64748b",margin:"14px auto 0",maxWidth:440,lineHeight:1.7 }}>Profissionais dedicados a oferecer o melhor atendimento para voce.</p>
          </div>
          <div className="three-col" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20 }}>
            {showEquipe
              ? equipe.map((m, i) => (
                  <div key={m.id} style={{ background:"#ffffff",borderRadius:20,overflow:"hidden",border:"1.5px solid #e2e8f0",textAlign:"center",transition:"transform 0.2s,box-shadow 0.2s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform="translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow="0 16px 40px rgba(0,0,0,0.09)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform=""; (e.currentTarget as HTMLDivElement).style.boxShadow=""; }}>
                    <div style={{ height:150,background:`linear-gradient(135deg,${EQUIPE_COLORS[i%EQUIPE_COLORS.length]},#0f172a)`,display:"flex",alignItems:"center",justifyContent:"center" }}>
                      {m.foto_url
                        ? <img src={m.foto_url} alt={m.nome} style={{ width:90,height:90,borderRadius:"50%",objectFit:"cover",border:"3px solid rgba(255,255,255,0.25)" }} loading="lazy"/>
                        : <div style={{ width:80,height:80,borderRadius:"50%",background:"rgba(255,255,255,0.12)",border:"2.5px solid rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"#ffffff" }}>{initials(m.nome)}</div>
                      }
                    </div>
                    <div style={{ padding:"20px 18px 24px" }}>
                      <h3 style={{ fontSize:16,fontWeight:700,color:"#0f172a",margin:"0 0 4px" }}>{m.nome}</h3>
                      {m.especialidade && <p style={{ fontSize:13,color:"#00a87d",fontWeight:600,margin:"0 0 4px" }}>{m.especialidade}</p>}
                      {m.cro && <p style={{ fontSize:12,color:"#94a3b8",margin:"0 0 10px" }}>{m.cro}</p>}
                      {m.descricao && <p style={{ fontSize:13,color:"#475569",lineHeight:1.6,margin:"0 0 12px" }}>{m.descricao}</p>}
                      <div style={{ display:"flex",justifyContent:"center",gap:3 }}>{[1,2,3,4,5].map(s => <IcStar key={s} size={13}/>)}</div>
                    </div>
                  </div>
                ))
              : EQUIPE_STATIC.map((m, i) => (
                  <div key={i} style={{ background:"#ffffff",borderRadius:20,overflow:"hidden",border:"1.5px solid #e2e8f0",textAlign:"center",transition:"transform 0.2s,box-shadow 0.2s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform="translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow="0 16px 40px rgba(0,0,0,0.09)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform=""; (e.currentTarget as HTMLDivElement).style.boxShadow=""; }}>
                    <div style={{ height:140,background:`linear-gradient(135deg,${m.cor},#0f172a)`,display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <div style={{ width:80,height:80,borderRadius:"50%",background:"rgba(255,255,255,0.12)",border:"2.5px solid rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"#ffffff" }}>{m.iniciais}</div>
                    </div>
                    <div style={{ padding:"20px 18px 24px" }}>
                      <h3 style={{ fontSize:16,fontWeight:700,color:"#0f172a",margin:"0 0 4px" }}>{m.nome}</h3>
                      <p style={{ fontSize:13,color:"#00a87d",fontWeight:600,margin:"0 0 12px" }}>{m.esp}</p>
                      <div style={{ display:"flex",justifyContent:"center",gap:3 }}>{[1,2,3,4,5].map(s => <IcStar key={s} size={13}/>)}</div>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>
      </section>

      {whatsappNumber && <CTABand waLink={waLink}/>}

      {/* ── DEPOIMENTOS ───────────────────────────────────────────────────── */}
      <section style={{ padding:"72px 20px",background:"#ffffff" }}>
        <div style={{ maxWidth:1080,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:48 }}>
            <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>Depoimentos</p>
            <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:0 }}>O que nossos clientes dizem</h2>
          </div>
          <div className="four-col" style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:18 }}>
            {(showDep ? depoimentos : DEPOIMENTOS_STATIC).map((d, i) => {
              const isDB  = showDep;
              const dNome = isDB ? (d as DBDepoimento).nome : (d as typeof DEPOIMENTOS_STATIC[0]).nome;
              const dCid  = isDB ? (d as DBDepoimento).cidade ?? "" : (d as typeof DEPOIMENTOS_STATIC[0]).cidade;
              const dTxt  = isDB ? (d as DBDepoimento).comentario : (d as typeof DEPOIMENTOS_STATIC[0]).texto;
              const dNota = isDB ? (d as DBDepoimento).nota : 5;
              const dFoto = isDB ? (d as DBDepoimento).foto_url : null;
              const dCor  = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <div key={i} style={{ background:"#f8fafc",borderRadius:20,padding:"24px 20px",border:"1.5px solid #e2e8f0" }}>
                  <div style={{ display:"flex",gap:3,marginBottom:14 }}>{[1,2,3,4,5].map(s => <span key={s} style={{ color:s<=dNota?"#f59e0b":"#e2e8f0",fontSize:14 }}>★</span>)}</div>
                  <p style={{ fontSize:14,color:"#475569",lineHeight:1.72,margin:"0 0 18px",fontStyle:"italic" }}>&ldquo;{dTxt}&rdquo;</p>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    {dFoto
                      ? <img src={dFoto} alt={dNome} style={{ width:38,height:38,borderRadius:"50%",objectFit:"cover",flexShrink:0 }} loading="lazy"/>
                      : <div style={{ width:38,height:38,borderRadius:"50%",background:dCor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#ffffff",flexShrink:0 }}>{initials(dNome)}</div>
                    }
                    <div>
                      <div style={{ fontWeight:700,fontSize:13,color:"#0f172a" }}>{dNome}</div>
                      {dCid && <div style={{ fontSize:12,color:"#94a3b8" }}>{dCid}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── LOCALIZAÇÃO ───────────────────────────────────────────────────── */}
      <section style={{ padding:"72px 20px",background:"#f8fafc" }}>
        <div style={{ maxWidth:1080,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:48 }}>
            <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>Onde estamos</p>
            <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:0 }}>Venha nos visitar</h2>
          </div>
          <div className="two-col" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:28,alignItems:"start" }}>
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              {empresa.endereco && (
                <div style={{ display:"flex",alignItems:"flex-start",gap:14,background:"#ffffff",borderRadius:14,padding:"18px 20px",border:"1.5px solid #e2e8f0" }}>
                  <span style={{ color:"#00c896",flexShrink:0,marginTop:1 }}><IcPin/></span>
                  <div>
                    <div style={{ fontSize:11,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4 }}>Endereco</div>
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
              <p style={{ fontSize:14,color:"#64748b",textAlign:"center",margin:0,padding:"0 28px",lineHeight:1.6 }}>{empresa.endereco || "Localizacao nao cadastrada"}</p>
              {empresa.google_maps_url && (
                <a href={empresa.google_maps_url} target="_blank" rel="noreferrer" style={{ padding:"10px 22px",borderRadius:10,background:"#00c896",color:"#ffffff",textDecoration:"none",fontSize:13,fontWeight:700 }}>
                  Ver no mapa
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section style={{ padding:"72px 20px",background:"#ffffff" }}>
        <div style={{ maxWidth:700,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:44 }}>
            <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 10px" }}>Duvidas frequentes</p>
            <h2 style={{ fontSize:"clamp(26px,4vw,40px)",fontWeight:800,color:"#0f172a",margin:0 }}>Perguntas Frequentes</h2>
            <p style={{ fontSize:15,color:"#64748b",margin:"14px auto 0",lineHeight:1.7 }}>Tire suas principais duvidas antes de agendar.</p>
          </div>
          {FAQS.map((f, i) => <FAQItem key={i} p={f.p} r={f.r}/>)}
        </div>
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────────────────────── */}
      {whatsappNumber && (
        <section style={{ background:"linear-gradient(135deg,#061c2c 0%,#0a2e1e 100%)",padding:"88px 20px",textAlign:"center",position:"relative",overflow:"hidden" }}>
          <div style={{ position:"absolute",top:-100,left:"50%",transform:"translateX(-50%)",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,200,150,0.10) 0%,transparent 65%)",pointerEvents:"none" }}/>
          <div style={{ maxWidth:680,margin:"0 auto",position:"relative",zIndex:1 }}>
            <p style={{ fontSize:12,fontWeight:700,color:"#00c896",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 16px" }}>Pronto para agendar seu atendimento?</p>
            <h2 style={{ fontSize:"clamp(28px,5vw,50px)",fontWeight:900,color:"#ffffff",margin:"0 0 16px",lineHeight:1.1 }}>
              Agende hoje.{" "}
              <span style={{ backgroundImage:"linear-gradient(90deg,#00c896,#3bffd8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>E gratuito.</span>
            </h2>
            <p style={{ fontSize:16,color:"rgba(255,255,255,0.50)",margin:"0 0 40px",lineHeight:1.7 }}>Nossa equipe esta pronta para receber voce com atencao e cuidado. Respondemos em minutos.</p>
            <a href={waLink} target="_blank" rel="noreferrer" style={{ display:"inline-flex",alignItems:"center",gap:12,padding:"18px 42px",borderRadius:50,background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#ffffff",textDecoration:"none",fontWeight:800,fontSize:17,boxShadow:"0 12px 40px rgba(37,211,102,0.40)" }}>
              <IcWa/> Falar no WhatsApp
            </a>
            <div style={{ marginTop:24,fontSize:13,color:"rgba(255,255,255,0.25)" }}>Atendimento humanizado &middot; Sem compromisso &middot; Respondemos rapido</div>
          </div>
        </section>
      )}

      {/* ── WHATSAPP FLUTUANTE ─────────────────────────────────────────────── */}
      {whatsappNumber && (
        <a href={waLink} target="_blank" rel="noreferrer" title="Falar no WhatsApp"
          style={{ position:"fixed",bottom:24,right:24,zIndex:9999,width:60,height:60,borderRadius:"50%",background:"#25D366",color:"#ffffff",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 24px rgba(37,211,102,0.50)",textDecoration:"none",transition:"transform 0.2s,box-shadow 0.2s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform="scale(1.12)"; (e.currentTarget as HTMLAnchorElement).style.boxShadow="0 8px 32px rgba(37,211,102,0.65)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform=""; (e.currentTarget as HTMLAnchorElement).style.boxShadow="0 4px 24px rgba(37,211,102,0.50)"; }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
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

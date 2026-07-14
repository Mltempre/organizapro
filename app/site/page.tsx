"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AdminShell from "../components/AdminShell";
import PageLoader from "../components/PageLoader";
import SiteWorkspaceNav from "./SiteWorkspaceNav";
import { normalizarEspecialidade } from "../empresa/[slug]/_lib/helpers";

type SiteForm = {
  nome: string;
  especialidade: string;
  telefone: string;
  whatsapp: string;
  endereco: string;
  cidade: string;
  estado: string;
  google_maps_url: string;
  email: string;
  slug: string;
  logo_url: string;
  hero_url: string;
  nota_google: string;
  num_avaliacoes: string;
  horario_funcionamento: string;
  banner_url: string;
  instagram_url: string;
  facebook_url: string;
  linkedin_url: string;
  tiktok_url: string;
  seo_titulo: string;
  seo_descricao: string;
  seo_imagem_url: string;
};

type ClinicaInfo = {
  nome?: string;
  especialidade?: string;
  telefone?: string;
  whatsapp?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  google_maps_url?: string;
  email?: string;
};

const CONTEUDO_LINKS = [
  { l: "Serviços",     h: "/site/servicos",     i: "🛠️", desc: "O que sua empresa oferece" },
  { l: "Equipe",       h: "/site/equipe",       i: "👥", desc: "Quem atende seus clientes" },
  { l: "Galeria",      h: "/site/galeria",      i: "📸", desc: "Fotos do seu trabalho e espaço" },
  { l: "Depoimentos",  h: "/site/depoimentos",  i: "💬", desc: "Avaliações de clientes reais" },
  { l: "FAQ",          h: "/site/faq",          i: "❓", desc: "Perguntas frequentes" },
  { l: "Estrutura",    h: "/site/estrutura",    i: "🏢", desc: "Seu espaço em detalhe" },
  { l: "Antes/Depois", h: "/site/antes-depois", i: "✨", desc: "Comparações de resultado" },
];

const generateSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function SectionEyebrow({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)", margin: "36px 0 12px" }}>
      {children}
    </div>
  );
}

export default function Site() {
  const router = useRouter();
  const [loading, setLoading]                   = useState(true);
  const [clinicaId, setClinicaId]               = useState("");
  const [userId, setUserId]                     = useState("");
  const [salvando, setSalvando]                 = useState(false);
  const [sucesso, setSucesso]                   = useState("");
  const [erro, setErro]                         = useState("");
  const [slugEdited, setSlugEdited]             = useState(false);
  const [origin, setOrigin]                     = useState("");
  const [uploadingLogo, setUploadingLogo]       = useState(false);
  const [uploadingHero, setUploadingHero]       = useState(false);
  const [uploadingBanner, setUploadingBanner]   = useState(false);
  const [uploadingSeoImg, setUploadingSeoImg]   = useState(false);
  const [migrationPending, setMigrationPending] = useState(false);
  const [feedbackModal, setFeedbackModal]       = useState(false);
  const [showPreview, setShowPreview]           = useState(false);
  const logoInputRef   = useRef<HTMLInputElement>(null);
  const heroInputRef   = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const seoImgInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<SiteForm>({
    nome: "", especialidade: "", telefone: "", whatsapp: "",
    endereco: "", cidade: "", estado: "", google_maps_url: "", email: "", slug: "",
    logo_url: "", hero_url: "", nota_google: "", num_avaliacoes: "", horario_funcionamento: "",
    banner_url: "", instagram_url: "", facebook_url: "", linkedin_url: "", tiktok_url: "",
    seo_titulo: "", seo_descricao: "", seo_imagem_url: "",
  });

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUserId(user.id);

    const { data: cu } = await supabase
      .from("clinica_usuarios")
      .select("clinica_id, clinicas(*)")
      .eq("usuario_id", user.id)
      .maybeSingle();

    if (cu?.clinicas) {
      const c = cu.clinicas as ClinicaInfo;
      setClinicaId(cu.clinica_id);
      setForm(prev => ({
        ...prev,
        nome:            c.nome            || "",
        especialidade:   normalizarEspecialidade(c.especialidade),
        telefone:        c.telefone        || "",
        whatsapp:        c.whatsapp        || "",
        endereco:        c.endereco        || "",
        cidade:          c.cidade          || "",
        estado:          c.estado          || "",
        google_maps_url: c.google_maps_url || "",
        email:           c.email           || "",
      }));
    }

    const { data: config, error: configError } = await supabase
      .from("clinica_config")
      .select("slug, logo_url, hero_url, nota_google, num_avaliacoes, horario_funcionamento, banner_url, instagram_url, facebook_url, linkedin_url, tiktok_url, seo_titulo, seo_descricao, seo_imagem_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (configError?.code === "42703") {
      setMigrationPending(true);
      const { data: configBasic } = await supabase
        .from("clinica_config")
        .select("slug, logo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (configBasic) {
        setForm(prev => ({
          ...prev,
          slug:     configBasic.slug     || "",
          logo_url: configBasic.logo_url || "",
        }));
      }
    } else if (config) {
      setMigrationPending(false);
      setForm(prev => ({
        ...prev,
        slug:                  config.slug                       || "",
        logo_url:              config.logo_url                   || "",
        hero_url:              config.hero_url                   || "",
        nota_google:           config.nota_google?.toString()    || "",
        num_avaliacoes:        config.num_avaliacoes?.toString() || "",
        horario_funcionamento: config.horario_funcionamento      || "",
        banner_url:            config.banner_url                 || "",
        instagram_url:         config.instagram_url              || "",
        facebook_url:          config.facebook_url               || "",
        linkedin_url:          config.linkedin_url               || "",
        tiktok_url:            config.tiktok_url                 || "",
        seo_titulo:            config.seo_titulo                 || "",
        seo_descricao:         config.seo_descricao              || "",
        seo_imagem_url:        config.seo_imagem_url             || "",
      }));
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const computedSlug = form.slug || generateSlug(form.nome);
  const siteUrl = computedSlug ? `${origin}/empresa/${computedSlug}` : "";

  // ── PROGRESS BAR ─────────────────────────────────────────────────────────────
  const progressItems = [
    { label: "Nome",          done: !!form.nome         },
    { label: "Especialidade", done: !!form.especialidade },
    { label: "WhatsApp",      done: !!form.whatsapp     },
    { label: "Cidade",        done: !!form.cidade        },
    { label: "Endereço",      done: !!form.endereco      },
    { label: "Slug",          done: !!computedSlug       },
    { label: "Logo",          done: !!form.logo_url      },
    ...(!migrationPending
      ? [
          { label: "Hero",       done: !!form.hero_url   },
          { label: "Avaliações", done: !!form.nota_google },
        ]
      : []),
  ];
  const progressDone  = progressItems.filter(i => i.done).length;
  const progressTotal = progressItems.length;
  const progressPct   = Math.round((progressDone / progressTotal) * 100);
  const progressColor = progressPct === 100 ? "#00c896" : progressPct >= 70 ? "#34d399" : progressPct >= 40 ? "#fbbf24" : "#f87171";

  const copyLink = async () => {
    if (!computedSlug) return;
    try {
      await navigator.clipboard.writeText(siteUrl);
      setSucesso("Link copiado para a área de transferência!");
      setTimeout(() => setSucesso(""), 3000);
    } catch {
      window.prompt("Copie o link abaixo:", siteUrl);
    }
  };

  const compartilhar = async () => {
    if (!siteUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: form.nome || "Meu Negócio", text: "Conheça nosso negócio!", url: siteUrl });
      } else {
        await navigator.clipboard.writeText(siteUrl);
        setSucesso("Link copiado para compartilhar!");
        setTimeout(() => setSucesso(""), 3000);
      }
    } catch { /* usuário cancelou o share */ }
  };

  function abrirMeuSite() {
    if (!siteUrl) {
      setErro("Seu site ainda não está configurado. Preencha o nome do negócio para gerar o endereço público.");
      return;
    }
    window.open(siteUrl, "_blank", "noopener,noreferrer");
  }

  const normalizePhone = (value: string) => value.replace(/\D/g, "");

  const UPLOAD_INFO = {
    logo:   { setUploading: setUploadingLogo,   field: "logo_url" as const,       label: "Logo" },
    hero:   { setUploading: setUploadingHero,   field: "hero_url" as const,       label: "Imagem hero" },
    banner: { setUploading: setUploadingBanner, field: "banner_url" as const,     label: "Banner" },
    seo:    { setUploading: setUploadingSeoImg, field: "seo_imagem_url" as const, label: "Imagem de SEO" },
  };

  async function uploadImagem(file: File, tipo: keyof typeof UPLOAD_INFO) {
    if (!clinicaId) { setErro("Salve os dados básicos antes de enviar imagens."); return; }
    if (file.size > 5 * 1024 * 1024) { setErro("Arquivo muito grande. Máximo 5 MB."); return; }
    const { setUploading, field, label } = UPLOAD_INFO[tipo];
    setUploading(true);
    setErro("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setErro("Sessão expirada. Recarregue a página."); return; }

      const fd = new FormData();
      fd.append("file", file);
      fd.append("tipo", tipo);
      fd.append("clinica_id", clinicaId);

      const res  = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || "Erro no upload. Tente um arquivo menor ou em outro formato."); return; }

      setForm(prev => ({ ...prev, [field]: data.url }));
      setSucesso(`${label} enviada! Clique em "Salvar alterações" para publicar.`);
      setTimeout(() => setSucesso(""), 4000);
    } catch {
      setErro("Não foi possível enviar o arquivo agora. Verifique sua conexão e tente novamente.");
    } finally {
      setUploading(false);
    }
  }

  function removerBanner() {
    setForm(prev => ({ ...prev, banner_url: "" }));
    setSucesso('Banner removido. Clique em "Salvar alterações" para publicar.');
    setTimeout(() => setSucesso(""), 4000);
  }

  async function salvar() {
    setSalvando(true);
    setErro("");

    const normalizedSlug = generateSlug(computedSlug.trim());
    if (!normalizedSlug) { setErro("Informe o nome do negócio para gerar o endereço do site."); setSalvando(false); return; }
    if (!clinicaId || !userId) { setErro("Não foi possível identificar seu negócio. Recarregue a página e tente novamente."); setSalvando(false); return; }

    const { data: existing } = await supabase
      .from("clinica_config")
      .select("user_id")
      .eq("slug", normalizedSlug)
      .neq("user_id", userId)
      .maybeSingle();

    if (existing) { setErro("Este endereço (slug) já está sendo usado por outro negócio. Escolha outro."); setSalvando(false); return; }

    const { error: clinicaError } = await supabase
      .from("clinicas")
      .upsert({
        id:              clinicaId,
        nome:            form.nome,
        especialidade:   form.especialidade,
        telefone:        form.telefone,
        whatsapp:        normalizePhone(form.whatsapp),
        endereco:        form.endereco,
        cidade:          form.cidade,
        estado:          form.estado,
        google_maps_url: form.google_maps_url,
        email:           form.email,
      }, { onConflict: "id" });

    if (clinicaError) { setErro("Não foi possível salvar os dados do negócio. Tente novamente em instantes."); setSalvando(false); return; }

    const configBase = {
      user_id:    userId,
      clinica_id: clinicaId,
      slug:       normalizedSlug,
      logo_url:   form.logo_url || null,
    };
    const notaGoogle    = form.nota_google    ? parseFloat(form.nota_google)    : null;
    const numAvaliacoes = form.num_avaliacoes ? parseInt(form.num_avaliacoes, 10) : null;
    if (notaGoogle !== null && (isNaN(notaGoogle) || notaGoogle < 0 || notaGoogle > 5)) {
      setErro("A nota do Google deve ser um número entre 0 e 5."); setSalvando(false); return;
    }
    if (numAvaliacoes !== null && (isNaN(numAvaliacoes) || numAvaliacoes < 0)) {
      setErro("O número de avaliações informado é inválido."); setSalvando(false); return;
    }
    for (const [label, valor] of [
      ["Instagram", form.instagram_url], ["Facebook", form.facebook_url],
      ["LinkedIn", form.linkedin_url], ["TikTok", form.tiktok_url],
    ] as const) {
      if (valor && !/^https?:\/\//i.test(valor)) {
        setErro(`O link do ${label} deve começar com http:// ou https://.`); setSalvando(false); return;
      }
    }
    const configFull = migrationPending ? configBase : {
      ...configBase,
      hero_url:              form.hero_url || null,
      nota_google:           notaGoogle,
      num_avaliacoes:        numAvaliacoes,
      horario_funcionamento: form.horario_funcionamento || null,
      banner_url:            form.banner_url || null,
      instagram_url:         form.instagram_url || null,
      facebook_url:          form.facebook_url || null,
      linkedin_url:          form.linkedin_url || null,
      tiktok_url:            form.tiktok_url || null,
      seo_titulo:            form.seo_titulo || null,
      seo_descricao:         form.seo_descricao || null,
      seo_imagem_url:        form.seo_imagem_url || null,
    };

    const { error: configError } = await supabase
      .from("clinica_config")
      .upsert(configFull, { onConflict: "user_id" });

    if (configError) {
      if (configError.code === "42703") {
        setMigrationPending(true);
        const { error: e2 } = await supabase
          .from("clinica_config")
          .upsert(configBase, { onConflict: "user_id" });
        if (e2) { setErro("Não foi possível salvar as configurações do site. Tente novamente."); setSalvando(false); return; }
      } else {
        setErro("Não foi possível salvar as configurações do site. Tente novamente."); setSalvando(false); return;
      }
    }

    setForm(prev => ({ ...prev, whatsapp: normalizePhone(prev.whatsapp), slug: normalizedSlug }));
    setSalvando(false);
    setFeedbackModal(true);
  }

  const uploadAreaStyle = (hasImg: boolean): React.CSSProperties => ({
    border: "2px dashed var(--border, #334155)",
    borderRadius: 12,
    padding: 16,
    textAlign: "center",
    cursor: "pointer",
    position: "relative",
    minHeight: 110,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    background: hasImg ? "transparent" : "rgba(255,255,255,0.02)",
    transition: "border-color 0.2s",
  });

  const MIGRATION_SQL = `ALTER TABLE clinica_config ADD COLUMN IF NOT EXISTS hero_url TEXT;\nALTER TABLE clinica_config ADD COLUMN IF NOT EXISTS nota_google NUMERIC(3,1);\nALTER TABLE clinica_config ADD COLUMN IF NOT EXISTS num_avaliacoes INTEGER;`;

  if (loading) {
    return (
      <AdminShell title="Meu Site" subtitle="Configure as informações do seu negócio para o site público">
        <PageLoader title="Carregando as configurações do seu site..." />
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Meu Site" subtitle="Central completa de edição do site público do seu negócio">

      <SiteWorkspaceNav
        siteUrl={siteUrl}
        onPreview={() => setShowPreview(value => !value)}
        onPublish={salvar}
        publishing={salvando}
      />

      {/* ── MODAL FEEDBACK PREMIUM ─────────────────────────────────────────── */}
      {feedbackModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(8px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
             onClick={() => setFeedbackModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#0f172a", border:"1px solid rgba(0,200,150,0.3)", borderRadius:20, padding:"32px 28px", maxWidth:480, width:"100%", textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
            <h3 style={{ fontSize:20, fontWeight:800, color:"#fff", margin:"0 0 8px" }}>Site publicado com sucesso!</h3>
            <p style={{ fontSize:14, color:"rgba(255,255,255,0.55)", margin:"0 0 20px", lineHeight:1.6 }}>
              Seu negócio agora tem uma presença digital profissional. Compartilhe o link para atrair novos clientes.
            </p>
            <div style={{ background:"rgba(0,200,150,0.08)", border:"1px solid rgba(0,200,150,0.2)", borderRadius:10, padding:"10px 14px", marginBottom:20, fontSize:13, color:"#00c896", wordBreak:"break-all", fontWeight:600 }}>
              {siteUrl}
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap", marginBottom:16 }}>
              <button
                onClick={() => { compartilhar(); setFeedbackModal(false); }}
                style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"11px 22px", borderRadius:10, background:"linear-gradient(135deg,#00c896,#00a878)", color:"#fff", border:"none", fontWeight:700, fontSize:14, cursor:"pointer" }}>
                🔗 Compartilhar site
              </button>
              <button
                onClick={() => { abrirMeuSite(); setFeedbackModal(false); }}
                style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"11px 22px", borderRadius:10, background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.75)", border:"1px solid rgba(255,255,255,0.12)", fontWeight:600, fontSize:14, cursor:"pointer" }}>
                Abrir meu site →
              </button>
            </div>
            <button onClick={() => setFeedbackModal(false)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.35)", cursor:"pointer", fontSize:13 }}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {erro && (
        <div className="panel" style={{ borderColor:"#ef4444", background:"rgba(254,202,202,0.10)", color:"#b91c1c" }}>{erro}</div>
      )}
      {sucesso && (
        <div className="panel" style={{ borderColor:"#7c3aed", background:"rgba(124,58,237,0.08)", color:"#c4b5fd" }}>{sucesso}</div>
      )}

      {/* ══════════════════════ VISÃO GERAL ══════════════════════ */}
      <SectionEyebrow>Visão Geral</SectionEyebrow>

      {migrationPending && (
        <div className="panel" style={{ borderColor:"#f59e0b", background:"rgba(245,158,11,0.06)", padding:"16px 20px" }}>
          <div style={{ fontWeight:700, color:"#f59e0b", marginBottom:8 }}>
            ⚠️ Configuração necessária — Hero e Avaliações
          </div>
          <p style={{ fontSize:13, color:"var(--muted)", margin:"0 0 10px", lineHeight:1.6 }}>
            Execute no <strong>Supabase Dashboard → SQL Editor</strong> e recarregue a página:
          </p>
          <pre style={{ background:"#0f172a", color:"#00c896", padding:"12px 14px", borderRadius:8, fontSize:12, overflowX:"auto", margin:"0 0 10px", fontFamily:"monospace", lineHeight:1.7 }}>{MIGRATION_SQL}</pre>
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(MIGRATION_SQL); setSucesso("SQL copiado!"); setTimeout(() => setSucesso(""), 2000); }}
            style={{ fontSize:12, padding:"6px 14px", borderRadius:8, background:"rgba(245,158,11,0.15)", border:"1px solid rgba(245,158,11,0.4)", color:"#f59e0b", cursor:"pointer" }}
          >
            Copiar SQL
          </button>
          <span style={{ fontSize:11, color:"var(--muted)", marginLeft:10 }}>Logo, slug e dados básicos funcionam normalmente.</span>
        </div>
      )}

      <div className="panel" style={{ padding:"14px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--text, #f1f5f9)" }}>
            Perfil do site —{" "}
            <span style={{ color: progressColor }}>{progressPct}% configurado</span>
          </div>
          <div style={{ fontSize:11, color:"var(--muted)" }}>
            {progressDone}/{progressTotal} campos
          </div>
        </div>
        <div style={{ height:6, borderRadius:99, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${progressPct}%`, borderRadius:99, background:`linear-gradient(90deg,${progressColor},${progressColor}99)`, transition:"width 0.5s ease" }} />
        </div>
        {progressPct < 100 && (
          <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:6 }}>
            {progressItems.filter(i => !i.done).map(i => (
              <span key={i.label} style={{ fontSize:11, padding:"2px 8px", borderRadius:6, background:"rgba(255,255,255,0.05)", color:"var(--muted)", border:"1px solid rgba(255,255,255,0.08)" }}>
                + {i.label}
              </span>
            ))}
          </div>
        )}
        {progressPct === 100 && (
          <div style={{ marginTop:8, fontSize:12, color:"#00c896", fontWeight:600 }}>
            ✓ Perfil completo — seu site está maximizado para conversão!
          </div>
        )}
      </div>

      <div className="panel" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--accent)" }}>🔗 URL pública</div>
          <div style={{ fontSize:12, color:"var(--muted)", marginTop:4 }}>
            {siteUrl || "Seu site ainda não está configurado — preencha o nome do negócio abaixo para gerar o endereço."}
          </div>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <button type="button" className="button-secondary" onClick={copyLink} disabled={!siteUrl} style={{ padding:"10px 16px", fontSize:13, opacity: siteUrl ? 1 : 0.5 }}>
            Copiar link
          </button>
          <button type="button" className="button-secondary" onClick={compartilhar} disabled={!siteUrl} style={{ padding:"10px 16px", fontSize:13, opacity: siteUrl ? 1 : 0.5 }}>
            🔗 Compartilhar
          </button>
          <button type="button" className="button-secondary" onClick={() => setShowPreview(v => !v)} disabled={!siteUrl} style={{ padding:"10px 16px", fontSize:13, opacity: siteUrl ? 1 : 0.5 }}>
            {showPreview ? "Ocultar site publicado" : "👁️ Ver site publicado"}
          </button>
          <button type="button" className="button-primary" onClick={abrirMeuSite} style={{ padding:"10px 16px", fontSize:13 }}>
            Abrir meu site →
          </button>
        </div>
      </div>

      {showPreview && (
        siteUrl ? (
          <div className="panel" style={{ padding:0, overflow:"hidden" }}>
            <div style={{ padding:"10px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)", fontSize:12, color:"var(--muted)", display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:"#00c896", display:"inline-block" }} />
              Site publicado — {siteUrl}
            </div>
            <iframe src={siteUrl} title="Pré-visualização do site" style={{ width:"100%", height:520, border:"none", display:"block", background:"#fff" }} />
          </div>
        ) : (
          <div className="panel" style={{ textAlign:"center", padding:"32px 20px", color:"var(--muted)", fontSize:13 }}>
            Configure o nome do negócio para poder pré-visualizar o site.
          </div>
        )
      )}

      {/* ══════════════════════ IDENTIDADE VISUAL ══════════════════════ */}
      <SectionEyebrow>Identidade Visual</SectionEyebrow>

      <div className="grid-cards">
        {([
          { label:"Nome do Negócio",      key:"nome",          placeholder:"Ex: Meu Negócio"      },
          { label:"Slug público",         key:"slug",          placeholder:"slug-do-negocio"       },
          { label:"Área de Atuação",      key:"especialidade", placeholder:"Ex: Consultoria, Serviços" },
          { label:"Telefone",             key:"telefone",      placeholder:"(38) 99999-9999"       },
          { label:"WhatsApp (com DDI)",   key:"whatsapp",      placeholder:"5538999999999"         },
          { label:"Email",                key:"email",         placeholder:"contato@seunegocio.com" },
          { label:"Endereco",             key:"endereco",      placeholder:"Rua das Flores, 123"   },
          { label:"Cidade",               key:"cidade",        placeholder:"Cornelio Procopio"     },
          { label:"Estado",               key:"estado",        placeholder:"PR"                    },
          { label:"Horário de funcionamento", key:"horario_funcionamento", placeholder:"Seg a Sex: 09h - 18h" },
        ] as const).map((f) => (
          <div key={f.key} className="panel">
            <label style={{ fontSize:12, color:"var(--muted)", display:"block", marginBottom:8 }}>{f.label}</label>
            <input
              value={form[f.key]}
              onChange={(e) => {
                if (f.key === "slug") {
                  setSlugEdited(true);
                  setForm(prev => ({ ...prev, slug: e.target.value }));
                  return;
                }
                if (f.key === "nome") {
                  const value = e.target.value;
                  setForm(prev => ({
                    ...prev,
                    nome: value,
                    slug: slugEdited ? prev.slug : generateSlug(value),
                  }));
                  return;
                }
                setForm(prev => ({ ...prev, [f.key]: e.target.value }));
              }}
              placeholder={f.placeholder}
              className="input-field"
            />
          </div>
        ))}
        <div className="panel" style={{ gridColumn:"1 / -1" }}>
          <label style={{ fontSize:12, color:"var(--muted)", display:"block", marginBottom:8 }}>Link Google Maps</label>
          <input
            value={form.google_maps_url}
            onChange={(e) => setForm(prev => ({ ...prev, google_maps_url: e.target.value }))}
            placeholder="https://maps.google.com/..."
            className="input-field"
          />
        </div>
      </div>

      <div className="panel">
        <div style={{ fontSize:14, fontWeight:700, color:"var(--text, #f1f5f9)", marginBottom:4 }}>🖼️ Logo do Negócio</div>
        <div style={{ fontSize:12, color:"var(--muted)", marginBottom:14 }}>Exibida no topo do site público.</div>
        <div style={{ maxWidth:320 }}>
          <div style={uploadAreaStyle(!!form.logo_url)} onClick={() => logoInputRef.current?.click()}>
            {form.logo_url
              ? <img src={form.logo_url} alt="Logo" style={{ maxHeight:90, maxWidth:"100%", objectFit:"contain" }} />
              : <div style={{ color:"var(--muted)", fontSize:13, lineHeight:1.7 }}>
                  <div style={{ fontSize:26, marginBottom:6 }}>🖼️</div>
                  Clique para enviar a logo<br />
                  <span style={{ fontSize:11, opacity:0.7 }}>PNG ou JPG, até 5 MB</span>
                </div>
            }
            {uploadingLogo && (
              <div style={{ position:"absolute", inset:0, background:"rgba(15,23,42,0.78)", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:10, color:"#c4b5fd", fontSize:13, fontWeight:600 }}>
                Enviando...
              </div>
            )}
          </div>
          {form.logo_url && (
            <button type="button" onClick={() => logoInputRef.current?.click()}
              style={{ marginTop:8, fontSize:11, color:"var(--muted)", background:"none", border:"none", cursor:"pointer", padding:0 }}>
              Trocar logo
            </button>
          )}
        </div>
        <input ref={logoInputRef} type="file" accept="image/*" style={{ display:"none" }}
          onChange={(e) => e.target.files?.[0] && uploadImagem(e.target.files[0], "logo")} />
      </div>

      {/* ══════════════════════ BANNER E HERO ══════════════════════ */}
      <SectionEyebrow>Banner e Hero</SectionEyebrow>

      <div className="panel" style={{ opacity:migrationPending ? 0.55 : 1, position:"relative" }}>
        {migrationPending && (
          <div style={{ position:"absolute", inset:0, zIndex:2, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:12, background:"rgba(15,23,42,0.45)" }}>
            <span style={{ background:"rgba(245,158,11,0.90)", color:"#000", fontWeight:700, fontSize:12, padding:"6px 14px", borderRadius:8 }}>
              ⚠️ Execute o SQL acima para ativar
            </span>
          </div>
        )}
        <div style={{ fontSize:14, fontWeight:700, color:"var(--text, #f1f5f9)", marginBottom:4 }}>🌅 Imagem Principal (Hero)</div>
        <div style={{ fontSize:12, color:"var(--muted)", marginBottom:14 }}>Imagem de destaque exibida no topo do site público.</div>
        <div
          style={{
            ...uploadAreaStyle(!!form.hero_url),
            backgroundImage: form.hero_url ? `url(${form.hero_url})` : undefined,
            backgroundSize: "cover", backgroundPosition: "center",
            maxWidth: 480,
          }}
          onClick={() => !migrationPending && heroInputRef.current?.click()}
        >
          {form.hero_url
            ? <div style={{ background:"rgba(0,0,0,0.55)", color:"#fff", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:600 }}>Clique para trocar</div>
            : <div style={{ color:"var(--muted)", fontSize:13, lineHeight:1.7 }}>
                <div style={{ fontSize:26, marginBottom:6 }}>🌅</div>
                Clique para enviar imagem hero<br />
                <span style={{ fontSize:11, opacity:0.7 }}>JPG recomendado, até 5 MB</span>
              </div>
          }
          {uploadingHero && (
            <div style={{ position:"absolute", inset:0, background:"rgba(15,23,42,0.78)", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:10, color:"#c4b5fd", fontSize:13, fontWeight:600 }}>
              Enviando...
            </div>
          )}
        </div>
        <input ref={heroInputRef} type="file" accept="image/*" style={{ display:"none" }}
          onChange={(e) => e.target.files?.[0] && uploadImagem(e.target.files[0], "hero")} />
      </div>

      <div className="panel">
        <div style={{ fontSize:14, fontWeight:700, color:"var(--text, #f1f5f9)", marginBottom:4 }}>🏳️ Banner</div>
        <div style={{ fontSize:12, color:"var(--muted)", marginBottom:14 }}>Faixa de imagem exibida logo abaixo do topo do site. Opcional — sem banner, essa faixa simplesmente não aparece.</div>
        <div style={{ maxWidth:480 }}>
          <div
            style={{
              ...uploadAreaStyle(!!form.banner_url),
              backgroundImage: form.banner_url ? `url(${form.banner_url})` : undefined,
              backgroundSize: "cover", backgroundPosition: "center",
            }}
            onClick={() => bannerInputRef.current?.click()}
          >
            {form.banner_url
              ? <div style={{ background:"rgba(0,0,0,0.55)", color:"#fff", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:600 }}>Clique para trocar</div>
              : <div style={{ color:"var(--muted)", fontSize:13, lineHeight:1.7 }}>
                  <div style={{ fontSize:26, marginBottom:6 }}>🏳️</div>
                  Clique para enviar um banner<br />
                  <span style={{ fontSize:11, opacity:0.7 }}>JPG ou PNG, até 5 MB</span>
                </div>
            }
            {uploadingBanner && (
              <div style={{ position:"absolute", inset:0, background:"rgba(15,23,42,0.78)", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:10, color:"#c4b5fd", fontSize:13, fontWeight:600 }}>
                Enviando...
              </div>
            )}
          </div>
          {form.banner_url && (
            <button type="button" onClick={removerBanner}
              style={{ marginTop:8, fontSize:11, color:"#f87171", background:"none", border:"none", cursor:"pointer", padding:0 }}>
              Remover banner
            </button>
          )}
        </div>
        <input ref={bannerInputRef} type="file" accept="image/*" style={{ display:"none" }}
          onChange={(e) => e.target.files?.[0] && uploadImagem(e.target.files[0], "banner")} />
      </div>

      <div className="panel" style={{ opacity:migrationPending ? 0.55 : 1, position:"relative" }}>
        {migrationPending && (
          <div style={{ position:"absolute", inset:0, zIndex:2, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:12, background:"rgba(15,23,42,0.45)" }}>
            <span style={{ background:"rgba(245,158,11,0.90)", color:"#000", fontWeight:700, fontSize:12, padding:"6px 14px", borderRadius:8 }}>
              ⚠️ Execute o SQL acima para ativar
            </span>
          </div>
        )}
        <div style={{ fontSize:14, fontWeight:700, color:"var(--text, #f1f5f9)", marginBottom:4 }}>⭐ Avaliações Google</div>
        <div style={{ fontSize:12, color:"var(--muted)", marginBottom:14 }}>
          Exibido com ★★★★★ no site público.
          {" "}<span style={{ color:"var(--accent)", cursor:"default" }} title="Acesse seu perfil no Google Meu Negócio, veja a nota e o número de avaliações.">ⓘ Como encontrar?</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          <div>
            <label style={{ fontSize:12, color:"var(--muted)", display:"block", marginBottom:8 }}>Nota Google (ex: 4.9)</label>
            <input
              value={form.nota_google}
              onChange={(e) => setForm(prev => ({ ...prev, nota_google: e.target.value }))}
              placeholder="4.9"
              className="input-field"
              type="number" min="1" max="5" step="0.1"
              disabled={migrationPending}
            />
          </div>
          <div>
            <label style={{ fontSize:12, color:"var(--muted)", display:"block", marginBottom:8 }}>Quantidade de avaliações (ex: 237)</label>
            <input
              value={form.num_avaliacoes}
              onChange={(e) => setForm(prev => ({ ...prev, num_avaliacoes: e.target.value }))}
              placeholder="237"
              className="input-field"
              type="number" min="0"
              disabled={migrationPending}
            />
          </div>
        </div>
      </div>

      {/* ══════════════════════ CONTEÚDO ══════════════════════ */}
      <SectionEyebrow>Conteúdo</SectionEyebrow>
      <div className="panel" style={{ marginBottom: 12, fontSize: 12, color: "var(--muted)" }}>
        Cada área de conteúdo tem sua própria tela de edição, com upload de imagens e reordenação. Clique para abrir.
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:14 }}>
        {CONTEUDO_LINKS.map(c => (
          <button key={c.h} onClick={() => router.push(c.h)} className="panel" style={{ textAlign:"left", cursor:"pointer", border:"1px solid rgba(255,255,255,0.08)", transition:"border-color 0.15s" }}>
            <div style={{ fontSize:24, marginBottom:8 }}>{c.i}</div>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text, #f1f5f9)", marginBottom:4 }}>{c.l}</div>
            <div style={{ fontSize:12, color:"var(--muted)" }}>{c.desc}</div>
            <div style={{ fontSize:12, color:"var(--accent)", marginTop:10, fontWeight:600 }}>Editar →</div>
          </button>
        ))}
      </div>

      {/* ══════════════════════ REDES SOCIAIS ══════════════════════ */}
      <SectionEyebrow>Redes Sociais</SectionEyebrow>

      <div className="panel">
        <div style={{ fontSize:12, color:"var(--muted)", marginBottom:14 }}>Só aparecem no site os ícones das redes preenchidas aqui.</div>
        <div className="grid-cards">
          {([
            { label:"Instagram", key:"instagram_url", placeholder:"https://instagram.com/seu-negocio" },
            { label:"Facebook",  key:"facebook_url",   placeholder:"https://facebook.com/seu-negocio"  },
            { label:"LinkedIn",  key:"linkedin_url",   placeholder:"https://linkedin.com/company/seu-negocio" },
            { label:"TikTok",    key:"tiktok_url",      placeholder:"https://tiktok.com/@seu-negocio"   },
          ] as const).map(f => (
            <div key={f.key}>
              <label style={{ fontSize:12, color:"var(--muted)", display:"block", marginBottom:8 }}>{f.label}</label>
              <input
                value={form[f.key]}
                onChange={(e) => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="input-field"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════ SEO ══════════════════════ */}
      <SectionEyebrow>SEO</SectionEyebrow>

      <div className="panel">
        <div style={{ fontSize:12, color:"var(--muted)", marginBottom:14 }}>
          Controla o título e a prévia do site quando compartilhado (Google, WhatsApp, redes sociais). Deixe em branco para usar os valores gerados automaticamente a partir do nome e da especialidade.
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, color:"var(--muted)", display:"block", marginBottom:8 }}>Título (aparece na aba do navegador e no Google)</label>
          <input
            value={form.seo_titulo}
            onChange={(e) => setForm(prev => ({ ...prev, seo_titulo: e.target.value }))}
            placeholder={form.nome ? `${form.nome}${form.especialidade ? ` — ${form.especialidade}` : ""}` : "Ex: Meu Negócio — Consultoria"}
            className="input-field"
            maxLength={70}
          />
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, color:"var(--muted)", display:"block", marginBottom:8 }}>Descrição (aparece abaixo do título nos resultados de busca)</label>
          <textarea
            value={form.seo_descricao}
            onChange={(e) => setForm(prev => ({ ...prev, seo_descricao: e.target.value }))}
            placeholder="Uma frase curta sobre o seu negócio, o que oferece e onde atende."
            className="input-field"
            style={{ resize:"vertical", minHeight:70 }}
            maxLength={160}
          />
        </div>
        <div>
          <label style={{ fontSize:12, color:"var(--muted)", display:"block", marginBottom:8 }}>Imagem de compartilhamento (Open Graph)</label>
          <div style={{ maxWidth:320 }}>
            <div style={uploadAreaStyle(!!form.seo_imagem_url)} onClick={() => seoImgInputRef.current?.click()}>
              {form.seo_imagem_url
                ? <img src={form.seo_imagem_url} alt="Imagem de SEO" style={{ maxHeight:90, maxWidth:"100%", objectFit:"contain" }} />
                : <div style={{ color:"var(--muted)", fontSize:13, lineHeight:1.7 }}>
                    <div style={{ fontSize:26, marginBottom:6 }}>🔎</div>
                    Clique para enviar uma imagem<br />
                    <span style={{ fontSize:11, opacity:0.7 }}>Opcional — sem ela, usamos o Hero ou a Logo</span>
                  </div>
              }
              {uploadingSeoImg && (
                <div style={{ position:"absolute", inset:0, background:"rgba(15,23,42,0.78)", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:10, color:"#c4b5fd", fontSize:13, fontWeight:600 }}>
                  Enviando...
                </div>
              )}
            </div>
          </div>
          <input ref={seoImgInputRef} type="file" accept="image/*" style={{ display:"none" }}
            onChange={(e) => e.target.files?.[0] && uploadImagem(e.target.files[0], "seo")} />
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", marginTop: 32, position: "sticky", bottom: 16 }}>
        <button onClick={salvar} disabled={salvando} className="button-primary" style={{ padding:"14px 36px", fontSize: 15, opacity:salvando ? 0.7 : 1, boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
          {salvando ? "Publicando..." : "Publicar alterações"}
        </button>
      </div>
    </AdminShell>
  );
}

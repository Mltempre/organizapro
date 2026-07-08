"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AdminShell from "../components/AdminShell";
import Feedback, { MSG_ERRO_PADRAO } from "../components/Feedback";

// ─── Data ─────────────────────────────────────────────────────────────────────

const OBJETIVOS = [
  { id: "atrair",     icon: "📅", label: "Atrair novos clientes" },
  { id: "avaliacoes", icon: "⭐", label: "Conseguir avaliações Google" },
  { id: "educar",     icon: "📚", label: "Educar clientes" },
  { id: "engajar",    icon: "📱", label: "Engajar Instagram" },
  { id: "reels",      icon: "🎥", label: "Criar Reels" },
  { id: "carrossel",  icon: "📖", label: "Criar Carrossel" },
  { id: "campanha",   icon: "🎉", label: "Campanha Especial" },
  { id: "servico",    icon: "📢", label: "Promover um serviço" },
];

const CATEGORIAS = [
  { id: "venda",          icon: "💰", label: "Venda",          chips: ["Conversão", "Oferta", "Fechamento"] },
  { id: "atendimento",    icon: "🤝", label: "Atendimento",    chips: ["Cuidado", "Suporte", "Experiência"] },
  { id: "relacionamento", icon: "❤️", label: "Relacionamento", chips: ["Fidelização", "Proximidade", "Confiança"] },
  { id: "promocao",       icon: "🎉", label: "Promoção",       chips: ["Oferta especial", "Tempo limitado", "Desconto"] },
  { id: "dicas",          icon: "💡", label: "Dicas",          chips: ["Educativo", "Útil", "Prático"] },
  { id: "autoridade",     icon: "🏆", label: "Autoridade",     chips: ["Experiência", "Expertise", "Credibilidade"] },
  { id: "redes",          icon: "📱", label: "Redes Sociais",  chips: ["Engajamento", "Alcance", "Instagram"] },
  { id: "campanhas",      icon: "📣", label: "Campanhas",      chips: ["Data especial", "Sazonal", "Tema"] },
  { id: "google",         icon: "⭐", label: "Google",         chips: ["Avaliações", "Reputação", "Prova social"] },
  { id: "whatsapp",       icon: "💬", label: "WhatsApp",       chips: ["Contato direto", "Agendamento", "Conversa"] },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Objetivo  = typeof OBJETIVOS[number];
type Categoria = typeof CATEGORIAS[number];

type ConteudoResult = {
  gancho:           string;
  legenda:          string;
  cta_whatsapp:     string;
  sugestao_imagem:  string;
  hashtags_grandes: string[];
  hashtags_medias:  string[];
  hashtags_nicho:   string[];
  melhor_horario:   string;
  objetivo_post:    string;
  tom:              string;
  dica_marketing:   string;
  proxima_ideia:    string;
};

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(obj: Objetivo, cat: Categoria, oferta: string): string {
  const contexto = oferta.trim()
    ? `\nO que este negócio oferece: ${oferta.trim()}`
    : "";
  return `Você é um consultor especializado em marketing digital para pequenos e médios negócios, contratado pelo OrganizaPro. Crie conteúdos de alta conversão para Instagram.

Objetivo deste post: ${obj.label}
Tipo de conteúdo: ${cat.label}${contexto}

Retorne SOMENTE JSON puro, sem markdown, sem texto adicional:

{"gancho":"frase de abertura que paralisa o scroll (máximo 12 palavras, sem emojis, afirmativa e forte)","legenda":"corpo da legenda entre 130 e 180 palavras — linguagem consultiva, autoridade, máximo 3 emojis, SEM gancho e SEM CTA, termine com ponto final","cta_whatsapp":"CTA elegante para WhatsApp em 1 frase direta e convertedora","sugestao_imagem":"descreva exatamente a foto ou vídeo ideal: o que mostrar, ângulo, iluminação, ambiente e expressões — nunca genérico","hashtags_grandes":["8 hashtags reais e populares no segmento deste negócio, acima de 100k publicações"],"hashtags_medias":["9 hashtags de nicho do segmento, entre 10k e 100k publicações"],"hashtags_nicho":["8 hashtags de micro-nicho bem específicas do negócio, abaixo de 10k publicações"],"melhor_horario":"dia da semana, horário ideal e justificativa curta em 1 frase","objetivo_post":"Alcance, Engajamento, Conversão ou Autoridade — explique em 1 frase por que este post atende esse objetivo","tom":"descreva em até 6 palavras ex: Educativo com autoridade","dica_marketing":"1 dica não óbvia para aumentar o desempenho deste post","proxima_ideia":"qual seria o próximo post estratégico para este negócio — diga o formato e o tema específico em 1 frase inspiradora"}

Regras: português do Brasil, nunca genérico, foco em autoridade e conversão, nunca mencione preços.`;
}

// ─── JSON parser com fallback em 3 camadas ────────────────────────────────────

function parseResult(raw: string): ConteudoResult | null {
  function tryParse(s: string): ConteudoResult | null {
    try {
      const obj = JSON.parse(s) as ConteudoResult;
      // backward compat: se veio hashtags flat, distribui em grupos
      if (!obj.hashtags_grandes && (obj as Record<string, unknown>).hashtags) {
        const flat = (obj as Record<string, unknown>).hashtags as string[];
        obj.hashtags_grandes = flat.slice(0, 8);
        obj.hashtags_medias  = flat.slice(8, 17);
        obj.hashtags_nicho   = flat.slice(17);
      }
      return obj;
    } catch { return null; }
  }
  const direct = tryParse(raw);
  if (direct) return direct;
  const block = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (block) { const r = tryParse(block[1]); if (r) return r; }
  const b = raw.indexOf("{"), l = raw.lastIndexOf("}");
  if (b !== -1 && l !== -1) return tryParse(raw.slice(b, l + 1));
  return null;
}

function ensureHash(h: string): string { return h.startsWith("#") ? h : `#${h}`; }

function flatHashtags(r: ConteudoResult): string[] {
  return [
    ...(r.hashtags_grandes ?? []),
    ...(r.hashtags_medias  ?? []),
    ...(r.hashtags_nicho   ?? []),
  ].map(ensureHash);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepLabel({ n, label, done }: { n: number; label: string; done: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <div style={{
        width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0,
        background: done ? "#7c3aed" : "#2d3148",
        color: done ? "#fff" : "#64748b",
        transition: "all 0.2s",
      }}>{n}</div>
      <span style={{ fontSize: 13, fontWeight: 700, color: done ? "#f1f5f9" : "#64748b", transition: "color 0.2s" }}>{label}</span>
    </div>
  );
}

function HashGroup({ label, tags, chipBg, chipColor, chipBorder }: {
  label: string; tags: string[];
  chipBg: string; chipColor: string; chipBorder: string;
}) {
  if (!tags?.length) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {tags.map((h, i) => (
          <span key={i} style={{
            background: chipBg, border: `1px solid ${chipBorder}`,
            borderRadius: 6, padding: "3px 8px", fontSize: 11, color: chipColor,
          }}>{ensureHash(h)}</span>
        ))}
      </div>
    </div>
  );
}

function ResultSection({
  label, icon, children, bg = "#1e2130", border = "#2d3148", labelColor = "#94a3b8",
}: {
  label: string; icon: string; children: React.ReactNode;
  bg?: string; border?: string; labelColor?: string;
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "16px 18px", marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: labelColor, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>
        {icon} {label}
      </div>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Conteudo() {
  const router = useRouter();
  const [objetivo,   setObjetivo]   = useState<Objetivo | null>(null);
  const [categoria,  setCategoria]  = useState<Categoria | null>(null);
  const [oferta,     setOferta]     = useState("");
  const [resultado,  setResultado]  = useState<ConteudoResult | null>(null);
  const [rawError,   setRawError]   = useState("");
  const [loading,    setLoading]    = useState(false);
  const [copiado,    setCopiado]    = useState<"idle" | "ok" | "erro">("idle");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
    });
  }, [router]);

  const pronto = !!objetivo && !!categoria;

  async function gerar() {
    if (!pronto || loading) return;
    setLoading(true);
    setResultado(null);
    setRawError("");
    setCopiado("idle");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); setLoading(false); return; }

      const res = await fetch("/api/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ prompt: buildPrompt(objetivo!, categoria!, oferta), max_tokens: 1500 }),
      });

      const data = await res.json();
      if (!res.ok) { console.error(data); setRawError(MSG_ERRO_PADRAO); setLoading(false); return; }

      const parsed = parseResult(data.content || "");
      if (parsed) {
        setResultado(parsed);
      } else {
        setRawError("Não foi possível interpretar o conteúdo gerado. Tente novamente.");
      }
    } catch (e) {
      console.error(e);
      setRawError(MSG_ERRO_PADRAO);
    }
    setLoading(false);
  }

  async function copiarInstagram() {
    if (!resultado) return;
    const tags = flatHashtags(resultado).join(" ");
    const texto = `${resultado.gancho}\n\n${resultado.legenda}\n\n${resultado.cta_whatsapp}\n\n.\n.\n.\n${tags}`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado("ok");
    } catch {
      setCopiado("erro");
    } finally {
      setTimeout(() => setCopiado("idle"), 2500);
    }
  }

  const corCopiar = copiado === "ok"
    ? { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)", color: "#4ade80" }
    : copiado === "erro"
    ? { bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)", color: "#f87171" }
    : { bg: "#7c3aed", border: "#7c3aed", color: "#fff" };

  return (
    <AdminShell
      title="Biblioteca de Marketing"
      subtitle="Conteúdos profissionais criados por IA para ajudar seu negócio a atrair clientes e fortalecer sua presença digital."
    >
      <style>{`
        .ct-obj-card:hover:not(.ct-sel) { border-color: #3d4360 !important; }
        .ct-esp-card:hover:not(.ct-sel) { border-color: #3d4360 !important; }
        .ct-btn-gerar:hover:not(:disabled) { filter: brightness(1.1); }
        .ct-btn-regerar:hover { background: rgba(148,163,184,0.1) !important; border-color: #3d4360 !important; }
        .ct-btn-copiar:hover { filter: brightness(1.1); }
        .ct-objetivos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
        .ct-especialidades-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
        .ct-info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px; }
      `}</style>
      <main style={{ overflowY: "auto", padding: "28px 32px" }}>

        {/* ── Etapa 1: Objetivo ── */}
        <div style={{ background: "#1e2130", border: "1px solid #2d3148", borderRadius: 12, padding: "22px 24px", marginBottom: 16 }}>
          <StepLabel n={1} label="Qual seu objetivo hoje?" done={!!objetivo} />
          <div className="ct-objetivos-grid">
            {OBJETIVOS.map(o => {
              const sel = objetivo?.id === o.id;
              return (
                <div key={o.id} onClick={() => { setObjetivo(o); setResultado(null); }}
                  className={`ct-obj-card${sel ? " ct-sel" : ""}`}
                  style={{
                    background:  sel ? "#7c3aed" : "#0f1117",
                    border:      sel ? "2px solid #7c3aed" : "2px solid #2d3148",
                    borderRadius: 10, padding: "14px 10px", cursor: "pointer",
                    textAlign:   "center", transition: "all 0.18s",
                    transform:   sel ? "scale(1.03)" : "scale(1)",
                    boxShadow:   sel ? "0 6px 20px rgba(124,58,237,0.22)" : "none",
                  }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", margin: "0 auto 8px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18,
                    background: sel ? "rgba(255,255,255,0.2)" : "#1e2130",
                    border:     sel ? "1px solid rgba(255,255,255,0.3)" : "1px solid #2d3148",
                    transition: "all 0.18s",
                  }}>{o.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: sel ? "#fff" : "#94a3b8", lineHeight: 1.3 }}>
                    {o.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Etapa 2: Categoria ── */}
        <div style={{ background: "#1e2130", border: "1px solid #2d3148", borderRadius: 12, padding: "22px 24px", marginBottom: 16 }}>
          <StepLabel n={2} label="Que tipo de conteúdo?" done={!!categoria} />
          <div className="ct-especialidades-grid">
            {CATEGORIAS.map(c => {
              const sel = categoria?.id === c.id;
              return (
                <div key={c.id} onClick={() => { setCategoria(c); setResultado(null); }}
                  className={`ct-esp-card${sel ? " ct-sel" : ""}`}
                  style={{
                    background:   sel ? "rgba(124,58,237,0.12)" : "#0f1117",
                    border:       sel ? "2px solid #7c3aed" : "2px solid #2d3148",
                    borderRadius: 12, padding: "22px 18px", cursor: "pointer",
                    textAlign:    "center", transition: "all 0.2s",
                    boxShadow:    sel ? "0 6px 20px rgba(124,58,237,0.15)" : "none",
                    transform:    sel ? "scale(1.02)" : "scale(1)",
                  }}>
                  <div style={{ fontSize: sel ? 40 : 32, marginBottom: 10, transition: "font-size 0.2s" }}>{c.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: sel ? "#c4b5fd" : "#f1f5f9", marginBottom: 12, transition: "color 0.2s" }}>
                    {c.label}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
                    {c.chips.map((chip, i) => (
                      <span key={i} style={{
                        background: sel ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.04)",
                        color:      sel ? "#c4b5fd" : "#94a3b8",
                        border:     sel ? "1px solid rgba(124,58,237,0.3)" : "1px solid #2d3148",
                        fontSize: 10, padding: "3px 8px", borderRadius: 5,
                        fontWeight: 500, transition: "all 0.2s",
                      }}>{chip}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 6 }}>
              O que seu negócio oferece? (opcional — ajuda a IA a ser mais específica)
            </label>
            <input
              value={oferta}
              onChange={e => setOferta(e.target.value)}
              placeholder="Ex: corte de cabelo e barba, consultoria financeira, serviços jurídicos trabalhistas..."
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8,
                border: "1px solid #2d3148", background: "#0f1117", color: "#f1f5f9",
                fontSize: 13, fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        {/* ── Etapa 3: Gerar ── */}
        <div style={{ background: "#1e2130", border: "1px solid #2d3148", borderRadius: 12, padding: "22px 24px", marginBottom: 20 }}>
          <StepLabel n={3} label="Gerar conteúdo" done={false} />
          {!pronto ? (
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 14px" }}>
              Selecione o objetivo e o tipo de conteúdo para liberar a geração.
            </p>
          ) : (
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 14px" }}>
              <span style={{ color: "#a78bfa", fontWeight: 600 }}>{objetivo!.icon} {objetivo!.label}</span>
              {" · "}
              <span style={{ color: "#a78bfa", fontWeight: 600 }}>{categoria!.icon} {categoria!.label}</span>
            </p>
          )}
          <button className="ct-btn-gerar" onClick={gerar} disabled={!pronto || loading}
            style={{
              padding: "13px 36px", borderRadius: 10, border: "none",
              background: pronto && !loading ? "#7c3aed" : "#2d3148",
              color:      pronto && !loading ? "#fff"    : "#64748b",
              fontSize: 14, fontWeight: 700,
              cursor:     pronto && !loading ? "pointer" : "not-allowed",
              transition: "filter 0.2s",
              boxShadow:  pronto && !loading ? "0 4px 14px rgba(124,58,237,0.3)" : "none",
            }}>
            {loading ? "✨ Gerando conteúdo..." : "✨ Gerar Conteúdo Inteligente"}
          </button>
        </div>

        {/* ── Erro ── */}
        {rawError && (
          <Feedback type="erro" message={rawError} onClose={() => setRawError("")} />
        )}

        {/* ── Resultado ── */}
        {resultado && (
          <div>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>✅ Conteúdo gerado</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  {objetivo!.icon} {objetivo!.label} · {categoria!.icon} {categoria!.label}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="ct-btn-regerar" onClick={() => { setResultado(null); setCopiado("idle"); }}
                  style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #2d3148", background: "transparent", color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "background 0.15s, border-color 0.15s" }}>
                  🔄 Gerar novamente
                </button>
                <button className="ct-btn-copiar" onClick={copiarInstagram}
                  style={{
                    padding: "7px 18px", borderRadius: 8,
                    border:      `1px solid ${corCopiar.border}`,
                    background:  corCopiar.bg,
                    color:       corCopiar.color,
                    fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "filter 0.15s",
                  }}>
                  {copiado === "ok" ? "✅ Copiado!" : copiado === "erro" ? "❌ Erro" : "📋 Copiar para Instagram"}
                </button>
              </div>
            </div>

            {/* 1 — Gancho */}
            <ResultSection label="1️⃣  Chamada inicial — Gancho" icon="⚡" bg="rgba(124,58,237,0.08)" border="rgba(124,58,237,0.25)" labelColor="#a78bfa">
              <p style={{ fontSize: 20, fontWeight: 800, color: "#e9d5ff", lineHeight: 1.3, margin: 0 }}>
                {resultado.gancho}
              </p>
            </ResultSection>

            {/* 2 — Legenda */}
            <ResultSection label="2️⃣  Legenda" icon="✍️">
              <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.85, margin: 0, whiteSpace: "pre-wrap" }}>
                {resultado.legenda}
              </p>
            </ResultSection>

            {/* 3 — CTA */}
            <ResultSection label="3️⃣  CTA para WhatsApp" icon="💬" bg="rgba(34,197,94,0.08)" border="rgba(34,197,94,0.25)" labelColor="#4ade80">
              <p style={{ fontSize: 14, fontWeight: 600, color: "#86efac", margin: 0 }}>
                {resultado.cta_whatsapp}
              </p>
            </ResultSection>

            {/* 4 — Imagem */}
            <ResultSection label="4️⃣  Sugestão de imagem / vídeo" icon="📸" bg="rgba(59,130,246,0.08)" border="rgba(59,130,246,0.25)" labelColor="#60a5fa">
              <p style={{ fontSize: 13, color: "#bfdbfe", lineHeight: 1.7, margin: 0 }}>
                {resultado.sugestao_imagem}
              </p>
            </ResultSection>

            {/* 5 — Hashtags por categoria */}
            <div style={{ background: "#1e2130", border: "1px solid #2d3148", borderRadius: 10, padding: "16px 18px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 }}>
                #️⃣  5️⃣  Hashtags
              </div>
              <HashGroup
                label="Grande alcance (100k+)"
                tags={resultado.hashtags_grandes ?? []}
                chipBg="rgba(255,255,255,0.04)" chipColor="#cbd5e1" chipBorder="#2d3148"
              />
              <HashGroup
                label="Nicho do negócio (10k–100k)"
                tags={resultado.hashtags_medias ?? []}
                chipBg="rgba(124,58,237,0.1)" chipColor="#c4b5fd" chipBorder="rgba(124,58,237,0.3)"
              />
              <HashGroup
                label="Micro-nicho (abaixo de 10k)"
                tags={resultado.hashtags_nicho ?? []}
                chipBg="rgba(34,197,94,0.1)" chipColor="#86efac" chipBorder="rgba(34,197,94,0.25)"
              />
            </div>

            {/* 6 — Info row */}
            <div className="ct-info-grid">
              <div style={{ background: "#1e2130", border: "1px solid #2d3148", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>🕐 Melhor horário</div>
                <p style={{ fontSize: 12, color: "#cbd5e1", margin: 0, lineHeight: 1.55 }}>{resultado.melhor_horario}</p>
              </div>
              <div style={{ background: "#1e2130", border: "1px solid #2d3148", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>🎯 Objetivo</div>
                <p style={{ fontSize: 12, color: "#cbd5e1", margin: 0, lineHeight: 1.55 }}>{resultado.objetivo_post}</p>
              </div>
              <div style={{ background: "#1e2130", border: "1px solid #2d3148", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>🎙️ Tom de voz</div>
                <p style={{ fontSize: 12, color: "#cbd5e1", margin: 0, lineHeight: 1.55 }}>{resultado.tom}</p>
              </div>
            </div>

            {/* 7 — Dica de marketing */}
            <ResultSection label="7️⃣  Dica de marketing" icon="💡" bg="rgba(245,158,11,0.08)" border="rgba(245,158,11,0.25)" labelColor="#fbbf24">
              <p style={{ fontSize: 13, color: "#fde68a", lineHeight: 1.7, margin: 0 }}>
                {resultado.dica_marketing}
              </p>
            </ResultSection>

            {/* 9 — Próxima Ideia */}
            {resultado.proxima_ideia && (
              <div style={{
                background: "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(59,130,246,0.08) 100%)",
                border: "1px solid rgba(124,58,237,0.25)", borderRadius: 12, padding: "18px 20px",
                display: "flex", alignItems: "flex-start", gap: 14,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: "#7c3aed",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0,
                }}>💡</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5 }}>
                    Próxima sugestão de conteúdo
                  </div>
                  <p style={{ fontSize: 13, color: "#e9d5ff", lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                    {resultado.proxima_ideia}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </AdminShell>
  );
}

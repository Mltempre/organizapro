"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AdminShell from "../components/AdminShell";

// ─── Data ─────────────────────────────────────────────────────────────────────

const OBJETIVOS = [
  { id: "atrair",     icon: "📅", label: "Atrair novos pacientes" },
  { id: "avaliacoes", icon: "⭐", label: "Conseguir avaliações Google" },
  { id: "educar",     icon: "📚", label: "Educar pacientes" },
  { id: "engajar",    icon: "📱", label: "Engajar Instagram" },
  { id: "reels",      icon: "🎥", label: "Criar Reels" },
  { id: "carrossel",  icon: "📖", label: "Criar Carrossel" },
  { id: "campanha",   icon: "🎉", label: "Campanha Especial" },
  { id: "servico",    icon: "📢", label: "Promover um serviço" },
];

const ESPECIALIDADES = [
  {
    id: "dentista",
    icon: "🦷",
    label: "Dentista",
    chips: ["Implantes", "Lentes", "Ortodontia", "Clareamento", "Limpeza", "Harmonização", "Próteses", "Odontologia Estética"],
    procedimentosPrompt: "Implantes Dentários, Lentes de Contato Dental, Ortodontia, Clareamento Dental, Limpeza Profissional, Harmonização Facial, Próteses Dentárias, Odontologia Estética",
  },
  {
    id: "estetica",
    icon: "✨",
    label: "Estética",
    chips: ["Botox", "Bioestimuladores", "Laser", "Peeling", "Limpeza de Pele", "Preenchimento", "Emagrecimento", "Harmonização"],
    procedimentosPrompt: "Botox, Bioestimuladores de Colágeno, Laser Facial, Peeling Químico, Limpeza de Pele Profunda, Preenchimento Labial e Facial, Emagrecimento, Harmonização Facial",
  },
  {
    id: "dermatologista",
    icon: "🩺",
    label: "Dermatologista",
    chips: ["Acne", "Melasma", "Toxina Botulínica", "Laser", "Rejuvenescimento", "Queda de cabelo", "Câncer de pele", "Doenças da pele"],
    procedimentosPrompt: "Tratamento de Acne, Melasma, Toxina Botulínica Dermatológica, Laser Dermatológico, Rejuvenescimento Facial, Queda de Cabelo, Prevenção ao Câncer de Pele, Doenças da Pele",
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Objetivo      = typeof OBJETIVOS[number];
type Especialidade = typeof ESPECIALIDADES[number];

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

function buildPrompt(obj: Objetivo, esp: Especialidade): string {
  return `Você é um consultor especializado em marketing digital para clínicas de ${esp.label}, contratado pela ClínicaFlow. Crie conteúdos de alta conversão para Instagram de clínicas premium.

Objetivo deste post: ${obj.label}
Especialidade: ${esp.label}
Procedimentos: ${esp.procedimentosPrompt}

Retorne SOMENTE JSON puro, sem markdown, sem texto adicional:

{"gancho":"frase de abertura que paralisa o scroll (máximo 12 palavras, sem emojis, afirmativa e forte)","legenda":"corpo da legenda entre 130 e 180 palavras — linguagem consultiva, cite ao menos 1 procedimento específico, autoridade, máximo 3 emojis, SEM gancho e SEM CTA, termine com ponto final","cta_whatsapp":"CTA elegante para WhatsApp em 1 frase direta e convertedora","sugestao_imagem":"descreva exatamente a foto ou vídeo ideal: o que mostrar, ângulo, iluminação, ambiente e expressões — nunca genérico","hashtags_grandes":["8 hashtags reais acima de 100k seguidores como #odontologia #dentes #saude"],"hashtags_medias":["9 hashtags entre 10k e 100k como #clareamentodental #implantesdentarios"],"hashtags_nicho":["8 hashtags de micro-nicho abaixo de 10k como #implantesdentariossp #ortodontiaestetica"],"melhor_horario":"dia da semana, horário ideal e justificativa curta em 1 frase","objetivo_post":"Alcance, Engajamento, Conversão ou Autoridade — explique em 1 frase por que este post atende esse objetivo","tom":"descreva em até 6 palavras ex: Educativo com autoridade clínica","dica_marketing":"1 dica não óbvia para aumentar o desempenho deste post — algo que profissionais de marketing premium de clínicas fazem","proxima_ideia":"qual seria o próximo post estratégico para esta clínica — diga o formato e o tema específico em 1 frase inspiradora"}

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
        background: done ? "#7c3aed" : "#e2e8f0",
        color: done ? "#fff" : "#94a3b8",
        transition: "all 0.2s",
      }}>{n}</div>
      <span style={{ fontSize: 13, fontWeight: 700, color: done ? "#1e293b" : "#94a3b8", transition: "color 0.2s" }}>{label}</span>
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
  label, icon, children, bg = "#fff", border = "#e2e8f0", labelColor = "#475569",
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
  const [objetivo,      setObjetivo]      = useState<Objetivo | null>(null);
  const [especialidade, setEspecialidade] = useState<Especialidade | null>(null);
  const [resultado,     setResultado]     = useState<ConteudoResult | null>(null);
  const [rawError,      setRawError]      = useState("");
  const [loading,       setLoading]       = useState(false);
  const [copiado,       setCopiado]       = useState<"idle" | "ok" | "erro">("idle");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
    });
  }, [router]);

  const pronto = !!objetivo && !!especialidade;

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
        body: JSON.stringify({ prompt: buildPrompt(objetivo!, especialidade!), max_tokens: 1500 }),
      });

      const data = await res.json();
      if (!res.ok) { setRawError(data.error || "Erro ao gerar. Tente novamente."); setLoading(false); return; }

      const parsed = parseResult(data.content || "");
      if (parsed) {
        setResultado(parsed);
      } else {
        setRawError("A IA retornou um formato inesperado. Tente novamente.");
      }
    } catch {
      setRawError("Erro de conexão. Tente novamente.");
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
    ? { bg: "#f0fdf4", border: "#bbf7d0", color: "#16a34a" }
    : copiado === "erro"
    ? { bg: "#fef2f2", border: "#fecaca", color: "#dc2626" }
    : { bg: "#7c3aed", border: "#7c3aed", color: "#fff" };

  return (
    <AdminShell
      title="Biblioteca de Marketing"
      subtitle="Conteúdos profissionais criados por IA para ajudar sua clínica a atrair pacientes e fortalecer sua presença digital."
    >
      <main style={{ overflowY: "auto", padding: "28px 32px" }}>

        {/* ── Etapa 1: Objetivo ── */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "22px 24px", marginBottom: 16 }}>
          <StepLabel n={1} label="Qual seu objetivo hoje?" done={!!objetivo} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {OBJETIVOS.map(o => {
              const sel = objetivo?.id === o.id;
              return (
                <div key={o.id} onClick={() => { setObjetivo(o); setResultado(null); }}
                  style={{
                    background:  sel ? "#7c3aed" : "#f8fafc",
                    border:      sel ? "2px solid #7c3aed" : "2px solid #e2e8f0",
                    borderRadius: 10, padding: "14px 10px", cursor: "pointer",
                    textAlign:   "center", transition: "all 0.18s",
                    transform:   sel ? "scale(1.03)" : "scale(1)",
                    boxShadow:   sel ? "0 6px 20px rgba(124,58,237,0.22)" : "none",
                  }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", margin: "0 auto 8px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18,
                    background: sel ? "rgba(255,255,255,0.2)" : "#fff",
                    border:     sel ? "1px solid rgba(255,255,255,0.3)" : "1px solid #e2e8f0",
                    transition: "all 0.18s",
                  }}>{o.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: sel ? "#fff" : "#475569", lineHeight: 1.3 }}>
                    {o.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Etapa 2: Especialidade ── */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "22px 24px", marginBottom: 16 }}>
          <StepLabel n={2} label="Escolha sua especialidade" done={!!especialidade} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {ESPECIALIDADES.map(e => {
              const sel = especialidade?.id === e.id;
              return (
                <div key={e.id} onClick={() => { setEspecialidade(e); setResultado(null); }}
                  style={{
                    background:   sel ? "#f5f3ff" : "#fff",
                    border:       sel ? "2px solid #7c3aed" : "2px solid #e2e8f0",
                    borderRadius: 12, padding: "22px 18px", cursor: "pointer",
                    textAlign:    "center", transition: "all 0.2s",
                    boxShadow:    sel ? "0 6px 20px rgba(124,58,237,0.15)" : "0 1px 3px rgba(0,0,0,0.04)",
                    transform:    sel ? "scale(1.02)" : "scale(1)",
                  }}>
                  <div style={{ fontSize: sel ? 40 : 32, marginBottom: 10, transition: "font-size 0.2s" }}>{e.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: sel ? "#5b21b6" : "#1e293b", marginBottom: 12, transition: "color 0.2s" }}>
                    {e.label}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
                    {e.chips.map((chip, i) => (
                      <span key={i} style={{
                        background: sel ? "#ede9fe" : "#f1f5f9",
                        color:      sel ? "#7c3aed" : "#64748b",
                        border:     sel ? "1px solid #ddd6fe" : "1px solid #e2e8f0",
                        fontSize: 10, padding: "3px 8px", borderRadius: 5,
                        fontWeight: 500, transition: "all 0.2s",
                      }}>{chip}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Etapa 3: Gerar ── */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "22px 24px", marginBottom: 20 }}>
          <StepLabel n={3} label="Gerar conteúdo" done={false} />
          {!pronto ? (
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 14px" }}>
              Selecione o objetivo e a especialidade para liberar a geração.
            </p>
          ) : (
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 14px" }}>
              <span style={{ color: "#7c3aed", fontWeight: 600 }}>{objetivo!.icon} {objetivo!.label}</span>
              {" · "}
              <span style={{ color: "#7c3aed", fontWeight: 600 }}>{especialidade!.icon} {especialidade!.label}</span>
            </p>
          )}
          <button onClick={gerar} disabled={!pronto || loading}
            style={{
              padding: "13px 36px", borderRadius: 10, border: "none",
              background: pronto && !loading ? "#7c3aed" : "#e2e8f0",
              color:      pronto && !loading ? "#fff"    : "#94a3b8",
              fontSize: 14, fontWeight: 700,
              cursor:     pronto && !loading ? "pointer" : "not-allowed",
              transition: "all 0.2s",
              boxShadow:  pronto && !loading ? "0 4px 14px rgba(124,58,237,0.3)" : "none",
            }}>
            {loading ? "✨ Gerando conteúdo..." : "✨ Gerar Conteúdo Inteligente"}
          </button>
        </div>

        {/* ── Erro ── */}
        {rawError && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 18px", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "#dc2626" }}>❌ {rawError}</span>
          </div>
        )}

        {/* ── Resultado ── */}
        {resultado && (
          <div>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>✅ Conteúdo gerado</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  {objetivo!.icon} {objetivo!.label} · {especialidade!.icon} {especialidade!.label}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setResultado(null); setCopiado("idle"); }}
                  style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  🔄 Gerar novamente
                </button>
                <button onClick={copiarInstagram}
                  style={{
                    padding: "7px 18px", borderRadius: 8,
                    border:      `1px solid ${corCopiar.border}`,
                    background:  corCopiar.bg,
                    color:       corCopiar.color,
                    fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                  }}>
                  {copiado === "ok" ? "✅ Copiado!" : copiado === "erro" ? "❌ Erro" : "📋 Copiar para Instagram"}
                </button>
              </div>
            </div>

            {/* 1 — Gancho */}
            <ResultSection label="1️⃣  Chamada inicial — Gancho" icon="⚡" bg="#f5f3ff" border="#ddd6fe" labelColor="#7c3aed">
              <p style={{ fontSize: 20, fontWeight: 800, color: "#3b0764", lineHeight: 1.3, margin: 0 }}>
                {resultado.gancho}
              </p>
            </ResultSection>

            {/* 2 — Legenda */}
            <ResultSection label="2️⃣  Legenda" icon="✍️">
              <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.85, margin: 0, whiteSpace: "pre-wrap" }}>
                {resultado.legenda}
              </p>
            </ResultSection>

            {/* 3 — CTA */}
            <ResultSection label="3️⃣  CTA para WhatsApp" icon="💬" bg="#f0fdf4" border="#bbf7d0" labelColor="#16a34a">
              <p style={{ fontSize: 14, fontWeight: 600, color: "#15803d", margin: 0 }}>
                {resultado.cta_whatsapp}
              </p>
            </ResultSection>

            {/* 4 — Imagem */}
            <ResultSection label="4️⃣  Sugestão de imagem / vídeo" icon="📸" bg="#eff6ff" border="#bfdbfe" labelColor="#2563eb">
              <p style={{ fontSize: 13, color: "#1e3a8a", lineHeight: 1.7, margin: 0 }}>
                {resultado.sugestao_imagem}
              </p>
            </ResultSection>

            {/* 5 — Hashtags por categoria */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 18px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 }}>
                #️⃣  5️⃣  Hashtags
              </div>
              <HashGroup
                label="Grande alcance (100k+)"
                tags={resultado.hashtags_grandes ?? []}
                chipBg="#f1f5f9" chipColor="#334155" chipBorder="#e2e8f0"
              />
              <HashGroup
                label="Nicho da especialidade (10k–100k)"
                tags={resultado.hashtags_medias ?? []}
                chipBg="#f5f3ff" chipColor="#6d28d9" chipBorder="#ddd6fe"
              />
              <HashGroup
                label="Micro-nicho (abaixo de 10k)"
                tags={resultado.hashtags_nicho ?? []}
                chipBg="#ecfdf5" chipColor="#065f46" chipBorder="#a7f3d0"
              />
            </div>

            {/* 6 — Info row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>🕐 Melhor horário</div>
                <p style={{ fontSize: 12, color: "#334155", margin: 0, lineHeight: 1.55 }}>{resultado.melhor_horario}</p>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>🎯 Objetivo</div>
                <p style={{ fontSize: 12, color: "#334155", margin: 0, lineHeight: 1.55 }}>{resultado.objetivo_post}</p>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>🎙️ Tom de voz</div>
                <p style={{ fontSize: 12, color: "#334155", margin: 0, lineHeight: 1.55 }}>{resultado.tom}</p>
              </div>
            </div>

            {/* 7 — Dica de marketing */}
            <ResultSection label="7️⃣  Dica de marketing" icon="💡" bg="#fffbeb" border="#fde68a" labelColor="#b45309">
              <p style={{ fontSize: 13, color: "#78350f", lineHeight: 1.7, margin: 0 }}>
                {resultado.dica_marketing}
              </p>
            </ResultSection>

            {/* 9 — Próxima Ideia */}
            {resultado.proxima_ideia && (
              <div style={{
                background: "linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)",
                border: "1px solid #ddd6fe", borderRadius: 12, padding: "18px 20px",
                display: "flex", alignItems: "flex-start", gap: 14,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: "#7c3aed",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0,
                }}>💡</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5 }}>
                    Próxima sugestão de conteúdo
                  </div>
                  <p style={{ fontSize: 13, color: "#3b0764", lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
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

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AdminShell from "../components/AdminShell";
import { nivelAtual, proximoObjetivo } from "../../lib/raio-x";

type Gestao = {
  total_semana: number;
  confirmados_semana: number;
  faltas_semana: number;
  taxa_confirmacao: number | null;
  tendencia_confirmacao: number | null;
  reducao_faltas: number | null;
  total_historico: number;
};

type RaioXData = {
  metricas: {
    gestao: Gestao;
    pacientes: { total: number };
    reputacao: { nota_google: number | null; num_avaliacoes: number | null };
    site: {
      galeria: number; equipe: number; antes_depois: number;
      depoimentos: number; servicos: number; estrutura: number;
      has_logo: boolean; has_hero: boolean; has_slug: boolean;
    };
    automacao: { has_zapi: boolean };
  };
  indice: number;
  indice_breakdown: { gestao: number; site: number; reputacao: number; automacao: number; atividade: number };
  ai_diagnostico:   string;
  ai_pontos_fortes: string;
  ai_oportunidade:  string;
  ai_missao:        string;
  ai_motivacional:  string;
  assinatura:       string;
  nome_clinica: string;
  data_geracao: string;
};

function Trend({ v }: { v: number | null }) {
  if (v === null) return null;
  const stable = Math.abs(v) < 3;
  const color  = stable ? "#64748b" : v > 0 ? "#22c55e" : "#ef4444";
  const arrow  = stable ? "→" : v > 0 ? "↑" : "↓";
  return (
    <span style={{ color, fontSize: 12, fontWeight: 700 }}>
      {arrow} {stable ? "~" : v > 0 ? "+" : ""}{v}%
    </span>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 100, overflow: "hidden" }}>
      <div style={{
        height: "100%",
        width: `${Math.min((value / max) * 100, 100)}%`,
        background: color,
        borderRadius: 100,
        opacity: 0.85,
        transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
      }} />
    </div>
  );
}

type ConsultoriaCardProps = {
  icon: string;
  label: string;
  sublabel: string;
  accentColor: string;
  borderColor: string;
  bg: string;
  text: string;
};

function ConsultoriaCard({ icon, label, sublabel, accentColor, borderColor, bg, text }: ConsultoriaCardProps) {
  return (
    <div style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: 20, padding: "24px 24px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accentColor}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: accentColor, letterSpacing: 2, textTransform: "uppercase" }}>{label}</div>
          <div style={{ fontSize: 11, color: "#334155", marginTop: 2 }}>{sublabel}</div>
        </div>
      </div>
      <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.9, margin: 0, borderLeft: `3px solid ${accentColor}40`, paddingLeft: 14 }}>{text}</p>
    </div>
  );
}

export default function RaioX() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [data,    setData]    = useState<RaioXData | null>(null);
  const [erro,    setErro]    = useState("");

  const carregar = useCallback(async (recarregar = false) => {
    if (recarregar) setGerando(true);
    else            setLoading(true);
    setErro("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const res = await fetch("/api/raio-x", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) { setErro((await res.json()).error || "Erro ao gerar análise."); return; }
      setData(await res.json());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLoading(false);
      setGerando(false);
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  const hoje = new Date();
  const ini  = new Date(hoje); ini.setDate(hoje.getDate() - 6);
  const fmt  = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  const dataRange = `${fmt(ini)} — ${fmt(hoje)}/${hoje.getFullYear()}`;

  if (loading) {
    return (
      <AdminShell title="Raio-X da Clínica" subtitle="Consultoria inteligente personalizada">
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 380, gap: 18 }}>
          <div style={{ width: 56, height: 56, border: "3px solid rgba(124,58,237,0.15)", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <p style={{ color: "#7c3aed", fontSize: 15, fontWeight: 600, margin: 0 }}>Gerando sua análise executiva...</p>
          <p style={{ color: "#334155", fontSize: 12, margin: 0 }}>O consultor inteligente está analisando os dados da sua clínica</p>
        </div>
      </AdminShell>
    );
  }

  if (erro) {
    return (
      <AdminShell title="Raio-X da Clínica" subtitle="Consultoria inteligente personalizada">
        <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 18, padding: "36px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: "#f87171", fontSize: 15, margin: "0 0 20px" }}>{erro}</p>
          <button onClick={() => carregar()} style={{ padding: "10px 28px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Tentar novamente</button>
        </div>
      </AdminShell>
    );
  }

  if (!data) return null;

  const {
    metricas, indice, indice_breakdown: bd,
    ai_diagnostico, ai_pontos_fortes, ai_oportunidade, ai_missao, ai_motivacional,
    assinatura,
  } = data;

  const nivel   = nivelAtual(indice);
  const proximo = proximoObjetivo(indice);

  const metCards = [
    {
      icon: "📅", label: "Agendamentos", sub: "esta semana",
      value: metricas.gestao.total_semana.toString(),
      trend: null as number | null, color: "#6366f1",
    },
    {
      icon: "✅", label: "Taxa de Confirmação",
      sub: metricas.gestao.tendencia_confirmacao !== null
        ? `${metricas.gestao.tendencia_confirmacao >= 0 ? "+" : ""}${metricas.gestao.tendencia_confirmacao}% vs semana anterior`
        : "das consultas",
      value: metricas.gestao.taxa_confirmacao !== null ? `${metricas.gestao.taxa_confirmacao}%` : "—",
      trend: metricas.gestao.tendencia_confirmacao, color: "#22c55e",
    },
    {
      icon: "👤", label: "Total de Pacientes", sub: "cadastrados",
      value: metricas.pacientes.total.toString(),
      trend: null as number | null, color: "#00c896",
    },
    {
      icon: "⭐", label: "Nota Google",
      sub: metricas.reputacao.num_avaliacoes !== null
        ? `${metricas.reputacao.num_avaliacoes} avaliações` : "sem dados ainda",
      value: metricas.reputacao.nota_google !== null ? metricas.reputacao.nota_google.toFixed(1) : "—",
      trend: null as number | null, color: "#f59e0b",
    },
  ];

  const breakdownRows = [
    { l: "Gestão",    v: bd.gestao,    max: 25, c: "#00c896" },
    { l: "Site",      v: bd.site,      max: 25, c: "#3b82f6" },
    { l: "Google",    v: bd.reputacao, max: 20, c: "#f59e0b" },
    { l: "WhatsApp",  v: bd.automacao, max: 15, c: "#c084fc" },
    { l: "Atividade", v: bd.atividade, max: 15, c: "#f472b6" },
  ];

  return (
    <AdminShell title="📊 Raio-X da Clínica" subtitle={`Semana ${dataRange} · Consultoria executiva`}>

      {/* ── BOTÃO ATUALIZAR ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
        <button
          onClick={() => carregar(true)}
          disabled={gerando}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "9px 18px", borderRadius: 10,
            border: "1px solid rgba(124,58,237,0.3)",
            background: "rgba(124,58,237,0.08)",
            color: "#c4b5fd", fontSize: 13, fontWeight: 600,
            cursor: gerando ? "not-allowed" : "pointer",
            opacity: gerando ? 0.7 : 1,
          }}
        >
          {gerando ? "⟳ Gerando..." : "🔄 Atualizar Análise"}
        </button>
      </div>

      {/* ── ÍNDICE HERO ── */}
      <div style={{
        background: `linear-gradient(135deg, rgba(124,58,237,0.10), ${nivel.color}0d)`,
        border: `1px solid ${nivel.color}40`,
        borderRadius: 24, padding: "44px 24px 32px",
        textAlign: "center", marginBottom: 24,
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, color: "#475569", textTransform: "uppercase", marginBottom: 18 }}>
          Índice ClínicaFlow
        </div>
        <div style={{ fontSize: 96, fontWeight: 900, color: nivel.color, lineHeight: 1, letterSpacing: -4 }}>{indice}</div>
        <div style={{ fontSize: 20, color: "#334155", marginBottom: 20 }}>/100</div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: `${nivel.color}18`, border: `1px solid ${nivel.color}40`, borderRadius: 100, padding: "8px 24px", marginBottom: 20 }}>
          <span style={{ fontSize: 20 }}>{nivel.emoji}</span>
          <span style={{ color: nivel.color, fontSize: 15, fontWeight: 800 }}>{nivel.label}</span>
        </div>

        <div style={{ maxWidth: 420, margin: "0 auto" }}>
          <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${indice}%`, background: `linear-gradient(90deg,${nivel.color}88,${nivel.color})`, borderRadius: 100, transition: "width 1.2s ease" }} />
          </div>
        </div>

        {proximo ? (
          <div style={{ marginTop: 22, display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 20px" }}>
            <span style={{ fontSize: 14, color: "#64748b" }}>🎯</span>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>
              Faltam apenas{" "}
              <span style={{ color: "#f1f5f9", fontWeight: 800 }}>{proximo.pontosRestantes} ponto{proximo.pontosRestantes !== 1 ? "s" : ""}</span>
              {" "}para{" "}
              <span style={{ color: proximo.nivel.color, fontWeight: 700 }}>{proximo.nivel.emoji} {proximo.nivel.label}</span>
            </span>
          </div>
        ) : (
          <div style={{ marginTop: 22, display: "inline-flex", alignItems: "center", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "10px 20px" }}>
            <span style={{ fontSize: 13, color: "#f59e0b", fontWeight: 700 }}>🏆 Você atingiu o nível máximo. Parabéns!</span>
          </div>
        )}
      </div>

      {/* ── MÉTRICAS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 24 }}>
        {metCards.map(card => (
          <div key={card.label} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "18px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>{card.icon}</span>
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{card.label}</span>
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#475569" }}>{card.sub}</span>
              <Trend v={card.trend} />
            </div>
          </div>
        ))}
      </div>

      {/* ── DESTAQUES GESTÃO ── */}
      {(metricas.gestao.faltas_semana > 0 || (metricas.gestao.reducao_faltas !== null && metricas.gestao.reducao_faltas > 0)) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 24 }}>
          {metricas.gestao.faltas_semana > 0 && (
            <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#f87171" }}>{metricas.gestao.faltas_semana}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>falta(s) esta semana</div>
              </div>
            </div>
          )}
          {metricas.gestao.reducao_faltas !== null && metricas.gestao.reducao_faltas > 0 && (
            <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24 }}>📉</span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#22c55e" }}>{metricas.gestao.reducao_faltas}%</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>redução de faltas vs semana ant.</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          CONSULTORIA EXECUTIVA — 5 seções
          ══════════════════════════════════════════════════════════ */}

      <ConsultoriaCard
        icon="📋"
        label="Diagnóstico Executivo"
        sublabel="Visão geral da operação desta semana"
        accentColor="#00c896"
        borderColor="rgba(0,200,150,0.18)"
        bg="linear-gradient(135deg,rgba(0,200,150,0.05),rgba(99,102,241,0.03))"
        text={ai_diagnostico}
      />

      <ConsultoriaCard
        icon="💚"
        label="Pontos Fortes"
        sublabel="O que está funcionando bem"
        accentColor="#22c55e"
        borderColor="rgba(34,197,94,0.18)"
        bg="rgba(34,197,94,0.04)"
        text={ai_pontos_fortes}
      />

      <ConsultoriaCard
        icon="🚀"
        label="Principal Oportunidade"
        sublabel="A ação de maior impacto estratégico"
        accentColor="#f59e0b"
        borderColor="rgba(245,158,11,0.22)"
        bg="rgba(245,158,11,0.04)"
        text={ai_oportunidade}
      />

      {/* ── MISSÃO DA SEMANA ── */}
      <div style={{
        background: "linear-gradient(135deg,rgba(124,58,237,0.12),rgba(192,132,252,0.07))",
        border: "1px solid rgba(124,58,237,0.35)",
        borderRadius: 20, padding: "24px 24px", marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>🎯</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#c4b5fd", letterSpacing: 2, textTransform: "uppercase" }}>Missão da Semana</div>
            <div style={{ fontSize: 11, color: "#334155", marginTop: 2 }}>Ação prática e objetiva para esta semana</div>
          </div>
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.7, margin: 0 }}>{ai_missao}</p>
      </div>

      {/* ── PERSPECTIVA ── */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16, padding: "20px 24px", marginBottom: 28,
        textAlign: "center",
      }}>
        <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.85, margin: 0, fontStyle: "italic" }}>{ai_motivacional}</p>
      </div>

      {/* ── COMPOSIÇÃO DO ÍNDICE ── */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "24px 24px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 2, textTransform: "uppercase", marginBottom: 22 }}>
          Composição do Índice
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {breakdownRows.map(row => (
            <div key={row.l}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>{row.l}</span>
                <span style={{ fontSize: 13, color: row.c, fontWeight: 700 }}>
                  {row.v}<span style={{ color: "#334155", fontWeight: 400 }}>/{row.max}</span>
                </span>
              </div>
              <Bar value={row.v} max={row.max} color={row.c} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Índice Total</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: nivel.color }}>{indice}/100 {nivel.emoji}</span>
        </div>
      </div>

      {/* ── COMPLETUDE DO SITE ── */}
      <div style={{ marginTop: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "22px 24px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 2, textTransform: "uppercase", marginBottom: 18 }}>
          Completude do Site
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10 }}>
          {[
            { l: "Logo",         ok: metricas.site.has_logo                },
            { l: "Foto Hero",    ok: metricas.site.has_hero                },
            { l: "Link Único",   ok: metricas.site.has_slug                },
            { l: "Galeria",      ok: metricas.site.galeria     > 0, cnt: metricas.site.galeria     },
            { l: "Equipe",       ok: metricas.site.equipe      > 0, cnt: metricas.site.equipe      },
            { l: "Serviços",     ok: metricas.site.servicos    > 0, cnt: metricas.site.servicos    },
            { l: "Depoimentos",  ok: metricas.site.depoimentos > 0, cnt: metricas.site.depoimentos },
            { l: "Antes/Depois", ok: metricas.site.antes_depois > 0, cnt: metricas.site.antes_depois },
            { l: "Estrutura",    ok: metricas.site.estrutura   > 0, cnt: metricas.site.estrutura   },
          ].map(item => (
            <div key={item.l} style={{
              display: "flex", alignItems: "center", gap: 8,
              background: item.ok ? "rgba(0,200,150,0.06)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${item.ok ? "rgba(0,200,150,0.2)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: 10, padding: "10px 12px",
            }}>
              <span style={{ fontSize: 14 }}>{item.ok ? "✅" : "○"}</span>
              <div>
                <div style={{ fontSize: 11, color: item.ok ? "#00c896" : "#64748b", fontWeight: 600 }}>{item.l}</div>
                {item.cnt !== undefined && item.cnt > 0 && (
                  <div style={{ fontSize: 10, color: "#334155" }}>{item.cnt} item{item.cnt > 1 ? "s" : ""}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ASSINATURA PREMIUM ── */}
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
        <p style={{ fontSize: 11, color: "#334155", margin: 0, letterSpacing: 0.3 }}>{assinatura}</p>
      </div>

    </AdminShell>
  );
}

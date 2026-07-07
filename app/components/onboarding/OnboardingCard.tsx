"use client";
import { useState } from "react";
import ProgressBar from "./ProgressBar";
import ChecklistItem from "./ChecklistItem";

interface OnboardingCardProps {
  clinicaId: string;
  temEmpresa: boolean;
  temWhatsapp: boolean;
  temCliente: boolean;
  temCompromisso: boolean;
  onNavigate: (path: string) => void;
}

const chaveRecolhido = (clinicaId: string) => `op_onboarding_concluido_recolhido_${clinicaId}`;
const chaveVisto      = (clinicaId: string) => `op_onboarding_dashboard_visto_${clinicaId}`;

export default function OnboardingCard({
  clinicaId, temEmpresa, temWhatsapp, temCliente, temCompromisso, onNavigate,
}: OnboardingCardProps) {
  // clinicaId já chega resolvido no primeiro render (o Dashboard só monta
  // este componente depois de carregar os dados), então o localStorage pode
  // ser lido de forma preguiçosa no useState, sem precisar de um useEffect.
  const [dashboardVisto] = useState(() => {
    if (typeof window === "undefined" || !clinicaId) return false;
    localStorage.setItem(chaveVisto(clinicaId), "1");
    return true;
  });
  const [recolhidoSessao, setRecolhidoSessao] = useState(false);
  const [recolhidoConcluido, setRecolhidoConcluido] = useState(() => {
    if (typeof window === "undefined" || !clinicaId) return false;
    return localStorage.getItem(chaveRecolhido(clinicaId)) === "1";
  });

  const etapas = [
    { key: "empresa",     label: "Configurar dados da empresa",  done: temEmpresa,     path: "/configuracoes" },
    { key: "whatsapp",    label: "Configurar WhatsApp",          done: temWhatsapp,    path: "/configuracoes" },
    { key: "cliente",     label: "Cadastrar primeiro cliente",   done: temCliente,     path: "/pacientes"     },
    { key: "compromisso", label: "Criar primeiro compromisso",   done: temCompromisso, path: "/agendamentos"  },
    { key: "dashboard",   label: "Conhecer o Dashboard",         done: dashboardVisto, path: null as string | null },
  ];

  const concluidas = etapas.filter(e => e.done).length;
  const progresso = Math.round((concluidas / etapas.length) * 100);
  const completo = progresso === 100;

  function concluirEFechar() {
    if (clinicaId) localStorage.setItem(chaveRecolhido(clinicaId), "1");
    setRecolhidoConcluido(true);
  }

  if (completo && recolhidoConcluido) {
    return (
      <div className="dc" style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.18)",
        borderRadius: 12, padding: "10px 16px", marginBottom: 20,
        fontSize: 12, color: "#4ade80", fontWeight: 600,
      }}>
        ✅ Configuração concluída
      </div>
    );
  }

  if (!completo && recolhidoSessao) {
    return (
      <div
        className="dc ob-strip-hover"
        onClick={() => setRecolhidoSessao(false)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(74,155,176,0.08)", border: "1px solid rgba(74,155,176,0.2)",
          borderRadius: 12, padding: "12px 16px", marginBottom: 20, cursor: "pointer",
          transition: "background 0.15s",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
          🚀 Configuração pendente — {concluidas}/{etapas.length}
        </span>
        <span style={{ fontSize: 12, color: "#4a9bb0", fontWeight: 600 }}>Continuar →</span>
      </div>
    );
  }

  return (
    <div className="dc" style={{
      background: "linear-gradient(135deg, rgba(74,155,176,0.12), rgba(31,78,95,0.22))",
      border: "1px solid rgba(74,155,176,0.3)",
      borderRadius: 16, padding: "22px 24px", marginBottom: 20,
      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
    }}>
      <style>{`
        .ob-item-hover:hover { background: rgba(255,255,255,0.04); }
        .ob-strip-hover:hover { background: rgba(74,155,176,0.14) !important; }
        .ob-btn-continuar:hover { filter: brightness(1.1); }
        .ob-close-btn:hover { color: #e2e8f0 !important; }
      `}</style>

      {completo ? (
        <>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", marginBottom: 6 }}>
            🎉 Parabéns!
          </div>
          <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, margin: 0, maxWidth: 460 }}>
            Seu OrganizaPro está pronto para uso. Agora você pode aproveitar todos os recursos da plataforma.
          </p>
          <button
            className="ob-btn-continuar"
            onClick={concluirEFechar}
            style={{
              marginTop: 18, padding: "10px 24px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg,#1F4E5F,#0d3547)", color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "filter 0.15s",
            }}
          >
            Continuar
          </button>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>
                🚀 Configure seu OrganizaPro
              </div>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, margin: "6px 0 0" }}>
                Conclua as etapas abaixo para aproveitar todos os recursos da plataforma.
              </p>
            </div>
            <button
              className="ob-close-btn"
              onClick={() => setRecolhidoSessao(true)}
              aria-label="Recolher"
              style={{ background: "none", border: "none", color: "#64748b", fontSize: 18, cursor: "pointer", padding: 4, lineHeight: 1, flexShrink: 0, transition: "color 0.15s" }}
            >
              ×
            </button>
          </div>

          <div style={{ margin: "16px 0 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#4a9bb0", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Progresso
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#4a9bb0" }}>{progresso}%</span>
            </div>
            <ProgressBar percent={progresso} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {etapas.map(e => (
              <ChecklistItem
                key={e.key}
                label={e.label}
                done={e.done}
                onClick={e.path ? () => onNavigate(e.path!) : undefined}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

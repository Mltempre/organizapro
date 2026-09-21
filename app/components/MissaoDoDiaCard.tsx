"use client";
// ── 🧭 Diretor Digital — Bloco B da Casa (P1: Reintegração da Inteligência) ──
// Peça central da inteligência do OrganizaPro no Dashboard. Consolida em
// UM único bloco (nunca superfícies duplicadas) três motores que já
// existiam separadamente:
//
// 1. Narrativa do IA Comercial (lib/ia-comercial.ts, gerarNarrativaDiretor).
// 2. Missão do Dia / Próxima Melhor Ação — mesmos Sinais Canônicos
//    (lib/nucleo-inteligente.ts, gerarMissaoDoDia/organizarSinaisCanonicos),
//    agora com o botão de WhatsApp que só existia em ProximaMelhorAcao.tsx
//    (reaproveitado aqui via sinal.contexto.telefone — mesmo campo, mesma
//    fonte, nenhum motor novo).
// 3. Pulso da Central de Oportunidades (lib/recomendacoes.ts,
//    gerarCentralOportunidades) — só a CONTAGEM por tier (🔴/🟡/🟢), nunca
//    a grade completa de cartões que a Central antiga renderizava; isso
//    reconecta a inteligência da Central sem duplicar o que o Radar de
//    Oportunidades já mostra em detalhe logo abaixo.
//
// ProximaMelhorAcao.tsx, DiretorDigitalCard.tsx e CentralDeOportunidades.tsx
// continuam no repositório (nenhum arquivo apagado) — a FUNCIONALIDADE de
// cada um (CTA de WhatsApp, narrativa consultiva, pulso por tier) está
// reintegrada aqui, num único bloco coeso, em vez de três cartões
// separados como antes da Correção Visual Final.
import type { SinalCanonico } from "../../lib/nucleo-inteligente";
import { stTom, stTierOportunidade } from "./estilos-prioridade";

export type ContagemPorTier = { alta: number; media: number; baixa: number };

type Props = {
  narrativa?: string;
  sinais: SinalCanonico[];
  onNavigate: (destino: string) => void;
  titulo?: string;
  subtitulo?: string;
  /** Pulso da Central de Oportunidades — omitido quando não há dados
   * (nunca mostra 0/0/0 fabricado; ausência de prop = ausência de pulso). */
  contagemPorTier?: ContagemPorTier;
};

function numeroWhatsapp(telefone: string): string {
  return telefone.length > 11 ? telefone : `55${telefone}`;
}

export default function MissaoDoDiaCard({ narrativa, sinais, onNavigate, titulo, subtitulo, contagemPorTier }: Props) {
  const totalPulso = contagemPorTier ? contagemPorTier.alta + contagemPorTier.media + contagemPorTier.baixa : 0;

  return (
    <div className="dc" style={{
      background: "#12151f", border: "1px solid rgba(56,189,248,0.22)",
      borderRadius: 16, padding: "20px 22px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(56,189,248,0.16)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0,
        }}>
          🧭
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>
            {titulo ?? "Diretor Digital"}
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {subtitulo ?? "3 prioridades para hoje, com base no seu histórico real"}
          </div>
        </div>

        {/* Pulso da Central de Oportunidades — só contagem, nunca a grade completa */}
        {totalPulso > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["alta", "media", "baixa"] as const).map((tier) => {
              const n = contagemPorTier![tier];
              if (n === 0) return null;
              const meta = stTierOportunidade[tier];
              const cor = stTom[meta.tom];
              return (
                <span key={tier} style={{
                  padding: "3px 9px", borderRadius: 999,
                  background: cor.bg, border: `1px solid ${cor.border}`,
                  color: cor.color, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                }}>
                  {meta.emoji} {n}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {narrativa && (
        <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, margin: "0 0 14px" }}>
          {narrativa}
        </p>
      )}

      {sinais.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
          Nenhuma prioridade identificada agora — continue acompanhando seu negócio.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sinais.map((sinal, i) => {
            const cor = stTom[stTierOportunidade[sinal.prioridade].tom];
            const telefone = sinal.contexto?.telefone;
            const whatsapp = telefone
              ? `https://wa.me/${numeroWhatsapp(telefone)}?text=${encodeURIComponent(`Olá, ${sinal.contexto!.nome}! Tudo bem?`)}`
              : null;
            return (
              <div key={sinal.id} style={{
                display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap",
                background: "rgba(255,255,255,0.03)", border: `1px solid ${cor.border}`,
                borderRadius: 10, padding: "10px 14px",
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(74,155,176,0.16)", color: "#4a9bb0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800,
                }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 3 }}>
                    {sinal.titulo}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 2 }}>
                    {sinal.motivo}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#64748b", fontStyle: "italic" }}>
                    Evidência: {sinal.evidencia}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
                  {whatsapp && (
                    <a
                      href={whatsapp}
                      target="_blank" rel="noopener noreferrer"
                      style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: cor.color, color: "#0a0d14", fontSize: 11.5, fontWeight: 700, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap" }}
                    >
                      💬 WhatsApp
                    </a>
                  )}
                  {sinal.destino && (
                    <button
                      onClick={() => onNavigate(sinal.destino!)}
                      style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(74,155,176,0.35)", background: "rgba(74,155,176,0.1)", color: "#4a9bb0", fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      {sinal.destinoLabel || "Ver"} →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

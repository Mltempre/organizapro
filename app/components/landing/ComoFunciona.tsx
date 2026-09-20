"use client";

import { BellRing, MessageCircle, LayoutDashboard, Star } from "lucide-react";
import { useReveal } from "./useReveal";

// Rotina real do produto — cada etapa corresponde a uma automação/tela que
// existe de fato (confirmado no código: app/api/cron/*, app/chatbot,
// app/dashboard, app/reputacao). Nenhum horário aqui é uma promessa vaga:
// é o que a automação de fato dispara.
const ETAPAS = [
  {
    icon: BellRing,
    titulo: "Na véspera",
    desc: "Um lembrete do compromisso é enviado sozinho pelo WhatsApp, sem ninguém precisar lembrar.",
  },
  {
    icon: MessageCircle,
    titulo: "Durante o dia",
    desc: "Perguntas sobre horário, endereço e serviços são respondidas automaticamente no WhatsApp.",
  },
  {
    icon: LayoutDashboard,
    titulo: "Ao abrir o painel",
    desc: "Compromissos pendentes, clientes sem retorno e cancelamentos sem remarcação aparecem organizados — a prioridade do dia já vem destacada.",
  },
  {
    icon: Star,
    titulo: "Depois do atendimento",
    desc: "Um pedido de avaliação é enviado automaticamente, e a resposta do cliente fica registrada.",
  },
];

export default function ComoFunciona({ isMobile }: { isMobile: boolean }) {
  const [ref, cls] = useReveal<HTMLDivElement>();

  return (
    <section id="como-funciona" style={{ padding: isMobile ? "64px 20px" : "96px 40px", background: "var(--panel)" }}>
      <div ref={ref} className={cls} style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: isMobile ? 44 : 64 }}>
          <span className="section-tag">Como funciona</span>
          <h2 className="section-title">O OrganizaPro trabalha mesmo quando você não está olhando</h2>
          <p className="section-lead">Automações reais, rodando em produção — não lembretes manuais que dependem de alguém se lembrar.</p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)",
            gap: isMobile ? 28 : 22,
          }}
        >
          {ETAPAS.map((etapa, i) => (
            <div key={etapa.titulo} style={{ textAlign: "center", position: "relative" }}>
              {!isMobile && i < ETAPAS.length - 1 && <div className="etapa-connector" />}
              <div className="etapa-icon">
                <etapa.icon size={22} strokeWidth={2} />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 8px" }}>{etapa.titulo}</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>{etapa.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .etapa-connector {
          position: absolute; top: 27px; left: calc(50% + 42px);
          width: calc(100% - 84px); height: 2px; background: rgba(255,255,255,0.08);
          pointer-events: none;
        }
        .etapa-icon {
          width: 56px; height: 56px; border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), var(--accent-strong)); color: #fff;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 18px; position: relative; z-index: 1;
          box-shadow: 0 4px 18px rgba(31,78,95,0.35);
        }
      `}</style>
    </section>
  );
}

"use client";

import { Briefcase } from "lucide-react";
import { abrirWhatsapp } from "./whatsapp";

export default function CtaFinal({ isMobile }: { isMobile: boolean }) {
  return (
    <section style={{ padding: isMobile ? "72px 20px" : "110px 40px", background: "var(--panel)", textAlign: "center" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div className="cta-icone">
          <Briefcase size={26} strokeWidth={2} />
        </div>

        <h2 style={{ fontSize: isMobile ? 26 : 40, fontWeight: 900, color: "var(--text)", lineHeight: 1.25, margin: "0 0 16px", letterSpacing: "-0.3px" }}>
          Sua empresa já conquistou clientes.<br />
          <span style={{ color: "#4a9bb0" }}>Agora ela merece uma operação organizada.</span>
        </h2>

        <button
          className="btn-main btn-hero"
          style={{ fontSize: isMobile ? 16 : 18, padding: isMobile ? "16px 24px" : "18px 44px", marginTop: 22 }}
          onClick={() => abrirWhatsapp("Quero conhecer o OrganizaPro")}
        >
          Quero conhecer o OrganizaPro
        </button>

        <p style={{ marginTop: 16, fontSize: 13, color: "#64748b" }}>Atendimento via WhatsApp · Resposta rápida</p>
      </div>

      <style>{`
        .cta-icone {
          width: 64px; height: 64px; margin: 0 auto 22px; border-radius: 18px;
          background: linear-gradient(135deg, var(--accent), var(--accent-strong)); color: #fff;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 10px 28px rgba(31,78,95,0.4);
        }
      `}</style>
    </section>
  );
}

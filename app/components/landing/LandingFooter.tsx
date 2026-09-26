"use client";

import Link from "next/link";
import { Briefcase, MessageCircle } from "lucide-react";
import { linkWhatsapp } from "./whatsapp";
import { EMAIL_CONTATO } from "../legal/DocumentoLegal";

export default function LandingFooter({ isMobile }: { isMobile: boolean }) {
  return (
    <footer
      style={{
        background: "#080a10",
        padding: isMobile ? "24px 20px" : "28px 40px",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        textAlign: isMobile ? "center" : "left",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Briefcase size={16} color="#f1f5f9" />
        <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>OrganizaPro</span>
      </div>
      <div style={{ fontSize: 12, color: "#64748b" }}>© 2026 OrganizaPro. Todos os direitos reservados.</div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px 20px", flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/privacidade" style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>
          Política de Privacidade
        </Link>
        <Link href="/termos" style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>
          Termos de Uso
        </Link>
        <a href={`mailto:${EMAIL_CONTATO}`} style={{ fontSize: 12, color: "#64748b", textDecoration: "none", overflowWrap: "anywhere" }}>
          {EMAIL_CONTATO}
        </a>
        <Link href="/login" style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>
          Entrar no sistema
        </Link>
        <a
          href={linkWhatsapp("Quero falar com o OrganizaPro")}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: "#64748b", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}
        >
          <MessageCircle size={13} /> WhatsApp
        </a>
      </div>
    </footer>
  );
}

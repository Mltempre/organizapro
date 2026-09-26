import Link from "next/link";
import type { ReactNode } from "react";

// ── Documentos públicos (Política de Privacidade e Termos de Uso) ─────
// Páginas públicas: fora de ROTAS_COM_SHELL (sem sidebar, sem login).
// Fonte do texto: docs/politica-de-privacidade-v1.md e docs/termos-de-uso-v1.md,
// adaptados ao produto atual. O e-mail abaixo é o contato oficial publicado.
export const EMAIL_CONTATO = "contato@organizaprooficial.com.br";

const cor = { fundo: "#f4f6f8", papel: "#ffffff", texto: "#1f2937", suave: "#4b5563", borda: "#e5e7eb", destaque: "#0f766e" };

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 20, lineHeight: 1.35, margin: "0 0 12px", color: cor.texto }}>{titulo}</h2>
      <div style={{ fontSize: 16, lineHeight: 1.7, color: cor.suave }}>{children}</div>
    </section>
  );
}

export function EmailContato() {
  return <a href={`mailto:${EMAIL_CONTATO}`} style={{ color: cor.destaque, fontWeight: 600, overflowWrap: "anywhere" }}>{EMAIL_CONTATO}</a>;
}

export default function DocumentoLegal({ titulo, atualizadoEm, children }: { titulo: string; atualizadoEm: string; children: ReactNode }) {
  const link = { color: cor.suave, textDecoration: "none", fontSize: 14 } as const;
  return (
    <div style={{ minHeight: "100vh", background: cor.fundo, color: cor.texto, fontFamily: "Inter, sans-serif" }}>
      <header style={{ background: cor.papel, borderBottom: `1px solid ${cor.borda}` }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Link href="/" style={{ fontWeight: 800, fontSize: 18, color: cor.texto, textDecoration: "none" }}>OrganizaPro</Link>
          <Link href="/" style={link}>← Voltar ao site</Link>
        </div>
      </header>
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px 48px" }}>
        <article style={{ background: cor.papel, border: `1px solid ${cor.borda}`, borderRadius: 12, padding: "32px clamp(20px, 5vw, 48px)" }}>
          <h1 style={{ fontSize: "clamp(26px, 5vw, 34px)", lineHeight: 1.2, margin: 0 }}>{titulo}</h1>
          <p style={{ margin: "8px 0 0", color: cor.suave, fontSize: 14 }}>OrganizaPro — Plataforma de Gestão de Negócios · Última atualização: {atualizadoEm}</p>
          {children}
          <p style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${cor.borda}`, fontSize: 14, color: cor.suave }}>
            MLT EMPREENDIMENTOS DIGITAIS LTDA — OrganizaPro · © 2026
          </p>
        </article>
      </main>
      <footer style={{ borderTop: `1px solid ${cor.borda}`, background: cor.papel }}>
        <nav aria-label="Documentos e contato" style={{ maxWidth: 800, margin: "0 auto", padding: "20px", display: "flex", gap: "8px 24px", flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/privacidade" style={link}>Política de Privacidade</Link>
          <Link href="/termos" style={link}>Termos de Uso</Link>
          <a href={`mailto:${EMAIL_CONTATO}`} style={{ ...link, overflowWrap: "anywhere" }}>{EMAIL_CONTATO}</a>
        </nav>
      </footer>
    </div>
  );
}

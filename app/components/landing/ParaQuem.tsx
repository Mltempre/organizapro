"use client";

import { useReveal } from "./useReveal";

const AUDIENCIA = [
  { icon: "⚖️", label: "Advogados" },
  { icon: "✂️", label: "Barbearias" },
  { icon: "🏥", label: "Clínicas" },
  { icon: "🧠", label: "Psicólogos" },
  { icon: "🦴", label: "Fisioterapeutas" },
  { icon: "🧾", label: "Contadores" },
  { icon: "💅", label: "Estéticas" },
  { icon: "🔧", label: "Oficinas" },
  { icon: "🍽️", label: "Restaurantes" },
  { icon: "🐾", label: "Pet Shops" },
  { icon: "🏋️", label: "Academias" },
  { icon: "🏠", label: "Imobiliárias" },
];

export default function ParaQuem({ isMobile }: { isMobile: boolean }) {
  const [ref, cls] = useReveal<HTMLDivElement>();

  return (
    <section id="para-quem" style={{ padding: isMobile ? "64px 20px" : "96px 40px", background: "var(--bg)" }}>
      <div ref={ref} className={cls} style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: isMobile ? 36 : 52 }}>
          <span className="section-tag">Para quem</span>
          <h2 className="section-title">
            Para qualquer negócio<br />que atende com hora marcada
          </h2>
          <p className="section-lead">Se você tem agenda e precisa administrar clientes, o OrganizaPro organiza a operação inteira.</p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
            gap: 14,
            maxWidth: 800,
            margin: "0 auto",
          }}
        >
          {AUDIENCIA.map((p) => (
            <div key={p.label} className="card-soft" style={{ padding: "22px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>{p.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", lineHeight: 1.4 }}>{p.label}</div>
            </div>
          ))}
        </div>

        <p style={{ textAlign: "center", marginTop: 28, fontSize: 14, color: "#64748b" }}>
          E qualquer outro profissional autônomo ou pequeno negócio de serviços.
        </p>
      </div>
    </section>
  );
}

"use client";

import { X, Check } from "lucide-react";
import { useReveal } from "./useReveal";

const OUTROS = [
  "Guardam contatos e compromissos.",
  "Esperam você abrir e procurar o que precisa de atenção.",
  "Cada função — agenda, clientes, site — em uma ferramenta separada.",
  "Um sistema. Você que organiza.",
];

const ORGANIZAPRO = [
  "Organiza clientes, oportunidades e atendimento em um único lugar.",
  "Aponta sozinho o que precisa de atenção hoje, com base na sua agenda real.",
  "Agenda, clientes, site, conteúdo e reputação na mesma operação.",
  "Uma operação. Ele que organiza.",
];

export default function Diferenciacao({ isMobile }: { isMobile: boolean }) {
  const [ref, cls] = useReveal<HTMLDivElement>();

  return (
    <section style={{ padding: isMobile ? "64px 20px" : "96px 40px", background: "var(--panel)" }}>
      <div ref={ref} className={cls} style={{ maxWidth: 920, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: isMobile ? 36 : 52 }}>
          <span className="section-tag">Posicionamento</span>
          <h2 className="section-title">Sistema de agenda é uma coisa. Operação organizada é outra.</h2>
          <p className="section-lead">
            OrganizaPro não é mais um CRM genérico — é a plataforma que organiza clientes, oportunidades,
            atendimento e a operação comercial do seu negócio, junto.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 18 }}>
          <div className="comparacao-coluna comparacao-outros">
            <div className="comparacao-label comparacao-label-outros">Sistemas genéricos</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {OUTROS.map((item) => (
                <div key={item} className="comparacao-item comparacao-item-outros">
                  <X size={16} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="comparacao-coluna comparacao-organizapro">
            <div className="comparacao-label comparacao-label-organizapro">OrganizaPro</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {ORGANIZAPRO.map((item) => (
                <div key={item} className="comparacao-item comparacao-item-organizapro">
                  <Check size={16} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1, color: "#4a9bb0" }} />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .comparacao-coluna { border-radius: 18px; padding: 30px 26px; }
        .comparacao-outros { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); }
        .comparacao-organizapro { background: rgba(74,155,176,0.08); border: 1px solid rgba(74,155,176,0.35); }
        .comparacao-label { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 18px; }
        .comparacao-label-outros { color: #64748b; }
        .comparacao-label-organizapro { color: #4a9bb0; }
        .comparacao-item { display: flex; align-items: flex-start; gap: 10px; font-size: 14.5px; line-height: 1.55; }
        .comparacao-item-outros { color: #64748b; }
        .comparacao-item-organizapro { color: var(--text); font-weight: 500; }
      `}</style>
    </section>
  );
}
